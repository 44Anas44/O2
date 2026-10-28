import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BRAND, hexToRgb } from '../brand';

export type RGB = [number, number, number];

export const COLORS = {
  brand: hexToRgb(BRAND.brand[700]) as RGB,
  brandDark: hexToRgb(BRAND.brand[800]) as RGB,
  brandSoft: hexToRgb(BRAND.brand[50]) as RGB,
  brandLine: hexToRgb(BRAND.brand[200]) as RGB,
  ink900: [14, 18, 17] as RGB,
  ink700: [47, 54, 52] as RGB,
  ink500: [92, 102, 99] as RGB,
  ink400: [130, 140, 136] as RGB,
  ink200: [215, 219, 217] as RGB,
  ink100: [235, 237, 236] as RGB,
  ink50: [246, 247, 247] as RGB,
  white: [255, 255, 255] as RGB,
  danger: [185, 28, 28] as RGB,
  dangerSoft: [254, 242, 242] as RGB,
  warning: [180, 83, 9] as RGB,
  warningSoft: [255, 247, 237] as RGB
};

/**
 * Les polices PDF standard ne gèrent que le jeu de caractères WinAnsi :
 * on remplace les espaces fines / signes typographiques qui n'en font pas
 * partie, sinon ils s'impriment comme des symboles illisibles.
 */
export function clean(text: string | number | undefined | null): string {
  return String(text ?? '').
  replace(/[\u202F\u2009\u2007]/g, '\u00A0').
  replace(/\u2212/g, '-').
  replace(/[\u2018\u2019]/g, "'").
  replace(/[\u201C\u201D]/g, '"').
  replace(/\u2192/g, '->');
}

const NBSP = '\u00A0';

/** 1234.5 -> "1 234,500" (séparateur de milliers = espace insécable). */
export function pdfNumber(value: number, decimals = 3): string {
  const rounded = Math.round((value + Number.EPSILON) * 10 ** decimals) / 10 ** decimals;
  const negative = rounded < 0;
  const [int, dec] = Math.abs(rounded).toFixed(decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${negative ? '-' : ''}${grouped}${dec ? `,${dec}` : ''}`;
}

/** Montant en dinars tunisiens, 3 décimales (millimes). */
export function pdfMoney(value: number): string {
  return `${pdfNumber(value, 3)}${NBSP}TND`;
}

export function pdfPercent(value: number): string {
  if (!isFinite(value)) return '-';
  return `${pdfNumber(value, 1)}${NBSP}%`;
}

export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function dateLong(key: string): string {
  return capitalize(format(parseISO(key), 'EEEE d MMMM yyyy', { locale: fr }));
}

export function dateNumeric(key: string): string {
  return format(parseISO(key), 'dd/MM/yyyy');
}

export function dateTimeNow(): string {
  return format(new Date(), "dd/MM/yyyy 'à' HH:mm", { locale: fr });
}

export function receiptNumber(no: number): string {
  // 0 / négatif : aucun reçu délivré (vente composée uniquement de rendez-vous non payés).
  if (!(no > 0)) return '-';
  return `REC-${String(no).padStart(6, '0')}`;
}

/** Code court et stable pour un rendez-vous, dérivé de son identifiant. */
export function appointmentCode(id: string): string {
  return `RDV-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

/** Nom de fichier sûr (sans accents ni caractères interdits). */
export function safeFilePart(text: string): string {
  return text.
  normalize('NFD').
  replace(/[\u0300-\u036f]/g, '').
  replace(/[^a-zA-Z0-9]+/g, '-').
  replace(/^-+|-+$/g, '').
  slice(0, 40) || 'client';
}
