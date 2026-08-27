import prisma from '@/lib/prisma';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileText, TrendingUp, BarChart3 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const machines = await prisma.machine.findMany({
    include: {
      _count: { select: { tickets: true } },
      tickets: { where: { totalRepairCost: { not: null } }, select: { totalRepairCost: true } },
    },
    orderBy: { lifetimeMaintenanceCost: 'desc' },
  });

  const ticketStats = await prisma.maintenanceTicket.groupBy({
    by: ['status'],
    _count: true,
  });

  const topTechnicians = await prisma.maintenanceTicket.groupBy({
    by: ['assignedToId'],
    where: { assignedToId: { not: null }, totalRepairCost: { not: null } },
    _count: { _all: true },
    _sum: { totalRepairCost: true },
    _avg: { totalRepairCost: true, laborHours: true },
    orderBy: { _count: { _all: 'desc' } },
    take: 5,
  });

  const techUsers = await prisma.user.findMany({
    where: { id: { in: topTechnicians.map(t => t.assignedToId!) } },
  });

  const topPartsUsed = await prisma.ticketSparePart.groupBy({
    by: ['partId'],
    _sum: { qty: true, totalCost: true },
    _count: true,
    orderBy: { _sum: { totalCost: 'desc' } },
    take: 10,
  });

  const parts = await prisma.sparePart.findMany({
    where: { id: { in: topPartsUsed.map(p => p.partId) } },
  });

  const totalRepairCost = machines.reduce(
    (sum, m) => sum + m.tickets.reduce((ts, t) => ts + (t.totalRepairCost || 0), 0),
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-sm text-gray-500">Maintenance cost, ticket, and inventory analytics</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2"><FileText className="h-5 w-5 text-primary-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Tickets</p>
              <p className="text-xl font-bold">{ticketStats.reduce((s, t) => s + t._count, 0)}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2"><TrendingUp className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Repair Cost</p>
              <p className="text-xl font-bold">{formatCurrency(totalRepairCost)}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-50 p-2"><BarChart3 className="h-5 w-5 text-orange-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Active Machines</p>
              <p className="text-xl font-bold">{machines.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2"><FileText className="h-5 w-5 text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Cost per Ticket (avg)</p>
              <p className="text-xl font-bold">
                {totalRepairCost > 0 ? formatCurrency(totalRepairCost / Math.max(1, ticketStats.find(t => t.status === 'closed')?._count || 1)) : '₹0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Status Distribution */}
      <div className="card p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Ticket Status Distribution</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {ticketStats.map((stat) => (
            <div key={stat.status} className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stat._count}</div>
              <div className="text-sm text-gray-500 capitalize">{stat.status.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Machine-wise Cost */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Machine-wise Maintenance Cost</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">Machine</th>
                  <th className="table-header px-6 py-3">Tickets</th>
                  <th className="table-header px-6 py-3">Avg Cost</th>
                  <th className="table-header px-6 py-3">Lifetime Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {machines.map((m) => {
                  const totalCost = m.tickets.reduce((s, t) => s + (t.totalRepairCost || 0), 0);
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium">{m.machineName}</td>
                      <td className="px-6 py-3">{m._count.tickets}</td>
                      <td className="px-6 py-3">
                        {m._count.tickets > 0 ? formatCurrency(totalCost / m._count.tickets) : '-'}
                      </td>
                      <td className="px-6 py-3 font-semibold text-primary-600">
                        {formatCurrency(m.lifetimeMaintenanceCost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Technicians */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Top Technicians</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">Technician</th>
                  <th className="table-header px-6 py-3">Tickets</th>
                  <th className="table-header px-6 py-3">Avg Cost</th>
                  <th className="table-header px-6 py-3">Avg Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topTechnicians.map((tech) => {
                  const user = techUsers.find(u => u.id === tech.assignedToId);
                  return (
                    <tr key={tech.assignedToId} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium">{user?.name || '-'}</td>
                      <td className="px-6 py-3">{tech._count}</td>
                      <td className="px-6 py-3">
                        {tech._avg.totalRepairCost ? formatCurrency(tech._avg.totalRepairCost) : '-'}
                      </td>
                      <td className="px-6 py-3">
                        {tech._avg.laborHours ? `${tech._avg.laborHours.toFixed(1)}h` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Parts Used */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Most Used / Expensive Parts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header px-6 py-3">Part</th>
                <th className="table-header px-6 py-3">Code</th>
                <th className="table-header px-6 py-3">Times Used</th>
                <th className="table-header px-6 py-3">Total Qty</th>
                <th className="table-header px-6 py-3">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topPartsUsed.map((pu) => {
                const part = parts.find(p => p.id === pu.partId);
                return (
                  <tr key={pu.partId} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">{part?.partName || '-'}</td>
                    <td className="px-6 py-3 text-gray-500">{part?.partCode || '-'}</td>
                    <td className="px-6 py-3">{pu._count}</td>
                    <td className="px-6 py-3">{pu._sum.qty} {part?.unit}</td>
                    <td className="px-6 py-3 font-semibold">{formatCurrency(pu._sum.totalCost || 0)}</td>
                  </tr>
                );
              })}
              {topPartsUsed.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No parts usage data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
