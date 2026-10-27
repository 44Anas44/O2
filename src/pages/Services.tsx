import React, { useMemo, useState } from 'react';
import { PencilIcon, PlusIcon, StethoscopeIcon, Trash2Icon } from 'lucide-react';
import type { ServiceItem } from '../types';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { SearchBox } from '../components/sale/SearchBox';
import { filterBySearch } from '../utils/search';
import { Modal } from '../components/ui/Modal';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Panel,
  PanelHeader,
  inputClass } from
'../components/ui/Primitives';
import { money } from '../utils/format';

const emptyForm = {
  name: '',
  category: 'Consultation',
  price: 0,
  durationMin: 20,
  active: true
};

export function Services() {
  const { services, saveService, removeService, sales } = useStore();
  const { can } = useAuth();
  const canEdit = can('catalog.edit');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState(emptyForm);

  const revenueByService = useMemo(() => {
    const map = new Map<string, number>();
    sales.
    filter((sale) => sale.kind === 'service').
    forEach((sale) => {
      map.set(sale.itemId, (map.get(sale.itemId) ?? 0) + sale.total);
    });
    return map;
  }, [sales]);

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const startEdit = (service: ServiceItem) => {
    setEditing(service);
    setForm({
      name: service.name,
      category: service.category,
      price: service.price,
      durationMin: service.durationMin,
      active: service.active
    });
    setOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    saveService({ ...form, id: editing?.id });
    setOpen(false);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Panel>
        <PanelHeader
          title="Services du cabinet"
          subtitle={`${services.length} services déclarés · ${services.filter((s) => s.active).length} actifs`}
          action={
          <div className="flex flex-wrap items-center gap-2">
              <div className="w-64">
                <SearchBox value={query} onChange={setQuery} placeholder="Rechercher un service…" />
              </div>
              {canEdit ?
            <Button onClick={startCreate}>
                  <PlusIcon className="h-4 w-4" />
                  Nouveau service
                </Button> : null}
            </div>
          } />
        
        {services.length === 0 ?
        <EmptyState
          icon={<StethoscopeIcon className="h-5 w-5" />}
          title="Aucun service déclaré"
          description="Ajoutez vos consultations, soins et analyses avec leurs tarifs." /> :


        <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 font-medium">Catégorie</th>
                  <th className="px-5 py-3 font-medium">Durée</th>
                  <th className="px-5 py-3 text-right font-medium">Prix</th>
                  <th className="px-5 py-3 text-right font-medium">CA cumulé</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filterBySearch(services, query, (item) => item.name, (item) => item.category).map((service) =>
              <tr key={service.id} className="align-middle">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink-900">{service.name}</p>
                      {!service.active ?
                  <Badge tone="neutral">Inactif</Badge> :
                  null}
                    </td>
                    <td className="px-5 py-3.5 text-ink-500">{service.category}</td>
                    <td className="px-5 py-3.5 text-ink-500">
                      {service.durationMin} min
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-ink-900">
                      {money(service.price)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-ink-500">
                      {money(revenueByService.get(service.id) ?? 0)}
                    </td>
                    {canEdit ?
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(service)}
                      aria-label={`Modifier ${service.name}`}>
                      
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeService(service.id)}
                      aria-label={`Supprimer ${service.name}`}
                      className="text-red-500 hover:bg-red-50 hover:text-red-600">
                      
                          <Trash2Icon className="h-4 w-4" />
                        </Button>
                      </div>
                    </td> : null}
                  </tr>
              )}
              </tbody>
            </table>
          </div>
        }
      </Panel>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Modifier le service' : 'Nouveau service'}
        description="Nom, catégorie, durée et tarif facturé au patient.">
        
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nom du service">
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required />
            
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Catégorie">
              <select
                className={inputClass}
                value={form.category}
                onChange={(event) =>
                setForm({ ...form, category: event.target.value })
                }>
                
                {['Consultation', 'Soins', 'Analyses', 'Administratif', 'Autre'].map(
                  (category) =>
                  <option key={category} value={category}>
                      {category}
                    </option>

                )}
              </select>
            </Field>
            <Field label="Durée (minutes)">
              <input
                type="number"
                min={5}
                step={5}
                className={inputClass}
                value={form.durationMin}
                onChange={(event) =>
                setForm({ ...form, durationMin: Number(event.target.value) })
                } />
              
            </Field>
            <Field label="Prix (TND)">
              <input
                type="number"
                step="any"
                min={0}
                className={inputClass}
                value={form.price}
                onChange={(event) =>
                setForm({ ...form, price: Number(event.target.value) })
                }
                required />
              
            </Field>
            <Field label="Disponibilité">
              <label className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  checked={form.active}
                  onChange={(event) =>
                  setForm({ ...form, active: event.target.checked })
                  } />
                
                Proposé aux patients
              </label>
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>);

}