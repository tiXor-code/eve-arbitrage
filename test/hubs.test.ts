import { describe, it, expect } from 'vitest';
import { HUBS, HUB_BY_KEY, HUB_KEYS, hubByRegion } from '@/lib/hubs';

describe('hubs', () => {
  it('has the 5 major trade hubs', () => {
    expect(HUBS).toHaveLength(5);
    expect(HUB_KEYS).toEqual(['jita', 'amarr', 'dodixie', 'rens', 'hek']);
  });

  it('has unique region and location ids', () => {
    expect(new Set(HUBS.map((h) => h.regionId)).size).toBe(5);
    expect(new Set(HUBS.map((h) => h.locationId)).size).toBe(5);
  });

  it('pins Jita to The Forge', () => {
    expect(HUB_BY_KEY.jita.regionId).toBe(10000002);
    expect(HUB_BY_KEY.jita.locationId).toBe(60003760);
  });

  it('resolves a hub by region id', () => {
    expect(hubByRegion(10000043)?.name).toBe('Amarr');
    expect(hubByRegion(999)).toBeUndefined();
  });
});
