import { describe, it, expect } from 'vitest';
import { ROLES, SUPERVISOR_ROLES, EHS_ROLES, isRole, hasRole, isSupervisor, isAdmin, isEhsOfficer } from './roles';

describe('roles', () => {
  describe('isRole', () => {
    it.each(ROLES)('returns true for valid role: %s', (role) => {
      expect(isRole(role)).toBe(true);
    });

    it('returns false for null', () => {
      expect(isRole(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isRole(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isRole('')).toBe(false);
    });

    it('returns false for unknown role string', () => {
      expect(isRole('MANAGER')).toBe(false);
    });

    it('returns false for number', () => {
      expect(isRole(42)).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('returns true when role is in allowed list', () => {
      expect(hasRole('ADMIN', ['ADMIN', 'SUPERVISOR'])).toBe(true);
    });

    it('returns false when role is not in allowed list', () => {
      expect(hasRole('EMPLOYEE', ['ADMIN', 'SUPERVISOR'])).toBe(false);
    });

    it('returns false for invalid role even if in allowed list shape', () => {
      expect(hasRole('BOSS' as any, ['BOSS'] as any)).toBe(false);
    });

    it('returns false for null role', () => {
      expect(hasRole(null, SUPERVISOR_ROLES)).toBe(false);
    });
  });

  describe('isSupervisor', () => {
    it('returns true for SUPERVISOR', () => {
      expect(isSupervisor('SUPERVISOR')).toBe(true);
    });

    it('returns true for ADMIN', () => {
      expect(isSupervisor('ADMIN')).toBe(true);
    });

    it.each(['EMPLOYEE', 'TECHNICIAN', 'STORE_ADMIN', 'EHS_OFFICER'])(
      'returns false for %s',
      (role) => {
        expect(isSupervisor(role)).toBe(false);
      },
    );
  });

  describe('isAdmin', () => {
    it('returns true for ADMIN', () => {
      expect(isAdmin('ADMIN')).toBe(true);
    });

    it.each(['EMPLOYEE', 'TECHNICIAN', 'SUPERVISOR', 'STORE_ADMIN', 'EHS_OFFICER'])(
      'returns false for %s',
      (role) => {
        expect(isAdmin(role)).toBe(false);
      },
    );
  });

  describe('isEhsOfficer', () => {
    it('returns true for EHS_OFFICER', () => {
      expect(isEhsOfficer('EHS_OFFICER')).toBe(true);
    });

    it('returns true for ADMIN', () => {
      expect(isEhsOfficer('ADMIN')).toBe(true);
    });

    it.each(['EMPLOYEE', 'TECHNICIAN', 'SUPERVISOR', 'STORE_ADMIN'])(
      'returns false for %s',
      (role) => {
        expect(isEhsOfficer(role)).toBe(false);
      },
    );
  });
});
