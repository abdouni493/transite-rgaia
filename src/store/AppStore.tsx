/* ============================================================
   Application store — backed by Supabase.

   Screens keep calling the same synchronous-looking helpers they always have.
   Under the hood each one applies the change to the in-memory mirror right
   away (so the UI never stalls) and posts it to Postgres. If the database
   refuses — almost always an RLS denial because the signed-in employee lacks
   that button action — the error is toasted and the mirror is re-synced from
   the server, so what you see is always what is stored.
   ============================================================ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createIsolatedClient, newId, supabase } from '../lib/supabase';
import {
  EMPTY_STATE,
  absenceRow,
  advanceRow,
  carBrandRow,
  carModelRow,
  cashRow,
  companyRow,
  containerRow,
  fetchAll,
  invoiceRow,
  paymentRow,
  payrollRow,
  principalRow,
  run,
  secondaryRow,
  serviceRow,
  setDbErrorHandler,
  warehouseRow,
  workerRow,
} from '../lib/db';
import { writeBrand } from '../lib/brand';
import { nextDeclarationNo, nextInvoiceNo, nextVersementRef } from '../lib/selectors';
import { todayISO } from '../lib/format';
import { useToast } from '../components/ui/overlays';
import { PAGE_KEYS } from '../lib/types';
import type {
  Absence,
  Advance,
  AdminUser,
  AppState,
  CarBrand,
  CarModel,
  CashTransaction,
  Company,
  Container,
  ID,
  Invoice,
  PageKey,
  Payment,
  PayrollRun,
  Permissions,
  PrincipalClient,
  Role,
  SecondaryClient,
  Service,
  Session,
  Warehouse,
  Worker,
} from '../lib/types';

/* ---------------- context shape ---------------- */

type Updater = (s: AppState) => AppState;

export interface AuthResult {
  ok: boolean;
  error?: string;
}

interface StoreValue {
  state: AppState;
  session: Session | null;
  /** True until the first load after sign-in resolves. */
  loading: boolean;
  update: (fn: Updater) => void;
  refresh: () => Promise<void>;

  /* auth */
  login: (identifier: string, password: string) => Promise<AuthResult>;
  registerAdmin: (input: {
    name: string;
    username: string;
    email: string;
    password: string;
  }) => Promise<AuthResult>;
  logout: () => void;
  updateOwnAccount: (patch: Partial<AdminUser>) => void;

  /* permissions */
  can: (page: PageKey, action?: string) => boolean;
  visiblePages: PageKey[];

  /* principal clients */
  addPrincipal: (c: Omit<PrincipalClient, 'id' | 'createdAt'>) => PrincipalClient;
  updatePrincipal: (id: ID, patch: Partial<PrincipalClient>) => void;
  deletePrincipal: (id: ID) => void;

  /* secondary clients */
  addSecondary: (
    c: Omit<SecondaryClient, 'id' | 'createdAt' | 'customsStatus' | 'declarationNo'> & {
      /** Typed by hand on the form; falls back to the next free number. */
      declarationNo?: number;
    },
  ) => SecondaryClient;
  updateSecondary: (id: ID, patch: Partial<SecondaryClient>) => void;
  deleteSecondary: (id: ID) => void;

  /* containers */
  addContainer: (c: Omit<Container, 'id' | 'createdAt'>) => Container;
  updateContainer: (id: ID, patch: Partial<Container>) => void;
  deleteContainer: (id: ID) => void;

  /* warehouses */
  addWarehouse: (w: Omit<Warehouse, 'id' | 'createdAt'>) => Warehouse;
  updateWarehouse: (id: ID, patch: Partial<Warehouse>) => void;
  deleteWarehouse: (id: ID) => void;

  /* car catalog */
  addCarBrand: (name: string) => CarBrand;
  addCarModel: (brandId: ID, name: string) => CarModel;

  /* services */
  addService: (s: Omit<Service, 'id' | 'createdAt'>) => Service;
  updateService: (id: ID, patch: Partial<Service>) => void;
  deleteService: (id: ID) => void;

  /* invoices */
  addInvoice: (i: Omit<Invoice, 'id' | 'createdAt' | 'createdBy' | 'invoiceNo'>) => Invoice;
  updateInvoice: (id: ID, patch: Partial<Invoice>) => void;
  deleteInvoice: (id: ID) => void;

  /* payments */
  addPayment: (p: Omit<Payment, 'id' | 'createdAt' | 'createdBy' | 'refNo'>) => Payment;
  updatePayment: (id: ID, patch: Partial<Payment>) => void;
  deletePayment: (id: ID) => void;

  /* cash */
  addCash: (t: Omit<CashTransaction, 'id' | 'createdAt' | 'createdBy'>) => CashTransaction;
  updateCash: (id: ID, patch: Partial<CashTransaction>) => void;
  deleteCash: (id: ID) => void;

  /* workers */
  addWorker: (w: Omit<Worker, 'id' | 'createdAt'>) => void;
  updateWorker: (id: ID, patch: Partial<Worker>) => void;
  deleteWorker: (id: ID) => void;
  setWorkerPermissions: (id: ID, perms: Permissions) => void;
  addRole: (name: string) => Role;
  deleteRole: (id: ID) => void;

  addAdvance: (a: Omit<Advance, 'id' | 'createdAt' | 'settled'>) => void;
  updateAdvance: (id: ID, patch: Partial<Advance>) => void;
  deleteAdvance: (id: ID) => void;
  addAbsence: (a: Omit<Absence, 'id' | 'createdAt' | 'settled'>) => void;
  updateAbsence: (id: ID, patch: Partial<Absence>) => void;
  deleteAbsence: (id: ID) => void;
  addPayroll: (p: Omit<PayrollRun, 'id' | 'createdAt'>) => void;
  deletePayroll: (id: ID) => void;

  /* settings */
  updateCompany: (patch: Partial<Company>) => void;
  exportBackup: () => void;
  importBackup: (json: string) => Promise<boolean>;
}

const StoreContext = createContext<StoreValue | null>(null);

/* ---------------- provider ---------------- */

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const update = useCallback((fn: Updater) => setState((s) => fn(s)), []);

  const refresh = useCallback(async () => {
    const next = await fetchAll();
    if (mounted.current) setState(next);
  }, []);

  /* Database rejections land here — one toast, then re-sync. */
  useEffect(() => {
    setDbErrorHandler((message) => {
      toast.error(message);
      void refresh();
    });
  }, [toast, refresh]);

  /* ---------------- session bootstrap ---------------- */

  /** Turns a signed-in auth user into the app's Session (or null). */
  const buildSession = useCallback(async (userId: string): Promise<Session | null> => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) return null;

    if (profile.role === 'admin') {
      return {
        kind: 'admin',
        id: profile.id,
        name: profile.name || profile.email,
        username: profile.username ?? '',
        email: profile.email,
        roleName: 'Administrateur',
        permissions: 'all',
      };
    }

    const { data: worker } = await supabase
      .from('workers')
      .select('*, roles(name)')
      .eq('id', profile.worker_id)
      .maybeSingle();

    if (!worker || !worker.active || !worker.account_enabled) return null;

    return {
      kind: 'worker',
      id: worker.id,
      name: worker.full_name,
      username: worker.account_username ?? '',
      email: profile.email,
      roleName: (worker.roles as { name: string } | null)?.name ?? '—',
      permissions: (worker.permissions ?? {}) as Permissions,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const sync = async (userId: string | undefined) => {
      if (!userId) {
        if (!cancelled) {
          setSession(null);
          setState(EMPTY_STATE);
          setLoading(false);
        }
        return;
      }
      const next = await buildSession(userId);
      if (cancelled) return;
      if (!next) {
        // Signed in but no usable profile — e.g. the employee was deactivated.
        await supabase.auth.signOut();
        setSession(null);
        setState(EMPTY_STATE);
        setLoading(false);
        return;
      }
      setSession(next);
      const data = await fetchAll();
      if (cancelled) return;
      setState(data);
      // Keep the login screen's branding in step with the company settings.
      writeBrand({ name: data.company.name, logo: data.company.logo });
      setLoading(false);
    };

    void supabase.auth.getSession().then(({ data }) => sync(data.session?.user?.id));

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'TOKEN_REFRESHED') return;
      setLoading(true);
      void sync(s?.user?.id);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [buildSession]);

  const actor = session?.name ?? 'Système';

  /* ---------------- auth ---------------- */

  const login = useCallback<StoreValue['login']>(async (identifier, password) => {
    const id = identifier.trim();
    let email = id;

    // Usernames are resolved to an address by a SECURITY DEFINER function so
    // the profiles table itself stays closed to anonymous readers.
    if (!id.includes('@')) {
      const { data } = await supabase.rpc('email_for_identifier', { identifier: id });
      if (!data) return { ok: false, error: 'invalidCredentials' };
      email = data as string;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: 'invalidCredentials' };
    return { ok: true };
  }, []);

  const registerAdmin = useCallback<StoreValue['registerAdmin']>(
    async ({ name, username, email, password }) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim(), username: username.trim(), role: 'admin' },
        },
      });
      if (error) {
        const m = error.message.toLowerCase();
        if (m.includes('already') || m.includes('registered')) return { ok: false, error: 'emailTaken' };
        return { ok: false, error: error.message };
      }
      if (!data.session) {
        // Email confirmation is still enabled on the project.
        return { ok: false, error: 'confirmEmailFirst' };
      }
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(() => {
    void supabase.auth.signOut();
    setSession(null);
    setState(EMPTY_STATE);
  }, []);

  const updateOwnAccount = useCallback<StoreValue['updateOwnAccount']>(
    (patch) => {
      if (!session) return;

      setSession((s) =>
        s
          ? {
              ...s,
              name: patch.name ?? s.name,
              username: patch.username ?? s.username,
              email: patch.email ?? s.email,
            }
          : s,
      );

      void run(
        'profiles',
        supabase
          .from('profiles')
          .update({
            ...(patch.name !== undefined && { name: patch.name }),
            ...(patch.username !== undefined && { username: patch.username }),
            ...(patch.email !== undefined && { email: patch.email }),
          })
          .eq('id', session.id),
      );

      if (patch.email || patch.password) {
        void supabase.auth
          .updateUser({
            ...(patch.email && { email: patch.email }),
            ...(patch.password && { password: patch.password }),
          })
          .then(({ error }) => error && toast.error(error.message));
      }

      if (session.kind === 'worker' && (patch.name || patch.username)) {
        void run(
          'workers',
          supabase
            .from('workers')
            .update({
              ...(patch.name && { full_name: patch.name }),
              ...(patch.username && { account_username: patch.username }),
            })
            .eq('id', session.id),
        );
      }
    },
    [session, toast],
  );

  /* ---------------- permissions ---------------- */

  const can = useCallback<StoreValue['can']>(
    (page, action) => {
      if (!session) return false;
      if (session.permissions === 'all') return true;
      const granted = session.permissions[page];
      if (!granted) return false;
      return action ? granted.includes(action) : true;
    },
    [session],
  );

  const visiblePages = useMemo<PageKey[]>(() => {
    if (!session) return [];
    if (session.permissions === 'all') return [...PAGE_KEYS];
    const perms = session.permissions;
    return PAGE_KEYS.filter((k) => perms[k] !== undefined);
  }, [session]);

  /* ---------------- principal clients ---------------- */

  const addPrincipal = useCallback<StoreValue['addPrincipal']>((c) => {
    const item: PrincipalClient = { ...c, id: newId(), createdAt: todayISO() };
    setState((s) => ({ ...s, principalClients: [item, ...s.principalClients] }));
    void run(
      'principal_clients',
      supabase.from('principal_clients').insert({ id: item.id, ...principalRow(item) }),
    );
    return item;
  }, []);

  const updatePrincipal = useCallback<StoreValue['updatePrincipal']>((id, patch) => {
    setState((s) => ({
      ...s,
      principalClients: s.principalClients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    void run(
      'principal_clients',
      supabase.from('principal_clients').update(principalRow(patch)).eq('id', id),
    );
  }, []);

  const deletePrincipal = useCallback<StoreValue['deletePrincipal']>((id) => {
    setState((s) => {
      const orphaned = new Set(
        s.secondaryClients.filter((c) => c.principalClientId === id).map((c) => c.id),
      );
      return {
        ...s,
        principalClients: s.principalClients.filter((c) => c.id !== id),
        secondaryClients: s.secondaryClients.filter((c) => c.principalClientId !== id),
        payments: s.payments.filter((p) => p.principalClientId !== id),
        invoices: s.invoices.filter((i) => !orphaned.has(i.secondaryClientId)),
      };
    });
    void run('principal_clients', supabase.from('principal_clients').delete().eq('id', id));
  }, []);

  /* ---------------- secondary clients ---------------- */

  const addSecondary = useCallback<StoreValue['addSecondary']>(
    (c) => {
      const item: SecondaryClient = {
        ...c,
        id: newId(),
        // A unique index backs this up, so a number typed twice is refused by
        // Postgres and surfaces as a toast rather than two files sharing an id.
        declarationNo: c.declarationNo ?? nextDeclarationNo(state),
        customsStatus: 'non_arrive',
        createdAt: todayISO(),
      };
      setState((s) => ({ ...s, secondaryClients: [item, ...s.secondaryClients] }));
      void run(
        'secondary_clients',
        supabase.from('secondary_clients').insert({ id: item.id, ...secondaryRow(item) }),
      );
      return item;
    },
    [state],
  );

  const updateSecondary = useCallback<StoreValue['updateSecondary']>((id, patch) => {
    setState((s) => ({
      ...s,
      secondaryClients: s.secondaryClients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    void run(
      'secondary_clients',
      supabase.from('secondary_clients').update(secondaryRow(patch)).eq('id', id),
    );
  }, []);

  const deleteSecondary = useCallback<StoreValue['deleteSecondary']>((id) => {
    setState((s) => ({
      ...s,
      secondaryClients: s.secondaryClients.filter((c) => c.id !== id),
      invoices: s.invoices.filter((i) => i.secondaryClientId !== id),
    }));
    void run('secondary_clients', supabase.from('secondary_clients').delete().eq('id', id));
  }, []);

  /* ---------------- containers ---------------- */

  const addContainer = useCallback<StoreValue['addContainer']>((c) => {
    const item: Container = { ...c, id: newId(), createdAt: todayISO() };
    setState((s) => ({ ...s, containers: [item, ...s.containers] }));
    void run('containers', supabase.from('containers').insert({ id: item.id, ...containerRow(item) }));
    return item;
  }, []);

  const updateContainer = useCallback<StoreValue['updateContainer']>((id, patch) => {
    setState((s) => ({
      ...s,
      containers: s.containers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    void run('containers', supabase.from('containers').update(containerRow(patch)).eq('id', id));
  }, []);

  const deleteContainer = useCallback<StoreValue['deleteContainer']>((id) => {
    setState((s) => {
      const orphaned = new Set(
        s.secondaryClients.filter((c) => c.containerId === id).map((c) => c.id),
      );
      return {
        ...s,
        containers: s.containers.filter((c) => c.id !== id),
        secondaryClients: s.secondaryClients.filter((c) => c.containerId !== id),
        payments: s.payments.filter((p) => p.containerId !== id),
        invoices: s.invoices.filter((i) => !orphaned.has(i.secondaryClientId)),
      };
    });
    void run('containers', supabase.from('containers').delete().eq('id', id));
  }, []);

  /* ---------------- warehouses ---------------- */

  const addWarehouse = useCallback<StoreValue['addWarehouse']>((w) => {
    const item: Warehouse = { ...w, id: newId(), createdAt: todayISO() };
    setState((s) => ({ ...s, warehouses: [item, ...s.warehouses] }));
    void run('warehouses', supabase.from('warehouses').insert({ id: item.id, ...warehouseRow(item) }));
    return item;
  }, []);

  const updateWarehouse = useCallback<StoreValue['updateWarehouse']>((id, patch) => {
    setState((s) => ({
      ...s,
      warehouses: s.warehouses.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
    void run('warehouses', supabase.from('warehouses').update(warehouseRow(patch)).eq('id', id));
  }, []);

  const deleteWarehouse = useCallback<StoreValue['deleteWarehouse']>((id) => {
    setState((s) => ({
      ...s,
      warehouses: s.warehouses.filter((w) => w.id !== id),
      // the cars stay, they just lose their storage site (ON DELETE SET NULL)
      secondaryClients: s.secondaryClients.map((c) =>
        c.warehouseId === id ? { ...c, warehouseId: undefined } : c,
      ),
    }));
    void run('warehouses', supabase.from('warehouses').delete().eq('id', id));
  }, []);

  /* ---------------- car catalog ---------------- */

  const addCarBrand = useCallback<StoreValue['addCarBrand']>((name) => {
    const item: CarBrand = { id: newId(), name: name.trim(), createdAt: todayISO() };
    setState((s) => ({
      ...s,
      carBrands: [...s.carBrands, item].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    void run('car_brands', supabase.from('car_brands').insert({ id: item.id, ...carBrandRow(item) }));
    return item;
  }, []);

  const addCarModel = useCallback<StoreValue['addCarModel']>((brandId, name) => {
    const item: CarModel = { id: newId(), brandId, name: name.trim(), createdAt: todayISO() };
    setState((s) => ({
      ...s,
      carModels: [...s.carModels, item].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    void run('car_models', supabase.from('car_models').insert({ id: item.id, ...carModelRow(item) }));
    return item;
  }, []);

  /* ---------------- services ---------------- */

  const addService = useCallback<StoreValue['addService']>((sv) => {
    const item: Service = { ...sv, id: newId(), createdAt: todayISO() };
    setState((s) => ({ ...s, services: [item, ...s.services] }));
    void run('services', supabase.from('services').insert({ id: item.id, ...serviceRow(item) }));
    return item;
  }, []);

  const updateService = useCallback<StoreValue['updateService']>((id, patch) => {
    setState((s) => ({
      ...s,
      services: s.services.map((sv) => (sv.id === id ? { ...sv, ...patch } : sv)),
    }));
    void run('services', supabase.from('services').update(serviceRow(patch)).eq('id', id));
  }, []);

  /** Invoices keep their own copy of every line, so they survive this untouched. */
  const deleteService = useCallback<StoreValue['deleteService']>((id) => {
    setState((s) => ({ ...s, services: s.services.filter((sv) => sv.id !== id) }));
    void run('services', supabase.from('services').delete().eq('id', id));
  }, []);

  /* ---------------- invoices ---------------- */

  const addInvoice = useCallback<StoreValue['addInvoice']>(
    (inv) => {
      const item: Invoice = {
        ...inv,
        id: newId(),
        invoiceNo: nextInvoiceNo(state),
        createdBy: actor,
        createdAt: new Date().toISOString().slice(0, 16),
      };
      setState((s) => ({ ...s, invoices: [item, ...s.invoices] }));
      void run('invoices', supabase.from('invoices').insert({ id: item.id, ...invoiceRow(item) }));
      return item;
    },
    [actor, state],
  );

  const updateInvoice = useCallback<StoreValue['updateInvoice']>((id, patch) => {
    setState((s) => ({
      ...s,
      invoices: s.invoices.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
    void run('invoices', supabase.from('invoices').update(invoiceRow(patch)).eq('id', id));
  }, []);

  const deleteInvoice = useCallback<StoreValue['deleteInvoice']>((id) => {
    setState((s) => ({ ...s, invoices: s.invoices.filter((i) => i.id !== id) }));
    void run('invoices', supabase.from('invoices').delete().eq('id', id));
  }, []);

  /* ---------------- payments ---------------- */

  const addPayment = useCallback<StoreValue['addPayment']>(
    (p) => {
      const item: Payment = {
        ...p,
        id: newId(),
        refNo: nextVersementRef(state),
        createdBy: actor,
        createdAt: `${p.date}T${p.time}`,
      };
      setState((s) => ({ ...s, payments: [item, ...s.payments] }));
      void run('payments', supabase.from('payments').insert({ id: item.id, ...paymentRow(item) }));
      return item;
    },
    [actor, state],
  );

  const updatePayment = useCallback<StoreValue['updatePayment']>((id, patch) => {
    setState((s) => ({
      ...s,
      payments: s.payments.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
    void run('payments', supabase.from('payments').update(paymentRow(patch)).eq('id', id));
  }, []);

  const deletePayment = useCallback<StoreValue['deletePayment']>((id) => {
    setState((s) => ({ ...s, payments: s.payments.filter((p) => p.id !== id) }));
    void run('payments', supabase.from('payments').delete().eq('id', id));
  }, []);

  /* ---------------- caisse ---------------- */

  const addCash = useCallback<StoreValue['addCash']>(
    (tx) => {
      const item: CashTransaction = {
        ...tx,
        id: newId(),
        createdBy: actor,
        createdAt: `${tx.date}T${tx.time}`,
      };
      setState((s) => ({ ...s, cash: [item, ...s.cash] }));
      void run(
        'cash_transactions',
        supabase.from('cash_transactions').insert({ id: item.id, ...cashRow(item) }),
      );
      return item;
    },
    [actor],
  );

  const updateCash = useCallback<StoreValue['updateCash']>((id, patch) => {
    setState((s) => ({ ...s, cash: s.cash.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    void run('cash_transactions', supabase.from('cash_transactions').update(cashRow(patch)).eq('id', id));
  }, []);

  const deleteCash = useCallback<StoreValue['deleteCash']>((id) => {
    setState((s) => ({ ...s, cash: s.cash.filter((t) => t.id !== id) }));
    void run('cash_transactions', supabase.from('cash_transactions').delete().eq('id', id));
  }, []);

  /* ---------------- workers ---------------- */

  /**
   * Creates the employee's login without disturbing the admin's own session:
   * signUp runs on a throwaway client that never writes to localStorage.
   * The `worker_id` metadata is what links auth.users → workers (see the
   * handle_new_user trigger in supabase_schema.sql).
   */
  const createWorkerLogin = useCallback(
    async (worker: Worker, password: string) => {
      const iso = createIsolatedClient();
      const { error } = await iso.auth.signUp({
        email: worker.account.email.trim(),
        password,
        options: {
          data: {
            name: worker.fullName,
            username: worker.account.username.trim(),
            role: 'worker',
            worker_id: worker.id,
          },
        },
      });
      if (error) toast.error(`Compte employé: ${error.message}`);
      await iso.auth.signOut();
    },
    [toast],
  );

  const addWorker = useCallback<StoreValue['addWorker']>(
    (w) => {
      const item: Worker = { ...w, id: newId(), createdAt: todayISO() };
      setState((s) => ({ ...s, workers: [item, ...s.workers] }));

      void (async () => {
        const ok = await run(
          'workers',
          supabase.from('workers').insert({ id: item.id, ...workerRow(item) }),
        );
        if (ok && item.account.enabled && w.account.password) {
          await createWorkerLogin(item, w.account.password);
        }
      })();
    },
    [createWorkerLogin],
  );

  const updateWorker = useCallback<StoreValue['updateWorker']>(
    (id, patch) => {
      let next: Worker | undefined;
      setState((s) => {
        const workers = s.workers.map((w) => {
          if (w.id !== id) return w;
          next = { ...w, ...patch };
          return next;
        });
        return { ...s, workers };
      });

      void (async () => {
        const ok = await run('workers', supabase.from('workers').update(workerRow(patch)).eq('id', id));
        if (!ok || !next) return;

        // Turning the account on for the first time creates the login.
        const enabling = patch.account?.enabled && patch.account.password;
        if (!enabling) return;
        const { data } = await supabase
          .from('workers')
          .select('auth_user_id')
          .eq('id', id)
          .maybeSingle();
        if (!data?.auth_user_id) {
          await createWorkerLogin(next, patch.account!.password);
        }
      })();
    },
    [createWorkerLogin],
  );

  const deleteWorker = useCallback<StoreValue['deleteWorker']>((id) => {
    setState((s) => ({
      ...s,
      workers: s.workers.filter((w) => w.id !== id),
      advances: s.advances.filter((a) => a.workerId !== id),
      absences: s.absences.filter((a) => a.workerId !== id),
      payrolls: s.payrolls.filter((p) => p.workerId !== id),
    }));
    void run('workers', supabase.from('workers').delete().eq('id', id));
  }, []);

  const setWorkerPermissions = useCallback<StoreValue['setWorkerPermissions']>((id, perms) => {
    setState((s) => ({
      ...s,
      workers: s.workers.map((w) => (w.id === id ? { ...w, permissions: perms } : w)),
    }));
    // Keep a logged-in worker's own session in sync.
    setSession((sess) =>
      sess && sess.kind === 'worker' && sess.id === id ? { ...sess, permissions: perms } : sess,
    );
    void run('workers', supabase.from('workers').update({ permissions: perms }).eq('id', id));
  }, []);

  const addRole = useCallback<StoreValue['addRole']>((name) => {
    const role: Role = { id: newId(), name: name.trim() };
    setState((s) => ({ ...s, roles: [...s.roles, role] }));
    void run('roles', supabase.from('roles').insert({ id: role.id, name: role.name }));
    return role;
  }, []);

  const deleteRole = useCallback<StoreValue['deleteRole']>((id) => {
    setState((s) => ({ ...s, roles: s.roles.filter((r) => r.id !== id || r.system) }));
    void run('roles', supabase.from('roles').delete().eq('id', id).eq('system', false));
  }, []);

  /* ---------------- advances / absences / payroll ---------------- */

  const addAdvance = useCallback<StoreValue['addAdvance']>((a) => {
    const item: Advance = {
      ...a,
      id: newId(),
      settled: false,
      createdAt: new Date().toISOString().slice(0, 16),
    };
    setState((s) => ({ ...s, advances: [item, ...s.advances] }));
    void run('advances', supabase.from('advances').insert({ id: item.id, ...advanceRow(item) }));
  }, []);

  const updateAdvance = useCallback<StoreValue['updateAdvance']>((id, patch) => {
    setState((s) => ({
      ...s,
      advances: s.advances.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
    void run('advances', supabase.from('advances').update(advanceRow(patch)).eq('id', id));
  }, []);

  const deleteAdvance = useCallback<StoreValue['deleteAdvance']>((id) => {
    setState((s) => ({ ...s, advances: s.advances.filter((a) => a.id !== id) }));
    void run('advances', supabase.from('advances').delete().eq('id', id));
  }, []);

  const addAbsence = useCallback<StoreValue['addAbsence']>((a) => {
    const item: Absence = {
      ...a,
      id: newId(),
      settled: false,
      createdAt: new Date().toISOString().slice(0, 16),
    };
    setState((s) => ({ ...s, absences: [item, ...s.absences] }));
    void run('absences', supabase.from('absences').insert({ id: item.id, ...absenceRow(item) }));
  }, []);

  const updateAbsence = useCallback<StoreValue['updateAbsence']>((id, patch) => {
    setState((s) => ({
      ...s,
      absences: s.absences.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
    void run('absences', supabase.from('absences').update(absenceRow(patch)).eq('id', id));
  }, []);

  const deleteAbsence = useCallback<StoreValue['deleteAbsence']>((id) => {
    setState((s) => ({ ...s, absences: s.absences.filter((a) => a.id !== id) }));
    void run('absences', supabase.from('absences').delete().eq('id', id));
  }, []);

  const addPayroll = useCallback<StoreValue['addPayroll']>((p) => {
    const item: PayrollRun = { ...p, id: newId(), createdAt: new Date().toISOString().slice(0, 16) };
    setState((s) => ({
      ...s,
      payrolls: [item, ...s.payrolls],
      // Settling a payroll consumes the advances/absences it deducted.
      advances: s.advances.map((a) => (p.advanceIds.includes(a.id) ? { ...a, settled: true } : a)),
      absences: s.absences.map((a) => (p.absenceIds.includes(a.id) ? { ...a, settled: true } : a)),
    }));

    void (async () => {
      const ok = await run(
        'payroll_runs',
        supabase.from('payroll_runs').insert({ id: item.id, ...payrollRow(item) }),
      );
      if (!ok) return;
      if (p.advanceIds.length)
        await run(
          'advances',
          supabase.from('advances').update({ settled: true }).in('id', p.advanceIds),
        );
      if (p.absenceIds.length)
        await run(
          'absences',
          supabase.from('absences').update({ settled: true }).in('id', p.absenceIds),
        );
    })();
  }, []);

  const deletePayroll = useCallback<StoreValue['deletePayroll']>(
    (id) => {
      const run_ = state.payrolls.find((p) => p.id === id);
      setState((s) => {
        const r = s.payrolls.find((p) => p.id === id);
        if (!r) return s;
        return {
          ...s,
          payrolls: s.payrolls.filter((p) => p.id !== id),
          advances: s.advances.map((a) =>
            r.advanceIds.includes(a.id) ? { ...a, settled: false } : a,
          ),
          absences: s.absences.map((a) =>
            r.absenceIds.includes(a.id) ? { ...a, settled: false } : a,
          ),
        };
      });

      void (async () => {
        await run('payroll_runs', supabase.from('payroll_runs').delete().eq('id', id));
        if (run_?.advanceIds.length)
          await run(
            'advances',
            supabase.from('advances').update({ settled: false }).in('id', run_.advanceIds),
          );
        if (run_?.absenceIds.length)
          await run(
            'absences',
            supabase.from('absences').update({ settled: false }).in('id', run_.absenceIds),
          );
      })();
    },
    [state.payrolls],
  );

  /* ---------------- settings ---------------- */

  const updateCompany = useCallback<StoreValue['updateCompany']>((patch) => {
    setState((s) => {
      const company = { ...s.company, ...patch };
      writeBrand({ name: company.name, logo: company.logo });
      return { ...s, company };
    });
    void run(
      'company',
      supabase.from('company').update({ ...companyRow(patch), updated_at: new Date().toISOString() }).eq('id', 1),
    );
  }, []);

  const exportBackup = useCallback(() => {
    const blob = new Blob([JSON.stringify({ __app: 'transitpro', version: 2, state }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transitpro-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  /** Restores a backup by upserting it back into Postgres, parents first. */
  const importBackup = useCallback(
    async (json: string) => {
      try {
        const parsed = JSON.parse(json);
        const next: AppState = parsed?.state ?? parsed;
        if (!next || !Array.isArray(next.principalClients) || !Array.isArray(next.containers))
          return false;

        const up = (table: string, rows: object[]) =>
          rows.length
            ? run(table, supabase.from(table).upsert(rows, { onConflict: 'id' }))
            : Promise.resolve(true);

        await up('roles', next.roles.map((r) => ({ id: r.id, name: r.name, system: !!r.system })));
        await up(
          'principal_clients',
          next.principalClients.map((c) => ({ id: c.id, ...principalRow(c) })),
        );
        await up('containers', next.containers.map((c) => ({ id: c.id, ...containerRow(c) })));
        // Backups written before these tables existed simply carry no rows.
        await up('warehouses', (next.warehouses ?? []).map((w) => ({ id: w.id, ...warehouseRow(w) })));
        await up('car_brands', (next.carBrands ?? []).map((b) => ({ id: b.id, ...carBrandRow(b) })));
        await up('car_models', (next.carModels ?? []).map((m) => ({ id: m.id, ...carModelRow(m) })));
        await up('services', (next.services ?? []).map((sv) => ({ id: sv.id, ...serviceRow(sv) })));
        await up(
          'secondary_clients',
          next.secondaryClients.map((c) => ({ id: c.id, ...secondaryRow(c) })),
        );
        await up('invoices', (next.invoices ?? []).map((i) => ({ id: i.id, ...invoiceRow(i) })));
        await up('payments', next.payments.map((p) => ({ id: p.id, ...paymentRow(p) })));
        await up('cash_transactions', next.cash.map((c) => ({ id: c.id, ...cashRow(c) })));
        await up('workers', next.workers.map((w) => ({ id: w.id, ...workerRow(w) })));
        await up('advances', next.advances.map((a) => ({ id: a.id, ...advanceRow(a) })));
        await up('absences', next.absences.map((a) => ({ id: a.id, ...absenceRow(a) })));
        await up('payroll_runs', next.payrolls.map((p) => ({ id: p.id, ...payrollRow(p) })));

        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [refresh],
  );

  const value = useMemo<StoreValue>(
    () => ({
      state,
      session,
      loading,
      update,
      refresh,
      login,
      registerAdmin,
      logout,
      updateOwnAccount,
      can,
      visiblePages,
      addPrincipal,
      updatePrincipal,
      deletePrincipal,
      addSecondary,
      updateSecondary,
      deleteSecondary,
      addContainer,
      updateContainer,
      deleteContainer,
      addWarehouse,
      updateWarehouse,
      deleteWarehouse,
      addCarBrand,
      addCarModel,
      addService,
      updateService,
      deleteService,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      addPayment,
      updatePayment,
      deletePayment,
      addCash,
      updateCash,
      deleteCash,
      addWorker,
      updateWorker,
      deleteWorker,
      setWorkerPermissions,
      addRole,
      deleteRole,
      addAdvance,
      updateAdvance,
      deleteAdvance,
      addAbsence,
      updateAbsence,
      deleteAbsence,
      addPayroll,
      deletePayroll,
      updateCompany,
      exportBackup,
      importBackup,
    }),
    [
      state, session, loading, update, refresh, login, registerAdmin, logout, updateOwnAccount, can,
      visiblePages, addPrincipal, updatePrincipal, deletePrincipal, addSecondary, updateSecondary,
      deleteSecondary, addContainer, updateContainer, deleteContainer, addWarehouse, updateWarehouse,
      deleteWarehouse, addCarBrand, addCarModel, addService, updateService, deleteService, addInvoice,
      updateInvoice, deleteInvoice, addPayment, updatePayment,
      deletePayment, addCash, updateCash, deleteCash, addWorker, updateWorker, deleteWorker,
      setWorkerPermissions, addRole, deleteRole, addAdvance, updateAdvance, deleteAdvance,
      addAbsence, updateAbsence, deleteAbsence, addPayroll, deletePayroll, updateCompany,
      exportBackup, importBackup,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <AppStoreProvider>');
  return ctx;
}
