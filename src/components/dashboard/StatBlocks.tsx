import React from 'react';
import { motion } from 'framer-motion';
import type { Period } from '../../types';
import type { PeriodStats, Ranked } from '../../utils/stats';
import { money, percent } from '../../utils/format';
import { Panel, PanelHeader } from '../ui/Primitives';

const periods: {key: Period;label: string;}[] = [
{ key: 'jour', label: "Aujourd'hui" },
{ key: 'semaine', label: 'Cette semaine' },
{ key: 'mois', label: 'Ce mois' }];


export function PeriodSwitcher({
  value,
  onChange,
  rangeLabel




}: {value: Period;onChange: (period: Period) => void;rangeLabel: string;}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-ink-900">Performance</h2>
        <p className="text-sm capitalize text-ink-500">{rangeLabel}</p>
      </div>
      <div
        className="inline-flex rounded-lg border border-ink-200 bg-white p-1"
        role="tablist"
        aria-label="Période">
        
        {periods.map((period) => {
          const selected = period.key === value;
          return (
            <button
              key={period.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(period.key)}
              className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
              selected ? 'text-white' : 'text-ink-600 hover:text-ink-900'}`
              }>
              
              {selected ?
              <motion.span
                layoutId="period-pill"
                className="absolute inset-0 rounded-md bg-ink-900"
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} /> :

              null}
              <span className="relative">{period.label}</span>
            </button>);

        })}
      </div>
    </div>);

}

export function HeadlineStats({ stats }: {stats: PeriodStats;}) {
  const positive = stats.net >= 0;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl bg-ink-900 p-6 text-white shadow-card lg:col-span-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
          Résultat net (encaissements − dépenses)
        </p>
        <p
          className={`mt-2 text-4xl font-semibold tracking-tight ${positive ? 'text-brand-300' : 'text-red-300'}`}>
          
          {money(stats.net)}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/10 pt-5 sm:grid-cols-3">
          <SubFigure label="Chiffre d’affaires" value={money(stats.revenue)} />
          <SubFigure label="Profit des ventes" value={money(stats.grossProfit)} />
          <SubFigure label="Dépenses" value={money(stats.expenses)} />
        </div>
      </div>
      <div className="rounded-xl border border-ink-100 bg-white p-6 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
          Pourcentage de profit
        </p>
        <p className="mt-2 text-3xl font-semibold text-ink-900">
          {percent(stats.margin)}
        </p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${Math.min(100, Math.max(0, stats.margin))}%` }} />
          
        </div>
        <dl className="mt-5 space-y-3 border-t border-ink-100 pt-4 text-sm">
          <Row label="Ventes enregistrées" value={String(stats.salesCount)} />
          <Row label="Panier moyen" value={money(stats.averageTicket)} />
          <Row
            label="Services facturés"
            value={`${stats.serviceCount} · ${money(stats.serviceRevenue)}`} />
          
          <Row
            label="Produits vendus"
            value={`${stats.productUnits} u · ${money(stats.productRevenue)}`} />
          
        </dl>
      </div>
    </div>);

}

function SubFigure({ label, value }: {label: string;value: string;}) {
  return (
    <div>
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>);

}

function Row({ label, value }: {label: string;value: string;}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-medium text-ink-900">{value}</dd>
    </div>);

}

export function SplitBar({
  serviceRevenue,
  productRevenue



}: {serviceRevenue: number;productRevenue: number;}) {
  const total = serviceRevenue + productRevenue;
  const servicePart = total > 0 ? serviceRevenue / total * 100 : 0;
  return (
    <Panel>
      <PanelHeader
        title="Répartition du chiffre d’affaires"
        subtitle="Services vs produits sur la période" />
      
      <div className="px-5 py-5">
        {total === 0 ?
        <p className="text-sm text-ink-500">Aucune vente sur la période.</p> :

        <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-100">
              <div
              className="h-full bg-brand-600"
              style={{ width: `${servicePart}%` }} />
            
              <div
              className="h-full bg-ink-900"
              style={{ width: `${100 - servicePart}%` }} />
            
            </div>
            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                Services · <strong className="text-ink-900">{money(serviceRevenue)}</strong>
                <span className="text-ink-500">({percent(servicePart)})</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-ink-900" />
                Produits · <strong className="text-ink-900">{money(productRevenue)}</strong>
                <span className="text-ink-500">({percent(100 - servicePart)})</span>
              </span>
            </div>
          </>
        }
      </div>
    </Panel>);

}

export function TopSellers({ items }: {items: Ranked[];}) {
  const max = items[0]?.value ?? 0;
  return (
    <Panel>
      <PanelHeader title="Meilleures ventes" subtitle="Par chiffre d’affaires" />
      <div className="px-5 py-5">
        {items.length === 0 ?
        <p className="text-sm text-ink-500">Aucune vente sur la période.</p> :

        <ul className="space-y-3.5">
            {items.map((item) =>
          <li key={item.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-ink-800">
                    {item.label}
                  </span>
                  <span className="shrink-0 text-ink-500">
                    {item.secondary} u · {money(item.value)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${max > 0 ? item.value / max * 100 : 0}%` }} />
              
                </div>
              </li>
          )}
          </ul>
        }
      </div>
    </Panel>);

}