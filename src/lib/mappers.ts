import type {
  Appointment,
  Expense,
  Buyer,
  Invitation,
  Profile,
  Receipt,
  Product,
  RecurringExpense,
  Sale,
  ServiceItem } from
'../types';

export function serviceFromRow(row: any): ServiceItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    durationMin: row.duration_min,
    active: row.active
  };
}

export function serviceToRow(service: Partial<ServiceItem>) {
  const row: Record<string, unknown> = {};
  if (service.name !== undefined) row.name = service.name;
  if (service.category !== undefined) row.category = service.category;
  if (service.price !== undefined) row.price = service.price;
  if (service.durationMin !== undefined) row.duration_min = service.durationMin;
  if (service.active !== undefined) row.active = service.active;
  return row;
}

export function productFromRow(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    purchasePrice: Number(row.purchase_price),
    salePrice: Number(row.sale_price),
    stock: Number(row.stock),
    minStock: Number(row.min_stock),
    unit: row.unit,
    vat: Boolean(row.vat)
  };
}

export function productToRow(product: Partial<Product>) {
  const row: Record<string, unknown> = {};
  if (product.name !== undefined) row.name = product.name;
  if (product.category !== undefined) row.category = product.category;
  if (product.purchasePrice !== undefined) row.purchase_price = product.purchasePrice;
  if (product.salePrice !== undefined) row.sale_price = product.salePrice;
  if (product.stock !== undefined) row.stock = product.stock;
  if (product.minStock !== undefined) row.min_stock = product.minStock;
  if (product.unit !== undefined) row.unit = product.unit;
  if (product.vat !== undefined) row.vat = product.vat;
  return row;
}

export function saleFromRow(row: any): Sale {
  return {
    id: row.id,
    kind: row.kind,
    itemId: row.item_id,
    itemName: row.item_name,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    unitCost: Number(row.unit_cost),
    total: Number(row.total),
    profit: Number(row.profit),
    date: row.date,
    time: row.time,
    client: row.client,
    appointmentId: row.appointment_id ?? undefined,
    // Les anciennes lignes (avant la migration) sont toutes des lignes payées.
    paid: row.paid === undefined || row.paid === null ? true : Boolean(row.paid),
    receiptId: row.receipt_id ?? row.id,
    discountPct: Number(row.discount_pct ?? 0),
    vatAmount: Number(row.vat_amount ?? 0),
    receiptNo: Number(row.receipt_no ?? 0),
    createdByName: row.created_by_name ?? ''
  };
}

export function expenseFromRow(row: any): Expense {
  return {
    id: row.id,
    label: row.label,
    amount: Number(row.amount),
    date: row.date,
    category: row.category,
    source: row.source,
    recurringId: row.recurring_id ?? undefined
  };
}

export function recurringFromRow(row: any): RecurringExpense {
  return {
    id: row.id,
    label: row.label,
    amount: Number(row.amount),
    category: row.category,
    dayOfMonth: row.day_of_month,
    startMonth: row.start_month,
    active: row.active
  };
}

export function recurringToRow(rule: Partial<RecurringExpense>) {
  const row: Record<string, unknown> = {};
  if (rule.label !== undefined) row.label = rule.label;
  if (rule.amount !== undefined) row.amount = rule.amount;
  if (rule.category !== undefined) row.category = rule.category;
  if (rule.dayOfMonth !== undefined) row.day_of_month = rule.dayOfMonth;
  if (rule.startMonth !== undefined) row.start_month = rule.startMonth;
  if (rule.active !== undefined) row.active = rule.active;
  return row;
}

export function appointmentFromRow(row: any): Appointment {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    client: row.client,
    phone: row.phone,
    serviceId: row.service_id,
    serviceName: row.service_name,
    durationMin: row.duration_min,
    status: row.status,
    note: row.note,
    saleId: row.sale_id ?? undefined,
    createdByName: row.created_by_name ?? ''
  };
}

export function profileFromRow(row: any): Profile {
  return {
    id: row.id,
    ownerId: row.owner_id,
    email: row.email ?? '',
    fullName: row.full_name ?? '',
    role: row.role,
    active: row.active
  };
}

export function invitationFromRow(row: any): Invitation {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? '',
    role: row.role,
    createdAt: row.created_at
  };
}

export function receiptFromRow(row: any): Receipt {
  return {
    id: row.id,
    receiptNo: Number(row.receipt_no ?? 0),
    client: row.client ?? '',
    company: row.company ?? '',
    phone: row.phone ?? '',
    date: row.date,
    time: row.time ?? '',
    createdByName: row.created_by_name ?? '',
    buyerId: row.buyer_id ?? undefined,
    isBulk: Boolean(row.is_bulk)
  };
}

export function buyerFromRow(row: any): Buyer {
  return {
    id: row.id,
    name: row.name ?? '',
    company: row.company ?? '',
    phone: row.phone ?? ''
  };
}
