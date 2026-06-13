import { describe, it, expect } from 'vitest';
import {
  BASE_SALES_TAX,
  salesTaxRate,
  computePair,
  rankOpportunities,
} from '@/lib/arbitrage';
import type { Aggregate, TypeQuotes } from '@/lib/types';

function side(over: Partial<Aggregate['buy']> = {}): Aggregate['buy'] {
  return {
    weightedAverage: 0,
    max: 0,
    min: 0,
    median: 0,
    volume: 0,
    orderCount: 0,
    percentile: 0,
    ...over,
  };
}

// A hub quote where you can BUY cheap (sell orders at `sellPrice`) and/or SELL
// into buy orders at `buyPrice`, each with `vol` units of depth.
function agg(opts: { sellPrice?: number; buyPrice?: number; vol?: number }): Aggregate {
  const vol = opts.vol ?? 1_000_000;
  return {
    sell:
      opts.sellPrice != null
        ? side({ min: opts.sellPrice, percentile: opts.sellPrice, volume: vol, orderCount: 5 })
        : side(),
    buy:
      opts.buyPrice != null
        ? side({ max: opts.buyPrice, percentile: opts.buyPrice, volume: vol, orderCount: 5 })
        : side(),
  };
}

describe('salesTaxRate', () => {
  it('is the base rate at Accounting 0', () => {
    expect(salesTaxRate(0)).toBeCloseTo(BASE_SALES_TAX);
  });
  it('drops 0.9% per level, to 3% at level 5', () => {
    expect(salesTaxRate(5)).toBeCloseTo(0.03);
  });
  it('clamps out-of-range levels', () => {
    expect(salesTaxRate(-3)).toBeCloseTo(BASE_SALES_TAX);
    expect(salesTaxRate(99)).toBeCloseTo(0.03);
  });
});

describe('computePair', () => {
  const base = {
    unitVolume: 1,
    cargoM3: 1_000_000,
    budgetIsk: 1_000_000_000,
    taxRate: 0,
    basis: 'percentile' as const,
  };

  it('computes net margin after tax', () => {
    const r = computePair({
      ...base,
      taxRate: 0.05,
      src: agg({ sellPrice: 100 }),
      dst: agg({ buyPrice: 120 }),
    })!;
    // 120 * (1 - 0.05) - 100 = 14
    expect(r.unitMargin).toBeCloseTo(14);
    expect(r.marginPct).toBeCloseTo(0.14);
  });

  it('returns null when not profitable', () => {
    const r = computePair({
      ...base,
      taxRate: 0.05,
      src: agg({ sellPrice: 120 }),
      dst: agg({ buyPrice: 120 }),
    });
    expect(r).toBeNull();
  });

  it('caps trip units by cargo when cargo is the binding constraint', () => {
    const r = computePair({
      ...base,
      unitVolume: 10, // 10 m³ each
      cargoM3: 1000, // -> 100 units fit
      src: agg({ sellPrice: 100, vol: 10_000 }),
      dst: agg({ buyPrice: 200, vol: 10_000 }),
    })!;
    expect(r.tripUnits).toBe(100);
    expect(r.limiter).toBe('cargo');
    expect(r.tripProfit).toBeCloseTo(100 * (200 - 100));
  });

  it('caps trip units by capital when budget is the binding constraint', () => {
    const r = computePair({
      ...base,
      unitVolume: 0.01,
      cargoM3: 1_000_000,
      budgetIsk: 1000, // at 100/unit -> 10 units
      src: agg({ sellPrice: 100, vol: 10_000 }),
      dst: agg({ buyPrice: 200, vol: 10_000 }),
    })!;
    expect(r.tripUnits).toBe(10);
    expect(r.limiter).toBe('capital');
  });

  it('caps trip units by liquidity when depth is the binding constraint', () => {
    const r = computePair({
      ...base,
      unitVolume: 0.01,
      src: agg({ sellPrice: 100, vol: 7 }),
      dst: agg({ buyPrice: 200, vol: 5 }), // thinner side = 5 units
    })!;
    expect(r.tripUnits).toBe(5);
    expect(r.limiter).toBe('liquidity');
  });

  it('falls back from percentile to best when percentile is zero', () => {
    const src: Aggregate = { sell: side({ min: 100, percentile: 0, volume: 100 }), buy: side() };
    const dst: Aggregate = { buy: side({ max: 200, percentile: 0, volume: 100 }), sell: side() };
    const r = computePair({ ...base, src, dst })!;
    expect(r.buyPrice).toBe(100);
    expect(r.sellPrice).toBe(200);
  });
});

describe('rankOpportunities', () => {
  function quote(typeId: number, name: string, hubs: Record<string, Aggregate>, unitVolume = 1): TypeQuotes {
    return { typeId, name, unitVolume, hubs };
  }

  const params = {
    sourceHubs: ['jita', 'hek'],
    destHubs: ['jita', 'amarr'],
    cargoM3: 1_000_000,
    budgetIsk: 1_000_000_000,
    accountingLevel: 0,
    minMarginPct: 0.05,
    minTripProfit: 0,
    minVolume: 1,
  };

  it('picks the most profitable source→dest pair per item', () => {
    const item = quote(34, 'Tritanium', {
      jita: agg({ sellPrice: 5, buyPrice: 6, vol: 1000 }),
      hek: agg({ sellPrice: 3, buyPrice: 4, vol: 1000 }), // buy cheap here
      amarr: agg({ buyPrice: 9, vol: 1000 }), // sell high here
    });
    const [best] = rankOpportunities([item], params);
    expect(best.sourceHub).toBe('hek');
    expect(best.destHub).toBe('amarr');
    // 9 * (1 - 0.075 tax) - 3 = 5.325
    expect(best.unitMargin).toBeCloseTo(9 * (1 - 0.075) - 3);
  });

  it('filters out items below the min margin', () => {
    const item = quote(35, 'Pyerite', {
      hek: agg({ sellPrice: 100, vol: 1000 }),
      amarr: agg({ buyPrice: 103, vol: 1000 }), // ~3% margin < 5%
    });
    expect(rankOpportunities([item], params)).toHaveLength(0);
  });

  it('drops absurd margins above maxMarginPct (data artifacts)', () => {
    const item = quote(36, 'Glitch', {
      hek: agg({ sellPrice: 1, vol: 1000 }),
      amarr: agg({ buyPrice: 10_000, vol: 1000 }), // 1,000,000% margin
    });
    expect(rankOpportunities([item], { ...params, maxMarginPct: 5 })).toHaveLength(0);
  });

  it('sorts by trip profit descending', () => {
    const small = quote(1, 'Small', {
      hek: agg({ sellPrice: 100, vol: 10 }),
      amarr: agg({ buyPrice: 200, vol: 10 }),
    });
    const big = quote(2, 'Big', {
      hek: agg({ sellPrice: 100, vol: 100000 }),
      amarr: agg({ buyPrice: 200, vol: 100000 }),
    });
    const ranked = rankOpportunities([small, big], params);
    expect(ranked.map((o) => o.name)).toEqual(['Big', 'Small']);
  });
});
