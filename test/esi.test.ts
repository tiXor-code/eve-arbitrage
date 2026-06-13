import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTypeOrders, getEsiType, EsiError } from '@/lib/esi';

function res(body: unknown, { ok = true, status = 200, pages = 1 } = {}) {
  const headers = new Headers();
  if (pages > 1) headers.set('x-pages', String(pages));
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers,
  } as unknown as Response;
}

const order = (id: number, isBuy: boolean, price: number) => ({
  order_id: id,
  type_id: 34,
  location_id: 60003760,
  system_id: 30000142,
  is_buy_order: isBuy,
  price,
  volume_remain: 100,
  volume_total: 100,
  min_volume: 1,
  range: 'region',
  duration: 90,
  issued: '2026-06-14T00:00:00Z',
});

describe('esi', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('returns single-page orders', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res([order(1, false, 7)])));
    const orders = await getTypeOrders(10000002, 34, 'sell');
    expect(orders).toHaveLength(1);
    expect(orders[0].price).toBe(7);
  });

  it('follows X-Pages and concatenates pages', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res([order(1, false, 7)], { pages: 3 }))
      .mockResolvedValueOnce(res([order(2, false, 8)]))
      .mockResolvedValueOnce(res([order(3, false, 9)]));
    vi.stubGlobal('fetch', fetchMock);

    const orders = await getTypeOrders(10000002, 34, 'sell');
    expect(orders.map((o) => o.order_id).sort()).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('parses a type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(res({ type_id: 34, name: 'Tritanium', volume: 0.01, packaged_volume: 0.01 })),
    );
    const t = await getEsiType(34);
    expect(t.name).toBe('Tritanium');
    expect(t.packaged_volume).toBe(0.01);
  });

  it('throws EsiError on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res({ error: 'nope' }, { ok: false, status: 420 })));
    await expect(getEsiType(34)).rejects.toBeInstanceOf(EsiError);
  });
});
