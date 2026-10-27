const nf = new Intl.NumberFormat('fr-TN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3
});

export function money(value: number): string {
  return `${nf.format(Math.round(value * 1000) / 1000)} TND`;
}

export function percent(value: number): string {
  if (!isFinite(value)) return '—';
  return `${nf.format(Math.round(value * 10) / 10)} %`;
}

export function initials(name: string): string {
  return name.
  split(' ').
  filter(Boolean).
  slice(0, 2).
  map((part) => part[0]?.toUpperCase() ?? '').
  join('');
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}