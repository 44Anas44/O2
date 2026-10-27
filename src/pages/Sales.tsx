import React, { useMemo, useState } from 'react';
import { ReceiptIcon, SearchIcon } from 'lucide-react';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { Badge, Button, EmptyState, Panel, PanelHeader, inputClass } from '../components/ui/Primitives';
import { SaleReceiptButton } from '../components/ReceiptButtons';
import { PRESET_LABELS, presetRange, type RangePreset } from '../utils/reportRange';
import { inRange, fmtShortDate, todayKey } from '../utils/date';
import { money } from '../utils/format';
import { receiptNumber } from '../pdf/theme';

const PAGE = 100;

export function Sales() {
  const { sales } = useStore();
  const { can } = useAuth();
  const [preset, setPreset] = useState<RangePreset | 'jour'>('jour');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const range = useMemo(
    () => preset === 'jour' ? { start: todayKey(), end: todayKey(), label: "Aujourd'hui" } : presetRange(preset),
    [preset]
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.
    filter((sale) => inRange(sale.date, range)).
    filter((sale) =>
    !q ||
    sale.client.toLowerCase().includes(q) ||
    sale.itemName.toLowerCase().includes(q) ||
    receiptNumber(sale.receiptNo).toLowerCase().includes(q)
    ).
    sort((a, b) => `${a.date}${a.time}` < `${b.date}${b.time}` ? 1 : -1);
  }, [sales, range, query]);

  const total = list.reduce((sum, sale) => sum + sale.total, 0);
  const options: (RangePreset | 'jour')[] = ['jour', 'mois', 'mois_prec', 'trimestre', 'annee'];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Panel>
        <PanelHeader
          title="Ventes"
          subtitle={`${list.length} vente(s) · ${money(total)} · ${range.label}`}
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
                className={`${inputClass} !w-56 !pl-8`}
                placeholder="Client, article, n° de reçu…"
                value={query}
                onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>
          } />
        {list.length === 0 ?
        <EmptyState icon={<ReceiptIcon className="h-5 w-5" />} title="Aucune vente" description="Aucune vente ne correspond à ce filtre." /> :
        <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3 font-medium">N° reçu</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Désignation</th>
                  <th className="px-5 py-3 text-right font-medium">Qté</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  {can('finance.view') ? <th className="px-5 py-3 text-right font-medium">Profit</th> : null}
                  <th className="px-5 py-3 font-medium">Par</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {list.slice(0, limit).map((sale) =>
              <tr key={sale.id}>
                    <td className="px-5 py-3 font-mono text-xs text-ink-600">{receiptNumber(sale.receiptNo)}</td>
                    <td className="px-5 py-3 text-ink-600">{fmtShortDate(sale.date)} · {sale.time}</td>
                    <td className="px-5 py-3 font-medium text-ink-900">{sale.client}</td>
                    <td className="px-5 py-3">
                      {sale.itemName}{' '}
                      <Badge tone={sale.kind === 'service' ? 'brand' : 'neutral'}>{sale.kind}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right text-ink-600">{sale.quantity}</td>
                    <td className="px-5 py-3 text-right font-semibold text-ink-900">{money(sale.total)}</td>
                    {can('finance.view') ? <td className="px-5 py-3 text-right text-ink-600">{money(sale.profit)}</td> : null}
                    <td className="px-5 py-3 text-ink-500">{sale.createdByName || '—'}</td>
                    <td className="px-5 py-3 text-right"><SaleReceiptButton sale={sale} /></td>
                  </tr>
              )}
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
