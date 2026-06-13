'use client';

import { useState } from 'react';
import type { Opportunity } from '@/lib/types';
import { HUB_BY_KEY } from '@/lib/hubs';
import { formatIsk, formatInt, formatPct } from '@/lib/format';

type SortKey =
  | 'tripProfit'
  | 'profitPerM3'
  | 'marginPct'
  | 'unitMargin'
  | 'capitalRequired'
  | 'name';

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'name', label: 'Item', align: 'left' },
  { key: 'tripProfit', label: 'Trip profit', align: 'right' },
  { key: 'profitPerM3', label: 'ISK/m³', align: 'right' },
  { key: 'marginPct', label: 'Margin', align: 'right' },
  { key: 'unitMargin', label: 'Margin/u', align: 'right' },
  { key: 'capitalRequired', label: 'Capital', align: 'right' },
];

function hubName(key: string): string {
  return HUB_BY_KEY[key]?.name ?? key;
}

const LIMITER_LABEL: Record<Opportunity['limiter'], string> = {
  cargo: 'cargo',
  capital: 'isk',
  liquidity: 'liq',
};

export default function ResultsTable({
  opportunities,
  onSelect,
}: {
  opportunities: Opportunity[];
  onSelect?: (o: Opportunity) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('tripProfit');
  const [asc, setAsc] = useState(false);

  const sorted = [...opportunities].sort((a, b) => {
    let cmp: number;
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
    else cmp = a[sortKey] - b[sortKey];
    return asc ? cmp : -cmp;
  });

  function toggle(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(key === 'name');
    }
  }

  if (opportunities.length === 0) {
    return (
      <p className="mt-6 text-sm text-[var(--muted)]">
        No opportunities matched. Loosen the filters (lower min margin / min trip
        profit) or widen the route to Any → Any.
      </p>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[var(--panel)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                onClick={() => toggle(c.key)}
                className={`cursor-pointer select-none px-3 py-2 ${
                  c.align === 'right' ? 'text-right' : 'text-left'
                } hover:text-[var(--text)]`}
              >
                {c.label}
                {sortKey === c.key ? (asc ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
            <th className="px-3 py-2 text-left">Route</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((o) => (
            <tr
              key={`${o.typeId}-${o.sourceHub}-${o.destHub}`}
              onClick={() => onSelect?.(o)}
              className={`border-t border-[var(--border)] ${
                onSelect ? 'cursor-pointer' : ''
              } hover:bg-[var(--panel)]`}
            >
              <td className="px-3 py-2">
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-[var(--muted)]">
                  buy {formatIsk(o.buyPrice)} → sell {formatIsk(o.sellPrice)}
                </div>
              </td>
              <td className="px-3 py-2 text-right font-semibold text-[var(--positive)]">
                {formatIsk(o.tripProfit)}
                <div className="text-xs font-normal text-[var(--muted)]">
                  {formatInt(o.tripUnits)} u
                </div>
              </td>
              <td className="px-3 py-2 text-right">{formatIsk(o.profitPerM3)}</td>
              <td className="px-3 py-2 text-right">{formatPct(o.marginPct)}</td>
              <td className="px-3 py-2 text-right">{formatIsk(o.unitMargin)}</td>
              <td className="px-3 py-2 text-right">
                {formatIsk(o.capitalRequired)}
                <div className="text-xs text-[var(--muted)]">
                  {LIMITER_LABEL[o.limiter]}-limited
                </div>
              </td>
              <td className="px-3 py-2 text-[var(--muted)]">
                {hubName(o.sourceHub)} → {hubName(o.destHub)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
