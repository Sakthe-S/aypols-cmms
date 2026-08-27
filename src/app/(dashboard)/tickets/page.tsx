import prisma from '@/lib/prisma';
import Link from 'next/link';
import { getStatusColor, getPriorityColor, formatDate } from '@/lib/utils';
import { Plus, Search, Filter } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { status?: string; priority?: string; search?: string };
}) {
  const where: any = {};
  if (searchParams.status && searchParams.status !== 'all') {
    where.status = searchParams.status;
  }
  if (searchParams.priority && searchParams.priority !== 'all') {
    where.priority = searchParams.priority;
  }
  if (searchParams.search) {
    where.OR = [
      { ticketNumber: { contains: searchParams.search } },
      { issueDescription: { contains: searchParams.search } },
      { category: { contains: searchParams.search } },
    ];
  }

  const tickets = await prisma.maintenanceTicket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { machine: true, reportedBy: true, assignedTo: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Tickets</h1>
          <p className="text-sm text-gray-500">{tickets.length} total tickets</p>
        </div>
        <Link href="/tickets/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Raise Ticket
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <form className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                name="search"
                placeholder="Search tickets..."
                defaultValue={searchParams.search}
                className="input-field pl-10"
              />
            </div>
          </div>
          <select name="status" defaultValue={searchParams.status || 'all'} className="input-field w-auto">
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="allocated">Allocated</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="verified">Verified</option>
            <option value="closed">Closed</option>
          </select>
          <select name="priority" defaultValue={searchParams.priority || 'all'} className="input-field w-auto">
            <option value="all">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <button type="submit" className="btn-secondary">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </button>
        </form>
      </div>

      {/* Tickets Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header px-6 py-3">Ticket #</th>
                <th className="table-header px-6 py-3">Machine</th>
                <th className="table-header px-6 py-3">Category</th>
                <th className="table-header px-6 py-3">Priority</th>
                <th className="table-header px-6 py-3">Status</th>
                <th className="table-header px-6 py-3">Reported By</th>
                <th className="table-header px-6 py-3">Assigned To</th>
                <th className="table-header px-6 py-3">Date</th>
                <th className="table-header px-6 py-3">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <Link href={`/tickets/${ticket.id}`} className="font-semibold text-primary-600 hover:underline">
                      {ticket.ticketNumber}
                    </Link>
                    <p className="mt-0.5 max-w-xs truncate text-xs text-gray-500">{ticket.issueDescription}</p>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                    {ticket.machine.machineName}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                    {ticket.category || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`badge ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                    {ticket.reportedBy.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                    {ticket.assignedTo?.name || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDate(ticket.reportedDate)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {ticket.totalRepairCost ? `₹${ticket.totalRepairCost.toLocaleString('en-IN')}` : '-'}
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-gray-500">
                    No tickets found
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
