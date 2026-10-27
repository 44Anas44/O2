import { BRAND } from '../brand';
import type { CenterInfo } from '../brand/types';

export type { CenterInfo };

/**
 * Valeurs PAR DÉFAUT des coordonnées du centre (propres à la marque, voir
 * src/brand). L'administrateur les modifie ensuite dans Paramètres.
 */
export const DEFAULT_CENTER: CenterInfo = {
  name: BRAND.name,
  tagline: BRAND.tagline,
  ...BRAND.center,
  logo: ''
};
