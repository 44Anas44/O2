import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek } from
'date-fns';
import { fr } from 'date-fns/locale';
import type { Period } from '../types';

export const DAY_KEY = 'yyyy-MM-dd';

export function dayKey(date: Date): string {
  return format(date, DAY_KEY);
}

export function todayKey(): string {
  return dayKey(new Date());
}

export function tomorrowKey(): string {
  return dayKey(addDays(new Date(), 1));
}

export function monthKey(date: Date): string {
  return format(date, 'yyyy-MM');
}

export function nowTime(): string {
  return format(new Date(), 'HH:mm');
}

export function fmtLongDate(key: string): string {
  return format(parseISO(key), 'EEEE d MMMM yyyy', { locale: fr });
}

export function fmtShortDate(key: string): string {
  return format(parseISO(key), 'd MMM yyyy', { locale: fr });
}

export function fmtDayLabel(key: string): string {
  return format(parseISO(key), 'EEE d MMM', { locale: fr });
}

export function fmtMonthTitle(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: fr });
}

export function relativeDayLabel(key: string): string {
  const diff = differenceInCalendarDays(parseISO(key), new Date());
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  if (diff > 1) return `Dans ${diff} jours`;
  return `Il y a ${Math.abs(diff)} jours`;
}

export type DateRange = {start: string;end: string;label: string;};

export function rangeFor(period: Period, reference = new Date()): DateRange {
  if (period === 'jour') {
    return {
      start: dayKey(reference),
      end: dayKey(reference),
      label: fmtLongDate(dayKey(reference))
    };
  }
  if (period === 'semaine') {
    const start = startOfWeek(reference, { weekStartsOn: 1 });
    const end = endOfWeek(reference, { weekStartsOn: 1 });
    return {
      start: dayKey(start),
      end: dayKey(end),
      label: `${fmtShortDate(dayKey(start))} — ${fmtShortDate(dayKey(end))}`
    };
  }
  const start = startOfMonth(reference);
  const end = endOfMonth(reference);
  return {
    start: dayKey(start),
    end: dayKey(end),
    label: fmtMonthTitle(reference)
  };
}

export function inRange(key: string, range: DateRange): boolean {
  return key >= range.start && key <= range.end;
}

export function buildMonthGrid(reference: Date): string[] {
  const start = startOfWeek(startOfMonth(reference), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(reference), { weekStartsOn: 1 });
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(dayKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];