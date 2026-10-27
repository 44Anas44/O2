import React, { useMemo, useRef, useState } from 'react';
import { CheckIcon, PlusIcon } from 'lucide-react';
import type { Product } from '../../types';
import { filterBySearch } from '../../utils/search';
import { money } from '../../utils/format';
import { unitPrice } from '../../lib/pricing';
import { Button } from '../ui/Primitives';
import { SearchBox } from './SearchBox';

const MAX_RESULTS = 40;

type Props = {
  products: Product[];
  /** Quantité déjà dans le panier, par produit. */
  inBasket: Map<string, number>;
  showCosts: boolean;
  onAdd: (productId: string, quantity: number) => void;
};

/** Recherche de produits : ajout direct avec quantité, la liste reste ouverte. */
export function ProductPicker({ products, inBasket, onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => filterBySearch(products, query, (product) => product.name, (product) => product.category),
    [products, query]
  );
  const shown = results.slice(0, MAX_RESULTS);

  const quantityOf = (id: string) => Math.max(1, quantities[id] ?? 1);
  const remaining = (product: Product) => product.stock - (inBasket.get(product.id) ?? 0);

  const add = (product: Product) => {
    const quantity = quantityOf(product.id);
    if (quantity > remaining(product)) return;
    onAdd(product.id, quantity);
    setQuantities((prev) => ({ ...prev, [product.id]: 1 }));
    setFlash(product.id);
    window.setTimeout(() => setFlash((current) => current === product.id ? null : current), 1100);
  };

  const addFirst = () => {
    const first = shown.find((product) => remaining(product) >= 1);
    if (first) {
      add(first);
      setQuery('');
      searchRef.current?.focus();
    }
  };

  return (
    <div className="space-y-3">
      <SearchBox
        ref={searchRef}
        autoFocus
        value={query}
        onChange={setQuery}
        onEnter={addFirst}
        placeholder="Rechercher un produit (nom, catégorie)…" />
      <p className="text-xs text-ink-400">
        {results.length} produit{results.length > 1 ? 's' : ''}
        {results.length > MAX_RESULTS ? ` · ${MAX_RESULTS} premiers affichés, précisez la recherche` : ''}
        {' · Entrée ajoute le premier résultat'}
      </p>

      <ul className="max-h-[46vh] divide-y divide-ink-100 overflow-y-auto rounded-lg border border-ink-100">
        {shown.length === 0 ?
        <li className="px-4 py-8 text-center text-sm text-ink-500">Aucun produit ne correspond.</li> :
        shown.map((product) => {
          const left = remaining(product);
          const inCart = inBasket.get(product.id) ?? 0;
          const quantity = quantityOf(product.id);
          const out = left < 1;
          return (
            <li key={product.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 ${out ? 'bg-ink-50/60' : ''}`}>
                <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                  <p className={`truncate text-sm font-medium ${out ? 'text-ink-400' : 'text-ink-900'}`}>{product.name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {product.category || 'Sans catégorie'} ·{' '}
                    <span className={left <= product.minStock ? 'font-medium text-amber-600' : ''}>
                      {out ? 'Rupture' : `Stock ${left}${product.unit ? ` ${product.unit}` : ''}`}
                    </span>
                    {inCart > 0 ? <span className="text-brand-700"> · {inCart} au panier</span> : null}
                  </p>
                </div>
                <span className="min-w-0 flex-1 text-sm font-semibold text-ink-900 sm:w-28 sm:flex-none sm:text-right">
                  {money(unitPrice(product))}
                  {product.vat ? <span className="ml-1 rounded bg-brand-50 px-1 py-0.5 text-[9px] font-semibold uppercase text-brand-700">TTC</span> : null}
                </span>
                <input
                aria-label={`Quantité de ${product.name}`}
                type="number"
                min={1}
                max={Math.max(left, 1)}
                disabled={out}
                value={quantity}
                onChange={(event) =>
                setQuantities((prev) => ({ ...prev, [product.id]: Math.max(1, Math.floor(Number(event.target.value) || 1)) }))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    add(product);
                  }
                }}
                className="w-16 shrink-0 rounded-lg border border-ink-200 px-2 py-1.5 text-center text-sm disabled:bg-ink-50" />
                <Button
                type="button"
                size="sm"
                disabled={out || quantity > left}
                onClick={() => add(product)}
                className="shrink-0 sm:w-24">
                  {flash === product.id ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                  {flash === product.id ? 'Ajouté' : 'Ajouter'}
                </Button>
              </li>);

        })}
      </ul>
    </div>);

}
