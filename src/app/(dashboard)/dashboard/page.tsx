import prisma from '@/lib/prisma';
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
  const notifUsers = await prisma.user.findMany({ where: { role: { in: ['SUPERVISOR', 'ADMIN', 'EHS_OFFICIER', 'STORE_ADMIN'] } } });
  const supervisorIds = notifUsers.map(u => u.id);

  // PM reminders
  const duePms = await prisma.pmSchedule.findMany({
    where: { isActive: true, nextDueDate: { not: null } },
    include: { machine: true },
  });
  for (const pm of duePms) {
    if (!pm.nextDueDate) continue;
    const msUntilDue = pm.nextDueDate.getTime() - now.getTime();
    const daysUntilDue = msUntilDue / (1000 * 60 * 60 * 24);
    if (daysUntilDue <= pm.leadDays && daysUntilDue >= -30) {
      const existing = await prisma.notification.findFirst({
        where: { type: 'pm_reminder', message: { contains: pm.taskName }, createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      });
      if (!existing) {
        for (const uid of supervisorIds) {
          await prisma.notification.create({
            data: {
              userId: uid,
              title: 'PM Reminder',
              message: `${pm.machine.machineName} - ${pm.taskName} due on ${pm.nextDueDate.toLocaleDateString('en-IN')}`,
              type: 'pm_reminder',
              linkUrl: '/pm',
            },
          });
        }
      }
    }
  }

  // Calibration reminders
  const dueCals = await prisma.calibrationRecord.findMany({ where: { isActive: true, nextDueDate: { not: null } }, include: { machine: true } });
  for (const cal of dueCals) {
    if (!cal.nextDueDate) continue;
    const daysUntilDue = (cal.nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilDue <= cal.leadDays && daysUntilDue >= -30) {
      const existing = await prisma.notification.findFirst({
        where: { type: 'calibration_reminder', message: { contains: cal.instrumentName }, createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      });
      if (!existing) {
        for (const uid of supervisorIds) {
          await prisma.notification.create({
            data: {
              userId: uid,
              title: 'Calibration Due',
              message: `${cal.machine?.machineName || 'Unknown'} - ${cal.instrumentName} calibration due on ${cal.nextDueDate.toLocaleDateString('en-IN')}`,
              type: 'calibration_reminder',
              linkUrl: '/pm',
            },
          });
        }
      }
    }
  }

  // AMC reminders
  const dueAmcs = await prisma.amcRecord.findMany({ where: { isActive: true, nextServiceDate: { not: null } }, include: { machine: true } });
  for (const amc of dueAmcs) {
    if (!amc.nextServiceDate) continue;
    const daysUntilDue = (amc.nextServiceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilDue <= amc.leadDays && daysUntilDue >= -30) {
      const existing = await prisma.notification.findFirst({
        where: { type: 'amc_reminder', message: { contains: amc.vendorName }, createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      });
      if (!existing) {
        for (const uid of supervisorIds) {
          await prisma.notification.create({
            data: {
              userId: uid,
              title: 'AMC Service Due',
              message: `${amc.machine?.machineName || 'Unknown'} - AMC service with ${amc.vendorName} due on ${amc.nextServiceDate.toLocaleDateString('en-IN')}`,
              type: 'amc_reminder',
              linkUrl: '/pm',
            },
          });
        }
      }
    }
  }

  // Training reminders
  const dueTrainings = await prisma.trainingRecord.findMany({ where: { isActive: true, nextDueDate: { not: null } } });
  for (const tr of dueTrainings) {
    if (!tr.nextDueDate) continue;
    const daysUntilDue = (tr.nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilDue <= tr.leadDays && daysUntilDue >= -30) {
      const existing = await prisma.notification.findFirst({
        where: { type: 'training_reminder', message: { contains: tr.trainingName }, createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      });
      if (!existing) {
        for (const uid of supervisorIds) {
          await prisma.notification.create({
            data: {
              userId: uid,
              title: 'Training Reminder',
              message: `${tr.trainingName} (${tr.trainingType}) due on ${tr.nextDueDate.toLocaleDateString('en-IN')}`,
              type: 'training_reminder',
              linkUrl: '/ehs',
            },
          });
        }
      }
    }
  }

  // ── Dashboard Data ──
  const [
    openTickets,
    inProgressTickets,
    closedTickets,
    totalMachines,
    lowStockPartsRaw,
    upcomingPms,
    recentTickets,
    lowStockItemsRaw,
    upcomingPmList,
  ] = await Promise.all([
    prisma.maintenanceTicket.count({ where: { status: { in: ['open', 'allocated'] } } }),
    prisma.maintenanceTicket.count({ where: { status: 'in_progress' } }),
    prisma.maintenanceTicket.count({ where: { status: { in: ['verified', 'closed'] } } }),
    prisma.machine.count(),
    prisma.$queryRawUnsafe<[{count: number}]>(`SELECT COUNT(*) as count FROM spare_parts WHERE current_qty <= min_threshold`),
    prisma.pmSchedule.count({
      where: {
        nextDueDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        isActive: true,
      },
    }),
    prisma.maintenanceTicket.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { machine: true, assignedTo: true },
    }),
    prisma.$queryRawUnsafe<{id: number}[]>(`SELECT id FROM spare_parts WHERE current_qty <= min_threshold ORDER BY current_qty ASC LIMIT 5`),
    prisma.pmSchedule.findMany({
      where: { isActive: true },
      take: 5,
      orderBy: { nextDueDate: 'asc' },
      include: { machine: true },
    }),
  ]);

  const lowStockParts = Number(lowStockPartsRaw[0]?.count || 0);

  const lowStockItemIds = (lowStockItemsRaw as any[]).map((r: any) => Number(r.id));
  const lowStockItems = lowStockItemIds.length > 0
    ? await prisma.sparePart.findMany({ where: { id: { in: lowStockItemIds } }, orderBy: { currentQty: 'asc' } })
    : [];

  const totalLifetimeCost = await prisma.machine.aggregate({
    _sum: { lifetimeMaintenanceCost: true },
  });

  const stats = [
    {
      label: 'Open Tickets',
      value: openTickets,
      icon: Ticket,
      color: 'bg-blue-500',
      href: '/tickets',
    },
    {
      label: 'In Progress',
      value: inProgressTickets,
      icon: Clock,
      color: 'bg-orange-500',
      href: '/tickets',
    },
    {
      label: 'Completed',
      value: closedTickets,
      icon: CheckCircle2,
      color: 'bg-green-500',
      href: '/tickets',
    },
    {
      label: 'Total Machines',
      value: totalMachines,
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
                {formatCurrency(totalLifetimeCost._sum.lifetimeMaintenanceCost || 0)}
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
                <p className="text-2xl font-bold text-gray-900">{lowStockItems.length}</p>
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
                <p className="text-2xl font-bold text-gray-900">{upcomingPms}</p>
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
          <div className="overflow-x-auto">
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
              {lowStockItems.map((part) => (
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
              {lowStockItems.length === 0 && (
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
