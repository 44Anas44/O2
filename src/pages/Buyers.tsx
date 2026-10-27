import React, { useMemo, useState } from 'react';
import { BuildingIcon, PencilIcon, PlusIcon, Trash2Icon, UserIcon, UsersIcon } from 'lucide-react';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { Button, EmptyState, Field, Panel, PanelHeader, inputClass } from '../components/ui/Primitives';
import { Modal } from '../components/ui/Modal';
import { SearchBox } from '../components/sale/SearchBox';
import { filterBySearch } from '../utils/search';
import { money } from '../utils/format';
import type { Buyer } from '../types';

const empty = { name: '', company: '', phone: '' };

export function Buyers() {
  const { buyers, receipts, sales, saveBuyer, removeBuyer } = useStore();
  const { can } = useAuth();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Buyer | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  // Achats par acheteur (reçus de vente par lot).
  const stats = useMemo(() => {
    const totalByReceipt = new Map<string, number>();
    sales.forEach((sale) => totalByReceipt.set(sale.receiptId, (totalByReceipt.get(sale.receiptId) ?? 0) + sale.total));
    const map = new Map<string, {count: number;total: number;}>();
    receipts.forEach((receipt) => {
      if (!receipt.buyerId) return;
      const current = map.get(receipt.buyerId) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += totalByReceipt.get(receipt.id) ?? 0;
      map.set(receipt.buyerId, current);
    });
    return map;
  }, [receipts, sales]);

  const list = useMemo(
    () => filterBySearch(buyers, query, (buyer) => `${buyer.company} ${buyer.name}`, (buyer) => buyer.phone),
    [buyers, query]
  );

  const startCreate = () => {
    setEditing(null);
    setForm(empty);
    setError(null);
    setOpen(true);
  };
  const startEdit = (buyer: Buyer) => {
    setEditing(buyer);
    setForm({ name: buyer.name, company: buyer.company, phone: buyer.phone });
    setError(null);
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() && !form.company.trim()) {
      setError('Saisissez un nom et/ou une société.');
      return;
    }
    const saved = await saveBuyer({ ...form, id: editing?.id });
    if (!saved) {
      setError('Enregistrement impossible.');
      return;
    }
    setOpen(false);
  };

  const remove = (buyer: Buyer) => {
    if (!window.confirm(`Supprimer l’acheteur « ${buyer.company || buyer.name} » ? Ses reçus déjà émis sont conservés.`)) return;
    removeBuyer(buyer.id);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Panel>
        <PanelHeader
          title="Acheteurs"
          subtitle={`${buyers.length} acheteur(s) · clients des ventes par lot`}
          action={
          <div className="flex flex-wrap items-center gap-2">
              <div className="w-64">
                <SearchBox value={query} onChange={setQuery} placeholder="Nom, société, téléphone…" />
              </div>
              <Button onClick={startCreate}>
                <PlusIcon className="h-4 w-4" />
                Nouvel acheteur
              </Button>
            </div>
          } />
        {list.length === 0 ?
        <EmptyState
          icon={<UsersIcon className="h-5 w-5" />}
          title={buyers.length === 0 ? 'Aucun acheteur' : 'Aucun résultat'}
          description={buyers.length === 0 ? 'Enregistrez vos acheteurs pour les retrouver à chaque vente par lot.' : 'Aucun acheteur ne correspond à la recherche.'} /> :
        <ul className="divide-y divide-ink-100">
            {list.map((buyer) => {
            const stat = stats.get(buyer.id);
            return (
              <li key={buyer.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
                    {buyer.company ? <BuildingIcon className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{buyer.company || buyer.name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {buyer.company && buyer.name ? `${buyer.name} · ` : ''}
                      {buyer.phone || 'Pas de téléphone'}
                    </p>
                  </div>
                  <p className="text-right text-sm text-ink-600">
                    {stat ? <><strong className="text-ink-900">{money(stat.total)}</strong> · {stat.count} reçu(s)</> : 'Aucun achat'}
                  </p>
                  <Button size="sm" variant="ghost" aria-label="Modifier" onClick={() => startEdit(buyer)}>
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                  {can('sales.delete') ?
                <Button size="sm" variant="ghost" aria-label="Supprimer" onClick={() => remove(buyer)} className="text-red-500 hover:bg-red-50">
                      <Trash2Icon className="h-4 w-4" />
                    </Button> : null}
                </li>);

          })}
          </ul>}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Modifier l’acheteur' : 'Nouvel acheteur'} description="Un nom et/ou une société suffit.">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom">
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </Field>
            <Field label="Société">
              <input className={inputClass} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </Field>
          </div>
          <Field label="Téléphone">
            <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>);

}
