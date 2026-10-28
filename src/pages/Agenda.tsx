import React, { useMemo, useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import {
  CalendarRangeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  PhoneIcon,
  PlusIcon } from
'lucide-react';
import { useStore } from '../contexts/StoreContext';
import { useSaleDialog } from '../components/SaleDialog';
import { useAuth } from '../contexts/AuthContext';
import { AppointmentSlipButton } from '../components/ReceiptButtons';
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader } from
'../components/ui/Primitives';
import { money } from '../utils/format';
import { cancelConfirmMessage, lineState, paymentLabel } from '../utils/saleAccounting';
import type { Appointment } from '../types';
import {
  WEEKDAYS,
  buildMonthGrid,
  fmtLongDate,
  fmtMonthTitle,
  todayKey } from
'../utils/date';

export function Agenda() {
  const { appointments, setAppointmentStatus, removeAppointment, services, saleByAppointment } =
  useStore();
  const { openSale } = useSaleDialog();
  const { can } = useAuth();
  const [monthRef, setMonthRef] = useState(new Date());
  const [selected, setSelected] = useState(todayKey());

  const grid = useMemo(() => buildMonthGrid(monthRef), [monthRef]);
  const currentMonth = format(monthRef, 'yyyy-MM');

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    appointments.
    filter((appointment) => appointment.status !== 'annulé').
    forEach((appointment) => {
      map.set(appointment.date, (map.get(appointment.date) ?? 0) + 1);
    });
    return map;
  }, [appointments]);

  const dayList = useMemo(
    () =>
    appointments.
    filter((appointment) => appointment.date === selected).
    sort((a, b) => a.time < b.time ? -1 : 1),
    [appointments, selected]
  );

  // Montant réellement vendu (prix au moment de la réservation) ; à défaut, prix actuel du service.
  const amountOf = (appointment: Appointment) =>
  saleByAppointment.get(appointment.id)?.total ??
  services.find((service) => service.id === appointment.serviceId)?.price ??
  0;
  const stateOf = (appointment: Appointment) => {
    const sale = saleByAppointment.get(appointment.id);
    return sale ? lineState(sale, appointment) : null;
  };

  const dayRevenue = dayList.
  filter((appointment) => appointment.status !== 'annulé').
  reduce((sum, appointment) => sum + amountOf(appointment), 0);

  const cancel = (appointment: Appointment) => {
    const message = cancelConfirmMessage(saleByAppointment.get(appointment.id));
    if (message && !window.confirm(message)) return;
    setAppointmentStatus(appointment.id, 'annulé');
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-5">
      <Panel className="xl:col-span-3">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold capitalize text-ink-900">
            {fmtMonthTitle(monthRef)}
          </h2>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMonthRef(addMonths(monthRef, -1))}
              aria-label="Mois précédent">
              
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMonthRef(new Date())}>
              
              Ce mois
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMonthRef(addMonths(monthRef, 1))}
              aria-label="Mois suivant">
              
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="px-5 py-5">
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium uppercase tracking-wide text-ink-400">
            {WEEKDAYS.map((day) =>
            <span key={day}>{day}</span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {grid.map((day) => {
              const count = byDay.get(day) ?? 0;
              const isSelected = day === selected;
              const isToday = day === todayKey();
              const outside = !day.startsWith(currentMonth);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelected(day)}
                  aria-pressed={isSelected}
                  className={`flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-sm transition-colors duration-150 ease-out ${
                  isSelected ?
                  'border-brand-600 bg-brand-600 text-white' :
                  outside ?
                  'border-transparent text-ink-300 hover:bg-ink-50' :
                  'border-ink-100 text-ink-800 hover:bg-ink-50'}`
                  }>
                  
                  <span
                    className={`font-medium ${isToday && !isSelected ? 'text-brand-700' : ''}`}>
                    
                    {Number(day.slice(-2))}
                  </span>
                  {count > 0 ?
                  <span
                    className={`rounded-full px-1.5 text-xs ${
                    isSelected ?
                    'bg-white/20 text-white' :
                    'bg-brand-50 text-brand-700'}`
                    }>
                    
                      {count}
                    </span> :

                  <span className="h-4" />
                  }
                </button>);

            })}
          </div>
        </div>
      </Panel>

      <Panel className="xl:col-span-2">
        <PanelHeader
          title={fmtLongDate(selected)}
          subtitle={`${dayList.length} rendez-vous · ${money(dayRevenue)} attendus`}
          action={
          <Button size="sm" onClick={() => openSale('service')}>
              <PlusIcon className="h-4 w-4" />
              Ajouter
            </Button>
          } />
        
        {dayList.length === 0 ?
        <EmptyState
          icon={<CalendarRangeIcon className="h-5 w-5" />}
          title="Journée libre"
          description={`Aucun rendez-vous le ${format(parseISO(selected), 'dd/MM/yyyy')}.`} /> :


        <ul className="divide-y divide-ink-100">
            {dayList.map((appointment) =>
          <li key={appointment.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                      <ClockIcon className="h-3.5 w-3.5 text-ink-400" />
                      {appointment.time}
                      <span className="text-ink-300">·</span>
                      <span className="truncate">{appointment.client}</span>
                    </p>
                    <p className="mt-1 truncate text-sm text-ink-500">
                      {appointment.serviceName} · {money(amountOf(appointment))} · {appointment.durationMin} min
                    </p>
                    {stateOf(appointment) && stateOf(appointment) !== 'annulé' ?
                <span className="mt-1.5 inline-flex">
                        <Badge tone={stateOf(appointment) === 'à-payer' ? 'warning' : 'brand'}>
                          {paymentLabel(stateOf(appointment)!)}
                        </Badge>
                      </span> :
                null}
                    {appointment.phone ?
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                        <PhoneIcon className="h-3 w-3" />
                        {appointment.phone}
                      </p> :
                null}
                    {appointment.note ?
                <p className="mt-1 text-xs italic text-ink-500">
                        {appointment.note}
                      </p> :
                null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                  tone={
                  appointment.status === 'honoré' ?
                  'brand' :
                  appointment.status === 'annulé' ?
                  'danger' :
                  'neutral'
                  }>
                  
                      {appointment.status}
                    </Badge>
                    {appointment.status === 'prévu' && appointment.date < todayKey() ?
                <Badge tone="warning">En retard</Badge> :
                null}
                  </div>
                </div>
                <div className="mt-3"><AppointmentSlipButton appointment={appointment} /></div>
                {appointment.status === 'prévu' ?
            <>
                    {stateOf(appointment) === 'à-payer' ?
              <p className="mt-3 text-xs text-amber-700">
                        Non payé : {money(amountOf(appointment))} sera ajouté aux ventes du {fmtLongDate(appointment.date)} une fois le rendez-vous marqué honoré.
                      </p> :
              null}
                    <div className="mt-3 flex gap-2">
                      <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setAppointmentStatus(appointment.id, 'honoré')}>
                  
                        Marquer honoré
                      </Button>
                      <Button
                  size="sm"
                  variant="danger"
                  onClick={() => cancel(appointment)}>
                  
                        Annuler
                      </Button>
                    </div>
                  </> :
            appointment.status === 'annulé' && can('appointments.delete') ?
            <div className="mt-3">
                    <Button
                size="sm"
                variant="ghost"
                onClick={() => removeAppointment(appointment.id)}>
                
                      Supprimer définitivement
                    </Button>
                  </div> :
            null}
              </li>
          )}
          </ul>
        }
      </Panel>
    </div>);

}