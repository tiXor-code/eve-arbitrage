import { describe, it, expect } from 'vitest';
import { exactToOpportunity, mapLimit, type ExactTrade } from '@/lib/depth';
import type { DepthResult } from '@/lib/types';

function trade(over: Partial<ExactTrade> & { result: DepthResult }): ExactTrade {
  return {
    typeId: 34,
    name: 'Tritanium',
    unitVolume: 0.01,
    sourceHub: 'hek',
    destHub: 'jita',
    sells: [{ price: 100, volume: 10 }],
    buys: [{ price: 200, volume: 10 }],
    ...over,
  };
}

describe('exactToOpportunity', () => {
  it('maps a fillable trade to an opportunity', () => {
    const o = exactToOpportunity(
      trade({
        result: {
          units: 10,
          cost: 1000,
          revenue: 2000,
          profit: 900,
          avgBuy: 100,
          avgSell: 200,
          taxRate: 0.05,
          limiter: 'liquidity',
        },
      }),
    )!;
    expect(o.tripUnits).toBe(10);
    expect(o.tripProfit).toBe(900);
    expect(o.unitMargin).toBeCloseTo(90);
    expect(o.marginPct).toBeCloseTo(0.9);
    expect(o.sourceHub).toBe('hek');
    expect(o.destHub).toBe('jita');
  });

  it('returns null for an empty or unprofitable trade', () => {
    const zero: DepthResult = {
      units: 0,
      cost: 0,
      revenue: 0,
      profit: 0,
      avgBuy: 0,
      avgSell: 0,
      taxRate: 0,
      limiter: 'liquidity',
    };
    expect(exactToOpportunity(trade({ result: zero }))).toBeNull();
  });
});

describe('mapLimit', () => {
  it('preserves order and respects the concurrency cap', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBeLessThanOrEqual(3);
  });
});
