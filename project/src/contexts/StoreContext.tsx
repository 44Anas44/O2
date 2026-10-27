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
  serviceFromRow,
  serviceToRow } from
'../lib/mappers';
import { dayKey, monthKey, nowTime, todayKey } from '../utils/date';

export type RecordedSale = {sale: Sale;appointment?: Appointment;};

type NewSaleInput = {
  kind: 'produit' | 'service';
  itemId: string;
  quantity: number;
  client: string;
  /** Ventes de produit : date d'encaissement. Services : date du rendez-vous. */
  date: string;
  time: string;
  phone?: string;
  note?: string;
};

type StoreValue = {
  loading: boolean;
  services: ServiceItem[];
  products: Product[];
  sales: Sale[];
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
  recordSale: (input: NewSaleInput) => Promise<RecordedSale | null>;
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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [manualExpenses, setManualExpenses] = useState<Expense[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);

  // Kept up to date for mutation handlers that need the latest snapshot
  // without re-subscribing (e.g. computing a stock delta).
  const productsRef = useRef(products);
  productsRef.current = products;
  const servicesRef = useRef(services);
  servicesRef.current = services;

  // ---------------------------------------------------------------------
  // Initial load + realtime subscriptions, scoped to the signed-in user
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!userId) {
      setServices([]);
      setProducts([]);
      setSales([]);
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
      appointmentsRes,
      expensesRes,
      recurringRes] =
      await Promise.all([
      supabase.from('services').select('*').eq('user_id', userId),
      supabase.from('products').select('*').eq('user_id', userId),
      supabase.from('sales').select('*').eq('user_id', userId).order('date', { ascending: false }),
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

  const recordSale = useCallback(
    async (input: NewSaleInput): Promise<RecordedSale | null> => {
      if (!userId) return null;

      if (input.kind === 'produit') {
        const product = productsRef.current.find((item) => item.id === input.itemId);
        if (!product) return null;
        const quantity = Math.max(1, input.quantity);
        const nextStock = Math.max(0, product.stock - quantity);

        const { data, error } = await supabase.
        from('sales').
        insert({
          user_id: userId,
          kind: 'produit',
          item_id: product.id,
          item_name: product.name,
          quantity,
          unit_price: product.salePrice,
          unit_cost: product.purchasePrice,
          total: product.salePrice * quantity,
          profit: (product.salePrice - product.purchasePrice) * quantity,
          date: input.date,
          time: input.time || nowTime(),
          client: input.client || 'Comptoir',
          created_by_name: displayName
        }).
        select().
        single();
        if (error || !data) return null;

        // Le stock n'est décrémenté qu'une fois la vente réellement enregistrée.
        setProducts((prev) =>
        prev.map((item) => item.id === product.id ? { ...item, stock: nextStock } : item)
        );
        await supabase.from('products').update({ stock: nextStock }).eq('id', product.id);

        const sale = saleFromRow(data);
        setSales((prev) => upsertById(prev, sale));
        return { sale };
      }

      const service = servicesRef.current.find((item) => item.id === input.itemId);
      if (!service) return null;

      const { data: saleRow } = await supabase.
      from('sales').
      insert({
        user_id: userId,
        kind: 'service',
        item_id: service.id,
        item_name: service.name,
        quantity: 1,
        unit_price: service.price,
        unit_cost: 0,
        total: service.price,
        profit: service.price,
        date: input.date,
        time: input.time || nowTime(),
        client: input.client || 'Patient',
        created_by_name: displayName
      }).
      select().
      single();
      if (!saleRow) return null;

      const { data: appointmentRow } = await supabase.
      from('appointments').
      insert({
        user_id: userId,
        date: input.date,
        time: input.time || nowTime(),
        client: input.client || 'Patient',
        phone: input.phone ?? '',
        service_id: service.id,
        service_name: service.name,
        duration_min: service.durationMin,
        status: input.date < dayKey(new Date()) ? 'honoré' : 'prévu',
        note: input.note ?? '',
        sale_id: saleRow.id,
        created_by_name: displayName
      }).
      select().
      single();

      if (appointmentRow) {
        await supabase.
        from('sales').
        update({ appointment_id: appointmentRow.id }).
        eq('id', saleRow.id);
        const sale = saleFromRow({ ...saleRow, appointment_id: appointmentRow.id });
        const appointment = appointmentFromRow(appointmentRow);
        setSales((prev) => upsertById(prev, sale));
        setAppointments((prev) => upsertById(prev, appointment));
        return { sale, appointment };
      }

      const sale = saleFromRow(saleRow);
      setSales((prev) => upsertById(prev, sale));
      return { sale };
    },
    [userId, displayName]
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
    setAppointments((prev) => prev.filter((item) => item.id !== id));
    setSales((prev) => prev.filter((sale) => sale.appointmentId !== id));
    await supabase.from('appointments').delete().eq('id', id);
    await supabase.from('sales').delete().eq('appointment_id', id);
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      loading,
      services,
      products,
      sales,
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
      recordSale,
      setAppointmentStatus,
      removeAppointment
    }),
    [
    loading,
    services,
    products,
    sales,
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
    recordSale,
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
