import { jsPDF } from 'jspdf';
import autoTable, { type UserOptions } from 'jspdf-autotable';
import type { CenterInfo } from '../config/center';
import { BRAND } from '../brand';
import { COLORS, clean, dateTimeNow, pdfMoney, type RGB } from './theme';

/**
 * Charte graphique commune à TOUS les documents (reçus, bons de rendez-vous,
 * rapports) : même en-tête, mêmes couleurs, mêmes blocs d'information, même
 * pied de page. Pour changer l'apparence, modifiez ce fichier et theme.ts.
 */

export type Format = 'a4' | 'a5';

export type DocContext = {
  doc: jsPDF;
  /** Coordonnées du centre (modifiables dans Paramètres). */
  center: CenterInfo;
  /** Largeur / hauteur de page en mm. */
  W: number;
  H: number;
  /** Marge latérale en mm. */
  M: number;
  /** Titre court affiché dans l'en-tête compact des pages suivantes. */
  title: string;
  /** Qui a généré le document (affiché dans le pied de page). */
  generatedBy: string;
};

export function createDoc(
format: Format,
title: string,
generatedBy: string,
center: CenterInfo)
: DocContext {
  const doc = new jsPDF({ unit: 'mm', format, orientation: 'portrait', compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setProperties({
    title: clean(title),
    author: clean(center.name),
    creator: BRAND.productName
  });
  return { doc, center, W, H, M: format === 'a5' ? 12 : 15, title, generatedBy };
}

export const FOOTER_HEIGHT = 18;
export const COMPACT_HEADER_HEIGHT = 18;

export function setFill(doc: jsPDF, color: RGB) {
  doc.setFillColor(color[0], color[1], color[2]);
}
export function setStroke(doc: jsPDF, color: RGB) {
  doc.setDrawColor(color[0], color[1], color[2]);
}
export function setText(doc: jsPDF, color: RGB) {
  doc.setTextColor(color[0], color[1], color[2]);
}

/** Logo (image de la marque) ou monogramme ; retourne la largeur occupée (mm). */
function drawLogo(ctx: DocContext, x: number, y: number, height: number): number {
  const { doc } = ctx;
  const logo = ctx.center.logo || BRAND.logo;
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const width = Math.min(height * (props.width / props.height), 34);
      doc.addImage(logo, 'PNG', x, y, width, width * (props.height / props.width));
      return width;
    } catch {
      // image illisible : on retombe sur le monogramme
    }
  }
  setFill(doc, COLORS.brand);
  doc.roundedRect(x, y, height, height, 2.2, 2.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(height * 0.8);
  setText(doc, COLORS.white);
  doc.text(clean(BRAND.initials), x + height / 2, y + height / 2 + height * 0.14, { align: 'center' });
  return height;
}

export type HeaderOptions = {
  /** Type de document, ex. « REÇU ». */
  label: string;
  /** Ligne sous le libellé, ex. « N° REC-000123 ». */
  reference: string;
  /** Deuxième ligne sous le libellé, ex. la date. */
  caption?: string;
};

/** En-tête complet (première page). Retourne l'ordonnée où commence le contenu. */
export function drawHeader(ctx: DocContext, options: HeaderOptions): number {
  const { doc, W, M } = ctx;

  // Bandeau supérieur
  setFill(doc, COLORS.brand);
  doc.rect(0, 0, W, 4, 'F');

  // Identité du centre
  const logoWidth = drawLogo(ctx, M, 10, 13);
  const textX = M + logoWidth + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  setText(doc, COLORS.ink900);
  doc.text(clean(ctx.center.name), textX, 15.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(doc, COLORS.brand);
  doc.text(clean(ctx.center.tagline), textX, 19.6);

  const contact = [ctx.center.address, ctx.center.phone && `Tél : ${ctx.center.phone}`, ctx.center.email].
  filter(Boolean).
  join('  ·  ');
  let lineY = 27;
  doc.setFontSize(7.5);
  setText(doc, COLORS.ink500);
  if (contact) {
    doc.text(clean(contact), M, lineY);
    lineY += 3.8;
  }
  if (ctx.center.taxId) {
    doc.text(clean(`MF : ${ctx.center.taxId}`), M, lineY);
    lineY += 3.8;
  }

  // Type de document à droite
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  setText(doc, COLORS.brand);
  doc.text(clean(options.label), W - M, 17, { align: 'right' });

  doc.setFontSize(9.5);
  setText(doc, COLORS.ink900);
  doc.text(clean(options.reference), W - M, 22.8, { align: 'right' });

  if (options.caption) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(doc, COLORS.ink500);
    doc.text(clean(options.caption), W - M, 27.4, { align: 'right' });
  }

  const ruleY = Math.max(lineY, 29) + 2;
  setStroke(doc, COLORS.brand);
  doc.setLineWidth(0.5);
  doc.line(M, ruleY, W - M, ruleY);
  return ruleY + 6;
}

/** En-tête compact, pages 2+ d'un document long. */
function drawCompactHeader(ctx: DocContext) {
  const { doc, W, M } = ctx;
  setFill(doc, COLORS.brand);
  doc.rect(0, 0, W, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setText(doc, COLORS.ink900);
  doc.text(clean(ctx.center.name), M, 10);
  doc.setFont('helvetica', 'normal');
  setText(doc, COLORS.ink500);
  doc.text(clean(ctx.title), W - M, 10, { align: 'right' });
  setStroke(doc, COLORS.ink200);
  doc.setLineWidth(0.25);
  doc.line(M, 13, W - M, 13);
}

/**
 * À appeler en dernier : dessine l'en-tête compact des pages 2+ et le pied de
 * page (mentions + « Page x / y ») sur toutes les pages.
 */
export function finalize(ctx: DocContext, footerNote?: string) {
  const { doc, W, H, M } = ctx;
  const pages = doc.getNumberOfPages();

  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    if (page > 1) drawCompactHeader(ctx);

    const lineY = H - FOOTER_HEIGHT + 4;
    setStroke(doc, COLORS.ink200);
    doc.setLineWidth(0.25);
    doc.line(M, lineY, W - M, lineY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    if (footerNote) {
      doc.setFont('helvetica', 'italic');
      setText(doc, COLORS.ink700);
      doc.text(clean(footerNote), W / 2, lineY + 4.6, { align: 'center' });
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    setText(doc, COLORS.ink400);
    doc.text(
      clean(`Document généré le ${dateTimeNow()}${ctx.generatedBy ? ` par ${ctx.generatedBy}` : ''}`),
      M,
      lineY + 9
    );
    doc.text(`Page ${page} / ${pages}`, W - M, lineY + 9, { align: 'right' });
  }
}

/** Passe à une nouvelle page si le contenu `needed` ne tient pas. */
export function ensureSpace(ctx: DocContext, y: number, needed: number): number {
  if (y + needed <= ctx.H - FOOTER_HEIGHT - 2) return y;
  ctx.doc.addPage();
  return COMPACT_HEADER_HEIGHT + 4;
}

/** Titre de section : petit trait d'accent + texte en capitales. */
export function sectionTitle(ctx: DocContext, y: number, text: string, note?: string): number {
  const { doc, M, W } = ctx;
  setFill(doc, COLORS.brand);
  doc.rect(M, y - 3.6, 1.2, 4.6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  setText(doc, COLORS.ink900);
  doc.text(clean(text.toUpperCase()), M + 3.2, y);
  if (note) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(doc, COLORS.ink500);
    doc.text(clean(note), W - M, y, { align: 'right' });
  }
  return y + 4.5;
}

export type InfoBlock = {
  title: string;
  rows: [label: string, value: string][];
};

/** Rangée de blocs d'information (client, détails...) de même hauteur. */
export function infoBlocks(ctx: DocContext, y: number, blocks: InfoBlock[]): number {
  const { doc, W, M } = ctx;
  const gap = 4;
  const width = (W - 2 * M - gap * (blocks.length - 1)) / blocks.length;
  const rowHeight = 5.6;
  const maxRows = Math.max(...blocks.map((block) => block.rows.length));
  const height = 9 + maxRows * rowHeight;

  blocks.forEach((block, index) => {
    const x = M + index * (width + gap);
    setFill(doc, COLORS.ink50);
    setStroke(doc, COLORS.ink100);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, width, height, 1.8, 1.8, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setText(doc, COLORS.brand);
    doc.text(clean(block.title.toUpperCase()), x + 4, y + 5.4);

    block.rows.forEach(([label, value], rowIndex) => {
      const rowY = y + 11 + rowIndex * rowHeight;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setText(doc, COLORS.ink500);
      doc.text(clean(label), x + 4, rowY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.6);
      setText(doc, COLORS.ink900);
      const maxValueWidth = width - 8 - doc.getTextWidth(clean(label)) - 3;
      const shown = fit(doc, clean(value || '-'), Math.max(maxValueWidth, 12));
      doc.text(shown, x + width - 4, rowY, { align: 'right' });
    });
  });

  return y + height + 5;
}

/** Tronque un texte avec « … » pour qu'il tienne dans `maxWidth` (mm). */
export function fit(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && doc.getTextWidth(`${out}...`) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out.trimEnd()}...`;
}

export type BadgeTone = 'brand' | 'danger' | 'warning' | 'neutral';

const BADGE_COLORS: Record<BadgeTone, {bg: RGB;fg: RGB;}> = {
  brand: { bg: COLORS.brandSoft, fg: COLORS.brand },
  danger: { bg: COLORS.dangerSoft, fg: COLORS.danger },
  warning: { bg: COLORS.warningSoft, fg: COLORS.warning },
  neutral: { bg: COLORS.ink100, fg: COLORS.ink700 }
};

/** Pastille colorée (statut). `align` indique de quel côté `x` est l'ancre. */
export function badge(
ctx: DocContext,
x: number,
y: number,
text: string,
tone: BadgeTone,
align: 'left' | 'right' = 'left')
: number {
  const { doc } = ctx;
  const colors = BADGE_COLORS[tone];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const label = clean(text.toUpperCase());
  const width = doc.getTextWidth(label) + 7;
  const left = align === 'right' ? x - width : x;
  setFill(doc, colors.bg);
  setStroke(doc, colors.fg);
  doc.setLineWidth(0.3);
  doc.roundedRect(left, y, width, 6.4, 3.2, 3.2, 'FD');
  setText(doc, colors.fg);
  doc.text(label, left + width / 2, y + 4.4, { align: 'center' });
  return width;
}

/** Encadré « Total » aligné à droite. */
export function totalBox(
ctx: DocContext,
y: number,
label: string,
amount: number,
width = 70)
: number {
  const { doc, W, M } = ctx;
  const x = W - M - width;
  setFill(doc, COLORS.brand);
  doc.roundedRect(x, y, width, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(doc, COLORS.brandLine);
  doc.text(clean(label.toUpperCase()), x + 4, y + 5.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  setText(doc, COLORS.white);
  doc.text(clean(pdfMoney(amount)), x + width - 4, y + 11, { align: 'right' });
  return y + 14 + 5;
}

export type Kpi = {
  label: string;
  value: string;
  sub?: string;
  tone?: 'brand' | 'danger' | 'dark' | 'plain';
};

/** Grille de cartes indicateur (`columns` par ligne). */
export function kpiCards(ctx: DocContext, y: number, items: Kpi[], columns = 3): number {
  const { doc, W, M } = ctx;
  const gap = 4;
  const width = (W - 2 * M - gap * (columns - 1)) / columns;
  const height = 19.5;
  const rows = Math.ceil(items.length / columns);

  items.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = M + col * (width + gap);
    const top = y + row * (height + gap);
    const tone = item.tone ?? 'plain';

    if (tone === 'dark') {
      setFill(doc, COLORS.ink900);
      doc.roundedRect(x, top, width, height, 2, 2, 'F');
    } else {
      setFill(doc, tone === 'brand' ? COLORS.brandSoft : COLORS.white);
      setStroke(doc, tone === 'brand' ? COLORS.brandLine : COLORS.ink200);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, top, width, height, 2, 2, 'FD');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(doc, tone === 'dark' ? COLORS.ink200 : COLORS.ink500);
    doc.text(clean(item.label.toUpperCase()), x + 4, top + 5.6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    const valueColor =
    tone === 'dark' ? COLORS.white : tone === 'danger' ? COLORS.danger : tone === 'brand' ? COLORS.brandDark : COLORS.ink900;
    setText(doc, valueColor);
    doc.text(fit(doc, clean(item.value), width - 8), x + 4, top + 12.6);

    if (item.sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      setText(doc, tone === 'dark' ? COLORS.ink200 : COLORS.ink400);
      doc.text(fit(doc, clean(item.sub), width - 8), x + 4, top + 16.9);
    }
  });

  return y + rows * height + (rows - 1) * gap + 6;
}

export type BarPoint = {label: string;a: number;b: number;};

/**
 * Histogramme à deux séries (ex. encaissements / dépenses) dessiné en
 * primitives PDF : net à l'impression, sans image.
 */
export function barChart(
ctx: DocContext,
y: number,
points: BarPoint[],
legend: {a: string;b: string;},
height = 52)
: number {
  const { doc, W, M } = ctx;
  const left = M + 14;
  const right = W - M;
  const top = y + 6;
  const bottom = y + height - 8;
  const plotWidth = right - left;

  // Légende
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  let lx = left;
  ([[legend.a, COLORS.brand], [legend.b, COLORS.ink400]] as [string, RGB][]).forEach(
    ([name, color]) => {
      setFill(doc, color);
      doc.rect(lx, y, 3, 3, 'F');
      setText(doc, COLORS.ink700);
      doc.text(clean(name), lx + 4.5, y + 2.6);
      lx += doc.getTextWidth(clean(name)) + 12;
    }
  );

  const rawMax = Math.max(1, ...points.map((point) => Math.max(point.a, point.b)));
  const magnitude = 10 ** Math.floor(Math.log10(rawMax));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s * 4 >= rawMax) ?? magnitude * 10;
  const max = step * 4;

  // Grille + graduations
  doc.setFontSize(6.8);
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = step * tick;
    const ty = bottom - (bottom - top) * (value / max);
    setStroke(doc, tick === 0 ? COLORS.ink400 : COLORS.ink100);
    doc.setLineWidth(tick === 0 ? 0.3 : 0.2);
    doc.line(left, ty, right, ty);
    setText(doc, COLORS.ink400);
    doc.text(shortNumber(value), left - 2, ty + 1.1, { align: 'right' });
  }

  const slot = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.min(slot * 0.34, 7);
  const labelEvery = Math.max(1, Math.ceil(points.length / 14));

  points.forEach((point, index) => {
    const center = left + slot * index + slot / 2;
    const hA = (bottom - top) * (point.a / max);
    const hB = (bottom - top) * (point.b / max);
    if (hA > 0) {
      setFill(doc, COLORS.brand);
      doc.rect(center - barWidth - 0.3, bottom - hA, barWidth, hA, 'F');
    }
    if (hB > 0) {
      setFill(doc, COLORS.ink400);
      doc.rect(center + 0.3, bottom - hB, barWidth, hB, 'F');
    }
    if (index % labelEvery === 0) {
      setText(doc, COLORS.ink500);
      doc.text(clean(point.label), center, bottom + 4.2, { align: 'center' });
    }
  });

  return y + height + 2;
}

function shortNumber(value: number): string {
  if (value >= 1_000_000) return `${trim(value / 1_000_000)} M`;
  if (value >= 1000) return `${trim(value / 1000)} k`;
  return trim(value);
}

function trim(value: number): string {
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

/** Barre de répartition horizontale (ex. services vs produits). */
export function shareBar(
ctx: DocContext,
y: number,
parts: {label: string;value: number;color: RGB;}[])
: number {
  const { doc, W, M } = ctx;
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const width = W - 2 * M;
  if (total <= 0) return y;
  let x = M;
  parts.forEach((part) => {
    const w = width * (part.value / total);
    if (w > 0) {
      setFill(doc, part.color);
      doc.rect(x, y, w, 4, 'F');
      x += w;
    }
  });
  return y + 9;
}

/** Cadre vide « Cachet et signature ». */
export function signatureBox(
ctx: DocContext,
y: number,
width = 56,
height = 26,
align: 'left' | 'right' = 'right')
: number {
  const { doc, W, M } = ctx;
  const x = align === 'right' ? W - M - width : M;
  setStroke(doc, COLORS.ink200);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 2, 2, 'D');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(doc, COLORS.ink400);
  doc.text('Cachet et signature', x + width / 2, y + 5, { align: 'center' });
  return y + height + 4;
}

/** Table : styles communs à tous les documents (utilisé avec autoTable). */
export const TABLE_STYLES = {
  theme: 'plain' as const,
  styles: {
    font: 'helvetica',
    fontSize: 8.4,
    textColor: COLORS.ink900,
    cellPadding: { top: 2.4, right: 3, bottom: 2.4, left: 3 },
    lineColor: COLORS.ink100,
    lineWidth: { bottom: 0.25 }
  },
  headStyles: {
    fillColor: COLORS.brand,
    textColor: COLORS.white,
    fontStyle: 'bold' as const,
    fontSize: 7.8,
    lineWidth: 0
  },
  footStyles: {
    fillColor: COLORS.ink50,
    textColor: COLORS.ink900,
    fontStyle: 'bold' as const,
    lineWidth: { top: 0.4 },
    lineColor: COLORS.brand
  },
  alternateRowStyles: { fillColor: COLORS.ink50 }
};

/**
 * autoTable + alignement : les colonnes déclarées `halign: 'right'` dans
 * columnStyles ont aussi leur en-tête et leur pied alignés à droite.
 */
export function drawTable(doc: jsPDF, options: UserOptions) {
  const right = Object.entries((options.columnStyles ?? {}) as Record<string, {halign?: string;}>).
  filter(([, style]) => style.halign === 'right').
  map(([index]) => Number(index));
  const user = options.didParseCell;
  autoTable(doc, {
    ...options,
    didParseCell: (data) => {
      if ((data.section === 'head' || data.section === 'foot') && right.includes(data.column.index)) {
        data.cell.styles.halign = 'right';
      }
      user?.(data);
    }
  });
}
