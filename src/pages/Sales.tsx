import React, { Fragment, useMemo, useState } from 'react';
import { CalendarClockIcon, ChevronDownIcon, ChevronRightIcon, ReceiptIcon, SearchIcon } from 'lucide-react';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { Badge, Button, EmptyState, Panel, PanelHeader, inputClass } from '../components/ui/Primitives';
import { AppointmentSlipButton, SaleReceiptButton } from '../components/ReceiptButtons';
import { PRESET_LABELS, presetRange, type RangePreset } from '../utils/reportRange';
import { inRange, fmtShortDate, todayKey } from '../utils/date';
import { money } from '../utils/format';
import { normalize } from '../utils/search';
import { receiptNumber } from '../pdf/theme';
import { hasReceiptNo, isCounted, lineState, type LineState } from '../utils/saleAccounting';
import type { Appointment, Receipt, Sale } from '../types';

const PAGE = 100;

/** Un reçu, affiché au jour de la vente (réservation). */
type ReceiptRow = {type: 'receipt';key: string;receipt: Receipt;lines: Sale[];sort: string;};
/**
 * Un service affiché au jour de son rendez-vous alors que la vente a eu lieu un autre jour.
 * C'est la MÊME ligne en base que dans le reçu : elle n'est jamais comptée deux fois.
 */
type RdvRow = {type: 'rdv';key: string;line: Sale;appointment: Appointment;receipt?: Receipt;sort: string;};
type Row = ReceiptRow | RdvRow;

const STATE_BADGE: Partial<Record<LineState, {tone: 'brand' | 'warning' | 'danger';label: string;}>> = {
  payé: { tone: 'brand', label: 'Payé' },
  'à-payer': { tone: 'warning', label: 'Non payé' },
  'payé-sur-place': { tone: 'brand', label: 'Payé sur place' },
  annulé: { tone: 'danger', label: 'Annulé' }
};

function StateBadge({ state }: {state: LineState;}) {
  const badge = STATE_BADGE[state];
  return badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null;
}

/** Phrase expliquant où (et si) une ligne de service est comptée, vue depuis le jour de la vente. */
function lineNote(line: Sale, appointment: Appointment | undefined, state: LineState, bookingDate: string): string {
  const rdvDate = appointment?.date ?? line.date;
  switch (state) {
    case 'à-payer':
      return `Non payé · sera compté le ${fmtShortDate(rdvDate)}, une fois le rendez-vous honoré`;
    case 'payé-sur-place':
      return `Non payé à la réservation · compté le ${fmtShortDate(line.date)} (rendez-vous honoré)`;
    case 'annulé':
      return line.paid ? 'Rendez-vous annulé · montant retiré des ventes' : 'Rendez-vous annulé · aucun montant dû';
    case 'payé':
      return line.date !== bookingDate ?
      `Payé à la réservation · compté le ${fmtShortDate(line.date)}` :
      'Payé à la réservation';
    default:
      return '';
  }
}

export function Sales() {
  const { sales, receipts, appointments } = useStore();
  const { can } = useAuth();
  const [preset, setPreset] = useState<RangePreset | 'jour'>('jour');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [expanded, setExpanded] = useState<string | null>(null);

  const range = useMemo(
    () => preset === 'jour' ? { start: todayKey(), end: todayKey(), label: "Aujourd'hui" } : presetRange(preset),
    [preset]
  );

  const linesByReceipt = useMemo(() => {
    const map = new Map<string, Sale[]>();
    sales.forEach((sale) => {
      const list = map.get(sale.receiptId);
      if (list) list.push(sale);else map.set(sale.receiptId, [sale]);
    });
    return map;
  }, [sales]);

  const appointmentById = useMemo(() => new Map(appointments.map((item) => [item.id, item])), [appointments]);
  const receiptById = useMemo(() => new Map(receipts.map((item) => [item.id, item])), [receipts]);

  const appointmentOf = (line: Sale) => line.appointmentId ? appointmentById.get(line.appointmentId) : undefined;
  /** La ligne est-elle comptée DANS la période affichée ? (même règle que le tableau de bord) */
  const recognized = (line: Sale) => isCounted(line, appointmentOf(line)) && inRange(line.date, range);
  const sumOf = (lines: Sale[], pick: (line: Sale) => number) =>
  lines.reduce((sum, line) => recognized(line) ? sum + pick(line) : sum, 0);

  const rows = useMemo(() => {
    const q = normalize(query);
    const out: Row[] = [];

    receipts.forEach((receipt) => {
      const lines = linesByReceipt.get(receipt.id) ?? [];
      if (lines.length === 0 || !inRange(receipt.date, range)) return;
      if (q) {
        const names = lines.map((line) => line.itemName).join(' ');
        if (!normalize(`${receipt.client} ${receipt.company} ${receiptNumber(receipt.receiptNo)} ${names}`).includes(q)) return;
      }
      out.push({ type: 'receipt', key: receipt.id, receipt, lines, sort: `${receipt.date} ${receipt.time}` });
    });

    // Services dont le rendez-vous tombe dans la période mais dont la vente a eu lieu avant/après.
    sales.forEach((line) => {
      if (line.kind !== 'service' || !line.appointmentId) return;
      const appointment = appointmentById.get(line.appointmentId);
      if (!appointment || !inRange(appointment.date, range)) return;
      const receipt = receiptById.get(line.receiptId);
      if (receipt && inRange(receipt.date, range)) return; // déjà affichée dans son reçu
      if (q && !normalize(`${line.client} ${line.itemName} ${receipt ? receiptNumber(receipt.receiptNo) : ''}`).includes(q)) return;
      out.push({ type: 'rdv', key: `rdv-${line.id}`, line, appointment, receipt, sort: `${appointment.date} ${appointment.time}` });
    });

    const noOf = (row: Row) => row.type === 'receipt' ? row.receipt.receiptNo : row.receipt?.receiptNo ?? 0;
    return out.sort((a, b) => a.sort < b.sort ? 1 : a.sort > b.sort ? -1 : noOf(b) - noOf(a));
  }, [receipts, sales, linesByReceipt, appointmentById, receiptById, range, query]);

  // Total de la période = chiffre d'affaires du tableau de bord (chaque ligne comptée une seule fois).
  const grandTotal = useMemo(
    () =>
    sales.reduce((sum, line) => {
      const appointment = line.appointmentId ? appointmentById.get(line.appointmentId) : undefined;
      return isCounted(line, appointment) && inRange(line.date, range) ? sum + line.total : sum;
    }, 0),
    [sales, appointmentById, range]
  );

  const receiptCount = rows.filter((row) => row.type === 'receipt').length;
  const rdvCount = rows.length - receiptCount;
  const options: (RangePreset | 'jour')[] = ['jour', 'mois', 'mois_prec', 'trimestre', 'annee'];
  const showProfit = can('finance.view');

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Panel>
        <PanelHeader
          title="Ventes"
          subtitle={`${receiptCount} reçu(s)${rdvCount > 0 ? ` · ${rdvCount} rendez-vous` : ''} · ${money(grandTotal)} · ${range.label}`}
          action={
          <div className="flex flex-wrap items-center gap-2">
              <select
              className={`${inputClass} !w-auto`}
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value as RangePreset | 'jour');
                setLimit(PAGE);
              }}>
                {options.map((key) =>
              <option key={key} value={key}>
                    {key === 'jour' ? "Aujourd'hui" : PRESET_LABELS[key]}
                  </option>
              )}
              </select>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-400" />
                <input
                className={`${inputClass} !w-60 !pl-8`}
                placeholder="Client, article, n° de reçu…"
                value={query}
                onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>
          } />
        {rows.length === 0 ?
        <EmptyState icon={<ReceiptIcon className="h-5 w-5" />} title="Aucune vente" description="Aucun reçu ne correspond à ce filtre." /> :
        <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="w-8 px-3 py-3" />
                  <th className="px-3 py-3 font-medium">N° reçu</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Articles</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  {showProfit ? <th className="px-5 py-3 text-right font-medium">Profit</th> : null}
                  <th className="px-5 py-3 font-medium">Par</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.slice(0, limit).map((row) => {
                if (row.type === 'rdv') {
                  const { line, appointment, receipt } = row;
                  const state = lineState(line, appointment);
                  const counted = recognized(line);
                  const bookingDate = receipt?.date ?? line.date;
                  const paidRef = line.paid && receipt && hasReceiptNo(receipt.receiptNo) ? ` · ${receiptNumber(receipt.receiptNo)}` : '';
                  const notCounted =
                  state === 'annulé' ? 'annulé' :
                  state === 'à-payer' ? 'non compté · à honorer' :
                  `déjà compté le ${fmtShortDate(line.date)}`;
                  return (
                    <tr key={row.key} className="hover:bg-ink-50/60">
                        <td className="px-3 py-3 text-ink-400"><CalendarClockIcon className="h-4 w-4" /></td>
                        <td className="px-3 py-3 font-mono text-xs text-ink-600">
                          {line.paid && receipt && hasReceiptNo(receipt.receiptNo) ? receiptNumber(receipt.receiptNo) : <span className="text-ink-400">Bon RDV</span>}
                        </td>
                        <td className="px-5 py-3 text-ink-600">
                          {fmtShortDate(appointment.date)} · {appointment.time}
                          <span className="block text-xs text-ink-400">Rendez-vous</span>
                        </td>
                        <td className="px-5 py-3 font-medium text-ink-900">{line.client}</td>
                        <td className="px-5 py-3 text-ink-600">
                          <span className="flex flex-wrap items-center gap-2">
                            {line.itemName}
                            <StateBadge state={state} />
                          </span>
                          <span className="block text-xs text-ink-500">
                            {line.paid ?
                          `Réservé et payé le ${fmtShortDate(bookingDate)}${paidRef}` :
                          `Réservé le ${fmtShortDate(bookingDate)} · non payé à la réservation`}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`font-semibold ${counted ? 'text-ink-900' : 'text-ink-400'} ${state === 'annulé' ? 'line-through' : ''}`}>
                            {money(line.total)}
                          </span>
                          {counted ? null : <span className="block text-xs font-normal text-amber-700">{notCounted}</span>}
                        </td>
                        {showProfit ?
                      <td className="px-5 py-3 text-right text-ink-600">{counted ? money(line.profit) : '—'}</td> : null}
                        <td className="px-5 py-3 text-ink-500">{line.createdByName || '—'}</td>
                        <td className="px-5 py-3 text-right">
                          {line.paid && receipt ?
                        <SaleReceiptButton receipt={receipt} /> :
                        <AppointmentSlipButton appointment={appointment} />}
                        </td>
                      </tr>);

                }

                const { receipt, lines } = row;
                const isOpen = expanded === receipt.id;
                const total = sumOf(lines, (line) => line.total);
                const profit = sumOf(lines, (line) => line.profit);
                const states = lines.map((line) => lineState(line, appointmentOf(line)));
                // Services non payés à la réservation, donc absents du total de ce jour.
                const unpaidAmount = lines.reduce((sum, line, index) =>
                line.kind === 'service' && !line.paid && states[index] !== 'annulé' && !recognized(line) ? sum + line.total : sum, 0);
                const badgeStates = (['à-payer', 'payé-sur-place', 'annulé'] as LineState[]).filter((state) => states.includes(state));
                const appointmentLines = lines.filter((line) => line.appointmentId && appointmentOf(line));
                return (
                  <Fragment key={row.key}>
                      <tr className="cursor-pointer hover:bg-ink-50/60" onClick={() => setExpanded(isOpen ? null : receipt.id)}>
                        <td className="px-3 py-3 text-ink-400">
                          {isOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-ink-600">
                          {hasReceiptNo(receipt.receiptNo) ? receiptNumber(receipt.receiptNo) : <span className="text-ink-400">Bon RDV</span>}
                        </td>
                        <td className="px-5 py-3 text-ink-600">{fmtShortDate(receipt.date)} · {receipt.time}</td>
                        <td className="px-5 py-3 font-medium text-ink-900">
                          {receipt.client}
                          {receipt.company && receipt.company !== receipt.client ?
                        <span className="block text-xs font-normal text-ink-500">{receipt.company}</span> : null}
                          {receipt.isBulk ? <Badge tone="brand">Lot</Badge> : null}
                        </td>
                        <td className="px-5 py-3 text-ink-600">
                          <span className="flex flex-wrap items-center gap-2">
                            {lines.length === 1 ? lines[0].itemName : `${lines.length} articles`}
                            {badgeStates.map((state) => <StateBadge key={state} state={state} />)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="font-semibold text-ink-900">{money(total)}</span>
                          {unpaidAmount > 0 ?
                        <span className="block text-xs font-normal text-amber-700">+ {money(unpaidAmount)} non payé</span> : null}
                        </td>
                        {showProfit ? <td className="px-5 py-3 text-right text-ink-600">{money(profit)}</td> : null}
                        <td className="px-5 py-3 text-ink-500">{receipt.createdByName || '—'}</td>
                        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <SaleReceiptButton receipt={receipt} />
                          {!hasReceiptNo(receipt.receiptNo) && appointmentLines.length === 1 ?
                        <AppointmentSlipButton appointment={appointmentOf(appointmentLines[0])!} /> : null}
                        </td>
                      </tr>
                      {isOpen ?
                    <tr className="bg-ink-50/60">
                          <td />
                          <td colSpan={showProfit ? 8 : 7} className="px-3 pb-4 pt-1">
                            <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100 bg-white">
                              {[...lines].
                          sort((a, b) => a.kind === b.kind ? a.itemName.localeCompare(b.itemName, 'fr') : a.kind === 'service' ? -1 : 1).
                          map((line) => {
                            const appointment = appointmentOf(line);
                            const state = lineState(line, appointment);
                            const counted = recognized(line);
                            return (
                              <li key={line.id} className="flex items-center gap-3 px-4 py-2.5">
                                    <Badge tone={line.kind === 'service' ? 'brand' : 'neutral'}>{line.kind}</Badge>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-ink-900">
                                        {line.itemName}
                                        {line.kind === 'service' ?
                                    <span className="text-ink-500"> · RDV {fmtShortDate(appointment?.date ?? line.date)} à {appointment?.time ?? line.time}</span> : null}
                                      </span>
                                      {line.kind === 'service' ?
                                  <span className="block truncate text-xs text-ink-500">{lineNote(line, appointment, state, receipt.date)}</span> : null}
                                    </span>
                                    {line.kind === 'service' ? <StateBadge state={state} /> : null}
                                    <span className="text-ink-500">
                                      {line.quantity} × {money(line.unitPrice)}
                                      {line.discountPct > 0 ? <span className="ml-1 font-medium text-amber-700">−{line.discountPct} %</span> : null}
                                    </span>
                                    <span className={`w-28 text-right font-semibold ${counted ? 'text-ink-900' : 'text-ink-400'} ${state === 'annulé' ? 'line-through' : ''}`}>
                                      {money(line.total)}
                                    </span>
                                    {appointment && !line.paid && state !== 'annulé' ?
                              <AppointmentSlipButton appointment={appointment} variant="ghost" label="Bon PDF" /> : null}
                                  </li>);

                          })}
                            </ul>
                          </td>
                        </tr> : null}
                    </Fragment>);

              })}
              </tbody>
            </table>
            {rows.length > limit ?
          <div className="border-t border-ink-100 p-4 text-center">
                <Button variant="secondary" onClick={() => setLimit(limit + PAGE)}>Afficher plus</Button>
              </div> : null}
          </div>
        }
      </Panel>
    </div>);

}
