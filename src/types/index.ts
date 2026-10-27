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
  /** TVA 19 % applicable : le prix de vente saisi est alors HT, le client paie HT x 1,19. */
  vat: boolean;
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
  /** Reçu auquel appartient cette ligne (un reçu = plusieurs lignes). */
  receiptId: string;
  /** Remise accordée sur la ligne (en %), vente par lot. */
  discountPct: number;
  /** TVA incluse dans le total de la ligne. */
  vatAmount: number;
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

/** Un reçu : un numéro, un client, une date ; regroupe une ou plusieurs lignes de vente. */
export type Receipt = {
  id: string;
  receiptNo: number;
  client: string;
  /** Société de l'acheteur (vente par lot). */
  company: string;
  phone: string;
  date: string;
  time: string;
  createdByName: string;
  buyerId?: string;
  /** Vente par lot : acheteur enregistré, remises possibles. */
  isBulk: boolean;
};

/** Acheteur enregistré (clients de ventes par lot) : nom et/ou société. */
export type Buyer = {
  id: string;
  name: string;
  company: string;
  phone: string;
};
