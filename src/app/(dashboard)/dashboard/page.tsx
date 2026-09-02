import { query, queryOne, toCamel } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateReminders } from '@/lib/scheduled';
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

  // ── Reminder Engine ──
  // Generate in-app notifications for upcoming PMs, calibrations, AMCs,
  // training, and low stock. This same logic also runs from the scheduled job
  // endpoint (/api/scheduled/run) so reminders fire even when no page is loaded.
  await generateReminders();

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
          <Link key={stat.label} href={stat.href} className="card block p-4 hover:shadow-md transition-shadow">
            <span className="flex items-center justify-between">
              <span>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{stat.value}</p>
              </span>
              <span className={`rounded-xl ${stat.color} p-3 text-white`}>
                <stat.icon className="h-6 w-6" />
              </span>
            </span>
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
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <p className="font-medium text-primary-600">{ticket.ticketNumber}</p>
                    <p className="truncate text-sm text-gray-700">{ticket.machine.machineName}</p>
                  </span>
                  <span className={`badge shrink-0 ${getStatusColor(ticket.status)}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                  <span className="text-xs text-gray-500">{ticket.category}</span>
                </span>
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
