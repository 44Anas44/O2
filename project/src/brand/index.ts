import identities from './brands.json';
import { theme as secondTheme } from './second/theme';
import type { Brand, BrandIdentity, BrandTheme } from './types';

/**
 * Identité visuelle de l'application : noms (brands.json), couleurs / police / style
 * (second/theme.ts) et logo (second/logo.png, PNG à fond transparent).
 * Sans logo, un monogramme (initiales) est affiché.
 */
const themes: Record<string, BrandTheme> = {
  second: secondTheme
};

const logos = import.meta.glob('./*/logo.png', {
  eager: true,
  query: '?inline',
  import: 'default'
}) as Record<string, string>;

// Marque = VITE_BRAND si défini, sinon le « mode » de compilation (vite build --mode second).
const explicit = import.meta.env.VITE_BRAND as string | undefined;
const requested = explicit || import.meta.env.MODE;
const id = requested in themes && requested in identities ? requested : 'second';
if (explicit && id !== explicit) {
  // eslint-disable-next-line no-console
  console.warn(`Marque « ${explicit} » inconnue, utilisation de « second ».`);
}

export const BRAND: Brand = {
  id,
  ...(identities as Record<string, BrandIdentity>)[id],
  ...themes[id],
  logo: logos[`./${id}/logo.png`]
};

function triplet(hex: string): string {
  const value = hex.replace('#', '');
  return `${parseInt(value.slice(0, 2), 16)} ${parseInt(value.slice(2, 4), 16)} ${parseInt(value.slice(4, 6), 16)}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const [r, g, b] = triplet(hex).split(' ').map(Number);
  return [r, g, b];
}

/** Applique couleurs, police, arrondis, titre et icône de la marque active. */
export function applyBrand(): void {
  const root = document.documentElement;
  (Object.keys(BRAND.brand) as unknown as (keyof typeof BRAND.brand)[]).forEach((step) => {
    root.style.setProperty(`--brand-${step}`, triplet(BRAND.brand[step]));
    root.style.setProperty(`--ink-${step}`, triplet(BRAND.ink[step]));
  });
  const sharp = BRAND.radius === 'sharp';
  root.style.setProperty('--r-lg', sharp ? '0.25rem' : '0.5rem');
  root.style.setProperty('--r-xl', sharp ? '0.375rem' : '0.75rem');
  root.style.setProperty('--r-2xl', sharp ? '0.5rem' : '1rem');
  root.style.setProperty('--font-sans', BRAND.font.family);
  root.lang = 'fr';

  document.title = BRAND.productName;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BRAND.brand[700]);

  if (BRAND.font.googleUrl) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BRAND.font.googleUrl;
    document.head.appendChild(link);
  }
  if (BRAND.logo) {
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.type = 'image/png';
    icon.href = BRAND.logo;
  }
}
