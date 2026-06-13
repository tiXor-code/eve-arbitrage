'use client';

import { useEffect, useState } from 'react';
import type { Opportunity, OrderbookResponse, LadderLevel } from '@/lib/types';
import { HUB_BY_KEY } from '@/lib/hubs';
import { formatIsk, formatInt } from '@/lib/format';

function hubName(key: string): string {
  return HUB_BY_KEY[key]?.name ?? key;
}

function Ladder({
  title,
  rows,
  highlight,
}: {
  title: string;
  rows: LadderLevel[];
  highlight: 'low' | 'high';
}) {
  return (
    <div className="flex-1">
      <div className="mb-1 text-xs uppercase tracking-wide text-[var(--muted)]">{title}</div>
      <table className="w-full text-xs">
        <thead className="text-[var(--muted)]">
          <tr>
            <th className="py-1 text-right">Price</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Cum</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className={
                i === 0 ? (highlight === 'low' ? 'text-[var(--accent)]' : 'text-[var(--positive)]') : ''
              }
            >
              <td className="py-0.5 text-right">{formatIsk(r.price)}</td>
              <td className="py-0.5 text-right">{formatInt(r.volume)}</td>
              <td className="py-0.5 text-right text-[var(--muted)]">{formatInt(r.cumVolume)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-2 text-center text-[var(--muted)]">
                no reachable orders
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function OrderBookDrawer({
  opp,
  cargoM3,
  budgetIsk,
  accountingLevel,
  onClose,
}: {
  opp: Opportunity;
  cargoM3: number;
  budgetIsk: number;
  accountingLevel: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<OrderbookResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    const qs = new URLSearchParams({
      typeId: String(opp.typeId),
      sourceHub: opp.sourceHub,
      destHub: opp.destHub,
      cargoM3: String(cargoM3),
      budgetIsk: String(budgetIsk),
      accountingLevel: String(accountingLevel),
    });
    fetch(`/api/orderbook?${qs}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `failed (${r.status})`);
        if (alive) setData(j as OrderbookResponse);
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [opp, cargoM3, budgetIsk, accountingLevel]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto border-l border-[var(--border)] bg-[var(--bg)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{opp.name}</h2>
            <p className="text-sm text-[var(--muted)]">
              {hubName(opp.sourceHub)} → {hubName(opp.destHub)} · exact order-book depth
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--text)]">
            ✕
          </button>
        </div>

        {error && <p className="mt-6 text-sm text-[var(--negative)]">{error}</p>}
        {!data && !error && (
          <p className="mt-6 text-sm text-[var(--muted)]">Loading live order books from ESI…</p>
        )}

        {data && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-4 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 text-sm">
              <Stat label="Haulable this trip" value={`${formatInt(data.result.units)} units`} />
              <Stat
                label="Net profit (after tax)"
                value={formatIsk(data.result.profit)}
                positive
              />
              <Stat label="Avg buy" value={formatIsk(data.result.avgBuy)} />
              <Stat label="Avg sell" value={formatIsk(data.result.avgSell)} />
              <Stat label="Capital needed" value={formatIsk(data.result.cost)} />
              <Stat
                label="Limited by"
                value={`${data.result.limiter} · vol ${data.type.unitVolume} m³`}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Walks real ESI orders: buys the cheapest sells at{' '}
              {hubName(opp.sourceHub)}, fills the highest reachable buy orders at{' '}
              {hubName(opp.destHub)} (region-range + at-station), honoring min-volume
              and your {data.params.cargoM3.toLocaleString()} m³ /{' '}
              {formatIsk(data.params.budgetIsk)} limits.
            </p>

            <div className="mt-5 flex gap-6">
              <Ladder title={`Buy at ${hubName(opp.sourceHub)} (sell orders)`} rows={data.source.ladder} highlight="low" />
              <Ladder title={`Sell at ${hubName(opp.destHub)} (buy orders)`} rows={data.dest.ladder} highlight="high" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className={`font-semibold ${positive ? 'text-[var(--positive)]' : ''}`}>{value}</div>
    </div>
  );
}
