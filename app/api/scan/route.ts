import { NextResponse } from 'next/server';
import { HUB_BY_KEY, HUB_KEYS } from '@/lib/hubs';
import { getHubAggregates } from '@/lib/market-cache';
import { allTypeIds, getType } from '@/lib/types-data';
import { rankOpportunities, salesTaxRate } from '@/lib/arbitrage';
import { computeExactTrade, exactToOpportunity, mapLimit } from '@/lib/depth';
import type { Aggregate, Opportunity, PriceBasis, TypeQuotes } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// How many Fuzzwork-ranked candidates get the exact ESI depth-walk. Generous
// enough that the true top opportunities are in the set; bounded to keep ESI
// usage sane. Each candidate costs ~2 cached ESI calls.
const CANDIDATES = 200;
const DEPTH_CONCURRENCY = 12;

interface ScanBody {
  sourceHub?: string;
  destHub?: string;
  cargoM3?: number;
  budgetIsk?: number;
  accountingLevel?: number;
  priceBasis?: PriceBasis;
  minMarginPct?: number;
  minTripProfit?: number;
  minVolume?: number;
  limit?: number;
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function resolveHubs(value: string | undefined): string[] | null {
  if (!value || value === 'any') return [...HUB_KEYS];
  if (HUB_BY_KEY[value]) return [value];
  return null;
}

export async function POST(req: Request): Promise<Response> {
  let body: ScanBody;
  try {
    body = (await req.json()) as ScanBody;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const sourceHubs = resolveHubs(body.sourceHub);
  const destHubs = resolveHubs(body.destHub);
  if (!sourceHubs || !destHubs) {
    return NextResponse.json({ error: 'unknown hub' }, { status: 400 });
  }
  if (sourceHubs.length === 1 && destHubs.length === 1 && sourceHubs[0] === destHubs[0]) {
    return NextResponse.json(
      { error: 'source and destination hubs must differ' },
      { status: 400 },
    );
  }

  const cargoM3 = Math.max(0, num(body.cargoM3, 60000));
  const budgetIsk = Math.max(0, num(body.budgetIsk, 500_000_000));
  const accountingLevel = Math.max(0, Math.min(5, num(body.accountingLevel, 0)));
  const taxRate = salesTaxRate(accountingLevel);
  const priceBasis: PriceBasis = body.priceBasis === 'best' ? 'best' : 'percentile';
  const minMarginPct = Math.max(0, num(body.minMarginPct, 5)) / 100;
  const minTripProfit = Math.max(0, num(body.minTripProfit, 0));
  const minVolume = Math.max(0, num(body.minVolume, 1));
  const limit = Math.max(1, Math.min(200, num(body.limit, 50)));

  // Stage 1: cheap Fuzzwork station aggregates -> rough candidates.
  const hubSet = [...new Set([...sourceHubs, ...destHubs])];
  let aggByHub: Map<string, Map<number, Aggregate>>;
  try {
    const entries = await Promise.all(
      hubSet.map(
        async (k) => [k, await getHubAggregates(HUB_BY_KEY[k].locationId)] as const,
      ),
    );
    aggByHub = new Map(entries);
  } catch (err) {
    return NextResponse.json(
      { error: `market data fetch failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const quotes: TypeQuotes[] = [];
  for (const id of allTypeIds()) {
    const t = getType(id);
    if (!t) continue;
    const hubs: Record<string, Aggregate> = {};
    let any = false;
    for (const k of hubSet) {
      const a = aggByHub.get(k)?.get(id);
      if (a) {
        hubs[k] = a;
        any = true;
      }
    }
    if (any) quotes.push({ typeId: id, name: t.name, unitVolume: t.volume, hubs });
  }

  // Rough ranking gates candidates. Because percentile margin >= achievable
  // margin, this never drops a genuinely profitable item from the candidate set.
  const candidates = rankOpportunities(quotes, {
    sourceHubs,
    destHubs,
    cargoM3,
    budgetIsk,
    accountingLevel,
    priceBasis,
    minMarginPct,
    minTripProfit: 0,
    minVolume,
    limit: CANDIDATES,
  });

  // Stage 2: exact depth-walk over real ESI order books for each candidate.
  let exact: (Opportunity | null)[];
  try {
    exact = await mapLimit(candidates, DEPTH_CONCURRENCY, async (c) => {
      try {
        const trade = await computeExactTrade(c.typeId, c.sourceHub, c.destHub, {
          cargoM3,
          budgetIsk,
          taxRate,
        });
        return exactToOpportunity(trade);
      } catch {
        return null;
      }
    });
  } catch (err) {
    return NextResponse.json(
      { error: `order-book walk failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const opportunities = exact
    .filter((o): o is Opportunity => o !== null)
    .filter((o) => o.marginPct >= minMarginPct && o.tripProfit >= minTripProfit)
    .sort((a, b) => b.tripProfit - a.tripProfit)
    .slice(0, limit);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: opportunities.length,
    candidatesWalked: candidates.length,
    opportunities,
    params: {
      sourceHub: body.sourceHub ?? 'any',
      destHub: body.destHub ?? 'any',
      cargoM3,
      budgetIsk,
      accountingLevel,
      salesTaxRate: taxRate,
      priceBasis,
    },
  });
}
