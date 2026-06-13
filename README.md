# EVE Arbitrage

Find inter-region hauling arbitrage in EVE Online: buy cheap from the lowest
sell orders in one trade hub, haul it, and fill the highest buy orders in
another. Opportunities are ranked by **realistic profit per trip** given your
ship's cargo (m³) and ISK budget. Filling an existing buy order costs sales tax
only — no broker fee.

Live: _(set after first deploy)_

## How it works

Two-stage scan for speed **and** accuracy:

1. **Discovery** — [Fuzzwork](https://market.fuzzwork.co.uk/) station aggregates
   (cached ~30 min) cheaply shortlist candidate items with a margin between hubs.
2. **Exact depth-walk** — for each candidate, the real
   [ESI](https://esi.evetech.net/) order books are walked (buy the cheapest
   station sell orders, fill the highest reachable buy orders), honoring
   cargo, capital, order-book depth, min-volume, and buy-order range. The
   scan's numbers therefore equal the per-item drill-down exactly.

Item names and volumes come from the EVE SDE (Fuzzwork `invTypes` dump),
generated into `data/types.json` at prebuild.

### The math

```
salesTax   = 0.075 - 0.009 * AccountingLevel        (fill = tax only, no broker fee)
unitMargin = sellPrice * (1 - salesTax) - buyPrice
tripUnits  = min(cargo / volume, budget / buyPrice, fillable order depth)
tripProfit = sum over the walked order book, net of tax
```

The 5 hubs: Jita (The Forge), Amarr (Domain), Dodixie (Sinq Laison),
Rens (Heimatar), Hek (Metropolis).

## Develop

```bash
npm install
npm run dev            # prebuild downloads the SDE -> data/types.json
npm test               # vitest (offline, mocked)
npm run e2e            # playwright
npm run build
```

Set `ESI_CONTACT` (your email) so outbound requests carry a descriptive
User-Agent, per ESI etiquette.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Vercel.
No database — live market data is fetched and cached in-process; only the SDE
item table is static.

## EVE SSO (optional, personalization)

Logging in with your EVE character auto-fills your exact sales tax (from the
Accounting skill) and budget (from your wallet). Without it, the tool works
anonymously with a manual Accounting-level selector.

Setup (see `.env.example`): register an app at
<https://developers.eveonline.com/> with callback
`<site>/api/auth/callback` and scopes `esi-skills.read_skills.v1`,
`esi-wallet.read_character_wallet.v1`, then set the env vars.
