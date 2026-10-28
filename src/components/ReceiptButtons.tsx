import React, { useState } from 'react';
import { FileTextIcon } from 'lucide-react';
import type { Appointment, Receipt } from '../types';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { downloadAppointmentSlip, downloadSaleReceipt } from '../pdf';
import { Button } from './ui/Primitives';
import { hasReceiptNo, isPaidAtBooking } from '../utils/saleAccounting';

type Props = {size?: 'sm' | 'md';variant?: 'secondary' | 'ghost';label?: string;};

function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      window.alert('Impossible de générer le PDF.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export function SaleReceiptButton({ receipt, size = 'sm', variant = 'secondary', label = 'Reçu PDF' }: Props & {receipt: Receipt;}) {
  const { sales, appointments } = useStore();
  const { displayName } = useAuth();
  const { center } = useSettings();
  const { busy, run } = useBusy();
  // Aucun reçu délivré (rendez-vous tous non payés) : il n'y a que des bons de rendez-vous.
  if (!hasReceiptNo(receipt.receiptNo)) return null;
  // Pas de reçu s'il ne reste aucun article payé (un service non payé n'a qu'un bon de rendez-vous).
  if (!sales.some((sale) => sale.receiptId === receipt.id && isPaidAtBooking(sale))) return null;
  return (
    <Button
      size={size}
      variant={variant}
      disabled={busy}
      onClick={() =>
      run(() => {
        const lines = sales.filter((sale) => sale.receiptId === receipt.id);
        return downloadSaleReceipt({
          receipt,
          lines,
          appointments: appointments.filter((item) => lines.some((line) => line.appointmentId === item.id)),
          center,
          generatedBy: displayName
        });
      })
      }>
      <FileTextIcon className="h-4 w-4" />
      {label}
    </Button>);

}

export function AppointmentSlipButton({ appointment, size = 'sm', variant = 'secondary', label = 'Bon PDF' }: Props & {appointment: Appointment;}) {
  const { services, sales } = useStore();
  const { displayName } = useAuth();
  const { center } = useSettings();
  const { busy, run } = useBusy();
  return (
    <Button
      size={size}
      variant={variant}
      disabled={busy}
      onClick={() =>
      run(() =>
      downloadAppointmentSlip({
        appointment,
        service: services.find((s) => s.id === appointment.serviceId) ?? null,
        sale: sales.find((s) => s.id === appointment.saleId || s.appointmentId === appointment.id) ?? null,
        center,
        generatedBy: displayName
      })
      )
      }>
      <FileTextIcon className="h-4 w-4" />
      {label}
    </Button>);

}
