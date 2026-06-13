import Scanner from '@/components/Scanner';

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">EVE Arbitrage</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Buy cheap in one trade hub, haul it, fill the highest buy orders in
          another. Ranked by realistic profit per trip given your cargo and ISK
          budget. Filling a buy order costs sales tax only — no broker fee.
        </p>
      </header>

      <Scanner />

      <footer className="mt-12 text-xs text-[var(--muted)]">
        Market data via Fuzzwork aggregates (≈30 min fresh). Prices use the
        volume-weighted percentile by default to avoid single-order traps; switch
        to “best order” for the optimistic top-of-book view.
      </footer>
    </main>
  );
}
