import { addMonths, endOfMonth, endOfQuarter, endOfYear, format, startOfMonth, startOfQuarter, startOfYear, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { dayKey, fmtShortDate, type DateRange } from './date';

export type RangePreset = 'mois' | 'mois_prec' | 'trimestre' | 'annee' | '30j' | 'perso';

export const PRESET_LABELS: Record<RangePreset, string> = {
  mois: 'Ce mois',
  mois_prec: 'Mois dernier',
  trimestre: 'Ce trimestre',
  '30j': '30 derniers jours',
  annee: 'Cette année',
  perso: 'Personnalisé'
};

export function presetRange(preset: RangePreset, custom?: {start: string;end: string;}): DateRange {
  const now = new Date();
  switch (preset) {
    case 'mois_prec': {
      const ref = addMonths(now, -1);
      return { start: dayKey(startOfMonth(ref)), end: dayKey(endOfMonth(ref)), label: format(ref, 'MMMM yyyy', { locale: fr }) };
    }
    case 'trimestre':
      return {
        start: dayKey(startOfQuarter(now)),
        end: dayKey(endOfQuarter(now)),
        label: `${Math.floor(now.getMonth() / 3) + 1}e trimestre ${now.getFullYear()}`
      };
    case 'annee':
      return { start: dayKey(startOfYear(now)), end: dayKey(endOfYear(now)), label: `année ${now.getFullYear()}` };
    case '30j':
      return { start: dayKey(subDays(now, 29)), end: dayKey(now), label: '30 derniers jours' };
    case 'perso': {
      const start = custom?.start || dayKey(startOfMonth(now));
      const end = custom?.end || dayKey(now);
      return { start, end, label: `${fmtShortDate(start)} - ${fmtShortDate(end)}` };
    }
    default:
      return { start: dayKey(startOfMonth(now)), end: dayKey(endOfMonth(now)), label: format(now, 'MMMM yyyy', { locale: fr }) };
  }
}
