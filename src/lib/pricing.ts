import type { Product } from '../types';

/** Taux de TVA appliqué aux produits marqués « TVA » (même valeur côté base de données). */
export const VAT_RATE = 0.19;

/** Arrondi au millime (dinar tunisien : 3 décimales), identique au calcul de la base. */
export const round3 = (value: number): number => Math.round((value + Number.EPSILON) * 1000) / 1000;

/** Prix payé par le client pour 1 unité : prix saisi x 1,19 si la TVA est activée. */
export function unitPrice(product: Pick<Product, 'salePrice' | 'vat'>): number {
  return round3(product.salePrice * (product.vat ? 1 + VAT_RATE : 1));
}

export type LineAmounts = {
  /** Prix unitaire avant remise (TTC si TVA). */
  unit: number;
  /** Montant avant remise. */
  gross: number;
  /** Montant de la remise. */
  discount: number;
  /** Total payé (après remise, TVA incluse). */
  total: number;
  /** TVA contenue dans le total. */
  vat: number;
  /** Profit : total - TVA reversée - coût d'achat. */
  profit: number;
};

/** Montants d'une ligne produit ; mêmes formules que create_sale() en base. */
export function lineAmounts(
product: Pick<Product, 'salePrice' | 'purchasePrice' | 'vat'>,
quantity: number,
discountPct = 0)
: LineAmounts {
  const unit = unitPrice(product);
  const gross = round3(unit * quantity);
  const total = round3(unit * quantity * (1 - discountPct / 100));
  const vat = product.vat ? round3(total - total / (1 + VAT_RATE)) : 0;
  return {
    unit,
    gross,
    discount: round3(gross - total),
    total,
    vat,
    profit: round3(total - vat - product.purchasePrice * quantity)
  };
}
