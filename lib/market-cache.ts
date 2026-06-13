import 'server-only';
import type { Aggregate } from './types';
import { fetchAggregates } from './fuzzwork';
import { allTypeIds } from './types-data';

// Per-region aggregate cache. Fuzzwork refreshes ~every 30 min, so we cache a
// full region snapshot for that long. The first scan touching a region is slow
// (one Fuzzwork sweep over all market types); subsequent scans are instant.

const TTL_MS = 30 * 60 * 1000;

interface Entry {
  at: number;
  data: Map<number, Aggregate>;
}

const cache = new Map<number, Entry>();
const inflight = new Map<number, Promise<Map<number, Aggregate>>>();

export async function getRegionAggregates(
  regionId: number,
): Promise<Map<number, Aggregate>> {
  const hit = cache.get(regionId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  // Coalesce concurrent requests for the same region into one fetch.
  const existing = inflight.get(regionId);
  if (existing) return existing;

  const p = (async () => {
    try {
      const data = await fetchAggregates(regionId, allTypeIds());
      cache.set(regionId, { at: Date.now(), data });
      return data;
    } finally {
      inflight.delete(regionId);
    }
  })();
  inflight.set(regionId, p);
  return p;
}

export function cacheStatus(): { regionId: number; ageMs: number; size: number }[] {
  const now = Date.now();
  return [...cache.entries()].map(([regionId, e]) => ({
    regionId,
    ageMs: now - e.at,
    size: e.data.size,
  }));
}
