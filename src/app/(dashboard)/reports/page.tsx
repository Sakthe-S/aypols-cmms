import { query, toCamel } from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileText, TrendingUp, BarChart3 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const machineRows = await query<Record<string, unknown>>(
    `SELECT m.*,
            (SELECT count(*)::int FROM maintenance_tickets t WHERE t.machine_id = m.id) AS ticket_count,
            (SELECT COALESCE(SUM(t.total_repair_cost), 0)::float8 FROM maintenance_tickets t
             WHERE t.machine_id = m.id AND t.total_repair_cost IS NOT NULL) AS tickets_total_cost
     FROM machines m
     ORDER BY m.lifetime_maintenance_cost DESC`
  );
  const machines = machineRows.map(row => {
    const r = toCamel(row) as any;
    return {
      ...r,
      _count: { tickets: Number(r.ticketCount || 0) },
      tickets: [{ totalRepairCost: Number(r.ticketsTotalCost || 0) }],
    };
  });

  const ticketStatsRaw = await query<{ status: string; count: number }>(
    `SELECT status, count(*)::int AS count FROM maintenance_tickets GROUP BY status`
  );
  const ticketStats = ticketStatsRaw.map(r => ({ status: r.status, _count: r.count }));

  const techRows = await query<Record<string, unknown>>(
    `SELECT t.assigned_to_id, u.name AS technician_name, count(*)::int AS count,
            COALESCE(SUM(t.total_repair_cost), 0)::float8 AS total_cost,
            COALESCE(AVG(t.total_repair_cost), 0)::float8 AS avg_repair_cost,
            COALESCE(AVG(t.labor_hours), 0)::float8 AS avg_labor_hours
     FROM maintenance_tickets t
     LEFT JOIN users u ON u.id = t.assigned_to_id
     WHERE t.assigned_to_id IS NOT NULL AND t.total_repair_cost IS NOT NULL
     GROUP BY t.assigned_to_id, u.name
     ORDER BY count DESC
     LIMIT 5`
  );
  const techUsers = techRows.map(r => ({ id: r.assigned_to_id, name: String(r.technician_name || '-') }));
  const topTechnicians = techRows.map(r => ({
    assignedToId: r.assigned_to_id as number,
    _count: Number(r.count),
    _avg: {
      totalRepairCost: Number(r.avg_repair_cost) || null,
      laborHours: Number(r.avg_labor_hours) || null,
    },
  }));

  const partsUsedRows = await query<Record<string, unknown>>(
    `SELECT part_id, count(*)::int AS count,
            COALESCE(SUM(qty), 0)::float8 AS total_qty,
            COALESCE(SUM(total_cost), 0)::float8 AS total_cost
     FROM ticket_spare_parts
     GROUP BY part_id
     ORDER BY total_cost DESC
     LIMIT 10`
  );
  const partsUsedIds = partsUsedRows.map(r => Number(r.part_id));
  const topPartsUsed = partsUsedRows.map(r => ({
    partId: r.part_id as number,
    _count: Number(r.count),
    _sum: { qty: Number(r.total_qty), totalCost: Number(r.total_cost) },
  }));

  const parts = partsUsedIds.length > 0
    ? (await query<Record<string, unknown>>(
        `SELECT * FROM spare_parts WHERE id = ANY($1)`,
        [partsUsedIds]
      )).map(toCamel)
    : [];

  const totalRepairCost = machines.reduce(
    (sum, m) => sum + m.tickets.reduce((ts: number, t: any) => ts + (t.totalRepairCost || 0), 0),
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
                  const totalCost = m.tickets.reduce((s: number, t: any) => s + (t.totalRepairCost || 0), 0);
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
