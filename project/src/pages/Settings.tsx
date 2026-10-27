import React, { useEffect, useState } from 'react';
import { CheckIcon } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import type { CenterInfo } from '../config/center';
import { Button, Field, Panel, PanelHeader, inputClass } from '../components/ui/Primitives';

export function Settings() {
  const { center, save } = useSettings();
  const [form, setForm] = useState<CenterInfo>(center);
  const [notes, setNotes] = useState(center.appointmentNotes.join('\n'));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ok: boolean;text: string;} | null>(null);

  useEffect(() => {
    setForm(center);
    setNotes(center.appointmentNotes.join('\n'));
  }, [center]);

  const set = (key: keyof CenterInfo) => (event: React.ChangeEvent<HTMLInputElement>) =>
  setForm({ ...form, [key]: event.target.value });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const error = await save({
      ...form,
      appointmentNotes: notes.split('\n').map((line) => line.trim()).filter(Boolean)
    });
    setSaving(false);
    setMessage(error ?
    { ok: false, text: `Échec de l’enregistrement : ${error}` } :
    { ok: true, text: 'Enregistré. Les prochains PDF utiliseront ces informations.' });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Panel>
        <PanelHeader
          title="Informations du centre"
          subtitle="Imprimées en en-tête et en pied de page des reçus, bons de rendez-vous et rapports. Les champs vides ne sont pas imprimés." />
        <form onSubmit={submit} className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Nom du centre">
            <input className={inputClass} value={form.name} onChange={set('name')} required />
          </Field>
          <Field label="Sous-titre">
            <input className={inputClass} value={form.tagline} onChange={set('tagline')} placeholder="Cabinet médical & pharmacie" />
          </Field>
          <Field label="Adresse" className="sm:col-span-2">
            <input className={inputClass} value={form.address} onChange={set('address')} placeholder="12 rue de la République, Tunis" />
          </Field>
          <Field label="Téléphone">
            <input className={inputClass} value={form.phone} onChange={set('phone')} placeholder="71 000 000" />
          </Field>
          <Field label="E-mail">
            <input type="email" className={inputClass} value={form.email} onChange={set('email')} placeholder="contact@exemple.tn" />
          </Field>
          <Field label="Matricule fiscal" className="sm:col-span-2">
            <input className={inputClass} value={form.taxId} onChange={set('taxId')} placeholder="1234567/A/M/000" />
          </Field>
          <Field label="Message en bas des reçus" className="sm:col-span-2">
            <input className={inputClass} value={form.receiptFooter} onChange={set('receiptFooter')} />
          </Field>
          <Field label="Consignes sur le bon de rendez-vous" hint="Une ligne = une puce. Laisser vide pour ne rien imprimer." className="sm:col-span-2">
            <textarea className={`${inputClass} min-h-[96px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {message ?
          <p className={`rounded-lg px-3 py-2 text-sm sm:col-span-2 ${message.ok ? 'bg-brand-50 text-brand-800' : 'bg-red-50 text-red-600'}`}>
              {message.text}
            </p> : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              <CheckIcon className="h-4 w-4" />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>);

}
