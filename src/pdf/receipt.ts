import type { Appointment, Receipt, Sale, ServiceItem } from '../types';
import type { CenterInfo } from '../config/center';
import {
  COLORS,
  appointmentCode,
  clean,
  dateLong,
  dateNumeric,
  pdfMoney,
  pdfNumber,
  receiptNumber,
  safeFilePart } from
'./theme';
import {
  COMPACT_HEADER_HEIGHT,
  FOOTER_HEIGHT,
  TABLE_STYLES,
  drawTable,
  ensureSpace,
  badge,
  createDoc,
  drawHeader,
  finalize,
  infoBlocks,
  sectionTitle,
  setFill,
  setStroke,
  setText,
  signatureBox,
  totalBox,
  type BadgeTone,
  type DocContext } from
'./kit';
import { amountInWords } from './words';
import { VAT_RATE } from '../lib/pricing';

export type BuiltPdf = {doc: import('jspdf').jsPDF;filename: string;};

const STATUS_TONE: Record<Appointment['status'], BadgeTone> = {
  prévu: 'neutral',
  honoré: 'brand',
  annulé: 'danger'
};

function lastTableY(ctx: DocContext, fallback: number): number {
  const table = (ctx.doc as any).lastAutoTable as {finalY?: number;} | undefined;
  return table?.finalY ?? fallback;
}

/* -------------------------------------------------------------------------- */
/*  Reçu de vente (produit ou service)                                        */
/* -------------------------------------------------------------------------- */

export type SaleReceiptInput = {
  receipt: Receipt;
  /** Lignes du reçu (produits et services). */
  lines: Sale[];
  /** Rendez-vous créés par les lignes de service. */
  appointments: Appointment[];
  center: CenterInfo;
  generatedBy: string;
};

export function buildSaleReceipt({ receipt, lines, appointments, center, generatedBy }: SaleReceiptInput): BuiltPdf {
  const number = receiptNumber(receipt.receiptNo);
  const ctx = createDoc('a5', `Reçu ${number}`, generatedBy, center);
  const { doc, W, H, M } = ctx;

  const ordered = [...lines].sort((a, b) =>
  a.kind === b.kind ? a.itemName.localeCompare(b.itemName, 'fr') : a.kind === 'service' ? -1 : 1
  );
  const total = ordered.reduce((sum, line) => sum + line.total, 0);
  const gross = ordered.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discountTotal = Math.max(0, gross - total);
  const vatTotal = ordered.reduce((sum, line) => sum + line.vatAmount, 0);
  const hasDiscount = ordered.some((line) => line.discountPct > 0);
  const hasServices = ordered.some((line) => line.kind === 'service');
  const hasProducts = ordered.some((line) => line.kind === 'produit');
  const phone = receipt.phone || appointments.find((item) => item.phone)?.phone || '';
  const apptOf = new Map(appointments.map((item) => [item.id, item]));

  let y = drawHeader(ctx, {
    label: 'REÇU',
    reference: `N° ${number}`,
    caption: dateLong(receipt.date)
  });

  // Client + détails
  const clientRows: [string, string][] = [
  [receipt.isBulk ? 'Acheteur' : hasServices && !hasProducts ? 'Patient' : 'Client', receipt.client || '-']];
  if (receipt.company && receipt.company !== receipt.client) clientRows.push(['Société', receipt.company]);

  if (phone) clientRows.push(['Téléphone', phone]);

  y = infoBlocks(ctx, y, [
  { title: 'Client', rows: clientRows },
  {
    title: 'Détails',
    rows: [
    ['Date', dateNumeric(receipt.date)],
    ['Heure', receipt.time || '-'],
    ['Articles', String(ordered.length)],
    ...(receipt.isBulk ? [['Type', 'Vente par lot'] as [string, string]] : []),
    ...(receipt.createdByName ? [['Servi par', receipt.createdByName] as [string, string]] : [])]

  }]
  );

  // Détail de la vente (une ligne par article ; les services indiquent leur rendez-vous)
  y = sectionTitle(ctx, y + 1, 'Détail de la vente') + 1;
  type Row = {name: string;qty: string;unit: string;disc: string;total: string;sub: string;};
  const body: Row[] = ordered.map((line) => {
    const appointment = line.appointmentId ? apptOf.get(line.appointmentId) : undefined;
    return {
      name: clean(line.itemName),
      qty: pdfNumber(line.quantity, Number.isInteger(line.quantity) ? 0 : 2),
      unit: clean(pdfMoney(line.unitPrice)),
      disc: line.discountPct > 0 ? `-${pdfNumber(line.discountPct, Number.isInteger(line.discountPct) ? 0 : 1)} %` : '',
      total: clean(pdfMoney(line.total)),
      sub: line.kind === 'service' ?
      clean(`Rendez-vous le ${dateNumeric(appointment?.date ?? line.date)} à ${appointment?.time ?? line.time}`) :
      ''
    };
  });

  drawTable(doc, {
    ...TABLE_STYLES,
    startY: y,
    margin: { left: M, right: M, top: COMPACT_HEADER_HEIGHT + 4, bottom: FOOTER_HEIGHT + 4 },
    rowPageBreak: 'avoid',
    columns: [
    { header: 'Désignation', dataKey: 'name' },
    { header: 'Qté', dataKey: 'qty' },
    { header: 'Prix unitaire', dataKey: 'unit' },
    ...(hasDiscount ? [{ header: 'Remise', dataKey: 'disc' }] : []),
    { header: 'Total', dataKey: 'total' }],

    body,
    styles: { ...TABLE_STYLES.styles, fontSize: 8.2, cellPadding: { top: 2, right: 3, bottom: 2, left: 3 } },
    columnStyles: {
      name: { cellWidth: 'auto' },
      qty: { halign: 'center', cellWidth: 12 },
      unit: { halign: 'right', cellWidth: 28 },
      disc: { halign: 'right', cellWidth: 16 },
      total: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'head') {
        data.cell.styles.halign = data.column.dataKey === 'name' ? 'left' : data.column.dataKey === 'qty' ? 'center' : 'right';
      }
      const raw = data.row.raw as Row | undefined;
      if (data.section === 'body' && data.column.dataKey === 'name' && raw?.sub) {
        // Réserve une 2e ligne pour le rendez-vous (dessinée dans didDrawCell).
        data.cell.text = [raw.name, ' '];
      }
    },
    didDrawCell: (data) => {
      const raw = data.row.raw as Row | undefined;
      if (data.section === 'body' && data.column.dataKey === 'name' && raw?.sub) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        setText(doc, COLORS.ink500);
        doc.text(raw.sub, data.cell.x + 3, data.cell.y + 2 + 3.5 + 3);
      }
    }
  });
  y = lastTableY(ctx, y + 14) + 6;

  // Bas du reçu : à gauche statut + montant en lettres, à droite total + signature
  // (compact : un reçu courant tient sur une seule page).
  const summary: [string, string][] = [];
  if (hasDiscount) {
    summary.push(['Sous-total', clean(pdfMoney(gross))]);
    summary.push(['Remise', clean(`-${pdfMoney(discountTotal)}`)]);
  }
  if (vatTotal > 0) {
    summary.push(['Total HT', clean(pdfMoney(total - vatTotal))]);
    summary.push([`TVA ${Math.round(VAT_RATE * 100)} %`, clean(pdfMoney(vatTotal))]);
  }
  const summaryH = summary.length * 4.6 + (summary.length ? 2 : 0);
  const rightW = 66;
  const leftW = W - 2 * M - rightW - 6;
  const sigH = 20;

  // Textes de gauche mesurés d'abord pour réserver la bonne hauteur.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const label = doc.splitTextToSize('Arrêté le présent reçu à la somme de :', leftW) as string[];
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(9);
  const words = doc.splitTextToSize(clean(amountInWords(total)), leftW) as string[];
  const wordsBottom = 18 + label.length * 3.8 + 2.2 + words.length * 4.2;
  const leftH = wordsBottom + 4 + sigH;
  const rightH = summaryH + 19;

  y = ensureSpace(ctx, y, Math.max(leftH, rightH) + 2);
  const top = y;

  // Colonne de droite : détail des montants puis total.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  summary.forEach(([text, value], index) => {
    const rowY = top + 3.2 + index * 4.6;
    setText(doc, COLORS.ink500);
    doc.text(text, W - M - rightW, rowY);
    setText(doc, COLORS.ink900);
    doc.text(value, W - M, rowY, { align: 'right' });
  });
  totalBox(ctx, top + summaryH, 'Total payé', total, rightW);

  // Colonne de gauche : statut, montant en lettres, signature.
  badge(ctx, M, top + 0.5, 'Payé', 'brand');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(doc, COLORS.ink500);
  doc.text(`${ordered.length} article${ordered.length > 1 ? 's' : ''}`, M, top + 11.5);

  doc.setFontSize(8);
  doc.text(label, M, top + 18);
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(9);
  setText(doc, COLORS.ink900);
  doc.text(words, M, top + 18 + label.length * 3.8 + 2.2);
  signatureBox(ctx, top + wordsBottom + 4, leftW, sigH, 'left');

  finalize(ctx, center.receiptFooter);
  return {
    doc,
    filename: `Recu-${number}-${safeFilePart(receipt.client)}.pdf`
  };
}

/* -------------------------------------------------------------------------- */
/*  Bon de rendez-vous                                                        */
/* -------------------------------------------------------------------------- */

export type AppointmentSlipInput = {
  appointment: Appointment;
  service?: ServiceItem | null;
  /** Vente liée : fournit le montant encaissé et le numéro de reçu. */
  sale?: Sale | null;
  center: CenterInfo;
  generatedBy: string;
};

export function buildAppointmentSlip({
  appointment,
  service,
  sale,
  center,
  generatedBy
}: AppointmentSlipInput): BuiltPdf {
  const code = appointmentCode(appointment.id);
  const ctx = createDoc('a5', `Rendez-vous ${code}`, generatedBy, center);
  const { doc, W, M } = ctx;
  const price = sale?.total ?? service?.price ?? 0;

  let y = drawHeader(ctx, {
    label: 'RENDEZ-VOUS',
    reference: `N° ${code}`,
    caption: appointment.status === 'annulé' ? 'Rendez-vous annulé' : 'Confirmation de rendez-vous'
  });

  // Carte date / heure
  const cardH = 26;
  setFill(doc, COLORS.brandSoft);
  setStroke(doc, COLORS.brandLine);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, W - 2 * M, cardH, 2.5, 2.5, 'FD');

  const dayNumber = dateNumeric(appointment.date).slice(0, 2);
  setFill(doc, COLORS.brand);
  doc.roundedRect(M + 4, y + 4, 18, 18, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  setText(doc, COLORS.white);
  doc.text(dayNumber, M + 13, y + 16.2, { align: 'center' });

  doc.setFontSize(11);
  setText(doc, COLORS.ink900);
  doc.text(clean(dateLong(appointment.date)), M + 27, y + 10.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, COLORS.ink500);
  doc.text(
    clean(`à ${appointment.time}${appointment.durationMin ? `  ·  durée ${appointment.durationMin} min` : ''}`),
    M + 27,
    y + 17
  );
  badge(ctx, W - M - 4, y + 4, appointment.status, STATUS_TONE[appointment.status], 'right');
  y += cardH + 5;

  // Patient + prestation
  y = infoBlocks(ctx, y, [
  {
    title: 'Patient',
    rows: [
    ['Nom', appointment.client || '-'],
    ['Téléphone', appointment.phone || '-']]

  },
  {
    title: 'Prestation',
    rows: [
    ['Service', appointment.serviceName],
    ['Durée', appointment.durationMin ? `${appointment.durationMin} min` : '-']]

  }]
  );

  if (appointment.note) {
    setFill(doc, COLORS.warningSoft);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const lines = doc.splitTextToSize(clean(appointment.note), W - 2 * M - 8);
    const h = 8.5 + lines.length * 4;
    doc.roundedRect(M, y, W - 2 * M, h, 1.8, 1.8, 'F');
    setText(doc, COLORS.warning);
    doc.text('NOTE', M + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    setText(doc, COLORS.ink900);
    doc.text(lines, M + 4, y + 9.4);
    y += h + 5;
  }

  // Tarif
  y = sectionTitle(ctx, y + 1, 'Tarif') + 1;
  drawTable(doc, {
    ...TABLE_STYLES,
    startY: y,
    margin: { left: M, right: M, bottom: 20 },
    head: [['Prestation', 'Durée', 'Montant']],
    body: [
    [
    clean(appointment.serviceName),
    appointment.durationMin ? `${appointment.durationMin} min` : '-',
    clean(pdfMoney(price))]],


    columnStyles: {
      1: { halign: 'center', cellWidth: 24 },
      2: { halign: 'right', cellWidth: 36, fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0) {
        data.cell.styles.halign = data.column.index === 1 ? 'center' : 'right';
      }
    }
  });
  y = lastTableY(ctx, y + 14) + 5;

  // Règlement
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.6);
  setText(doc, COLORS.ink700);
  if (sale) {
    doc.text(
      clean(`Montant réglé : ${pdfMoney(sale.total)}  ·  Reçu n° ${receiptNumber(sale.receiptNo)}`),
      M,
      y
    );
  } else {
    doc.text('Montant à régler sur place.', M, y);
  }
  y += 8;

  // Consignes
  if (center.appointmentNotes.length > 0 && appointment.status !== 'annulé') {
    y = sectionTitle(ctx, y, 'À savoir') + 1;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    setText(doc, COLORS.ink700);
    center.appointmentNotes.forEach((line) => {
      const wrapped = doc.splitTextToSize(clean(line), W - 2 * M - 5) as string[];
      setFill(doc, COLORS.brand);
      doc.circle(M + 1.2, y - 1, 0.6, 'F');
      doc.text(wrapped, M + 4.5, y);
      y += wrapped.length * 4.1 + 1.2;
    });
  }

  finalize(ctx, center.receiptFooter);
  const stamp = `${appointment.date}-${appointment.time.replace(':', 'h')}`;
  return {
    doc,
    filename: `Rendez-vous-${stamp}-${safeFilePart(appointment.client)}.pdf`
  };
}
