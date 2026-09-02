export const ROLES = [
  'EMPLOYEE',
  'TECHNICIAN',
  'SUPERVISOR',
  'STORE_ADMIN',
  'EHS_OFFICER',
  'ADMIN',
] as const;

export type Role = (typeof ROLES)[number];

export const SUPERVISOR_ROLES: readonly Role[] = ['SUPERVISOR', 'ADMIN'];
export const EHS_ROLES: readonly Role[] = ['EHS_OFFICER', 'ADMIN'];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function hasRole(userRole: unknown, allowed: readonly Role[]): boolean {
  return isRole(userRole) && (allowed as readonly string[]).includes(userRole);
}

export function isSupervisor(userRole: unknown): boolean {
  return hasRole(userRole, SUPERVISOR_ROLES);
}

export function isAdmin(userRole: unknown): boolean {
  return userRole === 'ADMIN';
}

export function isEhsOfficer(userRole: unknown): boolean {
  return hasRole(userRole, EHS_ROLES);
}