import { query, queryOne, execute } from '@/lib/db';

// ─── Scheduled reminder engine ───────────────────────────────────────────────
// Generates idempotent in-app notifications for upcoming PMs, calibrations,
// AMCs, training, and low stock. Intended to run from a scheduled job (cron) so
// reminders fire even when no user loads a page, but also runs on the dashboard
// for redundancy.

export async function generateReminders(): Promise<{ created: number }> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const reminderIds = (await query<{ id: number }>(
    `SELECT DISTINCT id FROM users WHERE role = ANY($1)`,
    [['SUPERVISOR', 'ADMIN', 'EHS_OFFICER', 'STORE_ADMIN']]
  )).map(u => u.id);

  let created = 0;

  async function writeNotification(type: string, title: string, match: string, message: string, link: string, recipientIds: number[]) {
    const existing = await queryOne(
      `SELECT id FROM notifications
       WHERE type = $1 AND message ILIKE $2 AND created_at >= $3 LIMIT 1`,
      [type, `%${match}%`, dayAgo]
    );
    if (existing) return;
    for (const uid of recipientIds) {
      await execute(
        `INSERT INTO notifications (user_id, title, message, type, link_url)
         VALUES ($1, $2, $3, $4, $5)`,
        [uid, title, message, type, link]
      );
      created += 1;
    }
  }

  // PM reminders
  const duePms = await query<{ id: number; task_name: string; next_due_date: Date | null; lead_days: number; machine_name: string }>(
    `SELECT ps.id, ps.task_name, ps.next_due_date, ps.lead_days, m.machine_name
     FROM pm_schedules ps JOIN machines m ON m.id = ps.machine_id
     WHERE ps.is_active = true AND ps.next_due_date IS NOT NULL`
  );
  for (const pm of duePms) {
    if (!pm.next_due_date) continue;
    const daysUntilDue = (pm.next_due_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilDue <= pm.lead_days && daysUntilDue >= -30) {
      await writeNotification('pm_reminder', 'PM Reminder', pm.task_name,
        `${pm.machine_name} - ${pm.task_name} due on ${pm.next_due_date.toLocaleDateString('en-IN')}`, '/pm', reminderIds);
    }
  }

  // Calibration reminders
  const dueCals = await query<{ id: number; instrument_name: string; next_due_date: Date | null; lead_days: number; machine_name: string | null }>(
    `SELECT cr.id, cr.instrument_name, cr.next_due_date, cr.lead_days, m.machine_name
     FROM calibration_records cr LEFT JOIN machines m ON m.id = cr.machine_id
     WHERE cr.is_active = true AND cr.next_due_date IS NOT NULL`
  );
  for (const cal of dueCals) {
    if (!cal.next_due_date) continue;
    const daysUntilDue = (cal.next_due_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilDue <= cal.lead_days && daysUntilDue >= -30) {
      await writeNotification('calibration_reminder', 'Calibration Due', cal.instrument_name,
        `${cal.machine_name || 'Unknown'} - ${cal.instrument_name} calibration due on ${cal.next_due_date.toLocaleDateString('en-IN')}`, '/pm', reminderIds);
    }
  }

  // AMC reminders
  const dueAmcs = await query<{ id: number; vendor_name: string; next_service_date: Date | null; lead_days: number; machine_name: string | null }>(
    `SELECT ar.id, ar.vendor_name, ar.next_service_date, ar.lead_days, m.machine_name
     FROM amc_records ar LEFT JOIN machines m ON m.id = ar.machine_id
     WHERE ar.is_active = true AND ar.next_service_date IS NOT NULL`
  );
  for (const amc of dueAmcs) {
    if (!amc.next_service_date) continue;
    const daysUntilDue = (amc.next_service_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilDue <= amc.lead_days && daysUntilDue >= -30) {
      await writeNotification('amc_reminder', 'AMC Service Due', amc.vendor_name,
        `${amc.machine_name || 'Unknown'} - AMC service with ${amc.vendor_name} due on ${amc.next_service_date.toLocaleDateString('en-IN')}`, '/pm', reminderIds);
    }
  }

  // Training reminders
  const dueTrainings = await query<{ id: number; training_name: string; training_type: string; next_due_date: Date | null; lead_days: number }>(
    `SELECT id, training_name, training_type, next_due_date, lead_days
     FROM training_records WHERE is_active = true AND next_due_date IS NOT NULL`
  );
  for (const tr of dueTrainings) {
    if (!tr.next_due_date) continue;
    const daysUntilDue = (tr.next_due_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilDue <= tr.lead_days && daysUntilDue >= -30) {
      await writeNotification('training_reminder', 'Training Reminder', tr.training_name,
        `${tr.training_name} (${tr.training_type}) due on ${tr.next_due_date.toLocaleDateString('en-IN')}`, '/ehs', reminderIds);
    }
  }

  // Low-stock notifications
  const lowStockParts = await query<{ part_code: string; part_name: string; current_qty: number; min_threshold: number; unit: string }>(
    `SELECT part_code, part_name, current_qty, min_threshold, unit
     FROM spare_parts WHERE current_qty <= min_threshold`
  );
  const lowStockIds = (await query<{ id: number }>(
    `SELECT id FROM users WHERE role = ANY($1)`,
    [['SUPERVISOR', 'STORE_ADMIN', 'ADMIN']]
  )).map(u => u.id);
  for (const part of lowStockParts) {
    await writeNotification('low_stock', 'Low Stock Alert', part.part_code,
      `${part.part_name} (${part.part_code}) is below minimum threshold. Current: ${part.current_qty} ${part.unit}, Min: ${part.min_threshold}`, '/inventory', lowStockIds);
  }

  return { created };
}