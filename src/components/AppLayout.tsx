import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOutIcon,
  BanknoteIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  CalendarRangeIcon,
  LayoutDashboardIcon,
  PackageIcon,
  FileBarChartIcon,
  PlusIcon,
  ReceiptIcon,
  SettingsIcon,
  UsersIcon,
  StethoscopeIcon,
  TriangleAlertIcon } from
'lucide-react';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useSaleDialog } from './SaleDialog';
import { Button } from './ui/Primitives';
import { fmtLongDate, todayKey } from '../utils/date';
import { ROLE_LABELS, type Permission } from '../lib/permissions';
import { BRAND } from '../brand';
import { BrandLogo } from '../brand/BrandLogo';
import { useSettings } from '../contexts/SettingsContext';

const dark = BRAND.sidebar === 'dark';
const sb = dark ?
{
  aside: 'border-ink-800 bg-ink-900',
  name: 'text-white',
  sub: 'text-ink-400',
  foot: 'text-ink-500',
  user: 'text-ink-300',
  link: 'text-ink-300 hover:bg-ink-800 hover:text-white',
  active: 'bg-brand-600 text-white',
  badge: 'bg-white/15 text-white',
  out: 'text-ink-400 hover:bg-ink-800 hover:text-white'
} :
{
  aside: 'border-ink-200 bg-white',
  name: 'text-ink-900',
  sub: 'text-ink-500',
  foot: 'text-ink-400',
  user: 'text-ink-700',
  link: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  active: 'bg-brand-50 text-brand-700',
  badge: 'bg-brand-100 text-brand-700',
  out: 'text-ink-500 hover:bg-ink-100 hover:text-ink-900'
};

const allNavItems: {to: string;label: string;icon: typeof LayoutDashboardIcon;permission?: Permission;}[] = [
{ to: '/', label: 'Accueil', icon: LayoutDashboardIcon },
{ to: '/ventes', label: 'Ventes', icon: ReceiptIcon, permission: 'sales.view' },
{ to: '/acheteurs', label: 'Acheteurs', icon: BriefcaseIcon, permission: 'sales.create' },
{ to: '/services', label: 'Services', icon: StethoscopeIcon },
{ to: '/produits', label: 'Produits & stock', icon: PackageIcon },
{ to: '/depenses', label: 'Dépenses', icon: BanknoteIcon, permission: 'expenses.manage' },
{ to: '/agenda', label: 'Agenda', icon: CalendarRangeIcon },
{ to: '/aujourdhui', label: "Aujourd'hui", icon: CalendarDaysIcon },
{ to: '/rapports', label: 'Rapports', icon: FileBarChartIcon, permission: 'reports.view' },
{ to: '/equipe', label: 'Équipe', icon: UsersIcon, permission: 'users.manage' },
{ to: '/parametres', label: 'Paramètres', icon: SettingsIcon, permission: 'settings.manage' }];


export function AppLayout() {
  const { lowStock, appointments } = useStore();
  const { openSale } = useSaleDialog();
  const { signOut, displayName, role, can } = useAuth();
  const { center } = useSettings();
  const navItems = allNavItems.filter((item) => !item.permission || can(item.permission));
  const location = useLocation();

  const todayCount = appointments.filter(
    (appointment) =>
    appointment.date === todayKey() && appointment.status === 'prévu'
  ).length;

  const currentLabel =
  navItems.find((item) => item.to === location.pathname)?.label ?? 'Accueil';

  return (
    <div className="flex min-h-screen w-full bg-ink-50/60">
      <aside className={`hidden w-64 shrink-0 flex-col border-r lg:flex ${sb.aside}`}>
        <div className="flex items-center gap-3 px-5 py-6">
          <BrandLogo size={42} src={center.logo || undefined} />
          <span className="leading-tight">
            <span className={`block text-sm font-semibold ${sb.name}`}>
              {BRAND.name}
            </span>
            <span className={`block text-xs ${sb.sub}`}>Manager</span>
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Navigation principale">
          {navItems.map((item) =>
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
            `flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ease-out ${
            isActive ?
            sb.active :
            sb.link}`

            }>
            
              <span className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                {item.label}
              </span>
              {item.to === '/aujourdhui' && todayCount > 0 ?
            <span className={`rounded-full px-1.5 text-xs font-semibold ${sb.badge}`}>
                  {todayCount}
                </span> :
            null}
              {item.to === '/produits' && lowStock.length > 0 ?
            <TriangleAlertIcon className="h-4 w-4 text-amber-400" /> :
            null}
            </NavLink>
          )}
        </nav>
        <p className={`px-5 py-6 text-xs ${sb.foot}`}>
          {BRAND.tagline}
        </p>
        <div className="flex items-center justify-between gap-2 px-5 py-4">
          <div className="min-w-0">
            <p className={`truncate text-xs font-medium ${sb.user}`}>{displayName}</p>
            <p className={`truncate text-xs ${sb.foot}`}>{role ? ROLE_LABELS[role] : ''}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            title="Se déconnecter"
            className={`shrink-0 rounded-lg p-1.5 ${sb.out}`}>
            <LogOutIcon className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-ink-900">
                {currentLabel}
              </h1>
              <p className="truncate text-sm capitalize text-ink-500">
                {fmtLongDate(todayKey())}
              </p>
            </div>
            <Button onClick={() => openSale()} className="shrink-0">
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Déclarer une vente</span>
              <span className="sm:hidden">Vente</span>
            </Button>
          </div>
          <nav
            className="flex gap-1 border-t border-ink-100 px-2 py-2 lg:hidden"
            aria-label="Navigation">
            
            <span className="flex gap-1 overflow-x-auto">
              {navItems.map((item) =>
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
                isActive ?
                'bg-ink-900 text-white' :
                'text-ink-600 hover:bg-ink-50'}`

                }>
                
                  {item.label}
                </NavLink>
              )}
            </span>
          </nav>
        </header>
        <main className="flex-1 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>);

}