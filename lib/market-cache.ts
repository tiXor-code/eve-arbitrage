import 'server-only';
import type { Aggregate } from './types';
import { fetchAggregates } from './fuzzwork';
import { getTypeOrders, type EsiOrder } from './esi';
import { allTypeIds } from './types-data';

// Per-station aggregate cache. Fuzzwork refreshes ~every 30 min, so we cache a
// full station snapshot for that long. The first scan touching a hub is slow
// (one Fuzzwork sweep over all market types); subsequent scans are instant.

const TTL_MS = 30 * 60 * 1000;

interface Entry {
  at: number;
  data: Map<number, Aggregate>;
}

const cache = new Map<number, Entry>();
const inflight = new Map<number, Promise<Map<number, Aggregate>>>();

// Aggregates scoped to a hub's NPC station (what you can actually buy/sell at
// the hub), keyed by station/location id.
export async function getHubAggregates(
  stationId: number,
): Promise<Map<number, Aggregate>> {
  const hit = cache.get(stationId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  // Coalesce concurrent requests for the same station into one fetch.
  const existing = inflight.get(stationId);
  if (existing) return existing;

  const p = (async () => {
    try {
      const data = await fetchAggregates({ station: stationId }, allTypeIds());
      cache.set(stationId, { at: Date.now(), data });
      return data;
    } finally {
      inflight.delete(stationId);
    }
  })();
  inflight.set(stationId, p);
  return p;
}

export function cacheStatus(): { stationId: number; ageMs: number; size: number }[] {
  const now = Date.now();
  return [...cache.entries()].map(([stationId, e]) => ({
    stationId,
    ageMs: now - e.at,
    size: e.data.size,
  }));
}

// --- Per-type order-book cache (raw ESI orders for one type in one region) ---
// Shared by the scan's exact depth-walk and the drill-down. ESI orders cache
// ~5 min, so we hold each type book that long.

const BOOK_TTL_MS = 5 * 60 * 1000;

interface BookEntry {
  at: number;
  data: EsiOrder[];
}

const bookCache = new Map<string, BookEntry>();
const bookInflight = new Map<string, Promise<EsiOrder[]>>();

export async function getTypeBook(
  regionId: number,
  typeId: number,
  side: 'buy' | 'sell',
): Promise<EsiOrder[]> {
  const key = `${regionId}:${typeId}:${side}`;
  const hit = bookCache.get(key);
  if (hit && Date.now() - hit.at < BOOK_TTL_MS) return hit.data;

  const existing = bookInflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      const data = await getTypeOrders(regionId, typeId, side);
      bookCache.set(key, { at: Date.now(), data });
      return data;
    } finally {
      bookInflight.delete(key);
    }
  })();
  bookInflight.set(key, p);
  return p;
}
