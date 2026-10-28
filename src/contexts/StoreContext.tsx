import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState } from
'react';
import { addMonths, format, parseISO, startOfMonth } from 'date-fns';
import type {
  Appointment,
  AppointmentStatus,
  Expense,
  Product,
  RecurringExpense,
  Buyer,
  Receipt,
  Sale,
  ServiceItem } from
'../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  appointmentFromRow,
  expenseFromRow,
  productFromRow,
  productToRow,
  recurringFromRow,
  recurringToRow,
  saleFromRow,
  receiptFromRow,
  buyerFromRow,
  serviceFromRow,
  serviceToRow } from
'../lib/mappers';
import { dayKey, monthKey, nowTime, todayKey } from '../utils/date';
import { isCounted } from '../utils/saleAccounting';

export type BasketLine =
{kind: 'produit';itemId: string;quantity: number;/** Remise en % (vente par lot, rôles autorisés). */discountPct?: number;} |
{kind: 'service';itemId: string;date: string;time: string;note: string;/** Payé à la réservation (sinon : réglé le jour du rendez-vous). */paid: boolean;};

export type NewBasket = {
  client: string;
  phone: string;
  /** Date d'encaissement du reçu (jour de la vente). */
  date: string;
  time: string;
  lines: BasketLine[];
  /** Vente par lot : acheteur enregistré obligatoire, produits uniquement. */
  bulk?: boolean;
  buyerId?: string;
};

export type CreatedSale = {
  receipt: Receipt;
  sales: Sale[];
  appointments: Appointment[];
  /** Renseigné si la base de données n'est pas à jour (migration_rdv_payment.sql non exécutée). */
  warning?: string;
};

export type CreateSaleResult = {ok: true;result: CreatedSale;} | {ok: false;error: string;};

type StoreValue = {
  loading: boolean;
  services: ServiceItem[];
  products: Product[];
  sales: Sale[];
  /**
   * Lignes qui entrent dans le chiffre d'affaires, le profit et les statistiques : exclut les
   * services annulés et les services non payés pas encore honorés (voir utils/saleAccounting).
   */
  countedSales: Sale[];
  /** Ligne de vente de chaque rendez-vous (clé : id du rendez-vous). */
  saleByAppointment: Map<string, Sale>;
  appointments: Appointment[];
  expenses: Expense[];
  recurring: RecurringExpense[];
  lowStock: Product[];
  saveService: (service: Omit<ServiceItem, 'id'> & {id?: string;}) => Promise<void>;
  removeService: (id: string) => Promise<void>;
  saveProduct: (
  product: Omit<Product, 'id'> & {id?: string;})
  => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  adjustStock: (id: string, delta: number, reason: string) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'source'> & {source?: Expense['source'];}) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  addRecurring: (recurring: Omit<RecurringExpense, 'id' | 'active'>) => Promise<void>;
  toggleRecurring: (id: string) => Promise<void>;
  removeRecurring: (id: string) => Promise<void>;
  receipts: Receipt[];
  buyers: Buyer[];
  saveBuyer: (input: {id?: string;name: string;company: string;phone: string;}) => Promise<Buyer | null>;
  removeBuyer: (id: string) => Promise<void>;
  createSale: (input: NewBasket) => Promise<CreateSaleResult>;
  setAppointmentStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  removeAppointment: (id: string) => Promise<void>;
};

const StoreContext = createContext<StoreValue | null>(null);

function expandRecurring(rules: RecurringExpense[]): Expense[] {
  const out: Expense[] = [];
  const today = todayKey();
  rules.
  filter((rule) => rule.active).
  forEach((rule) => {
    let cursor = startOfMonth(parseISO(`${rule.startMonth}-01`));
    const limit = addMonths(startOfMonth(new Date()), 1);
    while (cursor < limit) {
      const key = `${format(cursor, 'yyyy-MM')}-${String(rule.dayOfMonth).padStart(2, '0')}`;
      if (key <= today) {
        out.push({
          id: `${rule.id}_${key}`,
          label: rule.label,
          amount: rule.amount,
          date: key,
          category: rule.category,
          source: 'fixe',
          recurringId: rule.id
        });
      }
      cursor = addMonths(cursor, 1);
    }
  });
  return out;
}

/** Upserts a row into a keyed array by id — used to apply both optimistic
 *  local writes and incoming realtime events without creating duplicates. */
function upsertById<T extends {id: string;}>(list: T[], row: T): T[] {
  const idx = list.findIndex((item) => item.id === row.id);
  if (idx === -1) return [row, ...list];
  const next = [...list];
  next[idx] = row;
  return next;
}

export function StoreProvider({ children }: {children: React.ReactNode;}) {
  // `userId` désigne désormais le propriétaire du centre : toute l'équipe
  // partage les mêmes données, filtrées par les règles RLS côté base.
  const { ownerId, role, displayName, can } = useAuth();
  const userId = ownerId;
  const canFinance = can('finance.view');

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [manualExpenses, setManualExpenses] = useState<Expense[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);

  // Kept up to date for mutation handlers that need the latest snapshot
  // without re-subscribing (e.g. computing a stock delta).
  const productsRef = useRef(products);
  productsRef.current = products;
  const servicesRef = useRef(services);
  servicesRef.current = services;
  const salesRef = useRef(sales);
  salesRef.current = sales;

  // ---------------------------------------------------------------------
  // Initial load + realtime subscriptions, scoped to the signed-in user
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!userId) {
      setServices([]);
      setProducts([]);
      setSales([]);
      setReceipts([]);
      setBuyers([]);
      setAppointments([]);
      setManualExpenses([]);
      setRecurring([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const [
      servicesRes,
      productsRes,
      salesRes,
      receiptsRes,
      buyersRes,
      appointmentsRes,
      expensesRes,
      recurringRes] =
      await Promise.all([
      supabase.from('services').select('*').eq('user_id', userId),
      supabase.from('products').select('*').eq('user_id', userId),
      supabase.from('sales').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('receipts').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('buyers').select('*').eq('user_id', userId),
      supabase.from('appointments').select('*').eq('user_id', userId),
      canFinance ?
      supabase.from('expenses').select('*').eq('user_id', userId) :
      Promise.resolve({ data: [] as any[] }),
      canFinance ?
      supabase.from('recurring_expenses').select('*').eq('user_id', userId) :
      Promise.resolve({ data: [] as any[] })]
      );

      if (cancelled) return;

      setServices((servicesRes.data ?? []).map(serviceFromRow));
      setProducts((productsRes.data ?? []).map(productFromRow));
      setSales((salesRes.data ?? []).map(saleFromRow));
      setReceipts((receiptsRes.data ?? []).map(receiptFromRow));
      setBuyers((buyersRes.data ?? []).map(buyerFromRow));
      setAppointments((appointmentsRes.data ?? []).map(appointmentFromRow));
      setManualExpenses((expensesRes.data ?? []).map(expenseFromRow));
      setRecurring((recurringRes.data ?? []).map(recurringFromRow));
      setLoading(false);
    })();

    const channel = supabase.
    channel(`store-${userId}`).
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'services', filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          setServices((prev) => prev.filter((item) => item.id !== payload.old.id));
        } else {
          setServices((prev) => upsertById(prev, serviceFromRow(payload.new)));
        }
      }
    ).
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products', filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          setProducts((prev) => prev.filter((item) => item.id !== payload.old.id));
        } else {
          setProducts((prev) => upsertById(prev, productFromRow(payload.new)));
        }
      }
    ).
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'buyers', filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          setBuyers((prev) => prev.filter((item) => item.id !== payload.old.id));
        } else {
          setBuyers((prev) => upsertById(prev, buyerFromRow(payload.new)));
        }
      }
    ).
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'receipts', filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          setReceipts((prev) => prev.filter((item) => item.id !== payload.old.id));
        } else {
          setReceipts((prev) => upsertById(prev, receiptFromRow(payload.new)));
        }
      }
    ).
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sales', filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          setSales((prev) => prev.filter((item) => item.id !== payload.old.id));
        } else {
          setSales((prev) => upsertById(prev, saleFromRow(payload.new)));
        }
      }
    ).
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'appointments', filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          setAppointments((prev) => prev.filter((item) => item.id !== payload.old.id));
        } else {
          setAppointments((prev) => upsertById(prev, appointmentFromRow(payload.new)));
        }
      }
    ).
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expenses', filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          setManualExpenses((prev) => prev.filter((item) => item.id !== payload.old.id));
        } else {
          setManualExpenses((prev) => upsertById(prev, expenseFromRow(payload.new)));
        }
      }
    ).
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'recurring_expenses', filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          setRecurring((prev) => prev.filter((item) => item.id !== payload.old.id));
        } else {
          setRecurring((prev) => upsertById(prev, recurringFromRow(payload.new)));
        }
      }
    ).
    subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, role]);

  const expenses = useMemo(
    () =>
    [...manualExpenses, ...expandRecurring(recurring)].sort((a, b) =>
    a.date < b.date ? 1 : -1
    ),
    [manualExpenses, recurring]
  );

  const lowStock = useMemo(
    () =>
    products.
    filter((product) => product.stock <= product.minStock).
    sort((a, b) => a.stock - b.stock),
    [products]
  );

  const saleByAppointment = useMemo(() => {
    const map = new Map<string, Sale>();
    sales.forEach((sale) => {
      if (sale.appointmentId) map.set(sale.appointmentId, sale);
    });
    return map;
  }, [sales]);

  // Dérivé (rien n'est réécrit en base quand un rendez-vous change d'état) : annuler ou honorer
  // un rendez-vous met à jour tous les totaux, à la date de comptabilisation de la ligne.
  const countedSales = useMemo(() => {
    const byId = new Map(appointments.map((appointment) => [appointment.id, appointment]));
    return sales.filter((sale) =>
    isCounted(sale, sale.appointmentId ? byId.get(sale.appointmentId) : undefined)
    );
  }, [sales, appointments]);

  const pushExpense = useCallback(
    async (expense: Omit<Expense, 'id'>) => {
      if (!userId) return;
      const { data } = await supabase.
      from('expenses').
      insert({
        user_id: userId,
        label: expense.label,
        amount: expense.amount,
        date: expense.date,
        category: expense.category,
        source: expense.source
      }).
      select().
      single();
      if (data) setManualExpenses((prev) => upsertById(prev, expenseFromRow(data)));
    },
    [userId]
  );

  const saveService = useCallback<StoreValue['saveService']>(
    async (service) => {
      if (!userId) return;
      if (service.id) {
        const { data } = await supabase.
        from('services').
        update(serviceToRow(service)).
        eq('id', service.id).
        select().
        single();
        if (data) setServices((prev) => upsertById(prev, serviceFromRow(data)));
        return;
      }
      const { data } = await supabase.
      from('services').
      insert({ user_id: userId, ...serviceToRow(service) }).
      select().
      single();
      if (data) setServices((prev) => upsertById(prev, serviceFromRow(data)));
    },
    [userId]
  );

  const removeService = useCallback(async (id: string) => {
    setServices((prev) => prev.filter((item) => item.id !== id));
    await supabase.from('services').delete().eq('id', id);
  }, []);

  const saveProduct = useCallback<StoreValue['saveProduct']>(
    async (product) => {
      if (!userId) return;
      if (product.id) {
        const previous = productsRef.current.find((item) => item.id === product.id);
        const delta = previous ? product.stock - previous.stock : 0;
        const { data } = await supabase.
        from('products').
        update(productToRow(product)).
        eq('id', product.id).
        select().
        single();
        if (data) setProducts((prev) => upsertById(prev, productFromRow(data)));
        if (delta > 0) {
          await pushExpense({
            label: `Réappro. ${product.name} (+${delta} ${product.unit})`,
            amount: delta * (product.purchasePrice ?? 0),
            date: todayKey(),
            category: 'Stock',
            source: 'stock'
          });
        }
        return;
      }
      const { data } = await supabase.
      from('products').
      insert({ user_id: userId, ...productToRow(product) }).
      select().
      single();
      if (data) setProducts((prev) => upsertById(prev, productFromRow(data)));
      if ((product.stock ?? 0) > 0) {
        await pushExpense({
          label: `Achat initial ${product.name} (${product.stock} ${product.unit})`,
          amount: (product.stock ?? 0) * (product.purchasePrice ?? 0),
          date: todayKey(),
          category: 'Stock',
          source: 'stock'
        });
      }
    },
    [userId, pushExpense]
  );

  const removeProduct = useCallback(async (id: string) => {
    setProducts((prev) => prev.filter((item) => item.id !== id));
    await supabase.from('products').delete().eq('id', id);
  }, []);

  const adjustStock = useCallback(
    async (id: string, delta: number, reason: string) => {
      const product = productsRef.current.find((item) => item.id === id);
      if (!product || delta === 0) return;
      const nextStock = Math.max(0, product.stock + delta);
      setProducts((prev) =>
      prev.map((item) => item.id === id ? { ...item, stock: nextStock } : item)
      );
      await supabase.from('products').update({ stock: nextStock }).eq('id', id);
      if (delta > 0) {
        await pushExpense({
          label: `${reason || 'Entrée de stock'} — ${product.name} (+${delta})`,
          amount: delta * product.purchasePrice,
          date: todayKey(),
          category: 'Stock',
          source: 'stock'
        });
      } else {
        await pushExpense({
          label: `${reason || 'Perte de stock'} — ${product.name} (${delta})`,
          amount: Math.abs(delta) * product.purchasePrice,
          date: todayKey(),
          category: 'Stock',
          source: 'stock'
        });
      }
    },
    [pushExpense]
  );

  const addExpense = useCallback<StoreValue['addExpense']>(
    async (expense) => {
      await pushExpense({ ...expense, source: expense.source ?? 'manuelle' });
    },
    [pushExpense]
  );

  const removeExpense = useCallback(
    async (id: string) => {
      // Guard: recurring occurrences are virtual (id like `rec_..._2026-05`) and
      // don't exist as their own row — only real manual/stock rows can be deleted.
      if (!manualExpenses.some((item) => item.id === id)) return;
      setManualExpenses((prev) => prev.filter((item) => item.id !== id));
      await supabase.from('expenses').delete().eq('id', id);
    },
    [manualExpenses]
  );

  const addRecurring = useCallback<StoreValue['addRecurring']>(
    async (rule) => {
      if (!userId) return;
      const { data } = await supabase.
      from('recurring_expenses').
      insert({ user_id: userId, ...recurringToRow(rule), active: true }).
      select().
      single();
      if (data) setRecurring((prev) => upsertById(prev, recurringFromRow(data)));
    },
    [userId]
  );

  const toggleRecurring = useCallback(
    async (id: string) => {
      const rule = recurring.find((item) => item.id === id);
      if (!rule) return;
      const nextActive = !rule.active;
      setRecurring((prev) =>
      prev.map((item) => item.id === id ? { ...item, active: nextActive } : item)
      );
      await supabase.from('recurring_expenses').update({ active: nextActive }).eq('id', id);
    },
    [recurring]
  );

  const removeRecurring = useCallback(async (id: string) => {
    setRecurring((prev) => prev.filter((rule) => rule.id !== id));
    await supabase.from('recurring_expenses').delete().eq('id', id);
  }, []);

  const saveBuyer = useCallback<StoreValue['saveBuyer']>(
    async (input) => {
      if (!userId) return null;
      const row = { name: input.name.trim(), company: input.company.trim(), phone: input.phone.trim() };
      if (!row.name && !row.company) return null;
      const query = input.id ?
      supabase.from('buyers').update(row).eq('id', input.id).select().single() :
      supabase.from('buyers').insert({ ...row, user_id: userId }).select().single();
      const { data, error } = await query;
      if (error || !data) return null;
      const buyer = buyerFromRow(data);
      setBuyers((prev) => upsertById(prev, buyer));
      return buyer;
    },
    [userId]
  );

  const removeBuyer = useCallback(async (id: string) => {
    setBuyers((prev) => prev.filter((item) => item.id !== id));
    await supabase.from('buyers').delete().eq('id', id);
  }, []);

  const createSale = useCallback(
    async (input: NewBasket): Promise<CreateSaleResult> => {
      if (!userId) return { ok: false, error: 'Session invalide.' };
      if (input.lines.length === 0) return { ok: false, error: 'La vente est vide.' };

      // Tout est enregistré en UNE opération côté base (reçu + lignes + rendez-vous + stock) :
      // si une ligne échoue, rien n'est enregistré.
      const { data, error } = await supabase.rpc('create_sale', {
        p_client: input.client,
        p_phone: input.phone,
        p_date: input.date,
        p_time: input.time || nowTime(),
        p_today: dayKey(new Date()),
        p_buyer_id: input.bulk ? input.buyerId ?? null : null,
        p_bulk: Boolean(input.bulk),
        p_lines: input.lines.map((line) =>
        line.kind === 'produit' ?
        { kind: 'produit', item_id: line.itemId, quantity: line.quantity, discount_pct: line.discountPct ?? 0 } :
        { kind: 'service', item_id: line.itemId, date: line.date, time: line.time, note: line.note, paid: line.paid }
        )
      });
      if (error || !data) {
        return { ok: false, error: error?.message ?? 'Échec de l’enregistrement.' };
      }

      const result: CreatedSale = {
        receipt: receiptFromRow(data.receipt),
        sales: (data.sales ?? []).map(saleFromRow),
        appointments: (data.appointments ?? []).map(appointmentFromRow)
      };

      // Ancienne fonction create_sale côté Supabase : elle ignore « paid » et enregistre tout comme
      // payé (avec un reçu). On le signale au lieu de laisser croire que le rendez-vous est non payé.
      const askedUnpaid = input.lines.some((line) => line.kind === 'service' && !line.paid);
      const dbOutdated = (data.sales ?? []).some((row: any) => row.kind === 'service' && !('paid' in row));
      if (askedUnpaid && dbOutdated) {
        result.warning =
        'La base de données n’est pas à jour : ce rendez-vous a été enregistré comme PAYÉ. ' +
        'Exécutez supabase/migration_rdv_payment.sql dans Supabase (SQL Editor), puis corrigez cette vente.';
      }

      setReceipts((prev) => upsertById(prev, result.receipt));
      setSales((prev) => result.sales.reduce((list, sale) => upsertById(list, sale), prev));
      setAppointments((prev) => result.appointments.reduce((list, item) => upsertById(list, item), prev));
      // Stock : mise à jour immédiate de l'écran (la base l'a déjà décrémenté).
      setProducts((prev) =>
      prev.map((product) => {
        const sold = result.sales.
        filter((sale) => sale.kind === 'produit' && sale.itemId === product.id).
        reduce((sum, sale) => sum + sale.quantity, 0);
        return sold > 0 ? { ...product, stock: Math.max(0, product.stock - sold) } : product;
      })
      );
      return { ok: true, result };
    },
    [userId]
  );

  const setAppointmentStatus = useCallback(
    async (id: string, status: AppointmentStatus) => {
      setAppointments((prev) =>
      prev.map((item) => item.id === id ? { ...item, status } : item)
      );
      await supabase.from('appointments').update({ status }).eq('id', id);
    },
    []
  );

  const removeAppointment = useCallback(async (id: string) => {
    const affected = new Set(
      salesRef.current.filter((sale) => sale.appointmentId === id).map((sale) => sale.receiptId)
    );
    setAppointments((prev) => prev.filter((item) => item.id !== id));
    setSales((prev) => prev.filter((sale) => sale.appointmentId !== id));
    // Un reçu qui n'a plus aucune ligne disparaît (le serveur le supprime aussi).
    setReceipts((prev) =>
    prev.filter(
      (receipt) =>
      !affected.has(receipt.id) ||
      salesRef.current.some((sale) => sale.receiptId === receipt.id && sale.appointmentId !== id)
    )
    );
    await supabase.from('appointments').delete().eq('id', id);
    await supabase.from('sales').delete().eq('appointment_id', id);
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      loading,
      services,
      products,
      sales,
      countedSales,
      saleByAppointment,
      appointments,
      expenses,
      recurring,
      lowStock,
      saveService,
      removeService,
      saveProduct,
      removeProduct,
      adjustStock,
      addExpense,
      removeExpense,
      addRecurring,
      toggleRecurring,
      removeRecurring,
      receipts,
      buyers,
      saveBuyer,
      removeBuyer,
      createSale,
      setAppointmentStatus,
      removeAppointment
    }),
    [
    loading,
    services,
    products,
    sales,
    countedSales,
    saleByAppointment,
    appointments,
    expenses,
    recurring,
    lowStock,
    saveService,
    removeService,
    saveProduct,
    removeProduct,
    adjustStock,
    addExpense,
    removeExpense,
    addRecurring,
    toggleRecurring,
    removeRecurring,
    receipts,
    buyers,
    saveBuyer,
    removeBuyer,
    createSale,
    setAppointmentStatus,
    removeAppointment]

  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore doit être utilisé à l’intérieur de StoreProvider');
  }
  return context;
}

export const currentMonthKey = () => monthKey(new Date());
