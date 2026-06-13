'use client';

import { useState } from 'react';
import type { Opportunity, PriceBasis, ScanResponse } from '@/lib/types';
import { HUBS } from '@/lib/hubs';
import { salesTaxRate } from '@/lib/arbitrage';
import ResultsTable from './ResultsTable';
import OrderBookDrawer from './OrderBookDrawer';

const HUB_OPTIONS = [{ key: 'any', name: 'Any' }, ...HUBS.map((h) => ({ key: h.key, name: h.name }))];

interface Controls {
  sourceHub: string;
  destHub: string;
  cargoM3: number;
  budgetM: number; // millions ISK, for input convenience
  accountingLevel: number;
  minMarginPct: number;
  minTripProfitM: number; // millions ISK
  priceBasis: PriceBasis;
}

const DEFAULTS: Controls = {
  sourceHub: 'any',
  destHub: 'any',
  cargoM3: 60000,
  budgetM: 500,
  accountingLevel: 0,
  minMarginPct: 5,
  minTripProfitM: 1,
  priceBasis: 'percentile',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  'rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]';

export default function Scanner() {
  const [c, setC] = useState<Controls>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [selected, setSelected] = useState<Opportunity | null>(null);

  function set<K extends keyof Controls>(key: K, value: Controls[K]) {
    setC((prev) => ({ ...prev, [key]: value }));
  }

  async function scan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceHub: c.sourceHub,
          destHub: c.destHub,
          cargoM3: c.cargoM3,
          budgetIsk: c.budgetM * 1_000_000,
          accountingLevel: c.accountingLevel,
          minMarginPct: c.minMarginPct,
          minTripProfit: c.minTripProfitM * 1_000_000,
          priceBasis: c.priceBasis,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `scan failed (${res.status})`);
      setResult(json as ScanResponse);
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const tax = salesTaxRate(c.accountingLevel);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 sm:grid-cols-4 lg:grid-cols-8">
        <Field label="Buy at (source)">
          <select
            className={inputCls}
            value={c.sourceHub}
            onChange={(e) => set('sourceHub', e.target.value)}
          >
            {HUB_OPTIONS.map((h) => (
              <option key={h.key} value={h.key}>
                {h.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sell at (dest)">
          <select
            className={inputCls}
            value={c.destHub}
            onChange={(e) => set('destHub', e.target.value)}
          >
            {HUB_OPTIONS.map((h) => (
              <option key={h.key} value={h.key}>
                {h.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cargo (m³)">
          <input
            type="number"
            className={inputCls}
            value={c.cargoM3}
            min={0}
            onChange={(e) => set('cargoM3', Number(e.target.value))}
          />
        </Field>
        <Field label="Budget (M ISK)">
          <input
            type="number"
            className={inputCls}
            value={c.budgetM}
            min={0}
            onChange={(e) => set('budgetM', Number(e.target.value))}
          />
        </Field>
        <Field label={`Accounting (tax ${(tax * 100).toFixed(1)}%)`}>
          <select
            className={inputCls}
            value={c.accountingLevel}
            onChange={(e) => set('accountingLevel', Number(e.target.value))}
          >
            {[0, 1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                Level {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Min margin (%)">
          <input
            type="number"
            className={inputCls}
            value={c.minMarginPct}
            min={0}
            onChange={(e) => set('minMarginPct', Number(e.target.value))}
          />
        </Field>
        <Field label="Min trip profit (M)">
          <input
            type="number"
            className={inputCls}
            value={c.minTripProfitM}
            min={0}
            onChange={(e) => set('minTripProfitM', Number(e.target.value))}
          />
        </Field>
        <Field label="Price basis">
          <select
            className={inputCls}
            value={c.priceBasis}
            onChange={(e) => set('priceBasis', e.target.value as PriceBasis)}
          >
            <option value="percentile">Percentile (realistic)</option>
            <option value="best">Best order (optimistic)</option>
          </select>
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={scan}
          disabled={loading}
          className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[#04201c] transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Scanning…' : 'Scan'}
        </button>
        {result && (
          <span className="text-xs text-[var(--muted)]">
            {result.count} opportunities · tax {(result.params.salesTaxRate * 100).toFixed(1)}% ·{' '}
            {new Date(result.generatedAt).toLocaleTimeString()}
          </span>
        )}
        {error && <span className="text-xs text-[var(--negative)]">{error}</span>}
      </div>

      {loading && (
        <p className="mt-6 text-sm text-[var(--muted)]">
          Pulling market aggregates across hubs… the first scan of a region warms
          the cache and can take a few seconds.
        </p>
      )}

      {result && !loading && (
        <ResultsTable
          opportunities={result.opportunities as Opportunity[]}
          onSelect={setSelected}
        />
      )}

      {selected && (
        <OrderBookDrawer
          opp={selected}
          cargoM3={c.cargoM3}
          budgetIsk={c.budgetM * 1_000_000}
          accountingLevel={c.accountingLevel}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
