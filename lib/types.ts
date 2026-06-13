// Shared types used by both server (arbitrage engine, API routes) and client
// (results table). Kept free of 'server-only' and node imports so the client
// can type-import from here without pulling server code into the bundle.

export interface AggSide {
  weightedAverage: number;
  max: number;
  min: number;
  median: number;
  volume: number;
  orderCount: number;
  percentile: number;
}

export interface Aggregate {
  buy: AggSide;
  sell: AggSide;
}

export interface TypeQuotes {
  typeId: number;
  name: string;
  unitVolume: number;
  hubs: Record<string, Aggregate>;
}

export type PriceBasis = 'best' | 'percentile';
export type Limiter = 'cargo' | 'capital' | 'liquidity';

export interface RankParams {
  sourceHubs: string[];
  destHubs: string[];
  cargoM3: number;
  budgetIsk: number;
  accountingLevel: number;
  priceBasis?: PriceBasis;
  minMarginPct?: number; // fraction, e.g. 0.05 = 5%
  maxMarginPct?: number; // fraction, e.g. 5 = 500% (drops data artifacts)
  minTripProfit?: number;
  minVolume?: number; // min units available on the thinner side
  limit?: number;
}

export interface Opportunity {
  typeId: number;
  name: string;
  unitVolume: number;
  sourceHub: string;
  destHub: string;
  buyPrice: number; // basis-adjusted cost to acquire at source
  sellPrice: number; // basis-adjusted revenue selling into dest buy orders
  rawSellMin: number; // best (lowest) sell order at source, for reference
  rawBuyMax: number; // best (highest) buy order at dest, for reference
  salesTaxRate: number;
  unitMargin: number; // net ISK per unit after sales tax
  marginPct: number; // unitMargin / buyPrice
  profitPerM3: number;
  tripUnits: number;
  tripProfit: number;
  capitalRequired: number;
  liquidityUnits: number;
  limiter: Limiter;
}

// --- Drill-down (exact order-book depth) ---

export interface WalkOrder {
  price: number;
  volume: number;
  minVolume?: number;
}

export interface DepthResult {
  units: number;
  cost: number; // total ISK spent buying
  revenue: number; // gross ISK from buy orders (pre-tax)
  profit: number; // net after sales tax
  avgBuy: number;
  avgSell: number;
  taxRate: number;
  limiter: Limiter;
}

export interface LadderLevel {
  price: number;
  volume: number;
  cumVolume: number;
}

export interface OrderbookResponse {
  type: { id: number; name: string; unitVolume: number };
  source: { hub: string; ladder: LadderLevel[]; totalVolume: number };
  dest: { hub: string; ladder: LadderLevel[]; totalVolume: number };
  result: DepthResult;
  params: { cargoM3: number; budgetIsk: number; accountingLevel: number };
}

export interface ScanResponse {
  generatedAt: string;
  count: number;
  opportunities: Opportunity[];
  params: {
    sourceHub: string;
    destHub: string;
    cargoM3: number;
    budgetIsk: number;
    accountingLevel: number;
    salesTaxRate: number;
    priceBasis: PriceBasis;
  };
}
