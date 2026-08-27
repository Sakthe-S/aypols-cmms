import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getPriorityColor } from '@/lib/utils';
import Link from 'next/link';
import { Wrench, Clock, DollarSign, Calendar, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MachineDetailPage({ params }: { params: { id: string } }) {
  const machineId = Number(params.id);
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: {
      tickets: {
        orderBy: { reportedDate: 'desc' },
        take: 10,
        include: { assignedTo: true },
      },
      pmSchedules: { where: { isActive: true } },
      amcRecords: { where: { isActive: true } },
      calibrationRecords: { where: { isActive: true } },
      _count: { select: { tickets: true } },
    },
  });

  if (!machine) notFound();

  const costAgg = await prisma.maintenanceTicket.aggregate({
    where: { machineId, totalRepairCost: { not: null } },
    _sum: { totalRepairCost: true },
    _avg: { totalRepairCost: true },
    _count: true,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{machine.machineName}</h1>
          <span className={`badge ${getStatusColor(machine.currentStatus)}`}>
            {machine.currentStatus}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {machine.serialNumber} &middot; {machine.department} &middot; {machine.location}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <Wrench className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Tickets</p>
              <p className="text-xl font-bold">{machine._count.tickets}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Lifetime Cost</p>
              <p className="text-xl font-bold">{formatCurrency(machine.lifetimeMaintenanceCost)}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-50 p-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Avg Repair Cost</p>
              <p className="text-xl font-bold">
                {costAgg._avg.totalRepairCost ? formatCurrency(costAgg._avg.totalRepairCost) : '-'}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-50 p-2">
              <Calendar className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Next PM</p>
              <p className="text-lg font-bold">
                {machine.pmSchedules[0]?.nextDueDate
                  ? formatDate(machine.pmSchedules[0].nextDueDate)
                  : 'Not scheduled'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Machine Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Machine Information</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Manufacturer</span>
              <p className="font-medium">{machine.manufacturer || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">Model</span>
              <p className="font-medium">{machine.model || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">Installation Date</span>
              <p className="font-medium">{machine.installationDate ? formatDate(machine.installationDate) : '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">Last Service</span>
              <p className="font-medium">{machine.lastServiceDate ? formatDate(machine.lastServiceDate) : '-'}</p>
            </div>
          </div>
        </div>

        {/* Schedules */}
        <div className="space-y-4">
          {machine.pmSchedules.length > 0 && (
            <div className="card p-6">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">PM Schedules</h3>
              <div className="space-y-2">
                {machine.pmSchedules.map((pm) => (
                  <div key={pm.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">{pm.taskName}</span>
                    <span className="text-gray-500">{pm.frequency} &middot; Due: {pm.nextDueDate ? formatDate(pm.nextDueDate) : '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {machine.amcRecords.length > 0 && (
            <div className="card p-6">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">AMC Contracts</h3>
              <div className="space-y-2">
                {machine.amcRecords.map((amc) => (
                  <div key={amc.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">{amc.vendorName}</span>
                    <span className="text-gray-500">Until {formatDate(amc.endDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Service History */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Service History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header px-6 py-3">Ticket</th>
                <th className="table-header px-6 py-3">Date</th>
                <th className="table-header px-6 py-3">Technician</th>
                <th className="table-header px-6 py-3">Status</th>
                <th className="table-header px-6 py-3">Priority</th>
                <th className="table-header px-6 py-3">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {machine.tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <Link href={`/tickets/${ticket.id}`} className="font-medium text-primary-600 hover:underline">
                      {ticket.ticketNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-3">{formatDate(ticket.reportedDate)}</td>
                  <td className="px-6 py-3">{ticket.assignedTo?.name || '-'}</td>
                  <td className="px-6 py-3">
                    <span className={`badge ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`badge ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-medium">
                    {ticket.totalRepairCost ? formatCurrency(ticket.totalRepairCost) : '-'}
                  </td>
                </tr>
              ))}
              {machine.tickets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No service history
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
