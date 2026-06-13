import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.env.EVE_TYPES_PATH = path.join(ROOT, 'test', 'fixtures', 'types.json');

import {
  getType,
  allTypeIds,
  allTypes,
  __resetTypesCache,
} from '@/lib/types-data';

describe('types-data', () => {
  beforeEach(() => __resetTypesCache());

  it('loads types from the fixture', () => {
    expect(allTypeIds().sort((a, b) => a - b)).toEqual([34, 11399, 44992]);
    expect(allTypes()).toHaveLength(3);
  });

  it('resolves a type by id with name and volume', () => {
    const t = getType(34);
    expect(t?.name).toBe('Tritanium');
    expect(t?.volume).toBe(0.01);
    expect(t?.id).toBe(34);
  });

  it('returns undefined for an unknown id', () => {
    expect(getType(123456789)).toBeUndefined();
  });
});
