// Display formatting helpers. No server-only / node imports — safe on the client.

export function formatIsk(n: number): string {
  if (!Number.isFinite(n)) return '-';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(2)}`;
}

export function formatInt(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('en-US');
}

export function formatPct(frac: number): string {
  if (!Number.isFinite(frac)) return '-';
  return `${(frac * 100).toFixed(1)}%`;
}

export function formatM3(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return `${formatInt(n)} m³`;
}
