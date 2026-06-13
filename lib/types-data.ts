import 'server-only';
import fs from 'node:fs';
import path from 'node:path';

// Static item metadata, generated from the EVE SDE at prebuild
// (scripts/build-types.mjs -> data/types.json). `volume` is the SDE assembled
// volume in m3; ship packaged volume is refined from ESI at drill-down time.

export interface TypeInfo {
  id: number;
  name: string;
  volume: number;
  groupId: number;
  marketGroupId: number;
}

interface TypesFile {
  generatedAt: string;
  source: string;
  count: number;
  types: Record<string, Omit<TypeInfo, 'id'>>;
}

let cache: Map<number, TypeInfo> | null = null;

function dataFile(): string {
  return (
    process.env.EVE_TYPES_PATH ?? path.join(process.cwd(), 'data', 'types.json')
  );
}

export function loadTypes(): Map<number, TypeInfo> {
  if (cache) return cache;
  const raw = fs.readFileSync(dataFile(), 'utf8');
  const parsed = JSON.parse(raw) as TypesFile;
  const map = new Map<number, TypeInfo>();
  for (const [idStr, t] of Object.entries(parsed.types)) {
    const id = Number(idStr);
    map.set(id, {
      id,
      name: t.name,
      volume: t.volume,
      groupId: t.groupId,
      marketGroupId: t.marketGroupId,
    });
  }
  cache = map;
  return map;
}

export function getType(id: number): TypeInfo | undefined {
  return loadTypes().get(id);
}

export function allTypeIds(): number[] {
  return [...loadTypes().keys()];
}

export function allTypes(): TypeInfo[] {
  return [...loadTypes().values()];
}

// Test-only: clear the module cache so a different fixture can be loaded.
export function __resetTypesCache(): void {
  cache = null;
}
