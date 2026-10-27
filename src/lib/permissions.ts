import type { Role } from '../types';

export type Permission =
'sales.create' |
'sales.view' |
'sales.delete' |
'sales.discount' |
'appointments.manage' |
'appointments.delete' |
'catalog.edit' |
'stock.adjust' |
'costs.view' |
'expenses.manage' |
'finance.view' |
'reports.view' |
'users.manage' |
'settings.manage';

const ALL: Permission[] = [
'sales.create',
'sales.view',
'sales.delete',
'sales.discount',
'appointments.manage',
'appointments.delete',
'catalog.edit',
'stock.adjust',
'costs.view',
'expenses.manage',
'finance.view',
'reports.view',
'users.manage',
'settings.manage'];


/**
 * Droits par rôle. Ces règles pilotent l'interface ; la base de données
 * applique le même découpage via les règles RLS (migration_roles_receipts.sql).
 */
const MATRIX: Record<Role, Permission[]> = {
  admin: ALL,
  gestionnaire: ALL.filter((permission) => permission !== 'users.manage' && permission !== 'settings.manage'),
  reception: ['sales.create', 'sales.view', 'appointments.manage']
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role].includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrateur',
  gestionnaire: 'Gestionnaire',
  reception: 'Réception'
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Accès complet, gestion de l’équipe.',
  gestionnaire: 'Accès complet sauf la gestion de l’équipe.',
  reception: 'Ventes et rendez-vous. Pas d’accès aux dépenses ni aux chiffres de profit.'
};

export const ROLES: Role[] = ['admin', 'gestionnaire', 'reception'];
