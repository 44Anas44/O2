import React, { useMemo, useState } from 'react';
import { BanknoteIcon, PlusIcon, RepeatIcon, Trash2Icon } from 'lucide-react';
import type { ExpenseCategory, Period } from '../types';
import { useStore } from '../contexts/StoreContext';
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
import { money } from '../utils/format';
import {
  fmtShortDate,
  inRange,
  monthKey,
  rangeFor,
  todayKey } from
'../utils/date';

const categories: ExpenseCategory[] = [
'Stock',
'Loyer',
'Salaires',
'Charges',
'Matériel',
'Autre'];


const periodLabels: {key: Period;label: string;}[] = [
{ key: 'jour', label: "Aujourd'hui" },
{ key: 'semaine', label: 'Cette semaine' },
{ key: 'mois', label: 'Ce mois' }];


export function Expenses() {
  const {
    expenses,
    recurring,
    addExpense,
    removeExpense,
    addRecurring,
    toggleRecurring,
    removeRecurring
  } = useStore();

  const [open, setOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [useToday, setUseToday] = useState(true);
  const [form, setForm] = useState({
    label: '',
    amount: 0,
    category: 'Charges' as ExpenseCategory,
    date: todayKey()
  });
  const [ruleForm, setRuleForm] = useState({
    label: '',
    amount: 0,
    category: 'Charges' as ExpenseCategory,
    dayOfMonth: 1
  });

  const totals = useMemo(
    () =>
    periodLabels.map((period) => ({
      ...period,
      total: expenses.
      filter((expense) => inRange(expense.date, rangeFor(period.key))).
      reduce((sum, expense) => sum + expense.amount, 0)
    })),
    [expenses]
  );

  const monthlyFixed = recurring.
  filter((rule) => rule.active).
  reduce((sum, rule) => sum + rule.amount, 0);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    addExpense({
      label: form.label,
      amount: form.amount,
      category: form.category,
      date: useToday ? todayKey() : form.date
    });
    setForm({ label: '', amount: 0, category: 'Charges', date: todayKey() });
    setUseToday(true);
    setOpen(false);
  };

  const submitRule = (event: React.FormEvent) => {
    event.preventDefault();
    addRecurring({ ...ruleForm, startMonth: monthKey(new Date()) });
    setRuleForm({ label: '', amount: 0, category: 'Charges', dayOfMonth: 1 });
    setRecurringOpen(false);
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {totals.map((entry, index) =>
        <div
          key={entry.key}
          className={`rounded-xl border p-5 shadow-card ${
          index === 2 ?
          'border-ink-900 bg-ink-900 text-white' :
          'border-ink-100 bg-white'}`
          }>
          
            <p
            className={`text-xs font-medium uppercase tracking-wide ${index === 2 ? 'text-ink-400' : 'text-ink-400'}`}>
            
              Dépenses · {entry.label}
            </p>
            <p
            className={`mt-2 text-2xl font-semibold ${index === 2 ? 'text-white' : 'text-ink-900'}`}>
            
              {money(entry.total)}
            </p>
            {index === 2 ?
          <p className="mt-1 text-sm text-ink-400">
                dont {money(monthlyFixed)} de charges fixes
              </p> :
          null}
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel>
            <PanelHeader
              title="Journal des dépenses"
              subtitle="Saisies manuelles, mouvements de stock et charges fixes"
              action={
              <Button onClick={() => setOpen(true)}>
                  <PlusIcon className="h-4 w-4" />
                  Déclarer une dépense
                </Button>
              } />
            
            {expenses.length === 0 ?
            <EmptyState
              icon={<BanknoteIcon className="h-5 w-5" />}
              title="Aucune dépense enregistrée" /> :


            <ul className="max-h-[560px] divide-y divide-ink-100 overflow-y-auto scroll-thin">
                {expenses.map((expense) =>
              <li
                key={expense.id}
                className="flex items-center gap-4 px-5 py-3.5">
                
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {expense.label}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                        {fmtShortDate(expense.date)}
                        <Badge
                      tone={expense.category === 'Stock' ? 'brand' : 'neutral'}>
                      
                          {expense.category}
                        </Badge>
                        {expense.source !== 'manuelle' ?
                    <span className="text-ink-400">
                            {expense.source === 'fixe' ? 'charge fixe' : 'auto. stock'}
                          </span> :
                    null}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-ink-900">
                      −{money(expense.amount)}
                    </p>
                    {expense.source === 'fixe' ?
                <span className="w-8" /> :

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeExpense(expense.id)}
                  aria-label={`Supprimer ${expense.label}`}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600">
                  
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                }
                  </li>
              )}
              </ul>
            }
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            title="Dépenses mensuelles fixes"
            subtitle={`${money(monthlyFixed)} par mois`}
            action={
            <Button size="sm" variant="secondary" onClick={() => setRecurringOpen(true)}>
                <PlusIcon className="h-4 w-4" />
                Ajouter
              </Button>
            } />
          
          {recurring.length === 0 ?
          <EmptyState
            icon={<RepeatIcon className="h-5 w-5" />}
            title="Aucune charge fixe"
            description="Loyer, salaires, abonnements…" /> :


          <ul className="divide-y divide-ink-100">
              {recurring.map((rule) =>
            <li key={rule.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {rule.label}
                    </p>
                    <p className="text-xs text-ink-500">
                      Le {rule.dayOfMonth} de chaque mois · {rule.category}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-ink-900">
                    {money(rule.amount)}
                  </p>
                  <button
                type="button"
                role="switch"
                aria-checked={rule.active}
                aria-label={`Activer ${rule.label}`}
                onClick={() => toggleRecurring(rule.id)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ease-out ${
                rule.active ? 'bg-brand-600' : 'bg-ink-200'}`
                }>
                
                    <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-150 ease-out ${
                  rule.active ? 'translate-x-4' : 'translate-x-0.5'}`
                  } />
                
                  </button>
                  <Button
                size="sm"
                variant="ghost"
                onClick={() => removeRecurring(rule.id)}
                aria-label={`Supprimer ${rule.label}`}
                className="text-red-500 hover:bg-red-50 hover:text-red-600">
                
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </li>
            )}
            </ul>
          }
        </Panel>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Déclarer une dépense"
        description="Choisissez la date du jour ou une date précise.">
        
        <form onSubmit={submit} className="space-y-4">
          <Field label="Libellé">
            <input
              className={inputClass}
              value={form.label}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
              required />
            
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Montant (TND)">
              <input
                type="number"
                step="any"
                min={0}
                className={inputClass}
                value={form.amount}
                onChange={(event) =>
                setForm({ ...form, amount: Number(event.target.value) })
                }
                required />
              
            </Field>
            <Field label="Catégorie">
              <select
                className={inputClass}
                value={form.category}
                onChange={(event) =>
                setForm({
                  ...form,
                  category: event.target.value as ExpenseCategory
                })
                }>
                
                {categories.map((category) =>
                <option key={category} value={category}>
                    {category}
                  </option>
                )}
              </select>
            </Field>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              Date
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setUseToday(true)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out ${
                useToday ?
                'border-brand-600 bg-brand-50 text-brand-700' :
                'border-ink-200 text-ink-600 hover:bg-ink-50'}`
                }>
                
                Aujourd’hui
              </button>
              <button
                type="button"
                onClick={() => setUseToday(false)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out ${
                !useToday ?
                'border-brand-600 bg-brand-50 text-brand-700' :
                'border-ink-200 text-ink-600 hover:bg-ink-50'}`
                }>
                
                Autre date
              </button>
              {!useToday ?
              <input
                type="date"
                className={`${inputClass} max-w-[180px]`}
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
                required /> :

              null}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        title="Nouvelle dépense mensuelle fixe"
        description="Elle sera reportée automatiquement chaque mois.">
        
        <form onSubmit={submitRule} className="space-y-4">
          <Field label="Libellé">
            <input
              className={inputClass}
              value={ruleForm.label}
              onChange={(event) =>
              setRuleForm({ ...ruleForm, label: event.target.value })
              }
              required />
            
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Montant (TND)">
              <input
                type="number"
                step="any"
                min={0}
                className={inputClass}
                value={ruleForm.amount}
                onChange={(event) =>
                setRuleForm({ ...ruleForm, amount: Number(event.target.value) })
                }
                required />
              
            </Field>
            <Field label="Catégorie">
              <select
                className={inputClass}
                value={ruleForm.category}
                onChange={(event) =>
                setRuleForm({
                  ...ruleForm,
                  category: event.target.value as ExpenseCategory
                })
                }>
                
                {categories.map((category) =>
                <option key={category} value={category}>
                    {category}
                  </option>
                )}
              </select>
            </Field>
            <Field label="Jour du mois">
              <input
                type="number"
                min={1}
                max={28}
                className={inputClass}
                value={ruleForm.dayOfMonth}
                onChange={(event) =>
                setRuleForm({
                  ...ruleForm,
                  dayOfMonth: Number(event.target.value)
                })
                } />
              
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRecurringOpen(false)}>
              
              Annuler
            </Button>
            <Button type="submit">Ajouter la charge fixe</Button>
          </div>
        </form>
      </Modal>
    </div>);

}