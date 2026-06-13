// The five major NPC trade hubs. Market data at these stations is fully public
// (no SSO scope needed). locationId is the station ID, used to check whether a
// buy order is reachable from the hub when filling orders.

export interface Hub {
  key: string;
  name: string;
  station: string;
  regionId: number;
  regionName: string;
  locationId: number;
}

export const HUBS: readonly Hub[] = [
  {
    key: 'jita',
    name: 'Jita',
    station: 'Jita IV-4 Caldari Navy Assembly Plant',
    regionId: 10000002,
    regionName: 'The Forge',
    locationId: 60003760,
  },
  {
    key: 'amarr',
    name: 'Amarr',
    station: 'Amarr VIII (Oris) Emperor Family Academy',
    regionId: 10000043,
    regionName: 'Domain',
    locationId: 60008494,
  },
  {
    key: 'dodixie',
    name: 'Dodixie',
    station: 'Dodixie IX-20 Federation Navy Assembly Plant',
    regionId: 10000032,
    regionName: 'Sinq Laison',
    locationId: 60011866,
  },
  {
    key: 'rens',
    name: 'Rens',
    station: 'Rens VI-8 Brutor Tribe Treasury',
    regionId: 10000030,
    regionName: 'Heimatar',
    locationId: 60005686,
  },
  {
    key: 'hek',
    name: 'Hek',
    station: 'Hek VIII-12 Boundless Creation Factory',
    regionId: 10000042,
    regionName: 'Metropolis',
    locationId: 60002959,
  },
] as const;

export const HUB_BY_KEY: Record<string, Hub> = Object.fromEntries(
  HUBS.map((h) => [h.key, h]),
);

export const HUB_KEYS: string[] = HUBS.map((h) => h.key);

export function hubByRegion(regionId: number): Hub | undefined {
  return HUBS.find((h) => h.regionId === regionId);
}
