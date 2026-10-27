import React, { useMemo, useState } from 'react';
import { BuildingIcon, PlusIcon, UserIcon } from 'lucide-react';
import type { Buyer } from '../../types';
import { filterBySearch } from '../../utils/search';
import { Button, Field, inputClass } from '../ui/Primitives';
import { SearchBox } from './SearchBox';

/** « Nom — Société » (ou l'un des deux). */
export function buyerLabel(buyer: Pick<Buyer, 'name' | 'company'>): string {
  return buyer.name && buyer.company ? `${buyer.name} — ${buyer.company}` : buyer.name || buyer.company;
}

type Props = {
  buyers: Buyer[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreate: (input: {name: string;company: string;phone: string;}) => Promise<Buyer | null>;
};

/** Choix (recherche) ou création rapide de l'acheteur d'une vente par lot. */
export function BuyerPicker({ buyers, value, onChange, onCreate }: Props) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = buyers.find((buyer) => buyer.id === value);
  const results = useMemo(
    () =>
    filterBySearch(buyers, query, (buyer) => buyerLabel(buyer), (buyer) => `${buyer.phone} ${buyer.company}`).slice(0, 8),
    [buyers, query]
  );

  const create = async () => {
    if (!form.name.trim() && !form.company.trim()) {
      setError('Saisissez un nom et/ou une société.');
      return;
    }
    setSaving(true);
    setError(null);
    const buyer = await onCreate(form);
    setSaving(false);
    if (!buyer) {
      setError('Enregistrement impossible.');
      return;
    }
    setForm({ name: '', company: '', phone: '' });
    setCreating(false);
    setQuery('');
    onChange(buyer.id);
  };

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700">
          {selected.company ? <BuildingIcon className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900">{buyerLabel(selected)}</p>
          <p className="truncate text-xs text-ink-500">{selected.phone || 'Pas de téléphone'}</p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange(null)}>Changer</Button>
      </div>);

  }

  if (creating) {
    return (
      <div className="space-y-3 rounded-lg border border-ink-200 p-4">
        <p className="text-sm font-semibold text-ink-900">Nouvel acheteur</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nom">
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Société">
            <input className={inputClass} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </Field>
          <Field label="Téléphone">
            <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <p className="text-xs text-ink-500">Un nom et/ou une société suffit.</p>
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => {setCreating(false);setError(null);}}>Retour</Button>
          <Button type="button" disabled={saving} onClick={create}>{saving ? 'Enregistrement…' : 'Enregistrer et choisir'}</Button>
        </div>
      </div>);

  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <SearchBox value={query} onChange={setQuery} placeholder="Rechercher un acheteur (nom, société, téléphone)…" />
        </div>
        <Button type="button" variant="secondary" onClick={() => setCreating(true)}>
          <PlusIcon className="h-4 w-4" />
          Nouvel acheteur
        </Button>
      </div>
      {buyers.length === 0 ?
      <p className="rounded-lg border border-dashed border-ink-200 px-4 py-4 text-center text-sm text-ink-500">
          Aucun acheteur enregistré. Créez le premier avec « Nouvel acheteur ».
        </p> :
      <ul className="max-h-44 divide-y divide-ink-100 overflow-y-auto rounded-lg border border-ink-100">
          {results.length === 0 ?
        <li className="px-4 py-3 text-sm text-ink-500">Aucun acheteur ne correspond.</li> :
        results.map((buyer) =>
        <li key={buyer.id}>
                <button type="button" onClick={() => onChange(buyer.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-ink-50">
                  <span className="text-ink-400">{buyer.company ? <BuildingIcon className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{buyerLabel(buyer)}</span>
                  <span className="shrink-0 text-xs text-ink-500">{buyer.phone}</span>
                </button>
              </li>
        )}
        </ul>}
    </div>);

}
