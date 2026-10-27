import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StoreProvider } from './contexts/StoreContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { Settings } from './pages/Settings';
import { SaleDialogProvider } from './components/SaleDialog';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Services } from './pages/Services';
import { Products } from './pages/Products';
import { Expenses } from './pages/Expenses';
import { Agenda } from './pages/Agenda';
import { TodayAppointments } from './pages/TodayAppointments';
import { Sales } from './pages/Sales';
import { Buyers } from './pages/Buyers';
import { Reports } from './pages/Reports';
import { Team } from './pages/Team';
import type { Permission } from './lib/permissions';

function Screen({ children }: {children: React.ReactNode;}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 text-center text-sm text-ink-500">
      <div className="max-w-sm space-y-4">{children}</div>
    </div>);

}

function Blocked({ title, text }: {title: string;text: string;}) {
  const { signOut, user } = useAuth();
  return (
    <Screen>
      <h1 className="text-lg font-semibold text-ink-900">{title}</h1>
      <p>{text}</p>
      <p className="text-xs text-ink-400">{user?.email}</p>
      <button type="button" onClick={() => signOut()} className="rounded-lg border border-ink-200 bg-white px-4 py-2 font-medium text-ink-800 hover:bg-ink-50">
        Se déconnecter
      </button>
    </Screen>);

}

function Gate({ children }: {children: React.ReactNode;}) {
  const { session, loading, access } = useAuth();

  if (loading) return <Screen>Chargement…</Screen>;
  if (!session) return <Login />;
  if (access === 'loading') return <Screen>Chargement…</Screen>;
  if (access === 'missing') {
    return (
      <Blocked
        title="Accès non autorisé"
        text="Ce compte n’est rattaché à aucun centre. Demandez à un administrateur de vous inviter avec cette adresse e-mail, puis reconnectez-vous." />);

  }
  if (access === 'inactive') {
    return <Blocked title="Compte désactivé" text="Votre accès a été désactivé par un administrateur." />;
  }
  return <>{children}</>;
}

function Guard({ permission, children }: {permission: Permission;children: React.ReactNode;}) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : <Navigate to="/" replace />;
}

export function App() {
  return (
    <AuthProvider>
      <Gate>
        <SettingsProvider>
        <StoreProvider>
          <HashRouter>
            <SaleDialogProvider>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/ventes" element={<Guard permission="sales.view"><Sales /></Guard>} />
                  <Route path="/acheteurs" element={<Guard permission="sales.create"><Buyers /></Guard>} />
                  <Route path="/services" element={<Services />} />
                  <Route path="/produits" element={<Products />} />
                  <Route path="/depenses" element={<Guard permission="expenses.manage"><Expenses /></Guard>} />
                  <Route path="/rapports" element={<Guard permission="reports.view"><Reports /></Guard>} />
                  <Route path="/parametres" element={<Guard permission="settings.manage"><Settings /></Guard>} />
                  <Route path="/equipe" element={<Guard permission="users.manage"><Team /></Guard>} />
                  <Route path="/agenda" element={<Agenda />} />
                  <Route path="/aujourdhui" element={<TodayAppointments />} />
                  <Route path="*" element={<Dashboard />} />
                </Route>
              </Routes>
            </SaleDialogProvider>
          </HashRouter>
        </StoreProvider>
        </SettingsProvider>
      </Gate>
    </AuthProvider>
  );
}
