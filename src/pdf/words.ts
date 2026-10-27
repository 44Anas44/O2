import { capitalize } from './theme';

const UNITS = [
'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];

const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

/** 1 à 99. `final` : le « s » de quatre-vingts est conservé en fin de nombre. */
function below100(n: number, final: boolean): string {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) {
    const tens = Math.floor(n / 10);
    const unit = n % 10;
    if (unit === 0) return TENS[tens];
    if (unit === 1) return `${TENS[tens]} et un`;
    return `${TENS[tens]}-${UNITS[unit]}`;
  }
  if (n < 80) {
    // 70 à 79 : soixante-dix, soixante et onze, soixante-douze...
    if (n === 71) return 'soixante et onze';
    return `soixante-${below100(n - 60, false)}`;
  }
  // 80 à 99 : quatre-vingts, quatre-vingt-un, quatre-vingt-onze...
  if (n === 80) return final ? 'quatre-vingts' : 'quatre-vingt';
  return `quatre-vingt-${below100(n - 80, false)}`;
}

/** 1 à 999. */
function below1000(n: number, final: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) {
    const head = hundreds > 1 ? `${UNITS[hundreds]} cent` : 'cent';
    parts.push(hundreds > 1 && rest === 0 && final ? `${head}s` : head);
  }
  if (rest > 0) parts.push(below100(rest, final));
  return parts.join(' ');
}

/** Entier de 0 à 999 999 999 écrit en toutes lettres (français). */
export function frenchWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'zéro';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor(n / 1000) % 1000;
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions > 0) {
    parts.push(millions === 1 ? 'un million' : `${below1000(millions, false)} millions`);
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'mille' : `${below1000(thousands, false)} mille`);
  }
  if (rest > 0) parts.push(below1000(rest, true));
  return parts.join(' ');
}

/** 125.5 -> « Cent vingt-cinq dinars et cinq cents millimes ». */
export function amountInWords(amount: number): string {
  const total = Math.round(Math.abs(amount) * 1000);
  const dinars = Math.floor(total / 1000);
  const millimes = total % 1000;

  const dinarPart =
  dinars > 0 ? `${frenchWords(dinars)} ${dinars > 1 ? 'dinars' : 'dinar'}` : '';
  const millimePart =
  millimes > 0 ? `${frenchWords(millimes)} ${millimes > 1 ? 'millimes' : 'millime'}` : '';

  if (dinarPart && millimePart) return capitalize(`${dinarPart} et ${millimePart}`);
  if (dinarPart) return capitalize(dinarPart);
  if (millimePart) return capitalize(millimePart);
  return 'Zéro dinar';
}
