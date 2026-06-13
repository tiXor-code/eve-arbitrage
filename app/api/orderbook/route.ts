import { NextResponse } from 'next/server';
import { HUB_BY_KEY } from '@/lib/hubs';
import { salesTaxRate } from '@/lib/arbitrage';
import { buildLadder, computeExactTrade } from '@/lib/depth';
import type { OrderbookResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function num(v: string | null, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const typeId = num(url.searchParams.get('typeId'), NaN);
  const sourceKey = url.searchParams.get('sourceHub') ?? '';
  const destKey = url.searchParams.get('destHub') ?? '';
  const source = HUB_BY_KEY[sourceKey];
  const dest = HUB_BY_KEY[destKey];

  if (!Number.isFinite(typeId) || !source || !dest || source.key === dest.key) {
    return NextResponse.json({ error: 'bad typeId / hubs' }, { status: 400 });
  }

  const cargoM3 = Math.max(0, num(url.searchParams.get('cargoM3'), 60000));
  const budgetIsk = Math.max(0, num(url.searchParams.get('budgetIsk'), 500_000_000));
  const accountingLevel = Math.max(0, Math.min(5, num(url.searchParams.get('accountingLevel'), 0)));
  const taxRate = salesTaxRate(accountingLevel);

  try {
    const trade = await computeExactTrade(typeId, sourceKey, destKey, {
      cargoM3,
      budgetIsk,
      taxRate,
      useEsiVolume: true, // exact packaged volume for the decision view
    });
    const payload: OrderbookResponse = {
      type: { id: typeId, name: trade.name, unitVolume: trade.unitVolume },
      source: { hub: source.key, ...buildLadder(trade.sells) },
      dest: { hub: dest.key, ...buildLadder(trade.buys) },
      result: trade.result,
      params: { cargoM3, budgetIsk, accountingLevel },
    };
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: `ESI fetch failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
