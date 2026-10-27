const kgFormat = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });
const pctFormat = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 });

export function num(n: number): string {
  // Avoid "-0" when a value rounds to zero.
  const r = Math.round(n);
  return kgFormat.format(r === 0 ? 0 : r);
}

export function kg(n: number): string {
  return `${num(n)} kg`;
}

export function signedKg(n: number): string {
  const r = Math.round(n);
  if (r === 0) return '0 kg';
  return `${r > 0 ? '+' : '−'}${kgFormat.format(Math.abs(r))} kg`;
}

export function pct(n: number): string {
  return `${pctFormat.format(n)}%`;
}

export function mm(n: number): string {
  return `${num(n)} mm`;
}
