export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">EVE Arbitrage</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Buy cheap in one trade hub, haul it, fill the highest buy orders in
          another. Opportunities ranked by realistic profit per trip given your
          cargo and ISK budget.
        </p>
      </header>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-sm text-[var(--muted)]">
          Scanner coming online. Phase 0 scaffold is live.
        </p>
      </section>
    </main>
  );
}
