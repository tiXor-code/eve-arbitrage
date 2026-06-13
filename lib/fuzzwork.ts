import 'server-only';
import type { AggSide, Aggregate } from './types';

// Fuzzwork market aggregates: pre-reduced best buy/sell (+ volume, percentile)
// per type per region, refreshed ~30 min. Used for the broad arbitrage scan so
// we don't paginate full regional order books. Drill-down uses raw ESI orders.

const FUZZ_BASE = 'https://market.fuzzwork.co.uk/aggregates/';
const BATCH = 500;
const CONCURRENCY = 4;

function userAgent(): string {
  return process.env.ESI_CONTACT
    ? `eve-arbitrage/0.1 (+${process.env.ESI_CONTACT})`
    : 'eve-arbitrage/0.1';
}

function toSide(o: unknown): AggSide {
  const r = (o ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => Number(v ?? 0) || 0;
  return {
    weightedAverage: n(r.weightedAverage),
    max: n(r.max),
    min: n(r.min),
    median: n(r.median),
    volume: n(r.volume),
    orderCount: n(r.orderCount),
    percentile: n(r.percentile),
  };
}

// A market scope is either a whole region or a single station. We scan with
// station scope so prices reflect what you can actually buy/sell AT the hub
// (a hauler trades at the station, not at scattered region stations).
export type Scope = { region: number } | { station: number };

function scopeQuery(s: Scope): string {
  return 'region' in s ? `region=${s.region}` : `station=${s.station}`;
}

async function fetchBatch(
  scope: Scope,
  ids: number[],
): Promise<Map<number, Aggregate>> {
  const url = `${FUZZ_BASE}?${scopeQuery(scope)}&types=${ids.join(',')}`;
  const res = await fetch(url, { headers: { 'User-Agent': userAgent() } });
  if (!res.ok) {
    throw new Error(
      `Fuzzwork ${res.status} for ${scopeQuery(scope)} (${ids.length} types)`,
    );
  }
  const json = (await res.json()) as Record<
    string,
    { buy: unknown; sell: unknown }
  >;
  const out = new Map<number, Aggregate>();
  for (const [idStr, v] of Object.entries(json)) {
    out.set(Number(idStr), { buy: toSide(v.buy), sell: toSide(v.sell) });
  }
  return out;
}

// Fetch aggregates for many types in one scope, batching to keep URLs short
// and capping concurrency to stay polite.
export async function fetchAggregates(
  scope: Scope,
  typeIds: number[],
): Promise<Map<number, Aggregate>> {
  const batches: number[][] = [];
  for (let i = 0; i < typeIds.length; i += BATCH) {
    batches.push(typeIds.slice(i, i + BATCH));
  }
  const result = new Map<number, Aggregate>();
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const maps = await Promise.all(
      batches.slice(i, i + CONCURRENCY).map((b) => fetchBatch(scope, b)),
    );
    for (const m of maps) for (const [k, v] of m) result.set(k, v);
  }
  return result;
}

export const __test = { BATCH };
