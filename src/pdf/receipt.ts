import type { Appointment, Sale, ServiceItem } from '../types';
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
  TABLE_STYLES,
  drawTable,
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
  sale: Sale;
  /** Rendez-vous lié (vente de service). */
  appointment?: Appointment | null;
  center: CenterInfo;
  generatedBy: string;
};

export function buildSaleReceipt({ sale, appointment, center, generatedBy }: SaleReceiptInput): BuiltPdf {
  const number = receiptNumber(sale.receiptNo);
  const ctx = createDoc('a5', `Reçu ${number}`, generatedBy, center);
  const { doc, W, H, M } = ctx;

  let y = drawHeader(ctx, {
    label: 'REÇU',
    reference: `N° ${number}`,
    caption: dateLong(sale.date)
  });

  // Client + détails
  const clientRows: [string, string][] = [
  [sale.kind === 'service' ? 'Patient' : 'Client', sale.client || '-']];

  if (appointment?.phone) clientRows.push(['Téléphone', appointment.phone]);

  y = infoBlocks(ctx, y, [
  { title: 'Client', rows: clientRows },
  {
    title: 'Détails',
    rows: [
    ['Date', dateNumeric(sale.date)],
    ['Heure', sale.time || '-'],
    ['Nature', sale.kind === 'service' ? 'Service' : 'Produit'],
    ...(sale.createdByName ? [['Servi par', sale.createdByName] as [string, string]] : [])]

  }]
  );

  // Rendez-vous associé
  if (appointment) {
    setFill(doc, COLORS.brandSoft);
    setStroke(doc, COLORS.brandLine);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, W - 2 * M, 10, 1.8, 1.8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    setText(doc, COLORS.brandDark);
    doc.text(
      clean(`Rendez-vous : ${dateLong(appointment.date)} à ${appointment.time}`),
      M + 4,
      y + 6.2
    );
    badge(ctx, W - M - 3, y + 1.8, appointment.status, STATUS_TONE[appointment.status], 'right');
    y += 15;
  }

  // Détail de la vente
  y = sectionTitle(ctx, y + 1, 'Détail de la vente') + 1;
  drawTable(doc, {
    ...TABLE_STYLES,
    startY: y,
    margin: { left: M, right: M, bottom: 20 },
    head: [['Désignation', 'Qté', 'Prix unitaire', 'Total']],
    body: [
    [
    clean(sale.itemName),
    pdfNumber(sale.quantity, Number.isInteger(sale.quantity) ? 0 : 2),
    clean(pdfMoney(sale.unitPrice)),
    clean(pdfMoney(sale.total))]],


    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 14 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32, fontStyle: 'bold' }
    },
    headStyles: { ...TABLE_STYLES.headStyles, halign: 'left' },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0) {
        data.cell.styles.halign = data.column.index === 1 ? 'center' : 'right';
      }
    }
  });
  y = lastTableY(ctx, y + 14) + 6;

  // Total + montant en lettres
  const totalTop = y;
  y = totalBox(ctx, y, 'Total payé', sale.total, 66);
  badge(ctx, M, totalTop + 3.8, 'Payé', 'brand');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(doc, COLORS.ink500);
  doc.text('Arrêté le présent reçu à la somme de :', M, y + 1);
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(9);
  setText(doc, COLORS.ink900);
  const words = doc.splitTextToSize(clean(amountInWords(sale.total)), W - 2 * M);
  doc.text(words, M, y + 6);
  y += 6 + words.length * 4.2 + 4;

  // Signature (calée en bas si la place le permet)
  const sigY = Math.max(y, H - 18 - 30);
  signatureBox(ctx, sigY);

  finalize(ctx, center.receiptFooter);
  return {
    doc,
    filename: `Recu-${number}-${safeFilePart(sale.client)}.pdf`
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
