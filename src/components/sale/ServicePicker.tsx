import React, { useMemo, useState } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import type { ServiceItem } from '../../types';
import { filterBySearch } from '../../utils/search';
import { money } from '../../utils/format';
import { SearchBox } from './SearchBox';

const MAX_RESULTS = 40;

type Props = {
  services: ServiceItem[];
  onChoose: (serviceId: string) => void;
};

/** Recherche de services ; le choix ouvre le formulaire de rendez-vous. */
export function ServicePicker({ services, onChoose }: Props) {
  const [query, setQuery] = useState('');
  const results = useMemo(
    () => filterBySearch(services, query, (service) => service.name, (service) => service.category),
    [services, query]
  );
  const shown = results.slice(0, MAX_RESULTS);

  return (
    <div className="space-y-3">
      <SearchBox
        autoFocus
        value={query}
        onChange={setQuery}
        onEnter={() => shown[0] && onChoose(shown[0].id)}
        placeholder="Rechercher un service (nom, catégorie)…" />
      <p className="text-xs text-ink-400">
        {results.length} service{results.length > 1 ? 's' : ''}
        {results.length > MAX_RESULTS ? ` · ${MAX_RESULTS} premiers affichés, précisez la recherche` : ''}
        {' · Entrée choisit le premier résultat'}
      </p>
      <ul className="max-h-[46vh] divide-y divide-ink-100 overflow-y-auto rounded-lg border border-ink-100">
        {shown.length === 0 ?
        <li className="px-4 py-8 text-center text-sm text-ink-500">Aucun service ne correspond.</li> :
        shown.map((service) =>
        <li key={service.id}>
              <button
            type="button"
            onClick={() => onChoose(service.id)}
            className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-ink-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{service.name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {service.category || 'Sans catégorie'} · {service.durationMin} min
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-ink-900">{money(service.price)}</span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-400" />
              </button>
            </li>
        )}
      </ul>
    </div>);

}
