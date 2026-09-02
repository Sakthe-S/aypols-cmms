import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  execute: mocks.execute,
}));

import { generateReminders } from './scheduled';

const now = new Date('2025-06-10T00:00:00Z');
vi.setSystemTime(now);

const reminderRoleUsers = [{ id: 1 }, { id: 2 }];
const stockRoleUsers = [{ id: 1 }];

beforeEach(() => {
  vi.clearAllMocks();
  // default: no reminders exist in dedup window, role queries return users
  mocks.query.mockImplementation(async (text: string) => {
    if (/role = ANY/.test(text) && /SUPERVISOR.*STORE_ADMIN/.test(text)) return stockRoleUsers;
    if (/role = ANY/.test(text)) return reminderRoleUsers;
    if (/FROM pm_schedules/.test(text)) return [];
    if (/FROM calibration_records/.test(text)) return [];
    if (/FROM amc_records/.test(text)) return [];
    if (/FROM training_records/.test(text)) return [];
    if (/FROM spare_parts/.test(text)) return [];
    return [];
  });
  mocks.queryOne.mockResolvedValue(null);
  mocks.execute.mockResolvedValue(undefined);
});

describe('generateReminders', () => {
  it('creates nothing when nothing is due', async () => {
    const result = await generateReminders();
    expect(result).toEqual({ created: 0 });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('creates a PM reminder when within lead days', async () => {
    mocks.query.mockImplementation(async (text: string) => {
      if (/FROM pm_schedules/.test(text))
        return [{ id: 9, task_name: 'Oil Change', next_due_date: new Date('2025-06-13T00:00:00Z'), lead_days: 5, machine_name: 'Compressor' }];
      if (/FROM calibration_records/.test(text)) return [];
      if (/FROM amc_records/.test(text)) return [];
      if (/FROM training_records/.test(text)) return [];
      if (/FROM spare_parts/.test(text)) return [];
      return reminderRoleUsers;
    });

    const result = await generateReminders();
    expect(result.created).toBe(2);
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notifications'),
      expect.arrayContaining([1, 'PM Reminder', expect.stringContaining('Oil Change'), 'pm_reminder', '/pm']),
    );
  });

  it('creates no PM reminder when outside lead window (too far out)', async () => {
    mocks.query.mockImplementation(async (text: string) => {
      if (/FROM pm_schedules/.test(text))
        return [{ id: 9, task_name: 'Oil Change', next_due_date: new Date('2025-06-20T00:00:00Z'), lead_days: 5, machine_name: 'Compressor' }];
      return [];
    });

    const result = await generateReminders();
    expect(result.created).toBe(0);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('skips a due PM when a matching notification already exists (idempotency)', async () => {
    mocks.query.mockImplementation(async (text: string) => {
      if (/FROM pm_schedules/.test(text))
        return [{ id: 9, task_name: 'Oil Change', next_due_date: new Date('2025-06-13T00:00:00Z'), lead_days: 5, machine_name: 'Compressor' }];
      return reminderRoleUsers;
    });
    mocks.queryOne.mockResolvedValue({ id: 100 });

    const result = await generateReminders();
    expect(result.created).toBe(0);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('creates low-stock notifications for parts below threshold', async () => {
    mocks.query.mockImplementation(async (text: string, params?: any[]) => {
      if (/FROM spare_parts/.test(text))
        return [{ part_code: 'SP-01', part_name: 'Bearing', current_qty: 2, min_threshold: 5, unit: 'pcs' }];
      if (/role = ANY/.test(text)) {
        // reminder query includes EHS_OFFICER; low-stock query does not
        return (params ?? []).includes('EHS_OFFICER') ? [] : stockRoleUsers;
      }
      return [];
    });

    const result = await generateReminders();
    expect(result.created).toBe(1);
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notifications'),
      expect.arrayContaining([1, 'Low Stock Alert', expect.stringContaining('SP-01'), 'low_stock', '/inventory']),
    );
  });
});
