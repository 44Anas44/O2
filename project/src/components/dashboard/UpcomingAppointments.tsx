import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheckIcon, ClockIcon, PhoneIcon } from 'lucide-react';
import type { Appointment } from '../../types';
import { Badge, EmptyState, Panel, PanelHeader } from '../ui/Primitives';
import { initials, money } from '../../utils/format';
import { relativeDayLabel } from '../../utils/date';

export function UpcomingAppointments({
  appointments,
  priceOf



}: {appointments: Appointment[];priceOf: (serviceId: string) => number;}) {
  return (
    <Panel>
      <PanelHeader
        title="Rendez-vous proches"
        subtitle={`${appointments.length} rendez-vous à venir`}
        action={
        <Link
          to="/agenda"
          className="text-sm font-medium text-brand-700 underline-offset-4 hover:underline">
          
            Voir l’agenda
          </Link>
        } />
      
      {appointments.length === 0 ?
      <EmptyState
        icon={<CalendarCheckIcon className="h-5 w-5" />}
        title="Aucun rendez-vous à venir"
        description="Déclarez une vente de service pour créer un rendez-vous." /> :


      <ul className="divide-y divide-ink-100">
          {appointments.map((appointment) =>
        <li
          key={appointment.id}
          className="flex items-center gap-4 px-5 py-3.5">
          
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                {initials(appointment.client)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">
                  {appointment.client}
                </p>
                <p className="truncate text-sm text-ink-500">
                  {appointment.serviceName} · {money(priceOf(appointment.serviceId))}
                </p>
              </div>
              <div className="hidden items-center gap-1.5 text-sm text-ink-500 sm:flex">
                <PhoneIcon className="h-3.5 w-3.5" />
                {appointment.phone || '—'}
              </div>
              <div className="shrink-0 text-right">
                <p className="flex items-center justify-end gap-1.5 text-sm font-semibold text-ink-900">
                  <ClockIcon className="h-3.5 w-3.5 text-ink-400" />
                  {appointment.time}
                </p>
                <Badge tone={relativeDayLabel(appointment.date) === "Aujourd'hui" ? 'brand' : 'neutral'}>
                  {relativeDayLabel(appointment.date)}
                </Badge>
              </div>
            </li>
        )}
        </ul>
      }
    </Panel>);

}