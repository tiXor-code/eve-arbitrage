import type {
  Aggregate,
  Limiter,
  Opportunity,
  PriceBasis,
  RankParams,
  TypeQuotes,
} from './types';

// Core arbitrage math. Pure and dependency-free so it can be unit-tested and
// imported from anywhere. Mechanic: buy from the lowest sell orders at a source
// hub, haul, and immediately fill the highest buy orders at a destination hub.
// Filling an existing buy order costs sales tax only (no broker fee).

export const BASE_SALES_TAX = 0.075; // base sell-side tax; verify vs current patch

export function salesTaxRate(accountingLevel: number): number {
  const lvl = Math.max(0, Math.min(5, Math.floor(accountingLevel)));
  return Math.max(0, BASE_SALES_TAX - 0.009 * lvl);
}

// Cost to acquire one unit at the source = lowest sell orders. With the
// 'percentile' basis we use Fuzzwork's volume-weighted top-5% price so a single
// tiny order can't distort the estimate; fall back to the raw best.
function buyCost(a: Aggregate, basis: PriceBasis): number {
  if (basis === 'percentile') return a.sell.percentile || a.sell.min;
  return a.sell.min;
}

// Revenue from selling one unit into destination buy orders = highest buy
// orders (percentile-weighted by default).
function sellRevenue(a: Aggregate, basis: PriceBasis): number {
  if (basis === 'percentile') return a.buy.percentile || a.buy.max;
  return a.buy.max;
}

export interface ComputeInput {
  unitVolume: number;
  cargoM3: number;
  budgetIsk: number;
  taxRate: number;
  src: Aggregate;
  dst: Aggregate;
  basis: PriceBasis;
}

type PairResult = Omit<
  Opportunity,
  'typeId' | 'name' | 'unitVolume' | 'sourceHub' | 'destHub'
>;

// Compute the achievable trade for one (source, dest) pair, or null if it isn't
// profitable. tripUnits is capped by cargo, capital, and available liquidity.
export function computePair(input: ComputeInput): PairResult | null {
  const { unitVolume, cargoM3, budgetIsk, taxRate, src, dst, basis } = input;
  const buyPrice = buyCost(src, basis);
  const sellPrice = sellRevenue(dst, basis);
  if (buyPrice <= 0 || sellPrice <= 0) return null;

  const unitMargin = sellPrice * (1 - taxRate) - buyPrice;
  if (unitMargin <= 0) return null;

  const marginPct = unitMargin / buyPrice;
  const profitPerM3 = unitVolume > 0 ? unitMargin / unitVolume : unitMargin;

  const liquidityUnits = Math.floor(Math.min(src.sell.volume, dst.buy.volume));
  const maxByCargo =
    unitVolume > 0 ? Math.floor(cargoM3 / unitVolume) : Number.POSITIVE_INFINITY;
  const maxByCapital = buyPrice > 0 ? Math.floor(budgetIsk / buyPrice) : 0;

  let tripUnits = Math.min(maxByCargo, maxByCapital, liquidityUnits);
  if (!Number.isFinite(tripUnits)) tripUnits = Math.min(maxByCapital, liquidityUnits);
  tripUnits = Math.max(0, tripUnits);

  let limiter: Limiter = 'liquidity';
  if (tripUnits === maxByCargo) limiter = 'cargo';
  else if (tripUnits === maxByCapital) limiter = 'capital';

  return {
    buyPrice,
    sellPrice,
    rawSellMin: src.sell.min,
    rawBuyMax: dst.buy.max,
    salesTaxRate: taxRate,
    unitMargin,
    marginPct,
    profitPerM3,
    tripUnits,
    tripProfit: tripUnits * unitMargin,
    capitalRequired: tripUnits * buyPrice,
    liquidityUnits,
    limiter,
  };
}

// For each item, pick the best (source -> dest) pair by achievable trip profit,
// apply liquidity/quality filters, and return the top opportunities.
export function rankOpportunities(
  types: TypeQuotes[],
  params: RankParams,
): Opportunity[] {
  const basis = params.priceBasis ?? 'percentile';
  const taxRate = salesTaxRate(params.accountingLevel);
  const minMarginPct = params.minMarginPct ?? 0.05;
  const maxMarginPct = params.maxMarginPct ?? 5;
  const minTripProfit = params.minTripProfit ?? 0;
  const minVolume = params.minVolume ?? 1;

  const out: Opportunity[] = [];

  for (const t of types) {
    let best: Opportunity | null = null;
    for (const sh of params.sourceHubs) {
      const src = t.hubs[sh];
      if (!src) continue;
      for (const dh of params.destHubs) {
        if (sh === dh) continue;
        const dst = t.hubs[dh];
        if (!dst) continue;
        const r = computePair({
          unitVolume: t.unitVolume,
          cargoM3: params.cargoM3,
          budgetIsk: params.budgetIsk,
          taxRate,
          src,
          dst,
          basis,
        });
        if (!r) continue;
        if (!best || r.tripProfit > best.tripProfit) {
          best = {
            typeId: t.typeId,
            name: t.name,
            unitVolume: t.unitVolume,
            sourceHub: sh,
            destHub: dh,
            ...r,
          };
        }
      }
    }
    if (!best) continue;
    if (best.marginPct < minMarginPct) continue;
    if (best.marginPct > maxMarginPct) continue;
    if (best.tripProfit < minTripProfit) continue;
    if (best.liquidityUnits < minVolume) continue;
    if (best.tripUnits < 1) continue;
    out.push(best);
  }

  out.sort((a, b) => b.tripProfit - a.tripProfit);
  return out.slice(0, params.limit ?? 200);
}
