import React, { useMemo, useState } from 'react';
import { subDays } from 'date-fns';
import { PackageIcon, StethoscopeIcon, UsersIcon } from 'lucide-react';
import type { Period } from '../types';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useSaleDialog } from '../components/SaleDialog';
import { Button, Panel, PanelHeader } from '../components/ui/Primitives';
import {
  HeadlineStats,
  PeriodSwitcher,
  SplitBar,
  TopSellers } from
'../components/dashboard/StatBlocks';
import { UpcomingAppointments } from '../components/dashboard/UpcomingAppointments';
import { LowStockAlerts } from '../components/dashboard/LowStockAlerts';
import { PieChart } from '../components/dashboard/PieChart';
import { dailySeries, distributionByItem, statsFor, topSellers } from '../utils/stats';
import { dayKey, fmtDayLabel, rangeFor, todayKey } from '../utils/date';
import { money } from '../utils/format';

export function Dashboard() {
  // `countedSales` : sans les services annulés ni les services non payés pas encore honorés.
  const { countedSales: sales, expenses, appointments, services, lowStock } = useStore();
  const { can } = useAuth();
  const showFinance = can('finance.view');
  const { openSale } = useSaleDialog();
  const [period, setPeriod] = useState<Period>('jour');

  const range = useMemo(() => rangeFor(period), [period]);
  const stats = useMemo(() => statsFor(sales, expenses, range), [sales, expenses, range]);
  const best = useMemo(() => topSellers(sales, range), [sales, range]);
  const salesCountByItem = useMemo(
    () => distributionByItem(sales, range, 'count'),
    [sales, range]
  );
  const profitByItem = useMemo(
    () => distributionByItem(sales, range, 'profit'),
    [sales, range]
  );

  const last7 = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) =>
    dayKey(subDays(new Date(), 6 - index))
    );
    return dailySeries(sales, expenses, days);
  }, [sales, expenses]);

  const maxDay = Math.max(
    1,
    ...last7.map((entry) => Math.max(entry.revenue, entry.expenses))
  );

  const upcoming = useMemo(
    () =>
    appointments.
    filter(
      (appointment) =>
      appointment.status === 'prévu' && appointment.date >= todayKey()
    ).
    sort((a, b) =>
    `${a.date}${a.time}` < `${b.date}${b.time}` ? -1 : 1
    ).
    slice(0, 6),
    [appointments]
  );

  const priceOf = (serviceId: string) =>
  services.find((service) => service.id === serviceId)?.price ?? 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 bg-white px-5 py-4 shadow-card">
        <div className="mr-auto">
          <p className="text-sm font-semibold text-ink-900">
            Déclarer une vente
          </p>
          <p className="text-sm text-ink-500">
            Plusieurs articles sur un seul reçu ; vente par lot avec acheteur et remises.
          </p>
        </div>
        <Button onClick={() => openSale('lot')} variant="secondary">
          <UsersIcon className="h-4 w-4" />
          Vente par lot
        </Button>
        <Button onClick={() => openSale('produit')} variant="secondary">
          <PackageIcon className="h-4 w-4" />
          Vente de produit
        </Button>
        <Button onClick={() => openSale('service')}>
          <StethoscopeIcon className="h-4 w-4" />
          Vente de service
        </Button>
      </div>

      {showFinance ?
      <>
      <PeriodSwitcher value={period} onChange={setPeriod} rangeLabel={range.label} />
      <HeadlineStats stats={stats} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <UpcomingAppointments appointments={upcoming} priceOf={priceOf} />
        </div>
        <LowStockAlerts products={lowStock} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SplitBar
          serviceRevenue={stats.serviceRevenue}
          productRevenue={stats.productRevenue} />
        
        <TopSellers items={best} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PieChart
          title="Répartition des ventes"
          subtitle="Quantités vendues par produit / service"
          slices={salesCountByItem}
          valueFormat="unit" />
        
        <PieChart
          title="Répartition des profits"
          subtitle="Profit généré par produit / service"
          slices={profitByItem}
          valueFormat="money" />
        
      </div>

      <Panel>
        <PanelHeader
          title="7 derniers jours"
          subtitle="Encaissements et dépenses par jour" />
        
        <div className="px-5 py-6">
          <div className="flex items-end gap-3">
            {last7.map((entry) =>
            <div key={entry.day} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-36 w-full items-end justify-center gap-1">
                  <div
                  className="w-1/3 rounded-t bg-brand-500"
                  style={{ height: `${entry.revenue / maxDay * 100}%` }}
                  title={`Encaissements ${money(entry.revenue)}`} />
                
                  <div
                  className="w-1/3 rounded-t bg-ink-300"
                  style={{ height: `${entry.expenses / maxDay * 100}%` }}
                  title={`Dépenses ${money(entry.expenses)}`} />
                
                </div>
                <span className="text-center text-xs capitalize text-ink-500">
                  {fmtDayLabel(entry.day)}
                </span>
              </div>
            )}
          </div>
          <div className="mt-5 flex gap-6 border-t border-ink-100 pt-4 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
              Encaissements
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
              Dépenses
            </span>
          </div>
        </div>
      </Panel>
      </> :
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <UpcomingAppointments appointments={upcoming} priceOf={priceOf} />
        </div>
        <LowStockAlerts products={lowStock} />
      </div>}
    </div>);

}