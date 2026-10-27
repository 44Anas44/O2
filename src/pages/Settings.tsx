import React, { useEffect, useRef, useState } from 'react';
import { CheckIcon, ImageIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import type { CenterInfo } from '../config/center';
import { Button, Field, Panel, PanelHeader, inputClass } from '../components/ui/Primitives';
import { BrandLogo } from '../brand/BrandLogo';
import { fileToLogoDataUrl, LOGO_ACCEPT } from '../utils/image';

export function Settings() {
  const { center, save } = useSettings();
  const [form, setForm] = useState<CenterInfo>(center);
  const [notes, setNotes] = useState(center.appointmentNotes.join('\n'));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ok: boolean;text: string;} | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoMessage, setLogoMessage] = useState<{ok: boolean;text: string;} | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(center);
    setNotes(center.appointmentNotes.join('\n'));
  }, [center]);

  const set = (key: keyof CenterInfo) => (event: React.ChangeEvent<HTMLInputElement>) =>
  setForm({ ...form, [key]: event.target.value });

  const changeLogo = async (logo: string) => {
    setLogoBusy(true);
    setLogoMessage(null);
    // Seul le logo change : on réutilise les coordonnées déjà enregistrées.
    const error = await save({ ...center, logo });
    setLogoBusy(false);
    setLogoMessage(error ?
    { ok: false, text: `Échec de l’enregistrement : ${error}` } :
    { ok: true, text: logo ? 'Logo enregistré. Il apparaît dans le menu et sur tous les PDF.' : 'Logo par défaut rétabli.' });
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await changeLogo(await fileToLogoDataUrl(file));
    } catch (error) {
      setLogoMessage({ ok: false, text: error instanceof Error ? error.message : 'Image refusée.' });
    }
  };

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
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Panel>
        <PanelHeader
          title="Logo"
          subtitle="Affiché dans le menu et en en-tête de tous les reçus, bons de rendez-vous et rapports." />
        <div className="flex flex-wrap items-center gap-6 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-24 w-40 items-center justify-center rounded-lg border border-ink-200 bg-white p-3">
              <BrandLogo size={64} src={center.logo || undefined} />
            </span>
            <span className="flex h-24 w-40 items-center justify-center rounded-lg bg-ink-900 p-3">
              <BrandLogo size={64} src={center.logo || undefined} />
            </span>
          </div>
          <div className="min-w-[220px] flex-1 space-y-3">
            <p className="text-sm text-ink-600">
              {center.logo ? 'Logo personnalisé en place.' : 'Logo par défaut de l’application.'}{' '}
              PNG à fond transparent recommandé (JPG, WebP et SVG acceptés), carré ou horizontal.
            </p>
            <div className="flex flex-wrap gap-2">
              <input ref={fileInput} type="file" accept={LOGO_ACCEPT} className="hidden" onChange={onFile} />
              <Button type="button" disabled={logoBusy} onClick={() => fileInput.current?.click()}>
                {center.logo ? <ImageIcon className="h-4 w-4" /> : <UploadIcon className="h-4 w-4" />}
                {logoBusy ? 'Enregistrement…' : center.logo ? 'Changer le logo' : 'Importer un logo'}
              </Button>
              {center.logo ?
              <Button type="button" variant="secondary" disabled={logoBusy} onClick={() => changeLogo('')}>
                  <Trash2Icon className="h-4 w-4" />
                  Revenir au logo par défaut
                </Button> : null}
            </div>
            {logoMessage ?
            <p className={`rounded-lg px-3 py-2 text-sm ${logoMessage.ok ? 'bg-brand-50 text-brand-800' : 'bg-red-50 text-red-600'}`}>
                {logoMessage.text}
              </p> : null}
          </div>
        </div>
      </Panel>

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
