import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAggregates } from '@/lib/fuzzwork';

function mockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  } as unknown as Response;
}

describe('fuzzwork', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('parses aggregates and coerces string prices to numbers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        '34': {
          buy: { max: '6.50', min: '5.00', percentile: '6.40', volume: '1000', orderCount: '12' },
          sell: { min: '7.00', max: '9.00', percentile: '7.10', volume: '2000', orderCount: '30' },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const out = await fetchAggregates({ region: 10000002 }, [34]);
    expect(out.get(34)?.buy.max).toBe(6.5);
    expect(out.get(34)?.sell.min).toBe(7);
    expect(out.get(34)?.buy.orderCount).toBe(12);
    expect(typeof out.get(34)?.sell.percentile).toBe('number');
  });

  it('batches large type lists into multiple requests (BATCH=500)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    const ids = Array.from({ length: 1200 }, (_, i) => i + 1);
    await fetchAggregates({ station: 60003760 }, ids);
    // 1200 ids / 500 per batch => 3 requests
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({}, false, 503)));
    await expect(fetchAggregates({ region: 10000002 }, [34])).rejects.toThrow(/Fuzzwork 503/);
  });
});
