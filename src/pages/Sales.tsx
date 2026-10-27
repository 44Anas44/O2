import React, { Fragment, useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, ReceiptIcon, SearchIcon } from 'lucide-react';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { Badge, Button, EmptyState, Panel, PanelHeader, inputClass } from '../components/ui/Primitives';
import { SaleReceiptButton } from '../components/ReceiptButtons';
import { PRESET_LABELS, presetRange, type RangePreset } from '../utils/reportRange';
import { inRange, fmtShortDate, todayKey } from '../utils/date';
import { money } from '../utils/format';
import { normalize } from '../utils/search';
import { receiptNumber } from '../pdf/theme';
import type { Sale } from '../types';

const PAGE = 100;

export function Sales() {
  const { sales, receipts } = useStore();
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

  const list = useMemo(() => {
    const q = normalize(query);
    return receipts.
    filter((receipt) => (linesByReceipt.get(receipt.id)?.length ?? 0) > 0).
    filter((receipt) => inRange(receipt.date, range)).
    filter((receipt) => {
      if (!q) return true;
      const names = (linesByReceipt.get(receipt.id) ?? []).map((line) => line.itemName).join(' ');
      return normalize(`${receipt.client} ${receipt.company} ${receiptNumber(receipt.receiptNo)} ${names}`).includes(q);
    }).
    sort((a, b) => b.receiptNo - a.receiptNo);
  }, [receipts, linesByReceipt, range, query]);

  const totalOf = (id: string) => (linesByReceipt.get(id) ?? []).reduce((sum, line) => sum + line.total, 0);
  const profitOf = (id: string) => (linesByReceipt.get(id) ?? []).reduce((sum, line) => sum + line.profit, 0);
  const grandTotal = list.reduce((sum, receipt) => sum + totalOf(receipt.id), 0);
  const options: (RangePreset | 'jour')[] = ['jour', 'mois', 'mois_prec', 'trimestre', 'annee'];
  const showProfit = can('finance.view');

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Panel>
        <PanelHeader
          title="Ventes"
          subtitle={`${list.length} reçu(s) · ${money(grandTotal)} · ${range.label}`}
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
        {list.length === 0 ?
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
                {list.slice(0, limit).map((receipt) => {
                const lines = linesByReceipt.get(receipt.id) ?? [];
                const isOpen = expanded === receipt.id;
                return (
                  <Fragment key={receipt.id}>
                      <tr className="cursor-pointer hover:bg-ink-50/60" onClick={() => setExpanded(isOpen ? null : receipt.id)}>
                        <td className="px-3 py-3 text-ink-400">
                          {isOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-ink-600">{receiptNumber(receipt.receiptNo)}</td>
                        <td className="px-5 py-3 text-ink-600">{fmtShortDate(receipt.date)} · {receipt.time}</td>
                        <td className="px-5 py-3 font-medium text-ink-900">
                          {receipt.client}
                          {receipt.company && receipt.company !== receipt.client ?
                        <span className="block text-xs font-normal text-ink-500">{receipt.company}</span> : null}
                          {receipt.isBulk ? <Badge tone="brand">Lot</Badge> : null}
                        </td>
                        <td className="px-5 py-3 text-ink-600">
                          {lines.length === 1 ? lines[0].itemName : `${lines.length} articles`}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-ink-900">{money(totalOf(receipt.id))}</td>
                        {showProfit ? <td className="px-5 py-3 text-right text-ink-600">{money(profitOf(receipt.id))}</td> : null}
                        <td className="px-5 py-3 text-ink-500">{receipt.createdByName || '—'}</td>
                        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <SaleReceiptButton receipt={receipt} />
                        </td>
                      </tr>
                      {isOpen ?
                    <tr className="bg-ink-50/60">
                          <td />
                          <td colSpan={showProfit ? 8 : 7} className="px-3 pb-4 pt-1">
                            <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100 bg-white">
                              {[...lines].
                          sort((a, b) => a.kind === b.kind ? a.itemName.localeCompare(b.itemName, 'fr') : a.kind === 'service' ? -1 : 1).
                          map((line) =>
                          <li key={line.id} className="flex items-center gap-3 px-4 py-2.5">
                                    <Badge tone={line.kind === 'service' ? 'brand' : 'neutral'}>{line.kind}</Badge>
                                    <span className="min-w-0 flex-1 truncate text-ink-900">
                                      {line.itemName}
                                      {line.kind === 'service' ?
                              <span className="text-ink-500"> · RDV {fmtShortDate(line.date)} à {line.time}</span> : null}
                                    </span>
                                    <span className="text-ink-500">
                                      {line.quantity} × {money(line.unitPrice)}
                                      {line.discountPct > 0 ? <span className="ml-1 font-medium text-amber-700">−{line.discountPct} %</span> : null}
                                    </span>
                                    <span className="w-28 text-right font-semibold text-ink-900">{money(line.total)}</span>
                                  </li>
                          )}
                            </ul>
                          </td>
                        </tr> : null}
                    </Fragment>);

              })}
              </tbody>
            </table>
            {list.length > limit ?
          <div className="border-t border-ink-100 p-4 text-center">
                <Button variant="secondary" onClick={() => setLimit(limit + PAGE)}>Afficher plus</Button>
              </div> : null}
          </div>
        }
      </Panel>
    </div>);

}
