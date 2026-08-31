import { query, queryOne, execute, toCamel } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { formatCurrency, getStatusColor, getPriorityColor, getRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import {
  Ticket,
  Package,
  AlertTriangle,
  Wrench,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Calendar,
  Shield,
} from 'lucide-react';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  // ── Reminder Engine: generate notifications for upcoming PMs, calibrations, AMCs, and training ──
  const now = new Date();
  const notifUsers = await query<{ id: number }>(
    `SELECT DISTINCT id FROM users WHERE role = ANY($1)`,
    [['SUPERVISOR', 'ADMIN', 'EHS_OFFICER', 'STORE_ADMIN']]
  );
  const supervisorIds = notifUsers.map(u => u.id);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // PM reminders
  const duePms = await query<{ id: number; task_name: string; next_due_date: Date | null; lead_days: number; machine_name: string }>(
    `SELECT ps.id, ps.task_name, ps.next_due_date, ps.lead_days, m.machine_name
     FROM pm_schedules ps JOIN machines m ON m.id = ps.machine_id
     WHERE ps.is_active = true AND ps.next_due_date IS NOT NULL`
  );
  for (const pm of duePms) {
    if (!pm.next_due_date) continue;
    const msUntilDue = pm.next_due_date.getTime() - now.getTime();
    const daysUntilDue = msUntilDue / (1000 * 60 * 60 * 24);
    if (daysUntilDue <= pm.lead_days && daysUntilDue >= -30) {
      const existing = await queryOne(
        `SELECT id FROM notifications
         WHERE type = 'pm_reminder' AND message ILIKE $1 AND created_at >= $2 LIMIT 1`,
        [`%${pm.task_name}%`, dayAgo]
      );
      if (!existing) {
        for (const uid of supervisorIds) {
          await execute(
            `INSERT INTO notifications (user_id, title, message, type, link_url)
             VALUES ($1, $2, $3, $4, $5)`,
            [uid, 'PM Reminder', `${pm.machine_name} - ${pm.task_name} due on ${pm.next_due_date.toLocaleDateString('en-IN')}`, 'pm_reminder', '/pm']
          );
        }
      }
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
      const existing = await queryOne(
        `SELECT id FROM notifications
         WHERE type = 'calibration_reminder' AND message ILIKE $1 AND created_at >= $2 LIMIT 1`,
        [`%${cal.instrument_name}%`, dayAgo]
      );
      if (!existing) {
        for (const uid of supervisorIds) {
          await execute(
            `INSERT INTO notifications (user_id, title, message, type, link_url)
             VALUES ($1, $2, $3, $4, $5)`,
            [uid, 'Calibration Due', `${cal.machine_name || 'Unknown'} - ${cal.instrument_name} calibration due on ${cal.next_due_date.toLocaleDateString('en-IN')}`, 'calibration_reminder', '/pm']
          );
        }
      }
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
      const existing = await queryOne(
        `SELECT id FROM notifications
         WHERE type = 'amc_reminder' AND message ILIKE $1 AND created_at >= $2 LIMIT 1`,
        [`%${amc.vendor_name}%`, dayAgo]
      );
      if (!existing) {
        for (const uid of supervisorIds) {
          await execute(
            `INSERT INTO notifications (user_id, title, message, type, link_url)
             VALUES ($1, $2, $3, $4, $5)`,
            [uid, 'AMC Service Due', `${amc.machine_name || 'Unknown'} - AMC service with ${amc.vendor_name} due on ${amc.next_service_date.toLocaleDateString('en-IN')}`, 'amc_reminder', '/pm']
          );
        }
      }
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
      const existing = await queryOne(
        `SELECT id FROM notifications
         WHERE type = 'training_reminder' AND message ILIKE $1 AND created_at >= $2 LIMIT 1`,
        [`%${tr.training_name}%`, dayAgo]
      );
      if (!existing) {
        for (const uid of supervisorIds) {
          await execute(
            `INSERT INTO notifications (user_id, title, message, type, link_url)
             VALUES ($1, $2, $3, $4, $5)`,
            [uid, 'Training Reminder', `${tr.training_name} (${tr.training_type}) due on ${tr.next_due_date.toLocaleDateString('en-IN')}`, 'training_reminder', '/ehs']
          );
        }
      }
    }
  }

  // Low-stock notifications
  const lowStockRecipients = await query<{ id: number }>(
    `SELECT id FROM users WHERE role = ANY($1)`,
    [['SUPERVISOR', 'STORE_ADMIN', 'ADMIN']]
  );
  const lowStockRecipientIds = lowStockRecipients.map(u => u.id);
  const lowStockPartsAll = await query<{ part_code: string; part_name: string; current_qty: number; min_threshold: number; unit: string }>(
    `SELECT part_code, part_name, current_qty, min_threshold, unit
     FROM spare_parts WHERE current_qty <= min_threshold`
  );
  for (const part of lowStockPartsAll) {
    const existing = await queryOne(
      `SELECT id FROM notifications
       WHERE type = 'low_stock' AND message ILIKE $1 AND created_at >= $2 LIMIT 1`,
      [`%${part.part_code}%`, dayAgo]
    );
    if (!existing) {
      for (const uid of lowStockRecipientIds) {
        await execute(
          `INSERT INTO notifications (user_id, title, message, type, link_url)
           VALUES ($1, $2, $3, $4, $5)`,
          [uid, 'Low Stock Alert', `${part.part_name} (${part.part_code}) is below minimum threshold. Current: ${part.current_qty} ${part.unit}, Min: ${part.min_threshold}`, 'low_stock', '/inventory']
        );
      }
    }
  }

  // ── Dashboard Data ──
  const monthAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const [
    openTickets,
    inProgressTickets,
    closedTickets,
    totalMachines,
    lowStockPartsRaw,
    upcomingPms,
    recentTicketsRaw,
    lowStockItemIds,
    upcomingPmRaw,
  ] = await Promise.all([
    queryOne<{ count: number }>(`SELECT count(*)::int AS count FROM maintenance_tickets WHERE status IN ('open', 'allocated')`),
    queryOne<{ count: number }>(`SELECT count(*)::int AS count FROM maintenance_tickets WHERE status = 'in_progress'`),
    queryOne<{ count: number }>(`SELECT count(*)::int AS count FROM maintenance_tickets WHERE status IN ('verified', 'closed')`),
    queryOne<{ count: number }>(`SELECT count(*)::int AS count FROM machines`),
    queryOne<{ count: number }>(`SELECT count(*)::int AS count FROM spare_parts WHERE current_qty <= min_threshold`),
    queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM pm_schedules
       WHERE next_due_date <= $1 AND is_active = true`,
      [monthAhead]
    ),
    query<Record<string, unknown>>(
      `SELECT t.id, t.ticket_number, t.status, t.priority, t.category, t.created_at,
              m.machine_name, u.name AS assigned_to_name
       FROM maintenance_tickets t
       LEFT JOIN machines m ON m.id = t.machine_id
       LEFT JOIN users u ON u.id = t.assigned_to_id
       ORDER BY t.created_at DESC LIMIT 5`
    ),
    query<{ id: number }>(
      `SELECT id FROM spare_parts WHERE current_qty <= min_threshold ORDER BY current_qty ASC LIMIT 5`
    ),
    query<Record<string, unknown>>(
      `SELECT ps.id, ps.task_name, ps.next_due_date, ps.frequency, m.machine_name
       FROM pm_schedules ps JOIN machines m ON m.id = ps.machine_id
       WHERE ps.is_active = true
       ORDER BY ps.next_due_date ASC NULLS LAST
       LIMIT 5`
    ),
  ]);

  const lowStockParts = Number(lowStockPartsRaw?.count || 0);

  const lowStockItemIdsArr = lowStockItemIds.map(r => Number(r.id));
  const lowStockItems = lowStockItemIdsArr.length > 0
    ? await query<Record<string, unknown>>(
        `SELECT * FROM spare_parts WHERE id = ANY($1) ORDER BY current_qty ASC`,
        [lowStockItemIdsArr]
      )
    : [];

  const totalLifetimeCost = await queryOne<{ total: number | null }>(
    `SELECT COALESCE(SUM(lifetime_maintenance_cost), 0)::float8 AS total FROM machines`
  );

  const recentTickets: any[] = recentTicketsRaw.map(row => {
    const r = toCamel(row);
    return {
      ...r,
      ticketNumber: r.ticketNumber as string,
      machine: { machineName: r.machineName },
    };
  });

  const lowStockItemsCamel = lowStockItems.map(item => toCamel(item));

  const upcomingPmList: any[] = upcomingPmRaw.map(row => {
    const r = toCamel(row);
    return {
      ...r,
      machine: { machineName: r.machineName },
    };
  });

  const stats = [
    {
      label: 'Open Tickets',
      value: openTickets?.count || 0,
      icon: Ticket,
      color: 'bg-blue-500',
      href: '/tickets',
    },
    {
      label: 'In Progress',
      value: inProgressTickets?.count || 0,
      icon: Clock,
      color: 'bg-orange-500',
      href: '/tickets',
    },
    {
      label: 'Completed',
      value: closedTickets?.count || 0,
      icon: CheckCircle2,
      color: 'bg-green-500',
      href: '/tickets',
    },
    {
      label: 'Total Machines',
      value: totalMachines?.count || 0,
      icon: Wrench,
      color: 'bg-purple-500',
      href: '/machines',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back, {session?.user?.name}</p>
        </div>
        <Link href="/tickets/new" className="btn-primary">
          <Ticket className="mr-2 h-4 w-4" />
          Raise Ticket
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`rounded-xl ${stat.color} p-3 text-white`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Cost summary + Alerts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Lifetime maintenance cost */}
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Lifetime Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(totalLifetimeCost?.total || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Low stock alerts */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
                <p className="text-2xl font-bold text-gray-900">{lowStockItemsCamel.length}</p>
              </div>
            </div>
            <Link href="/inventory" className="text-sm text-primary-600 hover:underline">
              View All
            </Link>
          </div>
        </div>

        {/* Upcoming PMs */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-50 p-2">
                <Calendar className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Upcoming PMs (30d)</p>
                <p className="text-2xl font-bold text-gray-900">{upcomingPms?.count || 0}</p>
              </div>
            </div>
            <Link href="/pm" className="text-sm text-primary-600 hover:underline">
              View All
            </Link>
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Tickets */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Tickets</h3>
            <Link href="/tickets" className="text-sm text-primary-600 hover:underline">
              View All
            </Link>
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">Ticket</th>
                  <th className="table-header px-6 py-3">Machine</th>
                  <th className="table-header px-6 py-3">Status</th>
                  <th className="table-header px-6 py-3">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-3">
                      <Link href={`/tickets/${ticket.id}`} className="font-medium text-primary-600 hover:underline">
                        {ticket.ticketNumber}
                      </Link>
                      <p className="text-xs text-gray-500">{ticket.category}</p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-700">
                      {ticket.machine.machineName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3">
                      <span className={`badge ${getStatusColor(ticket.status)}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3">
                      <span className={`badge ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentTickets.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                      No tickets yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {recentTickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="block rounded-lg border border-gray-100 p-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-primary-600">{ticket.ticketNumber}</p>
                    <p className="truncate text-sm text-gray-700">{ticket.machine.machineName}</p>
                  </div>
                  <span className={`badge shrink-0 ${getStatusColor(ticket.status)}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                  <span className="text-xs text-gray-500">{ticket.category}</span>
                </div>
              </Link>
            ))}
            {recentTickets.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-500">No tickets yet</p>
            )}
          </div>
        </div>

        {/* Low Stock + Upcoming PMs */}
        <div className="space-y-6">
          {/* Low Stock */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
              <Link href="/inventory" className="text-sm text-primary-600 hover:underline">
                View All
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {lowStockItemsCamel.map((part) => (
                <div key={part.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{part.partName}</p>
                    <p className="text-xs text-gray-500">{part.partCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600">{part.currentQty} {part.unit}</p>
                    <p className="text-xs text-gray-500">Min: {part.minThreshold}</p>
                  </div>
                </div>
              ))}
              {lowStockItemsCamel.length === 0 && (
                <p className="px-6 py-4 text-center text-sm text-gray-500">All stock levels OK</p>
              )}
            </div>
          </div>

          {/* Upcoming PMs */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming PM Tasks</h3>
              <Link href="/pm" className="text-sm text-primary-600 hover:underline">
                View All
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {upcomingPmList.map((pm) => (
                <div key={pm.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{pm.taskName}</p>
                    <p className="text-xs text-gray-500">{pm.machine.machineName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-700">
                      {pm.nextDueDate ? getRelativeTime(pm.nextDueDate) : 'Not set'}
                    </p>
                    <p className="text-xs text-gray-500">{pm.frequency}</p>
                  </div>
                </div>
              ))}
              {upcomingPmList.length === 0 && (
                <p className="px-6 py-4 text-center text-sm text-gray-500">No upcoming PM tasks</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
