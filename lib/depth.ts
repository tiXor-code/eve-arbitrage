import 'server-only';
import { HUB_BY_KEY } from './hubs';
import { getTypeBook } from './market-cache';
import { getEsiType, type EsiOrder } from './esi';
import { getType } from './types-data';
import { simulateTrade } from './arbitrage';
import type {
  DepthResult,
  LadderLevel,
  Opportunity,
  WalkOrder,
} from './types';

// A destination buy order can fill our sale only if it reaches the hub station:
// physically at the hub, or a region-wide buy order. Jump/solarsystem ranged
// orders elsewhere can't be verified without route data, so we exclude them.
export function reachableAtHub(o: EsiOrder, hubLocationId: number): boolean {
  return o.location_id === hubLocationId || o.range === 'region';
}

export function buildLadder(
  orders: WalkOrder[],
  topN = 12,
): { ladder: LadderLevel[]; totalVolume: number } {
  let cum = 0;
  const totalVolume = orders.reduce((s, o) => s + o.volume, 0);
  const rows: LadderLevel[] = [];
  for (const o of orders.slice(0, topN)) {
    cum += o.volume;
    rows.push({ price: o.price, volume: o.volume, cumVolume: cum });
  }
  return { ladder: rows, totalVolume };
}

export interface ExactTrade {
  typeId: number;
  name: string;
  unitVolume: number;
  sourceHub: string;
  destHub: string;
  sells: WalkOrder[]; // source station sell orders, ascending price
  buys: WalkOrder[]; // dest reachable buy orders, descending price
  result: DepthResult;
}

export interface ExactOpts {
  cargoM3: number;
  budgetIsk: number;
  taxRate: number;
  useEsiVolume?: boolean; // fetch exact packaged_volume (drill-down only)
}

// Walk the real ESI order books for one (type, source, dest) and return the
// exact achievable trade. Shared by the scan (top candidates) and the
// drill-down, so their numbers are identical by construction.
export async function computeExactTrade(
  typeId: number,
  sourceKey: string,
  destKey: string,
  opts: ExactOpts,
): Promise<ExactTrade> {
  const source = HUB_BY_KEY[sourceKey];
  const dest = HUB_BY_KEY[destKey];

  const [sellRaw, buyRaw] = await Promise.all([
    getTypeBook(source.regionId, typeId, 'sell'),
    getTypeBook(dest.regionId, typeId, 'buy'),
  ]);

  const sells: WalkOrder[] = sellRaw
    .filter((o) => o.location_id === source.locationId)
    .map((o) => ({ price: o.price, volume: o.volume_remain, minVolume: o.min_volume }))
    .sort((a, b) => a.price - b.price);

  const buys: WalkOrder[] = buyRaw
    .filter((o) => reachableAtHub(o, dest.locationId))
    .map((o) => ({ price: o.price, volume: o.volume_remain, minVolume: o.min_volume }))
    .sort((a, b) => b.price - a.price);

  let unitVolume = getType(typeId)?.volume ?? 0;
  if (opts.useEsiVolume) {
    const t = await getEsiType(typeId).catch(() => null);
    unitVolume = t?.packaged_volume ?? t?.volume ?? unitVolume;
  }

  const result = simulateTrade(sells, buys, {
    unitVolume,
    cargoM3: opts.cargoM3,
    budgetIsk: opts.budgetIsk,
    taxRate: opts.taxRate,
  });

  return {
    typeId,
    name: getType(typeId)?.name ?? `Type ${typeId}`,
    unitVolume,
    sourceHub: sourceKey,
    destHub: destKey,
    sells,
    buys,
    result,
  };
}

// Convert an exact depth-walk into a ranked Opportunity, or null if it isn't a
// real, fillable trade.
export function exactToOpportunity(t: ExactTrade): Opportunity | null {
  const r = t.result;
  if (r.units < 1 || r.profit <= 0) return null;
  const unitMargin = r.profit / r.units;
  return {
    typeId: t.typeId,
    name: t.name,
    unitVolume: t.unitVolume,
    sourceHub: t.sourceHub,
    destHub: t.destHub,
    buyPrice: r.avgBuy,
    sellPrice: r.avgSell,
    rawSellMin: t.sells[0]?.price ?? 0,
    rawBuyMax: t.buys[0]?.price ?? 0,
    salesTaxRate: r.taxRate,
    unitMargin,
    marginPct: r.avgBuy > 0 ? unitMargin / r.avgBuy : 0,
    profitPerM3: t.unitVolume > 0 ? unitMargin / t.unitVolume : unitMargin,
    tripUnits: r.units,
    tripProfit: r.profit,
    capitalRequired: r.cost,
    liquidityUnits: r.units,
    limiter: r.limiter,
  };
}

// Concurrency-limited map for the candidate depth-walks.
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return out;
}
