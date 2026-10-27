import React, { forwardRef } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { inputClass } from '../ui/Primitives';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onEnter?: () => void;
  autoFocus?: boolean;
};

/** Champ de recherche avec bouton d'effacement. */
export const SearchBox = forwardRef<HTMLInputElement, Props>(function SearchBox(
{ value, onChange, placeholder, onEnter, autoFocus },
ref)
{
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-400" />
      <input
        ref={ref}
        autoFocus={autoFocus}
        type="search"
        value={value}
        placeholder={placeholder}
        className={`${inputClass} !pl-9 !pr-9`}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onEnter) {
            event.preventDefault();
            onEnter();
          }
        }} />
      {value ?
      <button
        type="button"
        aria-label="Effacer la recherche"
        onClick={() => onChange('')}
        className="absolute right-2 top-2 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
          <XIcon className="h-4 w-4" />
        </button> : null}
    </div>);

});
