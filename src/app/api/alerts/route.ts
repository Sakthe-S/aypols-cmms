import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';

export async function GET(req: NextRequest) {
  const allParts = await query<{
    id: number; part_code: string; part_name: string;
    current_qty: number; min_threshold: number;
  }>(`SELECT id, part_code, part_name, current_qty, min_threshold FROM spare_parts`);
  const lowStockParts = allParts.filter(p => p.current_qty <= p.min_threshold);

  const futureCutoff = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const upcomingPm = await query(
    `SELECT ps.*, m.machine_name
     FROM pm_schedules ps
     JOIN machines m ON m.id = ps.machine_id
     WHERE ps.is_active = true AND ps.next_due_date <= $1
     ORDER BY ps.next_due_date ASC`,
    [futureCutoff]
  );

  const upcomingCalibration = await query(
    `SELECT cr.*, m.machine_name
     FROM calibration_records cr
     JOIN machines m ON m.id = cr.machine_id
     WHERE cr.is_active = true AND cr.next_due_date <= $1
     ORDER BY cr.next_due_date ASC`,
    [futureCutoff]
  );

  const overdueTraining = await query(
    `SELECT * FROM training_records
     WHERE is_active = true AND next_due_date < NOW()`
  );

  // Auto-generate notifications for low stock
  for (const part of lowStockParts) {
    const existing = await queryOne(
      `SELECT id FROM notifications
       WHERE type = 'low_stock'
         AND message ILIKE $1
         AND created_at >= $2
       LIMIT 1`,
      [`%${part.part_code}%`, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]
    );
    if (!existing) {
      const supervisors = await query<{ id: number }>(
        `SELECT id FROM users WHERE role = ANY($1)`,
        [['SUPERVISOR', 'STORE_ADMIN', 'ADMIN']]
      );
      for (const user of supervisors) {
        await execute(
          `INSERT INTO notifications (user_id, title, message, type, link_url)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            user.id,
            'Low Stock Alert',
            `${part.part_name} (${part.part_code}) is below minimum threshold. Current: ${part.current_qty}, Min: ${part.min_threshold}`,
            'low_stock',
            `/inventory/${part.id}`,
          ]
        );
      }
    }
  }

  return NextResponse.json({
    lowStock: lowStockParts.length,
    upcomingPm: upcomingPm.length,
    upcomingCalibration: upcomingCalibration.length,
    overdueTraining: overdueTraining.length,
  });
}