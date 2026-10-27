export type ServiceItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  durationMin: number;
  active: boolean;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  unit: string;
};

export type ExpenseCategory =
'Stock' |
'Loyer' |
'Salaires' |
'Charges' |
'Matériel' |
'Autre';

export type ExpenseSource = 'manuelle' | 'stock' | 'fixe';

export type Expense = {
  id: string;
  label: string;
  amount: number;
  /** yyyy-MM-dd */
  date: string;
  category: ExpenseCategory;
  source: ExpenseSource;
  recurringId?: string;
};

export type RecurringExpense = {
  id: string;
  label: string;
  amount: number;
  category: ExpenseCategory;
  /** 1 - 28 */
  dayOfMonth: number;
  /** yyyy-MM */
  startMonth: string;
  active: boolean;
};

export type SaleKind = 'produit' | 'service';

export type Sale = {
  id: string;
  kind: SaleKind;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  total: number;
  profit: number;
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm */
  time: string;
  client: string;
  appointmentId?: string;
  /** Numéro de reçu séquentiel (attribué par la base de données). */
  receiptNo: number;
  /** Nom de la personne qui a enregistré la vente. */
  createdByName: string;
};

export type AppointmentStatus = 'prévu' | 'honoré' | 'annulé';

export type Appointment = {
  id: string;
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm */
  time: string;
  client: string;
  phone: string;
  serviceId: string;
  serviceName: string;
  durationMin: number;
  status: AppointmentStatus;
  note: string;
  saleId?: string;
  createdByName: string;
};

export type Period = 'jour' | 'semaine' | 'mois';

export type Role = 'admin' | 'gestionnaire' | 'reception';

export type Profile = {
  id: string;
  /** Propriétaire du centre : c'est son id qui porte toutes les données. */
  ownerId: string;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
};

export type Invitation = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  createdAt: string;
};
