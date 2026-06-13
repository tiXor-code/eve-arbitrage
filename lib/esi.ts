import 'server-only';

// Minimal ESI client. Public market/universe endpoints need no auth; character
// endpoints (skills, wallet) are added in the SSO phase. We send a descriptive
// User-Agent (ESI etiquette) and pin a compatibility date to lock behaviour.

const ESI_BASE = 'https://esi.evetech.net';
const COMPAT_DATE = '2026-06-01';

function userAgent(): string {
  return process.env.ESI_CONTACT
    ? `eve-arbitrage/0.1 (+${process.env.ESI_CONTACT})`
    : 'eve-arbitrage/0.1';
}

export interface EsiOrder {
  order_id: number;
  type_id: number;
  location_id: number;
  system_id: number;
  is_buy_order: boolean;
  price: number;
  volume_remain: number;
  volume_total: number;
  min_volume: number;
  range: string;
  duration: number;
  issued: string;
}

export interface EsiType {
  type_id: number;
  name: string;
  volume?: number;
  packaged_volume?: number;
  group_id?: number;
  market_group_id?: number;
}

export class EsiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errorLimitRemain?: number,
  ) {
    super(message);
    this.name = 'EsiError';
  }
}

interface FetchOpts {
  query?: Record<string, string | number | undefined>;
  token?: string;
}

function buildUrl(p: string, query?: FetchOpts['query']): string {
  const url = new URL(ESI_BASE + p);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function esiGet<T>(
  p: string,
  opts: FetchOpts = {},
): Promise<{ data: T; pages: number }> {
  const headers: Record<string, string> = {
    'User-Agent': userAgent(),
    'X-Compatibility-Date': COMPAT_DATE,
    Accept: 'application/json',
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(buildUrl(p, opts.query), { headers });
  if (!res.ok) {
    const remain = Number(res.headers.get('x-esi-error-limit-remain') ?? '');
    const body = await res.text().catch(() => '');
    throw new EsiError(
      res.status,
      `ESI ${res.status} for ${p}: ${body.slice(0, 200)}`,
      Number.isFinite(remain) ? remain : undefined,
    );
  }
  const data = (await res.json()) as T;
  const pages = Number(res.headers.get('x-pages') ?? '1') || 1;
  return { data, pages };
}

// All orders for a single type in a region (paginated). A single type rarely
// spans more than one page, but we follow X-Pages to be safe.
export async function getTypeOrders(
  regionId: number,
  typeId: number,
  orderType: 'buy' | 'sell' | 'all' = 'all',
): Promise<EsiOrder[]> {
  const query = { type_id: typeId, order_type: orderType, page: 1 };
  const first = await esiGet<EsiOrder[]>(
    `/latest/markets/${regionId}/orders/`,
    { query },
  );
  let orders = first.data;
  if (first.pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: first.pages - 1 }, (_, i) =>
        esiGet<EsiOrder[]>(`/latest/markets/${regionId}/orders/`, {
          query: { type_id: typeId, order_type: orderType, page: i + 2 },
        }).then((r) => r.data),
      ),
    );
    orders = orders.concat(...rest);
  }
  return orders;
}

export async function getEsiType(typeId: number): Promise<EsiType> {
  const { data } = await esiGet<EsiType>(`/latest/universe/types/${typeId}/`);
  return data;
}

// --- Authenticated character endpoints (SSO) ---

const ACCOUNTING_SKILL_ID = 16622;

interface EsiSkills {
  skills: { skill_id: number; active_skill_level: number }[];
}

// Trained Accounting level (0-5), which reduces sales tax.
export async function getAccountingLevel(
  characterId: number,
  token: string,
): Promise<number> {
  const { data } = await esiGet<EsiSkills>(
    `/latest/characters/${characterId}/skills/`,
    { token },
  );
  const acc = data.skills?.find((s) => s.skill_id === ACCOUNTING_SKILL_ID);
  return acc?.active_skill_level ?? 0;
}

// Wallet balance in ISK.
export async function getWalletBalance(
  characterId: number,
  token: string,
): Promise<number> {
  const { data } = await esiGet<number>(
    `/latest/characters/${characterId}/wallet/`,
    { token },
  );
  return Number(data) || 0;
}
