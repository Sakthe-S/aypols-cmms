import { describe, it, expect } from 'vitest';
import { authOptions } from './auth';

describe('auth callbacks', () => {
  const jwt = authOptions.callbacks!.jwt!;
  const session = authOptions.callbacks!.session!;

  describe('jwt', () => {
    it('enriches token with role and id when a user signs in', async () => {
      const user = { id: '7', name: 'Sakthi', email: 's@example.com', role: 'ADMIN' };
      const result = (await jwt({ token: { sub: '7' } as any, user, trigger: 'signIn' as any } as any)) as any;
      expect(result.role).toBe('ADMIN');
      expect(result.id).toBe('7');
    });

    it('preserves existing token when no user is provided', async () => {
      const token = { sub: '7', id: '7', role: 'ADMIN' };
      const result = (await jwt({ token, user: undefined as any, trigger: 'update' as any } as any)) as any;
      expect(result).toEqual({ sub: '7', id: '7', role: 'ADMIN' });
    });
  });

  describe('session', () => {
    it('copies role and id from token into the session user', async () => {
      const ses = { user: { name: 'Sakthi', email: 's@example.com' } } as any;
      const token = { role: 'ADMIN', id: '7' } as any;
      const result = (await session({ session: ses, token, user: {} } as any)) as any;
      expect(result.user.role).toBe('ADMIN');
      expect(result.user.id).toBe('7');
    });

    it('leaves session user intact when no token fields present', async () => {
      const ses = { user: { name: 'Sakthi' } } as any;
      const result = (await session({ session: ses, token: {} as any, user: {} } as any)) as any;
      expect(result.user.name).toBe('Sakthi');
      expect(result.user.role).toBeUndefined();
    });
  });
});
