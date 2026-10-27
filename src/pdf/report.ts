import { addDays, differenceInCalendarDays, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Appointment, Expense, Product, Sale } from '../types';
import type { DateRange } from '../utils/date';
import { inRange } from '../utils/date';
import { statsFor, topSellers } from '../utils/stats';
import type { CenterInfo } from '../config/center';
import {
  COLORS,
  capitalize,
  clean,
  dateNumeric,
  pdfMoney,
  pdfNumber,
  pdfPercent,
  receiptNumber,
  safeFilePart } from
'./theme';
import {
  COMPACT_HEADER_HEIGHT,
  FOOTER_HEIGHT,
  TABLE_STYLES,
  drawTable,
  barChart,
  createDoc,
  drawHeader,
  ensureSpace,
  finalize,
  kpiCards,
  sectionTitle,
  setText,
  shareBar,
  type BarPoint,
  type DocContext } from
'./kit';
import type { BuiltPdf } from './receipt';

export type ReportInput = {
  range: DateRange;
  sales: Sale[];
  expenses: Expense[];
  appointments: Appointment[];
  products: Product[];
  center: CenterInfo;
  generatedBy: string;
};

function lastTableY(ctx: DocContext, fallback: number): number {
  const table = (ctx.doc as any).lastAutoTable as {finalY?: number;} | undefined;
  return table?.finalY ?? fallback;
}

/** Découpe la période en barres : jours (<= 31 j), semaines (<= 100 j) ou mois. */
function buildBuckets(range: DateRange): {label: string;start: string;end: string;}[] {
  const start = parseISO(range.start);
  const end = parseISO(range.end);
  const days = differenceInCalendarDays(end, start) + 1;
  const buckets: {label: string;start: string;end: string;}[] = [];
  const key = (date: Date) => format(date, 'yyyy-MM-dd');

  if (days <= 31) {
    for (let i = 0; i < days; i += 1) {
      const day = addDays(start, i);
      buckets.push({ label: format(day, 'd'), start: key(day), end: key(day) });
    }
  } else if (days <= 100) {
    let cursor = startOfWeek(start, { weekStartsOn: 1 });
    while (cursor <= end) {
      const weekEnd = addDays(cursor, 6);
      buckets.push({
        label: format(cursor, 'd/MM'),
        start: key(cursor < start ? start : cursor),
        end: key(weekEnd > end ? end : weekEnd)
      });
      cursor = addDays(cursor, 7);
    }
  } else {
    let cursor = startOfMonth(start);
    while (cursor <= end) {
      const next = startOfMonth(addDays(cursor, 32));
      const monthEnd = addDays(next, -1);
      buckets.push({
        label: capitalize(format(cursor, 'MMM', { locale: fr })).replace('.', ''),
        start: key(cursor < start ? start : cursor),
        end: key(monthEnd > end ? end : monthEnd)
      });
      cursor = next;
    }
  }
  return buckets;
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

export function buildStatsReport(input: ReportInput): BuiltPdf {
  const { range, generatedBy, center } = input;
  const sales = input.sales.filter((sale) => inRange(sale.date, range));
  const expenses = input.expenses.filter((expense) => inRange(expense.date, range));
  const appointments = input.appointments.filter((appointment) => inRange(appointment.date, range));
  const stats = statsFor(input.sales, input.expenses, range);

  const ctx = createDoc('a4', `Rapport d'activité - ${range.label}`, generatedBy, center);
  const { doc, W, M } = ctx;
  const tableMargin = { left: M, right: M, top: COMPACT_HEADER_HEIGHT + 4, bottom: FOOTER_HEIGHT + 4 };

  let y = drawHeader(ctx, {
    label: 'RAPPORT D’ACTIVITÉ',
    reference: capitalize(range.label),
    caption: `Du ${dateNumeric(range.start)} au ${dateNumeric(range.end)}`
  });

  /* ------------------------------ Synthèse ------------------------------ */
  y = sectionTitle(ctx, y + 1, 'Synthèse de la période') + 2;
  y = kpiCards(
    ctx,
    y,
    [
    { label: 'Chiffre d’affaires', value: pdfMoney(stats.revenue), sub: `${stats.salesCount} vente(s)`, tone: 'dark' },
    { label: 'Dépenses', value: pdfMoney(stats.expenses), sub: `${expenses.length} écriture(s)` },
    {
      label: 'Résultat net',
      value: pdfMoney(stats.net),
      sub: 'encaissements - dépenses',
      tone: stats.net >= 0 ? 'brand' : 'danger'
    },
    { label: 'Profit des ventes', value: pdfMoney(stats.grossProfit), sub: 'avant dépenses' },
    { label: 'Taux de profit', value: pdfPercent(stats.margin), sub: 'profit / chiffre d’affaires' },
    { label: 'Panier moyen', value: pdfMoney(stats.averageTicket), sub: 'par vente' }],

    3
  );

  // TVA collectée et remises accordées (si la période en contient).
  const vatCollected = sum(sales, (sale) => sale.vatAmount);
  const discountsGiven = sum(sales, (sale) => Math.max(0, sale.unitPrice * sale.quantity - sale.total));
  if (vatCollected > 0 || discountsGiven > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(doc, COLORS.ink500);
    const parts = [
    vatCollected > 0 ? `dont TVA collectée : ${pdfMoney(vatCollected)} (reversée, exclue du profit)` : '',
    discountsGiven > 0 ? `remises accordées : ${pdfMoney(discountsGiven)}` : ''].
    filter(Boolean);
    doc.text(clean(parts.join('   ·   ')), M, y - 2);
    y += 4;
  }

  /* ------------------------ Services vs produits ------------------------ */
  y = ensureSpace(ctx, y, 48);
  y = sectionTitle(ctx, y, 'Répartition services / produits') + 2;
  y = shareBar(ctx, y, [
  { label: 'Services', value: stats.serviceRevenue, color: COLORS.brand },
  { label: 'Produits', value: stats.productRevenue, color: COLORS.ink900 }]
  );

  const serviceSales = sales.filter((sale) => sale.kind === 'service');
  const productSales = sales.filter((sale) => sale.kind === 'produit');
  const share = (value: number) => stats.revenue > 0 ? pdfPercent(value / stats.revenue * 100) : '-';

  drawTable(doc, {
    ...TABLE_STYLES,
    startY: y,
    margin: tableMargin,
    head: [['Catégorie', 'Ventes', 'Quantité', 'Chiffre d’affaires', 'Profit', 'Part du CA']],
    body: [
    [
    'Services',
    String(serviceSales.length),
    pdfNumber(sum(serviceSales, (s) => s.quantity), 0),
    pdfMoney(stats.serviceRevenue),
    pdfMoney(sum(serviceSales, (s) => s.profit)),
    share(stats.serviceRevenue)],

    [
    'Produits',
    String(productSales.length),
    pdfNumber(sum(productSales, (s) => s.quantity), 0),
    pdfMoney(stats.productRevenue),
    pdfMoney(sum(productSales, (s) => s.profit)),
    share(stats.productRevenue)]],


    foot: [
    [
    'Total',
    String(stats.salesCount),
    pdfNumber(sum(sales, (s) => s.quantity), 0),
    pdfMoney(stats.revenue),
    pdfMoney(stats.grossProfit),
    stats.revenue > 0 ? pdfPercent(100) : '-']],


    showFoot: 'lastPage',
    columnStyles: numericColumns([1, 2, 3, 4, 5])
  });
  y = lastTableY(ctx, y) + 8;

  /* --------------------------- Évolution (barres) --------------------------- */
  y = ensureSpace(ctx, y, 66);
  y = sectionTitle(ctx, y, 'Encaissements et dépenses', 'en TND') + 3;
  const points: BarPoint[] = buildBuckets(range).map((bucket) => ({
    label: bucket.label,
    a: sum(sales.filter((s) => s.date >= bucket.start && s.date <= bucket.end), (s) => s.total),
    b: sum(expenses.filter((e) => e.date >= bucket.start && e.date <= bucket.end), (e) => e.amount)
  }));
  if (points.every((point) => point.a === 0 && point.b === 0)) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    setText(doc, COLORS.ink500);
    doc.text('Aucune activité sur la période.', M, y + 4);
    y += 12;
  } else {
    y = barChart(ctx, y, points, { a: 'Encaissements', b: 'Dépenses' });
  }
  y += 4;

  /* ------------------------------ Meilleures ventes ------------------------------ */
  const best = topSellers(input.sales, range, 10);
  const kindOf = new Map(sales.map((sale) => [sale.itemName, sale.kind]));
  const profitOf = new Map<string, number>();
  sales.forEach((sale) => profitOf.set(sale.itemName, (profitOf.get(sale.itemName) ?? 0) + sale.profit));

  y = ensureSpace(ctx, y, 40);
  y = sectionTitle(ctx, y, 'Meilleures ventes', 'par chiffre d’affaires') + 2;
  if (best.length === 0) {
    y = emptyNote(ctx, y, 'Aucune vente sur la période.');
  } else {
    drawTable(doc, {
      ...TABLE_STYLES,
      startY: y,
      margin: tableMargin,
      head: [['#', 'Désignation', 'Type', 'Quantité', 'Chiffre d’affaires', 'Profit']],
      body: best.map((item, index) => [
      String(index + 1),
      clean(item.label),
      kindOf.get(item.label) === 'service' ? 'Service' : 'Produit',
      pdfNumber(item.secondary, 0),
      pdfMoney(item.value),
      pdfMoney(profitOf.get(item.label) ?? 0)]
      ),
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        ...numericColumns([3, 4, 5])
      },
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index === 0) data.cell.styles.halign = 'center';
      }
    });
    y = lastTableY(ctx, y) + 8;
  }

  /* ------------------------------ Dépenses par catégorie ------------------------------ */
  y = ensureSpace(ctx, y, 40);
  y = sectionTitle(ctx, y, 'Dépenses par catégorie') + 2;
  const byCategory = new Map<string, {count: number;amount: number;}>();
  expenses.forEach((expense) => {
    const current = byCategory.get(expense.category) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += expense.amount;
    byCategory.set(expense.category, current);
  });
  if (byCategory.size === 0) {
    y = emptyNote(ctx, y, 'Aucune dépense sur la période.');
  } else {
    const rows = [...byCategory.entries()].sort((a, b) => b[1].amount - a[1].amount);
    drawTable(doc, {
      ...TABLE_STYLES,
      startY: y,
      margin: tableMargin,
      head: [['Catégorie', 'Écritures', 'Montant', 'Part des dépenses']],
      body: rows.map(([category, value]) => [
      clean(category),
      String(value.count),
      pdfMoney(value.amount),
      stats.expenses > 0 ? pdfPercent(value.amount / stats.expenses * 100) : '-']
      ),
      foot: [['Total', String(expenses.length), pdfMoney(stats.expenses), stats.expenses > 0 ? pdfPercent(100) : '-']],
      showFoot: 'lastPage',
      columnStyles: numericColumns([1, 2, 3])
    });
    y = lastTableY(ctx, y) + 8;
  }

  /* ------------------------------ Rendez-vous ------------------------------ */
  y = ensureSpace(ctx, y, 50);
  y = sectionTitle(ctx, y, 'Rendez-vous') + 2;
  const planned = appointments.filter((a) => a.status === 'prévu').length;
  const honored = appointments.filter((a) => a.status === 'honoré').length;
  const cancelled = appointments.filter((a) => a.status === 'annulé').length;
  const closed = honored + cancelled;
  drawTable(doc, {
    ...TABLE_STYLES,
    startY: y,
    margin: tableMargin,
    head: [['Total', 'Prévus', 'Honorés', 'Annulés', 'Taux d’honoration']],
    body: [
    [
    String(appointments.length),
    String(planned),
    String(honored),
    String(cancelled),
    closed > 0 ? pdfPercent(honored / closed * 100) : '-']],


    columnStyles: numericColumns([0, 1, 2, 3, 4]),
    didParseCell: (data) => {
      if (data.section === 'head') data.cell.styles.halign = 'right';
    }
  });
  y = lastTableY(ctx, y);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.2);
  setText(doc, COLORS.ink400);
  doc.text('Taux d’honoration = rendez-vous honorés / (honorés + annulés).', M, y + 4.5);
  y += 11;

  /* ------------------------------ Activité par utilisateur ------------------------------ */
  const byUser = new Map<string, {count: number;revenue: number;}>();
  sales.forEach((sale) => {
    const name = sale.createdByName || 'Non renseigné';
    const current = byUser.get(name) ?? { count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += sale.total;
    byUser.set(name, current);
  });
  y = ensureSpace(ctx, y, 40);
  y = sectionTitle(ctx, y, 'Activité par utilisateur') + 2;
  if (byUser.size === 0) {
    y = emptyNote(ctx, y, 'Aucune vente sur la période.');
  } else {
    drawTable(doc, {
      ...TABLE_STYLES,
      startY: y,
      margin: tableMargin,
      head: [['Utilisateur', 'Ventes', 'Chiffre d’affaires', 'Part du CA']],
      body: [...byUser.entries()].
      sort((a, b) => b[1].revenue - a[1].revenue).
      map(([name, value]) => [
      clean(name),
      String(value.count),
      pdfMoney(value.revenue),
      stats.revenue > 0 ? pdfPercent(value.revenue / stats.revenue * 100) : '-']
      ),
      columnStyles: numericColumns([1, 2, 3])
    });
    y = lastTableY(ctx, y) + 8;
  }

  /* ------------------------------ Stock ------------------------------ */
  y = ensureSpace(ctx, y, 50);
  y = sectionTitle(ctx, y, 'État du stock', 'à la date du rapport') + 2;
  const stockCost = sum(input.products, (p) => p.stock * p.purchasePrice);
  const stockSale = sum(input.products, (p) => p.stock * p.salePrice);
  y = kpiCards(
    ctx,
    y,
    [
    { label: 'Références', value: String(input.products.length) },
    { label: 'Valeur du stock (achat)', value: pdfMoney(stockCost) },
    { label: 'Valeur du stock (vente)', value: pdfMoney(stockSale) }],

    3
  );
  const low = input.products.
  filter((product) => product.stock <= product.minStock).
  sort((a, b) => a.stock - b.stock);
  if (low.length > 0) {
    y = ensureSpace(ctx, y, 30);
    drawTable(doc, {
      ...TABLE_STYLES,
      startY: y,
      margin: tableMargin,
      head: [['Produit en alerte', 'Catégorie', 'Stock', 'Seuil minimal']],
      body: low.map((product) => [
      clean(product.name),
      clean(product.category),
      `${pdfNumber(product.stock, 0)} ${clean(product.unit)}`.trim(),
      pdfNumber(product.minStock, 0)]
      ),
      columnStyles: numericColumns([2, 3]),
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          data.cell.styles.textColor = COLORS.danger;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });
    y = lastTableY(ctx, y) + 8;
  } else {
    y = emptyNote(ctx, y, 'Tous les produits sont au-dessus de leur seuil minimal.');
  }

  /* ------------------------------ Annexe : journal des ventes ------------------------------ */
  doc.addPage();
  y = COMPACT_HEADER_HEIGHT + 4;
  y = sectionTitle(ctx, y, 'Annexe 1 - Journal des ventes', `${sales.length} vente(s)`) + 2;
  if (sales.length === 0) {
    y = emptyNote(ctx, y, 'Aucune vente sur la période.');
  } else {
    drawTable(doc, {
      ...TABLE_STYLES,
      styles: { ...TABLE_STYLES.styles, fontSize: 7.8 },
      startY: y,
      margin: tableMargin,
      head: [['N° reçu', 'Date', 'Heure', 'Client', 'Désignation', 'Qté', 'Total']],
      body: [...sales].
      sort((a, b) => `${a.date}${a.time}` < `${b.date}${b.time}` ? -1 : 1).
      map((sale) => [
      receiptNumber(sale.receiptNo),
      dateNumeric(sale.date),
      sale.time,
      clean(sale.client),
      clean(sale.itemName),
      pdfNumber(sale.quantity, Number.isInteger(sale.quantity) ? 0 : 2),
      pdfMoney(sale.total)]
      ),
      foot: [['', '', '', '', 'Total', pdfNumber(sum(sales, (s) => s.quantity), 0), pdfMoney(stats.revenue)]],
      showFoot: 'lastPage',
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 22 },
        2: { cellWidth: 14 },
        5: { halign: 'right', cellWidth: 12 },
        6: { halign: 'right', cellWidth: 32 }
      },
      didParseCell: (data) => {
        if (data.section !== 'body' && data.column.index >= 5) data.cell.styles.halign = 'right';
      }
    });
    y = lastTableY(ctx, y) + 8;
  }

  /* ------------------------------ Annexe : journal des dépenses ------------------------------ */
  if (expenses.length > 0) {
    y = ensureSpace(ctx, y, 40);
    y = sectionTitle(ctx, y, 'Annexe 2 - Journal des dépenses', `${expenses.length} écriture(s)`) + 2;
    drawTable(doc, {
      ...TABLE_STYLES,
      styles: { ...TABLE_STYLES.styles, fontSize: 7.8 },
      startY: y,
      margin: tableMargin,
      head: [['Date', 'Libellé', 'Catégorie', 'Origine', 'Montant']],
      body: [...expenses].
      sort((a, b) => a.date < b.date ? -1 : 1).
      map((expense) => [
      dateNumeric(expense.date),
      clean(expense.label),
      clean(expense.category),
      expense.source === 'fixe' ? 'Charge fixe' : expense.source === 'stock' ? 'Stock' : 'Saisie',
      pdfMoney(expense.amount)]
      ),
      foot: [['', '', '', 'Total', pdfMoney(stats.expenses)]],
      showFoot: 'lastPage',
      columnStyles: {
        0: { cellWidth: 22 },
        2: { cellWidth: 28 },
        3: { cellWidth: 26 },
        4: { halign: 'right', cellWidth: 34 }
      },
      didParseCell: (data) => {
        if (data.section !== 'body' && data.column.index === 4) data.cell.styles.halign = 'right';
      }
    });
  }

  finalize(ctx, `${center.name} - Rapport du ${dateNumeric(range.start)} au ${dateNumeric(range.end)}`);
  return {
    doc,
    filename: `Rapport-${safeFilePart(range.start)}_${safeFilePart(range.end)}.pdf`
  };
}

function numericColumns(indexes: number[]) {
  const styles: Record<number, {halign: 'right';}> = {};
  indexes.forEach((index) => {
    styles[index] = { halign: 'right' };
  });
  return styles;
}

function emptyNote(ctx: DocContext, y: number, text: string): number {
  const { doc, M } = ctx;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  setText(doc, COLORS.ink500);
  doc.text(clean(text), M, y + 4);
  return y + 12;
}

