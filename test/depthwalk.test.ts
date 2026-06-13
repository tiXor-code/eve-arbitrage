import { describe, it, expect } from 'vitest';
import { simulateTrade } from '@/lib/arbitrage';
import type { WalkOrder } from '@/lib/types';

const base = { unitVolume: 1, cargoM3: 1_000_000, budgetIsk: 1_000_000_000, taxRate: 0 };

describe('simulateTrade', () => {
  it('walks two order levels and computes exact totals', () => {
    const sells: WalkOrder[] = [
      { price: 100, volume: 10 },
      { price: 110, volume: 10 },
    ];
    const buys: WalkOrder[] = [
      { price: 200, volume: 5 },
      { price: 150, volume: 100 },
    ];
    const r = simulateTrade(sells, buys, base);
    // 5 units @ buy100/sell200, then 15 units @ buy(100,110)/sell150
    // units = 20 (sell supply), revenue = 5*200 + 15*150 = 3250
    // cost = 10*100 + 10*110 = 2100 ; profit = 3250 - 2100 = 1150
    expect(r.units).toBe(20);
    expect(r.revenue).toBe(3250);
    expect(r.cost).toBe(2100);
    expect(r.profit).toBe(1150);
  });

  it('stops when marginal margin goes non-positive', () => {
    const sells: WalkOrder[] = [{ price: 100, volume: 1000 }];
    const buys: WalkOrder[] = [
      { price: 200, volume: 5 },
      { price: 90, volume: 1000 }, // below cost -> never filled
    ];
    const r = simulateTrade(sells, buys, base);
    expect(r.units).toBe(5);
    expect(r.profit).toBe(5 * (200 - 100));
  });

  it('applies sales tax to revenue', () => {
    const r = simulateTrade(
      [{ price: 100, volume: 10 }],
      [{ price: 200, volume: 10 }],
      { ...base, taxRate: 0.1 },
    );
    // revenue 2000 * 0.9 - cost 1000 = 800
    expect(r.profit).toBeCloseTo(800);
  });

  it('caps by cargo and reports the cargo limiter', () => {
    const r = simulateTrade(
      [{ price: 100, volume: 1000 }],
      [{ price: 200, volume: 1000 }],
      { ...base, unitVolume: 10, cargoM3: 100 }, // 10 units fit
    );
    expect(r.units).toBe(10);
    expect(r.limiter).toBe('cargo');
  });

  it('caps by capital and reports the capital limiter', () => {
    const r = simulateTrade(
      [{ price: 100, volume: 1000 }],
      [{ price: 200, volume: 1000 }],
      { ...base, budgetIsk: 550 }, // 5 units affordable at 100
    );
    expect(r.units).toBe(5);
    expect(r.limiter).toBe('capital');
  });

  it('skips buy orders whose min volume cannot be met', () => {
    const r = simulateTrade(
      [{ price: 100, volume: 5 }], // only 5 units of supply
      [
        { price: 300, volume: 100, minVolume: 50 }, // needs 50, unreachable
        { price: 200, volume: 100, minVolume: 1 },
      ],
      base,
    );
    // best usable buy is 200; 5 units * (200-100) = 500
    expect(r.units).toBe(5);
    expect(r.avgSell).toBe(200);
    expect(r.profit).toBe(500);
  });
});
