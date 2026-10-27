import type { Expense, Sale } from '../types';
import { inRange, type DateRange } from './date';

export type PeriodStats = {
  revenue: number;
  serviceRevenue: number;
  productRevenue: number;
  grossProfit: number;
  expenses: number;
  net: number;
  margin: number;
  salesCount: number;
  serviceCount: number;
  productUnits: number;
  averageTicket: number;
};

export function statsFor(
sales: Sale[],
expenses: Expense[],
range: DateRange)
: PeriodStats {
  const scopedSales = sales.filter((sale) => inRange(sale.date, range));
  const scopedExpenses = expenses.filter((expense) => inRange(expense.date, range));

  const revenue = scopedSales.reduce((sum, s) => sum + s.total, 0);
  const serviceRevenue = scopedSales.
  filter((s) => s.kind === 'service').
  reduce((sum, s) => sum + s.total, 0);
  const productRevenue = revenue - serviceRevenue;
  const grossProfit = scopedSales.reduce((sum, s) => sum + s.profit, 0);
  const totalExpenses = scopedExpenses.reduce((sum, e) => sum + e.amount, 0);

  return {
    revenue,
    serviceRevenue,
    productRevenue,
    grossProfit,
    expenses: totalExpenses,
    net: revenue - totalExpenses,
    margin: revenue > 0 ? grossProfit / revenue * 100 : 0,
    salesCount: scopedSales.length,
    serviceCount: scopedSales.filter((s) => s.kind === 'service').length,
    productUnits: scopedSales.
    filter((s) => s.kind === 'produit').
    reduce((sum, s) => sum + s.quantity, 0),
    averageTicket: scopedSales.length > 0 ? revenue / scopedSales.length : 0
  };
}

export type Ranked = {label: string;value: number;secondary: number;};

export function topSellers(sales: Sale[], range: DateRange, limit = 5): Ranked[] {
  const map = new Map<string, Ranked>();
  sales.
  filter((sale) => inRange(sale.date, range)).
  forEach((sale) => {
    const current = map.get(sale.itemName) ?? {
      label: sale.itemName,
      value: 0,
      secondary: 0
    };
    current.value += sale.total;
    current.secondary += sale.quantity;
    map.set(sale.itemName, current);
  });
  return [...map.values()].sort((a, b) => b.value - a.value).slice(0, limit);
}

export type DistributionSlice = {
  label: string;
  kind: SaleKindLike;
  value: number;
};

type SaleKindLike = Sale['kind'];

/**
 * Groups sales in range by item, returning either the sell-count or the
 * profit contributed by each item. Small slices beyond `limit` are merged
 * into an "Autres" bucket so the pie chart stays readable.
 */
export function distributionByItem(
sales: Sale[],
range: DateRange,
metric: 'count' | 'profit',
limit = 6)
: DistributionSlice[] {
  const map = new Map<string, DistributionSlice>();
  sales.
  filter((sale) => inRange(sale.date, range)).
  forEach((sale) => {
    const key = sale.itemName;
    const current = map.get(key) ?? { label: key, kind: sale.kind, value: 0 };
    current.value += metric === 'count' ? sale.quantity : sale.profit;
    map.set(key, current);
  });

  const sorted = [...map.values()].
  filter((slice) => slice.value > 0).
  sort((a, b) => b.value - a.value);

  if (sorted.length <= limit) return sorted;

  const head = sorted.slice(0, limit);
  const tailTotal = sorted.slice(limit).reduce((sum, slice) => sum + slice.value, 0);
  if (tailTotal > 0) {
    head.push({ label: 'Autres', kind: 'produit', value: tailTotal });
  }
  return head;
}

/** Sell-count split between produits and services (used for a 2-slice pie). */
export function kindCountSplit(
sales: Sale[],
range: DateRange)
: DistributionSlice[] {
  const scoped = sales.filter((sale) => inRange(sale.date, range));
  const serviceCount = scoped.
  filter((s) => s.kind === 'service').
  reduce((sum, s) => sum + s.quantity, 0);
  const productCount = scoped.
  filter((s) => s.kind === 'produit').
  reduce((sum, s) => sum + s.quantity, 0);
  return [
  { label: 'Services', kind: 'service' as const, value: serviceCount },
  { label: 'Produits', kind: 'produit' as const, value: productCount }].
  filter((slice) => slice.value > 0);
}

/** Profit split between produits et services (used for a 2-slice pie). */
export function kindProfitSplit(
sales: Sale[],
range: DateRange)
: DistributionSlice[] {
  const scoped = sales.filter((sale) => inRange(sale.date, range));
  const serviceProfit = scoped.
  filter((s) => s.kind === 'service').
  reduce((sum, s) => sum + s.profit, 0);
  const productProfit = scoped.
  filter((s) => s.kind === 'produit').
  reduce((sum, s) => sum + s.profit, 0);
  return [
  { label: 'Services', kind: 'service' as const, value: serviceProfit },
  { label: 'Produits', kind: 'produit' as const, value: productProfit }].
  filter((slice) => slice.value > 0);
}

export function dailySeries(
sales: Sale[],
expenses: Expense[],
days: string[])
: {day: string;revenue: number;expenses: number;}[] {
  return days.map((day) => ({
    day,
    revenue: sales.
    filter((s) => s.date === day).
    reduce((sum, s) => sum + s.total, 0),
    expenses: expenses.
    filter((e) => e.date === day).
    reduce((sum, e) => sum + e.amount, 0)
  }));
}