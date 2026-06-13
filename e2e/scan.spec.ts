import { test, expect } from '@playwright/test';

// Deterministic: mock the API so the e2e doesn't depend on live Fuzzwork/ESI.
const fakeScan = {
  generatedAt: '2026-06-14T00:00:00.000Z',
  count: 1,
  candidatesWalked: 1,
  opportunities: [
    {
      typeId: 34,
      name: 'Tritanium',
      unitVolume: 0.01,
      sourceHub: 'hek',
      destHub: 'jita',
      buyPrice: 3,
      sellPrice: 4,
      rawSellMin: 3,
      rawBuyMax: 4,
      salesTaxRate: 0.075,
      unitMargin: 0.7,
      marginPct: 0.23,
      profitPerM3: 70,
      tripUnits: 1000,
      tripProfit: 700,
      capitalRequired: 3000,
      liquidityUnits: 1000,
      limiter: 'cargo',
    },
  ],
  params: {
    sourceHub: 'hek',
    destHub: 'jita',
    cargoM3: 60000,
    budgetIsk: 500000000,
    accountingLevel: 0,
    salesTaxRate: 0.075,
    priceBasis: 'percentile',
  },
};

const fakeBook = {
  type: { id: 34, name: 'Tritanium', unitVolume: 0.01 },
  source: { hub: 'hek', ladder: [{ price: 3, volume: 1000, cumVolume: 1000 }], totalVolume: 1000 },
  dest: { hub: 'jita', ladder: [{ price: 4, volume: 1000, cumVolume: 1000 }], totalVolume: 1000 },
  result: { units: 1000, cost: 3000, revenue: 4000, profit: 700, avgBuy: 3, avgSell: 4, taxRate: 0.075, limiter: 'cargo' },
  params: { cargoM3: 60000, budgetIsk: 500000000, accountingLevel: 0 },
};

test('scan renders ranked results and the drill-down opens', async ({ page }) => {
  await page.route('**/api/scan', (r) => r.fulfill({ json: fakeScan }));
  await page.route('**/api/orderbook**', (r) => r.fulfill({ json: fakeBook }));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'EVE Arbitrage' })).toBeVisible();

  await page.getByRole('button', { name: 'Scan' }).click();
  await expect(page.getByText('Tritanium').first()).toBeVisible();
  await expect(page.getByText('1 opportunities', { exact: false })).toBeVisible();

  // Open the order-book drill-down.
  await page.getByText('Tritanium').first().click();
  await expect(page.getByText('exact order-book depth')).toBeVisible();
  await expect(page.getByText('Haulable this trip')).toBeVisible();
});

test('login UI stays hidden when SSO is not configured', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Log in with EVE')).toHaveCount(0);
});
