import { addDays, subDays } from 'date-fns';
import type {
  Appointment,
  Expense,
  Product,
  RecurringExpense,
  Sale,
  ServiceItem } from
'../types';
import { dayKey, monthKey } from '../utils/date';

const d = (offset: number) => dayKey(offset >= 0 ? addDays(new Date(), offset) : subDays(new Date(), -offset));

export const seedServices: ServiceItem[] = [
{ id: 'srv_1', name: 'Consultation générale', category: 'Consultation', price: 300, durationMin: 30, active: true },
{ id: 'srv_2', name: 'Consultation de suivi', category: 'Consultation', price: 200, durationMin: 20, active: true },
{ id: 'srv_3', name: 'Vaccination', category: 'Soins', price: 150, durationMin: 15, active: true },
{ id: 'srv_4', name: 'Pansement / injection', category: 'Soins', price: 100, durationMin: 15, active: true },
{ id: 'srv_5', name: 'Prise de tension', category: 'Soins', price: 50, durationMin: 10, active: true },
{ id: 'srv_6', name: 'Bilan sanguin', category: 'Analyses', price: 400, durationMin: 25, active: true },
{ id: 'srv_7', name: 'Certificat médical', category: 'Administratif', price: 120, durationMin: 10, active: false }];


export const seedProducts: Omit<Product, 'vat'>[] = [
{ id: 'prd_1', name: 'Paracétamol 500 mg', category: 'Médicament', purchasePrice: 12, salePrice: 20, stock: 48, minStock: 15, unit: 'boîte' },
{ id: 'prd_2', name: 'Amoxicilline 1 g', category: 'Médicament', purchasePrice: 35, salePrice: 55, stock: 9, minStock: 15, unit: 'boîte' },
{ id: 'prd_3', name: 'Sérum physiologique', category: 'Parapharmacie', purchasePrice: 8, salePrice: 15, stock: 62, minStock: 20, unit: 'flacon' },
{ id: 'prd_4', name: 'Masques chirurgicaux', category: 'Consommable', purchasePrice: 25, salePrice: 45, stock: 6, minStock: 10, unit: 'boîte' },
{ id: 'prd_5', name: 'Gel hydroalcoolique', category: 'Consommable', purchasePrice: 30, salePrice: 55, stock: 21, minStock: 8, unit: 'flacon' },
{ id: 'prd_6', name: 'Bandes de gaze', category: 'Consommable', purchasePrice: 10, salePrice: 18, stock: 4, minStock: 12, unit: 'rouleau' },
{ id: 'prd_7', name: 'Thermomètre digital', category: 'Matériel', purchasePrice: 90, salePrice: 150, stock: 7, minStock: 4, unit: 'pièce' },
{ id: 'prd_8', name: 'Tensiomètre à bras', category: 'Matériel', purchasePrice: 450, salePrice: 700, stock: 2, minStock: 2, unit: 'pièce' }];


export const seedRecurring: RecurringExpense[] = [
{ id: 'rec_1', label: 'Loyer du cabinet', amount: 4500, category: 'Loyer', dayOfMonth: 1, startMonth: monthKey(subDays(new Date(), 120)), active: true },
{ id: 'rec_2', label: 'Salaire assistante', amount: 3800, category: 'Salaires', dayOfMonth: 28, startMonth: monthKey(subDays(new Date(), 120)), active: true },
{ id: 'rec_3', label: 'Internet & téléphone', amount: 399, category: 'Charges', dayOfMonth: 5, startMonth: monthKey(subDays(new Date(), 120)), active: true }];


export const seedExpenses: Expense[] = [
{ id: 'exp_1', label: 'Achat initial de stock', amount: 3410, date: d(-12), category: 'Stock', source: 'stock' },
{ id: 'exp_2', label: 'Électricité', amount: 620, date: d(-6), category: 'Charges', source: 'manuelle' },
{ id: 'exp_3', label: 'Produits de nettoyage', amount: 180, date: d(-3), category: 'Autre', source: 'manuelle' },
{ id: 'exp_4', label: 'Réassort Paracétamol (×20)', amount: 240, date: d(-1), category: 'Stock', source: 'stock' },
{ id: 'exp_5', label: 'Entretien climatiseur', amount: 350, date: d(0), category: 'Matériel', source: 'manuelle' }];


export const seedSales: Omit<Sale, 'receiptId' | 'discountPct' | 'vatAmount' | 'receiptNo' | 'createdByName'>[] = [
{ id: 'sal_1', kind: 'service', itemId: 'srv_1', itemName: 'Consultation générale', quantity: 1, unitPrice: 300, unitCost: 0, total: 300, profit: 300, date: d(-5), time: '09:30', client: 'Youssef Amrani', appointmentId: 'apt_p1' },
{ id: 'sal_2', kind: 'produit', itemId: 'prd_1', itemName: 'Paracétamol 500 mg', quantity: 3, unitPrice: 20, unitCost: 12, total: 60, profit: 24, date: d(-5), time: '10:05', client: 'Comptoir' },
{ id: 'sal_3', kind: 'service', itemId: 'srv_6', itemName: 'Bilan sanguin', quantity: 1, unitPrice: 400, unitCost: 0, total: 400, profit: 400, date: d(-3), time: '08:45', client: 'Nadia Bouzidi', appointmentId: 'apt_p2' },
{ id: 'sal_4', kind: 'produit', itemId: 'prd_5', itemName: 'Gel hydroalcoolique', quantity: 2, unitPrice: 55, unitCost: 30, total: 110, profit: 50, date: d(-2), time: '16:20', client: 'Comptoir' },
{ id: 'sal_5', kind: 'service', itemId: 'srv_3', itemName: 'Vaccination', quantity: 1, unitPrice: 150, unitCost: 0, total: 150, profit: 150, date: d(-1), time: '11:15', client: 'Salma Idrissi', appointmentId: 'apt_p3' },
{ id: 'sal_6', kind: 'produit', itemId: 'prd_3', itemName: 'Sérum physiologique', quantity: 5, unitPrice: 15, unitCost: 8, total: 75, profit: 35, date: d(-1), time: '17:40', client: 'Comptoir' },
{ id: 'sal_7', kind: 'service', itemId: 'srv_2', itemName: 'Consultation de suivi', quantity: 1, unitPrice: 200, unitCost: 0, total: 200, profit: 200, date: d(0), time: '09:00', client: 'Karim Belhaj', appointmentId: 'apt_1' },
{ id: 'sal_8', kind: 'produit', itemId: 'prd_7', itemName: 'Thermomètre digital', quantity: 1, unitPrice: 150, unitCost: 90, total: 150, profit: 60, date: d(0), time: '10:30', client: 'Comptoir' },
{ id: 'sal_9', kind: 'produit', itemId: 'prd_1', itemName: 'Paracétamol 500 mg', quantity: 2, unitPrice: 20, unitCost: 12, total: 40, profit: 16, date: d(0), time: '12:10', client: 'Comptoir' }];


export const seedAppointments: Omit<Appointment, 'createdByName'>[] = [
{ id: 'apt_p1', date: d(-5), time: '09:30', client: 'Youssef Amrani', phone: '06 61 22 14 07', serviceId: 'srv_1', serviceName: 'Consultation générale', durationMin: 30, status: 'honoré', note: '', saleId: 'sal_1' },
{ id: 'apt_p2', date: d(-3), time: '08:45', client: 'Nadia Bouzidi', phone: '06 70 55 90 12', serviceId: 'srv_6', serviceName: 'Bilan sanguin', durationMin: 25, status: 'honoré', note: 'À jeun', saleId: 'sal_3' },
{ id: 'apt_p3', date: d(-1), time: '11:15', client: 'Salma Idrissi', phone: '06 12 88 41 33', serviceId: 'srv_3', serviceName: 'Vaccination', durationMin: 15, status: 'honoré', note: '', saleId: 'sal_5' },
{ id: 'apt_1', date: d(0), time: '09:00', client: 'Karim Belhaj', phone: '06 45 12 78 90', serviceId: 'srv_2', serviceName: 'Consultation de suivi', durationMin: 20, status: 'honoré', note: 'Résultats analyses', saleId: 'sal_7' },
{ id: 'apt_2', date: d(0), time: '14:30', client: 'Fatima Zahra Alaoui', phone: '06 33 09 76 51', serviceId: 'srv_1', serviceName: 'Consultation générale', durationMin: 30, status: 'prévu', note: '', saleId: 'sal_10' },
{ id: 'apt_3', date: d(0), time: '16:00', client: 'Mehdi Tazi', phone: '06 78 34 22 18', serviceId: 'srv_4', serviceName: 'Pansement / injection', durationMin: 15, status: 'prévu', note: 'Pansement post-op', saleId: 'sal_11' },
{ id: 'apt_4', date: d(1), time: '08:30', client: 'Hind Chraibi', phone: '06 55 41 30 09', serviceId: 'srv_6', serviceName: 'Bilan sanguin', durationMin: 25, status: 'prévu', note: 'À jeun', saleId: 'sal_12' },
{ id: 'apt_5', date: d(1), time: '10:00', client: 'Omar Sabri', phone: '06 21 67 45 82', serviceId: 'srv_1', serviceName: 'Consultation générale', durationMin: 30, status: 'prévu', note: '', saleId: 'sal_13' },
{ id: 'apt_6', date: d(1), time: '15:15', client: 'Leila Bennani', phone: '06 90 12 55 74', serviceId: 'srv_5', serviceName: 'Prise de tension', durationMin: 10, status: 'prévu', note: '', saleId: 'sal_14' },
{ id: 'apt_7', date: d(2), time: '09:45', client: 'Rachid El Fassi', phone: '06 44 78 21 06', serviceId: 'srv_2', serviceName: 'Consultation de suivi', durationMin: 20, status: 'prévu', note: '', saleId: 'sal_15' },
{ id: 'apt_8', date: d(3), time: '11:30', client: 'Amina Kabbaj', phone: '06 66 30 18 92', serviceId: 'srv_3', serviceName: 'Vaccination', durationMin: 15, status: 'prévu', note: 'Rappel 2e dose', saleId: 'sal_16' },
{ id: 'apt_9', date: d(5), time: '10:15', client: 'Said Ouahbi', phone: '06 11 47 63 25', serviceId: 'srv_1', serviceName: 'Consultation générale', durationMin: 30, status: 'prévu', note: '', saleId: 'sal_17' }];


/** Ventes de services déjà encaissées pour les rendez-vous à venir. */
export const seedUpcomingServiceSales: Omit<Sale, 'receiptId' | 'discountPct' | 'vatAmount' | 'receiptNo' | 'createdByName'>[] = seedAppointments.
filter((a) => a.status === 'prévu' && a.saleId).
map((a) => ({
  id: a.saleId as string,
  kind: 'service' as const,
  itemId: a.serviceId,
  itemName: a.serviceName,
  quantity: 1,
  unitPrice: seedServices.find((s) => s.id === a.serviceId)?.price ?? 0,
  unitCost: 0,
  total: seedServices.find((s) => s.id === a.serviceId)?.price ?? 0,
  profit: seedServices.find((s) => s.id === a.serviceId)?.price ?? 0,
  date: a.date,
  time: a.time,
  client: a.client,
  appointmentId: a.id
}));