import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  const openTickets = queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM maintenance_tickets WHERE status IN ('open', 'allocated')`
  );
  const inProgressTickets = queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM maintenance_tickets WHERE status = 'in_progress'`
  );
  const totalMachines = queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM machines`
  );
  const lowStock = queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM spare_parts WHERE current_qty <= min_threshold`
  );
  const lifetimeCost = queryOne<{ total: number | null }>(
    `SELECT COALESCE(SUM(lifetime_maintenance_cost), 0)::float8 AS total FROM machines`
  );
  const recentTickets = query(
    `SELECT t.id, t.ticket_number, t.status, t.priority, t.created_at,
            m.machine_name, u.name AS assigned_to_name
     FROM maintenance_tickets t
     LEFT JOIN machines m ON m.id = t.machine_id
     LEFT JOIN users u ON u.id = t.assigned_to_id
     ORDER BY t.created_at DESC
     LIMIT 5`
  );
  const lowStockItems = query(
    `SELECT * FROM spare_parts WHERE current_qty <= min_threshold ORDER BY current_qty ASC`
  );

  const [openC, inProgC, machC, lowC, lifeC, recT, lowItems] = await Promise.all([
    openTickets, inProgressTickets, totalMachines, lowStock, lifetimeCost, recentTickets, lowStockItems,
  ]);

  const stats = {
    openTickets: openC?.count || 0,
    inProgressTickets: inProgC?.count || 0,
    totalMachines: machC?.count || 0,
    lowStockParts: lowC?.count || 0,
    totalLifetimeCost: { _sum: { lifetimeMaintenanceCost: lifeC?.total || 0 } },
    recentTickets: recT,
    lowStockItems: lowItems.map((item: any) => ({ ...item, currentQty: item.current_qty, minThreshold: item.min_threshold, partName: item.part_name, partCode: item.part_code })),
  };

  return NextResponse.json(stats);
}