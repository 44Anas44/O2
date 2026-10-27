import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CheckIcon,
  FileTextIcon,
  MinusIcon,
  PackageIcon,
  PencilIcon,
  PercentIcon,
  PlusIcon,
  StethoscopeIcon,
  Trash2Icon } from
'lucide-react';
import { useStore, type CreatedSale } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { downloadAppointmentSlip, downloadSaleReceipt } from '../pdf';
import { receiptNumber } from '../pdf/theme';
import { Modal } from './ui/Modal';
import { Button, Field, inputClass } from './ui/Primitives';
import { ProductPicker } from './sale/ProductPicker';
import { ServicePicker } from './sale/ServicePicker';
import { ServiceForm } from './sale/ServiceForm';
import { BuyerPicker, buyerLabel } from './sale/BuyerPicker';
import { lineAmounts } from '../lib/pricing';
import { money } from '../utils/format';
import { fmtShortDate, nowTime, todayKey } from '../utils/date';

type ProductLine = {key: string;kind: 'produit';itemId: string;quantity: number;discountPct: number;};
type Mode = 'standard' | 'lot';
type ServiceLine = {key: string;kind: 'service';itemId: string;date: string;time: string;note: string;};
type Line = ProductLine | ServiceLine;

type View =
{name: 'basket';} |
{name: 'products';} |
{name: 'services';} |
{name: 'service-form';itemId: string;editKey?: string;};

type SaleDialogValue = {openSale: (kind?: 'produit' | 'service' | 'lot') => void;};

const SaleDialogContext = createContext<SaleDialogValue | null>(null);

export function useSaleDialog(): SaleDialogValue {
  const context = useContext(SaleDialogContext);
  if (!context) throw new Error('useSaleDialog hors provider');
  return context;
}

let lineCounter = 0;
const nextKey = () => `l${(lineCounter += 1)}`;

export function SaleDialogProvider({ children }: {children: React.ReactNode;}) {
  const { products, services, buyers, saveBuyer, createSale } = useStore();
  const { can, displayName } = useAuth();
  const { center } = useSettings();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ name: 'basket' });
  const [lines, setLines] = useState<Line[]>([]);
  const [client, setClient] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(todayKey());
  const [mode, setMode] = useState<Mode>('standard');
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [globalDiscount, setGlobalDiscount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CreatedSale | null>(null);

  const activeServices = useMemo(() => services.filter((service) => service.active), [services]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);

  const start = (kind?: 'produit' | 'service' | 'lot') => {
    setMode(kind === 'lot' ? 'lot' : 'standard');
    setBuyerId(null);
    setGlobalDiscount('');
    setLines([]);
    setClient('');
    setPhone('');
    setDate(todayKey());
    setError(null);
    setDone(null);
    setSaving(false);
    setView(kind === 'produit' ? { name: 'products' } : kind === 'service' ? { name: 'services' } : { name: 'basket' });
    setOpen(true);
  };

  const value = useMemo<SaleDialogValue>(() => ({ openSale: start }), []);

  /* ----------------------------- panier ----------------------------- */

  const inBasket = useMemo(() => {
    const map = new Map<string, number>();
    lines.forEach((line) => {
      if (line.kind === 'produit') map.set(line.itemId, (map.get(line.itemId) ?? 0) + line.quantity);
    });
    return map;
  }, [lines]);

  const addProduct = (productId: string, quantity: number) => {
    setLines((prev) => {
      const existing = prev.find((line): line is ProductLine => line.kind === 'produit' && line.itemId === productId);
      if (existing) {
        return prev.map((line) => line.key === existing.key ? { ...existing, quantity: existing.quantity + quantity } : line);
      }
      return [...prev, { key: nextKey(), kind: 'produit', itemId: productId, quantity, discountPct: 0 }];
    });
  };

  const setQuantity = (key: string, quantity: number) =>
  setLines((prev) =>
  prev.map((line) => line.key === key && line.kind === 'produit' ? { ...line, quantity: Math.max(1, quantity) } : line)
  );

  const setDiscount = (key: string, value: number) =>
  setLines((prev) =>
  prev.map((line) =>
  line.key === key && line.kind === 'produit' ? { ...line, discountPct: Math.min(100, Math.max(0, value || 0)) } : line
  )
  );

  const applyGlobalDiscount = () => {
    const value = Math.min(100, Math.max(0, Number(globalDiscount) || 0));
    setLines((prev) => prev.map((line) => line.kind === 'produit' ? { ...line, discountPct: value } : line));
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((line) => line.key !== key));

  const saveService = (itemId: string, editKey: string | undefined, form: {date: string;time: string;note: string;}) => {
    setLines((prev) =>
    editKey ?
    prev.map((line) => line.key === editKey && line.kind === 'service' ? { ...line, ...form } : line) :
    [...prev, { key: nextKey(), kind: 'service', itemId, ...form }]
    );
    setView(editKey ? { name: 'basket' } : { name: 'services' });
  };

  const amountsOf = (line: Line) => {
    if (line.kind === 'produit') {
      const product = productById.get(line.itemId);
      if (!product) return { unit: 0, gross: 0, discount: 0, total: 0, vat: 0, profit: 0 };
      return lineAmounts(product, line.quantity, line.discountPct);
    }
    const price = serviceById.get(line.itemId)?.price ?? 0;
    return { unit: price, gross: price, discount: 0, total: price, vat: 0, profit: price };
  };

  const totals = lines.reduce(
    (sum, line) => {
      const amounts = amountsOf(line);
      return {
        gross: sum.gross + amounts.gross,
        discount: sum.discount + amounts.discount,
        total: sum.total + amounts.total,
        vat: sum.vat + amounts.vat,
        profit: sum.profit + amounts.profit
      };
    },
    { gross: 0, discount: 0, total: 0, vat: 0, profit: 0 }
  );
  const total = totals.total;
  const profit = totals.profit;
  const hasProducts = lines.some((line) => line.kind === 'produit');
  const hasServices = lines.some((line) => line.kind === 'service');

  const stockProblem = lines.some(
    (line) => line.kind === 'produit' && line.quantity > (productById.get(line.itemId)?.stock ?? 0)
  );
  const canDiscount = can('sales.discount');
  const buyer = buyers.find((item) => item.id === buyerId);
  const needsBuyer = mode === 'lot';
  const canSubmit = lines.length > 0 && !stockProblem && Boolean(date) && !saving && (!needsBuyer || Boolean(buyer));

  /* ----------------------------- actions ----------------------------- */

  const requestClose = () => {
    if (!done && lines.length > 0 && !window.confirm('Abandonner cette vente ? Les articles du panier seront perdus.')) return;
    setOpen(false);
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (lines.length > 0 && !window.confirm('Changer de type de vente vide le panier. Continuer ?')) return;
    setMode(next);
    setLines([]);
    setBuyerId(null);
    setGlobalDiscount('');
    setError(null);
  };

  const cancelSale = () => {
    if (lines.length > 0 && !window.confirm('Annuler cette vente ? Les articles du panier seront perdus.')) return;
    setOpen(false);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const response = await createSale({
      client: mode === 'lot' ? buyer ? buyerLabel(buyer) : '' : client.trim() || (hasServices && !hasProducts ? 'Patient' : 'Comptoir'),
      phone: mode === 'lot' ? buyer?.phone ?? '' : phone.trim(),
      date,
      time: nowTime(),
      bulk: mode === 'lot',
      buyerId: mode === 'lot' ? buyerId ?? undefined : undefined,
      lines: lines.map((line) =>
      line.kind === 'produit' ?
      { kind: 'produit', itemId: line.itemId, quantity: line.quantity, discountPct: line.discountPct } :
      { kind: 'service', itemId: line.itemId, date: line.date, time: line.time, note: line.note }
      )
    });
    setSaving(false);
    if (response.ok) setDone(response.result);else setError(response.error);
  };

  const pdfError = () => window.alert('Impossible de générer le PDF.');

  const printReceipt = () => {
    if (!done) return;
    downloadSaleReceipt({
      receipt: done.receipt,
      lines: done.sales,
      appointments: done.appointments,
      center,
      generatedBy: displayName
    }).catch(pdfError);
  };

  const printSlip = (appointmentId: string) => {
    if (!done) return;
    const appointment = done.appointments.find((item) => item.id === appointmentId);
    if (!appointment) return;
    downloadAppointmentSlip({
      appointment,
      service: serviceById.get(appointment.serviceId) ?? null,
      sale: done.sales.find((sale) => sale.appointmentId === appointment.id) ?? null,
      center,
      generatedBy: displayName
    }).catch(pdfError);
  };

  /* ----------------------------- rendu ----------------------------- */

  const count = lines.length;
  const summary =
  <div className="flex items-center justify-between gap-3 rounded-lg bg-ink-50 px-4 py-2.5 text-sm">
      <span className="text-ink-600">
        Panier : <strong className="text-ink-900">{count} article{count > 1 ? 's' : ''}</strong> · {money(total)}
      </span>
      <Button type="button" size="sm" onClick={() => setView({ name: 'basket' })}>
        <ArrowLeftIcon className="h-4 w-4" />
        Voir le panier
      </Button>
    </div>;


  const title =
  done ? 'Vente enregistrée' :
  view.name === 'products' ? 'Ajouter un produit' :
  view.name === 'services' ? 'Ajouter un service' :
  view.name === 'service-form' ? view.editKey ? 'Modifier le rendez-vous' : 'Rendez-vous' :
  'Déclarer une vente';

  const formService = view.name === 'service-form' ? serviceById.get(view.itemId) : undefined;
  const formLine = view.name === 'service-form' && view.editKey ?
  lines.find((line): line is ServiceLine => line.key === view.editKey && line.kind === 'service') :
  undefined;

  return (
    <SaleDialogContext.Provider value={value}>
      {children}
      <Modal
        open={open}
        onClose={requestClose}
        title={title}
        description={
        done || view.name !== 'basket' ? undefined : 'Ajoutez les produits et services, puis validez : un seul reçu pour toute la vente.'
        }
        width="max-w-2xl">

        {done ?
        <div className="space-y-5 py-2 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <CheckIcon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-base font-semibold text-ink-900">Reçu {receiptNumber(done.receipt.receiptNo)}</p>
              <p className="text-sm text-ink-500">
                {done.sales.length} article{done.sales.length > 1 ? 's' : ''} ·{' '}
                {money(done.sales.reduce((sum, sale) => sum + sale.total, 0))}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={printReceipt}>
                <FileTextIcon className="h-4 w-4" />
                Télécharger le reçu (PDF)
              </Button>
              {done.appointments.map((appointment) =>
            <Button key={appointment.id} type="button" variant="secondary" onClick={() => printSlip(appointment.id)}>
                  <CalendarClockIcon className="h-4 w-4" />
                  Bon RDV · {appointment.serviceName} ({fmtShortDate(appointment.date)})
                </Button>
            )}
            </div>
            <div className="flex justify-center gap-2 border-t border-ink-100 pt-4">
              <Button type="button" variant="ghost" onClick={() => start()}>Nouvelle vente</Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Fermer</Button>
            </div>
          </div> :

        view.name === 'products' ?
        <div className="space-y-4">
            <ProductPicker
            products={products}
            inBasket={inBasket}
            showCosts={can('costs.view')}
            onAdd={addProduct} />
            {summary}
          </div> :

        view.name === 'services' ?
        <div className="space-y-4">
            <ServicePicker services={activeServices} onChoose={(id) => setView({ name: 'service-form', itemId: id })} />
            {summary}
          </div> :

        view.name === 'service-form' && formService ?
        <ServiceForm
          key={view.editKey ?? view.itemId}
          service={formService}
          editing={Boolean(view.editKey)}
          initial={{
            date: formLine?.date ?? todayKey(),
            time: formLine?.time ?? nowTime(),
            note: formLine?.note ?? ''
          }}
          onSave={(form) => saveService(view.itemId, view.editKey, form)}
          onCancel={() => setView(view.editKey ? { name: 'basket' } : { name: 'services' })} /> :


        <div className="space-y-5">
            <div className="flex gap-1 rounded-lg bg-ink-100 p-1" role="tablist">
              {([['standard', 'Vente'], ['lot', 'Vente par lot']] as [Mode, string][]).map(([key, label]) =>
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => switchMode(key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}>
                  {label}
                </button>
            )}
            </div>

            {mode === 'lot' ?
          <div className="space-y-3">
                <p className="text-sm text-ink-500">
                  Vente en gros à un acheteur enregistré (produits uniquement).
                  {canDiscount ? ' Vous pouvez accorder des remises.' : ' Les remises sont réservées à un gestionnaire ou administrateur.'}
                </p>
                <BuyerPicker buyers={buyers} value={buyerId} onChange={setBuyerId} onCreate={saveBuyer} />
                <div className="max-w-[220px]">
                  <Field label="Date de la vente">
                    <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
                  </Field>
                </div>
              </div> :
          <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Client">
                  <input className={inputClass} value={client} onChange={(e) => setClient(e.target.value)} placeholder="Comptoir" />
                </Field>
                <Field label="Téléphone">
                  <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Facultatif" />
                </Field>
                <Field label="Date de la vente">
                  <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
              </div>}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setView({ name: 'products' })}>
                <PackageIcon className="h-4 w-4" />
                Ajouter un produit
              </Button>
              {mode === 'standard' ?
            <Button type="button" variant="secondary" onClick={() => setView({ name: 'services' })}>
                  <StethoscopeIcon className="h-4 w-4" />
                  Ajouter un service
                </Button> : null}
              {mode === 'lot' && canDiscount && hasProducts ?
            <div className="ml-auto flex items-center gap-2">
                  <label className="text-xs text-ink-500" htmlFor="global-discount">Remise sur tous les produits</label>
                  <div className="relative">
                    <input
                  id="global-discount"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={globalDiscount}
                  onChange={(e) => setGlobalDiscount(e.target.value)}
                  placeholder="0"
                  className="w-20 rounded-lg border border-ink-200 py-1.5 pl-2 pr-6 text-sm" />
                    <span className="pointer-events-none absolute right-2 top-1.5 text-sm text-ink-400">%</span>
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={applyGlobalDiscount}>Appliquer</Button>
                </div> : null}
            </div>

            {lines.length === 0 ?
          <div className="rounded-lg border border-dashed border-ink-200 px-4 py-10 text-center text-sm text-ink-500">
                Le panier est vide. Ajoutez un produit{mode === 'standard' ? ' ou un service' : ''} pour commencer.
              </div> :
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
                {lines.map((line) => {
              const product = line.kind === 'produit' ? productById.get(line.itemId) : undefined;
              const service = line.kind === 'service' ? serviceById.get(line.itemId) : undefined;
              const tooMany = line.kind === 'produit' && line.quantity > (product?.stock ?? 0);
              const amounts = amountsOf(line);
              return (
                <li key={line.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${line.kind === 'produit' ? 'bg-ink-100 text-ink-600' : 'bg-brand-50 text-brand-700'}`}>
                        {line.kind === 'produit' ? <PackageIcon className="h-4 w-4" /> : <StethoscopeIcon className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="truncate text-sm font-medium text-ink-900">
                          {product?.name ?? service?.name ?? 'Article supprimé'}
                        </p>
                        {line.kind === 'produit' ?
                    <p className={`text-xs ${tooMany ? 'font-medium text-red-600' : 'text-ink-500'}`}>
                            {money(amounts.unit)} l’unité{product?.vat ? ' TTC' : ''}
                            {tooMany ? ` · stock insuffisant (${product?.stock ?? 0})` : ''}
                          </p> :
                    <p className="truncate text-xs text-ink-500">
                            RDV le {fmtShortDate(line.date)} à {line.time}
                            {line.note ? ` · ${line.note}` : ''}
                          </p>}
                      </div>

                      {line.kind === 'produit' ?
                  <div className="flex shrink-0 items-center gap-1">
                          <Button type="button" size="sm" variant="secondary" aria-label="Diminuer" disabled={line.quantity <= 1} onClick={() => setQuantity(line.key, line.quantity - 1)}>
                            <MinusIcon className="h-3.5 w-3.5" />
                          </Button>
                          <input
                      aria-label="Quantité"
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => setQuantity(line.key, Math.floor(Number(e.target.value) || 1))}
                      className="w-14 rounded-lg border border-ink-200 px-1 py-1.5 text-center text-sm" />
                          <Button type="button" size="sm" variant="secondary" aria-label="Augmenter" onClick={() => setQuantity(line.key, line.quantity + 1)}>
                            <PlusIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div> :
                  <Button type="button" size="sm" variant="secondary" onClick={() => setView({ name: 'service-form', itemId: line.itemId, editKey: line.key })}>
                          <PencilIcon className="h-3.5 w-3.5" />
                          Modifier
                        </Button>}

                      {mode === 'lot' && line.kind === 'produit' && canDiscount ?
                  <div className="relative shrink-0">
                          <input
                      aria-label="Remise en pourcentage"
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      value={line.discountPct || ''}
                      placeholder="0"
                      onChange={(e) => setDiscount(line.key, Number(e.target.value))}
                      className="w-20 rounded-lg border border-ink-200 py-1.5 pl-2 pr-6 text-right text-sm" />
                          <PercentIcon className="pointer-events-none absolute right-2 top-2.5 h-3 w-3 text-ink-400" />
                        </div> : null}

                      <span className="w-28 shrink-0 text-right">
                        <span className="block text-sm font-semibold text-ink-900">{money(amounts.total)}</span>
                        {amounts.discount > 0 ?
                    <span className="block text-xs text-ink-400 line-through">{money(amounts.gross)}</span> : null}
                      </span>
                      <Button type="button" size="sm" variant="ghost" aria-label="Retirer" onClick={() => removeLine(line.key)} className="text-red-500 hover:bg-red-50 hover:text-red-600">
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </li>);

            })}
              </ul>}

            {error ?
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                La vente n’a pas pu être enregistrée : {error}
              </p> : null}

            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-ink-100 pt-4">
              <div className="space-y-0.5">
                {totals.discount > 0 ?
              <>
                    <p className="text-xs text-ink-500">Sous-total : {money(totals.gross)}</p>
                    <p className="text-xs font-medium text-amber-700">Remises : −{money(totals.discount)}</p>
                  </> : null}
                {totals.vat > 0 ?
              <p className="text-xs text-ink-500">dont TVA : {money(totals.vat)}</p> : null}
                <p className="text-xs uppercase tracking-wide text-ink-400">Total</p>
                <p className="text-xl font-semibold text-ink-900">{money(total)}</p>
                {can('finance.view') && lines.length > 0 ?
              <p className="text-xs text-ink-500">Profit généré : {money(profit)}</p> : null}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="danger" onClick={cancelSale}>Annuler la vente</Button>
                <Button type="button" disabled={!canSubmit} onClick={submit}>
                  <CheckIcon className="h-4 w-4" />
                  {saving ? 'Enregistrement…' : 'Valider la vente'}
                </Button>
              </div>
            </div>
          </div>}
      </Modal>
    </SaleDialogContext.Provider>);

}
