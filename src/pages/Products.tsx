import React, { useState } from 'react';
import {
  ArrowDownUpIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon } from
'lucide-react';
import type { Product } from '../types';
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
import { money, percent } from '../utils/format';
import { unitPrice, VAT_RATE } from '../lib/pricing';

const emptyForm = {
  name: '',
  category: 'Médicament',
  purchasePrice: 0,
  salePrice: 0,
  stock: 0,
  minStock: 5,
  unit: 'boîte',
  vat: false
};

export function Products() {
  const { products, saveProduct, removeProduct, adjustStock, lowStock } = useStore();
  const { can } = useAuth();
  const canEdit = can('catalog.edit');
  const showCosts = can('costs.view');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [delta, setDelta] = useState(10);
  const [reason, setReason] = useState('Réapprovisionnement');

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const startEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      category: product.category,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      stock: product.stock,
      minStock: product.minStock,
      unit: product.unit,
      vat: product.vat
    });
    setFormOpen(true);
  };

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault();
    saveProduct({ ...form, id: editing?.id });
    setFormOpen(false);
  };

  const submitStock = (event: React.FormEvent) => {
    event.preventDefault();
    if (!stockTarget || delta === 0) return;
    adjustStock(stockTarget.id, delta, reason);
    setStockTarget(null);
  };

  const stockValue = products.reduce(
    (sum, product) => sum + product.stock * product.purchasePrice,
    0
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {lowStock.length > 0 ?
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <TriangleAlertIcon className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="mr-auto text-sm text-amber-800">
            <strong>{lowStock.length} produit(s)</strong> sous ou au seuil minimal :{' '}
            {lowStock.map((product) => product.name).join(', ')}.
          </p>
        </div> :
      null}

      <Panel>
        <PanelHeader
          title="Produits & stock"
          subtitle={showCosts ? `${products.length} références · valeur du stock ${money(stockValue)}` : `${products.length} références`}
          action={
          <div className="flex flex-wrap items-center gap-2">
              <div className="w-64">
                <SearchBox value={query} onChange={setQuery} placeholder="Rechercher un produit…" />
              </div>
              {canEdit ?
            <Button onClick={startCreate}>
                  <PlusIcon className="h-4 w-4" />
                  Nouveau produit
                </Button> : null}
            </div>
          } />
        
        {products.length === 0 ?
        <EmptyState
          icon={<PackageIcon className="h-5 w-5" />}
          title="Aucun produit déclaré"
          description="Ajoutez vos références avec prix d’achat, prix de vente et seuil minimal." /> :


        <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3 font-medium">Produit</th>
                  {showCosts ? <th className="px-5 py-3 text-right font-medium">Prix d’achat</th> : null}
                  <th className="px-5 py-3 text-right font-medium">Prix de vente</th>
                  {showCosts ? <th className="px-5 py-3 text-right font-medium">Marge</th> : null}
                  <th className="px-5 py-3 text-right font-medium">Stock</th>
                  <th className="px-5 py-3 text-right font-medium">Seuil</th>
                  {canEdit ? <th className="px-5 py-3 text-right font-medium">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filterBySearch(products, query, (item) => item.name, (item) => item.category).map((product) => {
                const unitMargin = product.salePrice - product.purchasePrice;
                const alert = product.stock <= product.minStock;
                return (
                  <tr key={product.id}>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-ink-900">{product.name}</p>
                        <p className="text-xs text-ink-500">
                          {product.category} · {product.unit}
                        </p>
                      </td>
                      {showCosts ?
                      <td className="px-5 py-3.5 text-right text-ink-600">
                        {money(product.purchasePrice)}
                      </td> : null}
                      <td className="px-5 py-3.5 text-right font-semibold text-ink-900">
                        {money(unitPrice(product))}
                        {product.vat ?
                        <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-700" title={`Prix saisi ${money(product.salePrice)} HT + TVA ${Math.round(VAT_RATE * 100)} %`}>
                            TVA
                          </span> : null}
                      </td>
                      {showCosts ?
                      <td className="px-5 py-3.5 text-right text-ink-600">
                        {money(unitMargin)}
                        <span className="ml-1 text-xs text-ink-400">
                          {product.salePrice > 0 ?
                        percent(unitMargin / product.salePrice * 100) :
                        '—'}
                        </span>
                      </td> : null}
                      <td className="px-5 py-3.5 text-right">
                        {alert ?
                      <Badge tone={product.stock === 0 ? 'danger' : 'warning'}>
                            {product.stock}
                          </Badge> :

                      <span className="font-medium text-ink-900">
                            {product.stock}
                          </span>
                      }
                      </td>
                      <td className="px-5 py-3.5 text-right text-ink-500">
                        {product.minStock}
                      </td>
                      {canEdit ?
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setStockTarget(product);
                            setDelta(10);
                            setReason('Réapprovisionnement');
                          }}>
                          
                            <ArrowDownUpIcon className="h-4 w-4" />
                            Stock
                          </Button>
                          <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(product)}
                          aria-label={`Modifier ${product.name}`}>
                          
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeProduct(product.id)}
                          aria-label={`Supprimer ${product.name}`}
                          className="text-red-500 hover:bg-red-50 hover:text-red-600">
                          
                            <Trash2Icon className="h-4 w-4" />
                          </Button>
                        </div>
                      </td> : null}
                    </tr>);

              })}
              </tbody>
            </table>
          </div>
        }
      </Panel>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier le produit' : 'Nouveau produit'}
        description="Toute entrée de stock (hors vente) crée une dépense au prix d’achat."
        width="max-w-xl">
        
        <form onSubmit={submitForm} className="space-y-4">
          <Field label="Nom du produit">
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
                
                {['Médicament', 'Parapharmacie', 'Consommable', 'Matériel', 'Autre'].map(
                  (category) =>
                  <option key={category} value={category}>
                      {category}
                    </option>

                )}
              </select>
            </Field>
            <Field label="Unité">
              <input
                className={inputClass}
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })} />
              
            </Field>
            <Field label="Prix d’achat (TND)">
              <input
                type="number"
                step="any"
                min={0}
                className={inputClass}
                value={form.purchasePrice}
                onChange={(event) =>
                setForm({ ...form, purchasePrice: Number(event.target.value) })
                }
                required />
              
            </Field>
            <Field label={form.vat ? 'Prix de vente HT (TND)' : 'Prix de vente (TND)'}>
              <input
                type="number"
                step="any"
                min={0}
                className={inputClass}
                value={form.salePrice}
                onChange={(event) =>
                setForm({ ...form, salePrice: Number(event.target.value) })
                }
                required />
              
            </Field>
            <div className="sm:col-span-2 flex items-center justify-between gap-4 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">TVA {Math.round(VAT_RATE * 100)} %</p>
                <p className="text-xs text-ink-500">
                  {form.vat ?
                  `Le client paie le prix HT × ${1 + VAT_RATE} : ${money(unitPrice({ salePrice: form.salePrice, vat: true }))} TTC.` :
                  'Désactivée : le prix de vente saisi est le prix payé par le client.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.vat}
                aria-label="TVA applicable"
                onClick={() => setForm({ ...form, vat: !form.vat })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.vat ? 'bg-brand-600' : 'bg-ink-300'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.vat ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            <Field
              label="Stock"
              hint="Une augmentation ici est enregistrée en dépense.">
              
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.stock}
                onChange={(event) =>
                setForm({ ...form, stock: Number(event.target.value) })
                } />
              
            </Field>
            <Field label="Seuil minimal">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.minStock}
                onChange={(event) =>
                setForm({ ...form, minStock: Number(event.target.value) })
                } />
              
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFormOpen(false)}>
              
              Annuler
            </Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(stockTarget)}
        onClose={() => setStockTarget(null)}
        title={`Mouvement de stock — ${stockTarget?.name ?? ''}`}
        description="Entrée ou sortie hors vente. Une dépense est générée au prix d’achat.">
        
        <form onSubmit={submitStock} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Quantité (+ entrée / − sortie)"
              hint={`Stock actuel : ${stockTarget?.stock ?? 0}`}>
              
              <input
                type="number"
                className={inputClass}
                value={delta}
                onChange={(event) => setDelta(Number(event.target.value))} />
              
            </Field>
            <Field label="Motif">
              <select
                className={inputClass}
                value={reason}
                onChange={(event) => setReason(event.target.value)}>
                
                {['Réapprovisionnement', 'Retour fournisseur', 'Casse / perte', 'Péremption', 'Inventaire'].map(
                  (item) =>
                  <option key={item} value={item}>
                      {item}
                    </option>

                )}
              </select>
            </Field>
          </div>
          <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-sm text-ink-700">
            Dépense enregistrée :{' '}
            <strong>
              {money(Math.abs(delta) * (stockTarget?.purchasePrice ?? 0))}
            </strong>{' '}
            · nouveau stock :{' '}
            <strong>{Math.max(0, (stockTarget?.stock ?? 0) + delta)}</strong>
          </p>
          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStockTarget(null)}>
              
              Annuler
            </Button>
            <Button type="submit">Valider le mouvement</Button>
          </div>
        </form>
      </Modal>
    </div>);

}