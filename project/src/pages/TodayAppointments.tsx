import React, { useMemo, useState } from 'react';
import { CalendarCheckIcon, ClockIcon, PhoneIcon, PlusIcon } from 'lucide-react';
import { useStore } from '../contexts/StoreContext';
import { useSaleDialog } from '../components/SaleDialog';
import { AppointmentSlipButton } from '../components/ReceiptButtons';
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader } from
'../components/ui/Primitives';
import { initials, money } from '../utils/format';
import { fmtLongDate, todayKey, tomorrowKey } from '../utils/date';

export function TodayAppointments() {
  const { appointments, services, setAppointmentStatus } = useStore();
  const { openSale } = useSaleDialog();
  const [scope, setScope] = useState<'today' | 'tomorrow'>('today');

  const dateKey = scope === 'today' ? todayKey() : tomorrowKey();

  const list = useMemo(
    () =>
    appointments.
    filter((appointment) => appointment.date === dateKey).
    sort((a, b) => a.time < b.time ? -1 : 1),
    [appointments, dateKey]
  );

  const priceOf = (serviceId: string) =>
  services.find((service) => service.id === serviceId)?.price ?? 0;

  const active = list.filter((appointment) => appointment.status !== 'annulé');
  const expected = active.reduce(
    (sum, appointment) => sum + priceOf(appointment.serviceId),
    0
  );
  const remaining = list.filter((appointment) => appointment.status === 'prévu');

  const counts = {
    today: appointments.filter(
      (appointment) =>
      appointment.date === todayKey() && appointment.status !== 'annulé'
    ).length,
    tomorrow: appointments.filter(
      (appointment) =>
      appointment.date === tomorrowKey() && appointment.status !== 'annulé'
    ).length
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-lg border border-ink-200 bg-white p-1"
          role="tablist"
          aria-label="Journée">
          
          {(
          [
          { key: 'today', label: "Aujourd'hui", count: counts.today },
          { key: 'tomorrow', label: 'Demain', count: counts.tomorrow }] as
          const).
          map((tab) => {
            const selected = scope === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setScope(tab.key)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
                selected ?
                'bg-ink-900 text-white' :
                'text-ink-600 hover:text-ink-900'}`
                }>
                
                {tab.label}
                <span
                  className={`ml-2 rounded-full px-1.5 text-xs ${
                  selected ? 'bg-white/20' : 'bg-ink-100 text-ink-600'}`
                  }>
                  
                  {tab.count}
                </span>
              </button>);

          })}
        </div>
        <Button onClick={() => openSale('service')}>
          <PlusIcon className="h-4 w-4" />
          Nouveau rendez-vous
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-ink-900 p-5 text-white shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Recette attendue
          </p>
          <p className="mt-2 text-2xl font-semibold text-brand-300">
            {money(expected)}
          </p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Rendez-vous
          </p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">
            {active.length}
          </p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Encore à honorer
          </p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">
            {remaining.length}
          </p>
        </div>
      </div>

      <Panel>
        <PanelHeader
          title={fmtLongDate(dateKey)}
          subtitle={`${list.length} rendez-vous programmés`} />
        
        {list.length === 0 ?
        <EmptyState
          icon={<CalendarCheckIcon className="h-5 w-5" />}
          title="Aucun rendez-vous"
          description="Déclarez une vente de service pour programmer un rendez-vous." /> :


        <ul className="divide-y divide-ink-100">
            {list.map((appointment) =>
          <li
            key={appointment.id}
            className="flex flex-wrap items-center gap-4 px-5 py-4">
            
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-ink-900 text-xs font-semibold text-white">
                  {appointment.time}
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  {initials(appointment.client)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {appointment.client}
                  </p>
                  <p className="truncate text-sm text-ink-500">
                    {appointment.serviceName} ·{' '}
                    {money(priceOf(appointment.serviceId))} ·{' '}
                    {appointment.durationMin} min
                  </p>
                  {appointment.note ?
              <p className="mt-0.5 text-xs italic text-ink-500">
                      {appointment.note}
                    </p> :
              null}
                </div>
                {appointment.phone ?
            <span className="hidden items-center gap-1.5 text-sm text-ink-500 sm:flex">
                    <PhoneIcon className="h-3.5 w-3.5" />
                    {appointment.phone}
                  </span> :
            null}
                <AppointmentSlipButton appointment={appointment} label="PDF" />
                {appointment.status === 'prévu' ?
            <div className="flex gap-2">
                    <Button
                size="sm"
                variant="secondary"
                onClick={() => setAppointmentStatus(appointment.id, 'honoré')}>
                
                      Honoré
                    </Button>
                    <Button
                size="sm"
                variant="danger"
                onClick={() => setAppointmentStatus(appointment.id, 'annulé')}>
                
                      Annulé
                    </Button>
                  </div> :

            <Badge tone={appointment.status === 'honoré' ? 'brand' : 'danger'}>
                    <ClockIcon className="h-3 w-3" />
                    {appointment.status}
                  </Badge>
            }
              </li>
          )}
          </ul>
        }
      </Panel>
    </div>);

}