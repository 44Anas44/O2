import React, { useState } from 'react';
import { CheckIcon } from 'lucide-react';
import type { ServiceItem } from '../../types';
import { money } from '../../utils/format';
import { Button, Field, inputClass } from '../ui/Primitives';

type FormValue = {date: string;time: string;note: string;paid: boolean;};

type Props = {
  service: ServiceItem;
  initial: FormValue;
  editing: boolean;
  onSave: (value: FormValue) => void;
  onCancel: () => void;
};

const PAYMENT_CHOICES: {paid: boolean;label: string;}[] = [
{ paid: true, label: 'Payé à la réservation' },
{ paid: false, label: 'À payer le jour du RDV' }];


/** Détails du rendez-vous d'un service ajouté au panier (ou à modifier). */
export function ServiceForm({ service, initial, editing, onSave, onCancel }: Props) {
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [note, setNote] = useState(initial.note);
  const [paid, setPaid] = useState(initial.paid);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (date && time) onSave({ date, time, note, paid });
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

      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-700" id="payment-label">Paiement</span>
        <div className="flex gap-1 rounded-lg bg-ink-100 p-1" role="radiogroup" aria-labelledby="payment-label">
          {PAYMENT_CHOICES.map((choice) =>
          <button
            key={String(choice.paid)}
            type="button"
            role="radio"
            aria-checked={paid === choice.paid}
            onClick={() => setPaid(choice.paid)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${paid === choice.paid ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}>
              {choice.label}
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-ink-500">
          {paid ?
          'Le montant est encaissé maintenant : il figure sur le reçu et dans les ventes du jour.' :
          'Le client règle le jour du rendez-vous : un bon de rendez-vous lui est remis (pas de reçu). Le montant est compté à la date du rendez-vous, une fois celui-ci honoré.'}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Retour</Button>
        <Button type="submit" disabled={!date || !time}>
          <CheckIcon className="h-4 w-4" />
          {editing ? 'Enregistrer' : 'Ajouter au panier'}
        </Button>
      </div>
    </form>);

}
