import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  CalendarClockIcon,
  CheckIcon,
  PackageIcon,
  StethoscopeIcon } from
'lucide-react';
import { useStore, type RecordedSale } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { downloadAppointmentSlip, downloadSaleReceipt } from '../pdf';
import { receiptNumber } from '../pdf/theme';
import { Modal } from './ui/Modal';
import { Button, Field, inputClass } from './ui/Primitives';
import { money } from '../utils/format';
import { fmtLongDate, nowTime, todayKey } from '../utils/date';

type SaleDialogValue = {openSale: (kind?: 'produit' | 'service') => void;};

const SaleDialogContext = createContext<SaleDialogValue | null>(null);

export function useSaleDialog(): SaleDialogValue {
  const context = useContext(SaleDialogContext);
  if (!context) throw new Error('useSaleDialog hors provider');
  return context;
}

export function SaleDialogProvider({ children }: {children: React.ReactNode;}) {
  const { products, services, recordSale } = useStore();
  const { can, displayName } = useAuth();
  const { center } = useSettings();
  const [done, setDone] = useState<RecordedSale | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'produit' | 'service'>('produit');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [client, setClient] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState(nowTime());

  const activeServices = useMemo(
    () => services.filter((service) => service.active),
    [services]
  );

  const reset = (nextKind: 'produit' | 'service') => {
    setDone(null);
    setFailed(false);
    setKind(nextKind);
    setItemId('');
    setQuantity(1);
    setClient('');
    setPhone('');
    setNote('');
    setDate(todayKey());
    setTime(nowTime());
  };

  const value = useMemo<SaleDialogValue>(
    () => ({
      openSale: (nextKind = 'produit') => {
        reset(nextKind);
        setOpen(true);
      }
    }),
    []
  );

  const product = products.find((item) => item.id === itemId);
  const service = activeServices.find((item) => item.id === itemId);

  const total =
  kind === 'produit' ?
  (product?.salePrice ?? 0) * Math.max(1, quantity) :
  service?.price ?? 0;
  const profit =
  kind === 'produit' ?
  ((product?.salePrice ?? 0) - (product?.purchasePrice ?? 0)) *
  Math.max(1, quantity) :
  service?.price ?? 0;

  const canSubmit =
  Boolean(itemId) && (
  kind === 'produit' ?
  Math.max(1, quantity) <= (product?.stock ?? 0) :
  Boolean(date) && Boolean(time));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    setFailed(false);
    const result = await recordSale({
      kind,
      itemId,
      quantity: Math.max(1, quantity),
      client,
      date,
      time,
      phone,
      note
    });
    setSaving(false);
    if (result) setDone(result);else setFailed(true);
  };

  const printReceipt = () => {
    if (!done) return;
    downloadSaleReceipt({ sale: done.sale, appointment: done.appointment, center, generatedBy: displayName }).
    catch(() => window.alert('Impossible de générer le PDF.'));
  };
  const printSlip = () => {
    if (!done?.appointment) return;
    downloadAppointmentSlip({
      appointment: done.appointment,
      service: services.find((item) => item.id === done.appointment?.serviceId) ?? null,
      sale: done.sale,
      center,
      generatedBy: displayName
    }).catch(() => window.alert('Impossible de générer le PDF.'));
  };

  return (
    <SaleDialogContext.Provider value={value}>
      {children}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Déclarer une vente"
        description="Produit encaissé au comptoir ou service avec rendez-vous."
        width="max-w-xl">
        
        {done ?
        <div className="space-y-5 py-2 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <CheckIcon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-base font-semibold text-ink-900">Vente enregistrée</p>
              <p className="text-sm text-ink-500">
                Reçu {receiptNumber(done.sale.receiptNo)} · {money(done.sale.total)}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={printReceipt}>Télécharger le reçu (PDF)</Button>
              {done.appointment ?
            <Button type="button" variant="secondary" onClick={printSlip}>Bon de rendez-vous (PDF)</Button> : null}
            </div>
            <div className="flex justify-center gap-2 border-t border-ink-100 pt-4">
              <Button type="button" variant="ghost" onClick={() => reset(kind)}>Nouvelle vente</Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Fermer</Button>
            </div>
          </div> :
        <form onSubmit={submit} className="space-y-4">
          <div
            className="grid grid-cols-2 gap-2"
            role="tablist"
            aria-label="Type de vente">
            
            {(
            [
            { key: 'produit', label: 'Produit', icon: PackageIcon },
            { key: 'service', label: 'Service', icon: StethoscopeIcon }] as
            const).
            map((tab) => {
              const selected = kind === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => reset(tab.key)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors duration-150 ease-out ${
                  selected ?
                  'border-brand-600 bg-brand-50 text-brand-700' :
                  'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'}`
                  }>
                  
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>);

            })}
          </div>

          {kind === 'produit' ?
          <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Produit" className="sm:col-span-2">
                <select
                className={inputClass}
                value={itemId}
                onChange={(event) => setItemId(event.target.value)}
                required>
                
                  <option value="">Sélectionner un produit…</option>
                  {products.map((item) =>
                <option key={item.id} value={item.id} disabled={item.stock === 0}>
                      {item.name} — {money(item.salePrice)} (stock {item.stock})
                    </option>
                )}
                </select>
              </Field>
              <Field
              label="Quantité"
              hint={product ? `Stock disponible : ${product.stock} ${product.unit}` : undefined}>
              
                <input
                type="number"
                min={1}
                max={product?.stock ?? 999}
                className={inputClass}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))} />
              
              </Field>
              <Field label="Date de la vente">
                <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(event) => setDate(event.target.value)} />
              
              </Field>
              <Field label="Client (optionnel)" className="sm:col-span-2">
                <input
                className={inputClass}
                placeholder="Comptoir"
                value={client}
                onChange={(event) => setClient(event.target.value)} />
              
              </Field>
            </div> :

          <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Service" className="sm:col-span-2">
                <select
                className={inputClass}
                value={itemId}
                onChange={(event) => setItemId(event.target.value)}
                required>
                
                  <option value="">Sélectionner un service…</option>
                  {activeServices.map((item) =>
                <option key={item.id} value={item.id}>
                      {item.name} — {money(item.price)}
                    </option>
                )}
                </select>
              </Field>
              <Field label="Patient">
                <input
                className={inputClass}
                placeholder="Nom du patient"
                value={client}
                onChange={(event) => setClient(event.target.value)}
                required />
              
              </Field>
              <Field label="Téléphone (optionnel)">
                <input
                className={inputClass}
                placeholder="06 00 00 00 00"
                value={phone}
                onChange={(event) => setPhone(event.target.value)} />
              
              </Field>
              <Field label="Date du rendez-vous">
                <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required />
              
              </Field>
              <Field label="Heure">
                <input
                type="time"
                className={inputClass}
                value={time}
                onChange={(event) => setTime(event.target.value)}
                required />
              
              </Field>
              <Field label="Note (optionnel)" className="sm:col-span-2">
                <input
                className={inputClass}
                placeholder="À jeun, rappel 2e dose…"
                value={note}
                onChange={(event) => setNote(event.target.value)} />
              
              </Field>
              {date ?
            <p className="sm:col-span-2 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
                  <CalendarClockIcon className="h-4 w-4 shrink-0" />
                  Ce rendez-vous apparaîtra dans l’agenda le {fmtLongDate(date)} à{' '}
                  {time}.
                </p> :
            null}
            </div>
          }

          {failed ?
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              La vente n’a pas pu être enregistrée. Vérifiez la connexion et vos droits, puis réessayez.
            </p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Total encaissé
              </p>
              <p className="text-xl font-semibold text-ink-900">{money(total)}</p>
              {can('finance.view') ?
              <p className="text-xs text-ink-500">
                Profit généré : {money(profit)}
              </p> : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}>
                
                Annuler
              </Button>
              <Button type="submit" disabled={!canSubmit || saving}>
                <CheckIcon className="h-4 w-4" />
                {saving ? 'Enregistrement…' : 'Enregistrer la vente'}
              </Button>
            </div>
          </div>
        </form>
        }
      </Modal>
    </SaleDialogContext.Provider>);

}