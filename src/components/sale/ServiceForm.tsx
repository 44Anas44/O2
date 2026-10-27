import React, { useState } from 'react';
import { CheckIcon } from 'lucide-react';
import type { ServiceItem } from '../../types';
import { money } from '../../utils/format';
import { Button, Field, inputClass } from '../ui/Primitives';

type Props = {
  service: ServiceItem;
  initial: {date: string;time: string;note: string;};
  editing: boolean;
  onSave: (value: {date: string;time: string;note: string;}) => void;
  onCancel: () => void;
};

/** Détails du rendez-vous d'un service ajouté au panier (ou à modifier). */
export function ServiceForm({ service, initial, editing, onSave, onCancel }: Props) {
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [note, setNote] = useState(initial.note);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (date && time) onSave({ date, time, note });
      }}>
      <div className="flex items-center justify-between gap-3 rounded-lg bg-ink-50 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">{service.name}</p>
          <p className="text-xs text-ink-500">{service.durationMin} min</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-ink-900">{money(service.price)}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date du rendez-vous">
          <input type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Heure">
          <input type="time" required className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Note (facultatif)">
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. à jeun, apporter les analyses" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Retour</Button>
        <Button type="submit" disabled={!date || !time}>
          <CheckIcon className="h-4 w-4" />
          {editing ? 'Enregistrer' : 'Ajouter au panier'}
        </Button>
      </div>
    </form>);

}
