import type { ReportInput } from './report';
import type { AppointmentSlipInput, SaleReceiptInput } from './receipt';
import { savePdf } from './save';

/**
 * Les bibliothèques PDF (~400 Ko) ne sont chargées qu'au premier export,
 * pour ne pas alourdir le démarrage de l'application.
 */

export async function downloadSaleReceipt(input: SaleReceiptInput): Promise<void> {
  const { buildSaleReceipt } = await import('./receipt');
  const { doc, filename } = buildSaleReceipt(input);
  await savePdf(doc, filename);
}

export async function downloadAppointmentSlip(input: AppointmentSlipInput): Promise<void> {
  const { buildAppointmentSlip } = await import('./receipt');
  const { doc, filename } = buildAppointmentSlip(input);
  await savePdf(doc, filename);
}

export async function downloadStatsReport(input: ReportInput): Promise<void> {
  const { buildStatsReport } = await import('./report');
  const { doc, filename } = buildStatsReport(input);
  await savePdf(doc, filename);
}
