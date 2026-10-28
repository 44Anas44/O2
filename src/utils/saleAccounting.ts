import type { Appointment, Sale } from '../types';
import { money } from './format';
import { fmtShortDate } from './date';

/**
 * Règles de comptabilisation d'une ligne de vente (une seule ligne en base par article).
 *
 *  - produit .......................... toujours compté, le jour de la vente ;
 *  - service payé à la réservation .... compté le jour de la vente (sale.date) ;
 *                                       retiré si le rendez-vous est annulé ;
 *  - service non payé ................. compté À LA DATE DU RENDEZ-VOUS (sale.date), mais
 *                                       seulement une fois le rendez-vous honoré — même si
 *                                       on le marque honoré plusieurs jours plus tard ;
 *  - service annulé ................... jamais compté.
 *
 * `sale.date` est donc toujours la date de comptabilisation : il suffit de filtrer
 * les lignes « comptées » puis de les ranger par `sale.date`.
 */
export type LineState =
'produit' |
/** Service payé à la réservation (compté). */
'payé' |
/** Service non payé, rendez-vous pas encore honoré (pas compté). */
'à-payer' |
/** Service non payé à la réservation, rendez-vous honoré : réglé sur place (compté). */
'payé-sur-place' |
/** Service dont le rendez-vous est annulé (pas compté). */
'annulé';

export function lineState(sale: Sale, appointment?: Appointment | null): LineState {
  if (sale.kind !== 'service') return 'produit';
  if (appointment?.status === 'annulé') return 'annulé';
  if (sale.paid) return 'payé';
  return appointment?.status === 'honoré' ? 'payé-sur-place' : 'à-payer';
}

/** La ligne entre-t-elle dans le chiffre d'affaires, le profit et les statistiques ? */
export function isCounted(sale: Sale, appointment?: Appointment | null): boolean {
  const state = lineState(sale, appointment);
  return state !== 'à-payer' && state !== 'annulé';
}

/** Ligne encaissée au moment de la vente : elle figure sur le reçu. */
export function isPaidAtBooking(sale: Sale): boolean {
  return sale.kind === 'produit' || sale.paid;
}

/** Un reçu a-t-il été délivré ? (faux pour une vente de rendez-vous tous non payés) */
export function hasReceiptNo(receiptNo: number): boolean {
  return receiptNo > 0;
}

/** Libellé court de l'état de paiement d'un rendez-vous. */
export function paymentLabel(state: LineState): string {
  switch (state) {
    case 'payé':
      return 'Payé à la réservation';
    case 'à-payer':
      return 'À payer sur place';
    case 'payé-sur-place':
      return 'Payé sur place';
    case 'annulé':
      return 'Annulé';
    default:
      return 'Payé';
  }
}

/**
 * Message de confirmation avant d'annuler un rendez-vous déjà payé : son montant sera
 * retiré du chiffre d'affaires, du profit et des totaux du jour où il a été compté.
 * Renvoie null quand rien n'est à retirer (rendez-vous non payé).
 */
export function cancelConfirmMessage(sale: Sale | undefined): string | null {
  if (!sale || sale.kind !== 'service' || !sale.paid) return null;
  return (
    `Ce rendez-vous a été payé à la réservation (${money(sale.total)}).\n\n` +
    `En l'annulant, ce montant sera retiré des ventes, du profit et des totaux du ${fmtShortDate(sale.date)}.\n\n` +
    'Annuler le rendez-vous ?');

}
