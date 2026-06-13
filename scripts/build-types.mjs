#!/usr/bin/env node
// Build data/types.json from the EVE SDE (Fuzzwork invTypes dump).
// Keeps only published, market-tradeable types with the fields the scanner
// needs (name, assembled volume, group, market group). Skips the download when
// a recent data/types.json already exists.
//
//   SKIP_DATA_FETCH=1  -> require an existing file, never download
//   FORCE_DATA_FETCH=1 -> always re-download even if the file is fresh

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'types.json');
const SDE_URL = 'https://www.fuzzwork.co.uk/dump/latest/csv/invTypes.csv';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const UA = process.env.ESI_CONTACT
  ? `eve-arbitrage/0.1 (+${process.env.ESI_CONTACT})`
  : 'eve-arbitrage/0.1';

function fresh(p) {
  try {
    const st = fs.statSync(p);
    return Date.now() - st.mtimeMs < MAX_AGE_MS && st.size > 0;
  } catch {
    return false;
  }
}

if (process.env.SKIP_DATA_FETCH === '1') {
  if (fresh(OUT)) {
    console.log('[build-types] SKIP_DATA_FETCH=1, reusing existing data/types.json');
    process.exit(0);
  }
  console.error('[build-types] SKIP_DATA_FETCH=1 but data/types.json is missing/stale');
  process.exit(1);
}

if (fresh(OUT) && process.env.FORCE_DATA_FETCH !== '1') {
  console.log('[build-types] data/types.json is fresh; skipping (FORCE_DATA_FETCH=1 to override)');
  process.exit(0);
}

// RFC4180-ish parser: handles quoted fields with embedded commas/newlines and
// escaped double-quotes. The invTypes description column needs this.
function parseCSV(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

console.log(`[build-types] downloading SDE invTypes from ${SDE_URL} ...`);
const res = await fetch(SDE_URL, { headers: { 'User-Agent': UA } });
if (!res.ok) {
  console.error(`[build-types] SDE download failed: HTTP ${res.status}`);
  process.exit(1);
}
const csv = (await res.text()).replace(/^﻿/, '');
const rows = parseCSV(csv);
const header = rows[0];
const col = Object.fromEntries(header.map((h, i) => [h, i]));
for (const k of ['typeID', 'groupID', 'typeName', 'volume', 'published', 'marketGroupID']) {
  if (col[k] === undefined) {
    console.error(`[build-types] SDE missing expected column: ${k}`);
    process.exit(1);
  }
}

const types = {};
let kept = 0;
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (!row || row.length < header.length) continue;
  if (row[col.published] !== '1') continue;
  const marketGroupID = row[col.marketGroupID];
  if (marketGroupID === '' || marketGroupID == null) continue; // not tradeable
  const id = Number(row[col.typeID]);
  if (!Number.isFinite(id) || id <= 0) continue;
  const volume = Number(row[col.volume]);
  types[id] = {
    name: row[col.typeName],
    volume: Number.isFinite(volume) ? volume : 0,
    groupId: Number(row[col.groupID]) || 0,
    marketGroupId: Number(marketGroupID) || 0,
  };
  kept++;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: SDE_URL,
    count: kept,
    types,
  }),
);
console.log(`[build-types] wrote ${kept} market types -> ${path.relative(ROOT, OUT)}`);
