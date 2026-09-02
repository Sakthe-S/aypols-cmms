import { describe, it, expect } from 'vitest';
import { toCamel, toCamelAll } from './db';

describe('toCamel', () => {
  it('converts snake_case keys to camelCase', () => {
    expect(toCamel({ user_name: 'Sakthi', is_active: true })).toEqual({
      userName: 'Sakthi',
      isActive: true,
    });
  });

  it('leaves already-camelCase keys unchanged', () => {
    expect(toCamel({ ticketNumber: 'TK-1', totalCost: 500 })).toEqual({
      ticketNumber: 'TK-1',
      totalCost: 500,
    });
  });

  it('handles nested values (preserves references)', () => {
    const obj = { created_at: new Date('2025-01-01'), tags: [1, 2] };
    const result = toCamel(obj);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.tags).toEqual([1, 2]);
  });

  it('handles empty object', () => {
    expect(toCamel({})).toEqual({});
  });

  it('handles keys with multiple underscores', () => {
    expect(toCamel({ a_b_c_d: 1 })).toEqual({ aBCD: 1 });
  });
});

describe('toCamelAll', () => {
  it('maps toCamel over an array', () => {
    const rows = [
      { user_name: 'A', is_active: true },
      { user_name: 'B', is_active: false },
    ];
    expect(toCamelAll(rows)).toEqual([
      { userName: 'A', isActive: true },
      { userName: 'B', isActive: false },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(toCamelAll([])).toEqual([]);
  });
});
