import { query, queryOne, execute, toCamel } from '@/lib/db';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getStatusColor, getPriorityColor, formatDate } from '@/lib/utils';
import { Plus, Search, Filter, Camera } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ConfirmForm from '@/components/ConfirmForm';
import { deleteTicketPhotos } from '@/lib/ticketPhotos';

export const dynamic = 'force-dynamic';

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { status?: string; priority?: string; search?: string };
}) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const canDelete = userRole === 'SUPERVISOR' || userRole === 'ADMIN';
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (searchParams.status && searchParams.status !== 'all') {
    params.push(searchParams.status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (searchParams.priority && searchParams.priority !== 'all') {
    params.push(searchParams.priority);
    conditions.push(`t.priority = $${params.length}`);
  }
  if (searchParams.search) {
    params.push(`%${searchParams.search}%`, `%${searchParams.search}%`, `%${searchParams.search}%`);
    conditions.push(
      `(t.ticket_number ILIKE $${params.length - 2} OR t.issue_description ILIKE $${params.length - 1} OR t.category ILIKE $${params.length})`
    );
  }
  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query<Record<string, unknown>>(
    `SELECT t.*, m.machine_name, r.name AS reported_by_name, a.name AS assigned_to_name
     FROM maintenance_tickets t
     JOIN machines m ON m.id = t.machine_id
     JOIN users r ON r.id = t.reported_by_id
     LEFT JOIN users a ON a.id = t.assigned_to_id
     ${whereSql}
     ORDER BY t.created_at DESC`
  , params);

  const tickets = rows.map(row => {
    const r = toCamel(row);
    return {
      ...r,
      machine: { machineName: r.machineName },
      reportedBy: { name: r.reportedByName },
      assignedTo: r.assignedToName ? { name: r.assignedToName } : null,
    };
  });

  async function deleteTicket(formData: FormData) {
    'use server';
    if (userRole !== 'SUPERVISOR' && userRole !== 'ADMIN') return;
    const ticketId = Number(formData.get('id'));
    const statusRow = await queryOne<{ status: string; photo_paths?: string[] }>(
      `SELECT status, photo_paths FROM maintenance_tickets WHERE id = $1`,
      [ticketId]
    );
    if (!statusRow || statusRow.status !== 'open') return;
    const usedParts = await query<{ part_id: number; qty: number }>(
      `SELECT part_id, qty FROM ticket_spare_parts WHERE ticket_id = $1`,
      [ticketId]
    );
    for (const p of usedParts) {
      await execute(
        `UPDATE spare_parts SET current_qty = current_qty + $1 WHERE id = $2`,
        [p.qty, p.part_id]
      );
    }
    await execute(`DELETE FROM ticket_progress_logs WHERE ticket_id = $1`, [ticketId]);
    await execute(`DELETE FROM safety_checklist_completions WHERE ticket_id = $1`, [ticketId]);
    await execute(`DELETE FROM ticket_spare_parts WHERE ticket_id = $1`, [ticketId]);
    await execute(`DELETE FROM stock_transactions WHERE reference_ticket_id = $1`, [ticketId]);
    await execute(`DELETE FROM notifications WHERE link_url = $1`, [`/tickets/${ticketId}`]);
    await execute(`DELETE FROM maintenance_tickets WHERE id = $1`, [ticketId]);
    await deleteTicketPhotos(statusRow.photo_paths ?? []);
    revalidatePath('/tickets');
    redirect('/tickets');
  }

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

      {/* Tickets Table (desktop) */}
      <div className="card hidden overflow-hidden md:block">
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
                <th className="table-header px-6 py-3">Expected Done</th>
                <th className="table-header px-6 py-3">Date</th>
                <th className="table-header px-6 py-3">Cost</th>
                {canDelete && <th className="table-header px-6 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      {ticket.photoPaths?.length > 0 && (
                        <Link href={`/tickets/${ticket.id}`} className="shrink-0">
                          <img
                            src={ticket.photoPaths[0]}
                            alt="ticket photo"
                            className="h-10 w-10 rounded-md object-cover ring-1 ring-gray-200"
                          />
                        </Link>
                      )}
                      <div>
                        <Link href={`/tickets/${ticket.id}`} className="font-semibold text-primary-600 hover:underline">
                          {ticket.ticketNumber}
                        </Link>
                        <p className="mt-0.5 max-w-xs truncate text-xs text-gray-500">{ticket.issueDescription}</p>
                        {ticket.photoPaths?.length > 1 && (
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-gray-400">
                            <Camera className="h-3 w-3" /> {ticket.photoPaths.length} photos
                          </span>
                        )}
                      </div>
                    </div>
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
                    {ticket.expectedCompletionDate ? formatDate(ticket.expectedCompletionDate) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDate(ticket.reportedDate)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {ticket.totalRepairCost ? `₹${ticket.totalRepairCost.toLocaleString('en-IN')}` : '-'}
                  </td>
                  {canDelete && (
                    <td className="whitespace-nowrap px-6 py-4">
                      {ticket.status === 'open' ? (
                        <ConfirmForm
                          action={deleteTicket}
                          message="Delete this ticket?"
                          className="inline"
                        >
                          <input type="hidden" name="id" value={ticket.id} />
                          <button type="submit" className="btn-danger px-3 py-1 text-xs">
                            Delete
                          </button>
                        </ConfirmForm>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={canDelete ? 11 : 10} className="px-6 py-12 text-center text-sm text-gray-500">
                    No tickets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tickets Cards (mobile) */}
      <div className="space-y-3 md:hidden">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {ticket.photoPaths?.length > 0 && (
                  <Link href={`/tickets/${ticket.id}`} className="shrink-0">
                    <img
                      src={ticket.photoPaths[0]}
                      alt="ticket photo"
                      className="h-12 w-12 rounded-md object-cover ring-1 ring-gray-200"
                    />
                  </Link>
                )}
                <div className="min-w-0">
                  <Link href={`/tickets/${ticket.id}`} className="font-semibold text-primary-600 hover:underline">
                    {ticket.ticketNumber}
                  </Link>
                  <p className="mt-0.5 text-sm text-gray-700">{ticket.machine.machineName}</p>
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">{ticket.issueDescription}</p>
                </div>
              </div>
              <span className={`badge shrink-0 ${getStatusColor(ticket.status)}`}>
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
              <span className="text-xs text-gray-500">{ticket.category || '-'}</span>
              <span className="ml-auto text-xs font-medium text-gray-900">
                {ticket.totalRepairCost ? `₹${ticket.totalRepairCost.toLocaleString('en-IN')}` : '-'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>{ticket.reportedBy.name}</span>
              <span>{formatDate(ticket.reportedDate)}</span>
            </div>
            {ticket.assignedTo && (
              <div className="mt-1 text-xs text-gray-500">Assigned: {ticket.assignedTo.name}</div>
            )}
            {ticket.expectedCompletionDate && (
              <div className="mt-1 text-xs text-gray-500">
                Expected: {formatDate(ticket.expectedCompletionDate)}
              </div>
            )}
            {canDelete && ticket.status === 'open' && (
              <ConfirmForm action={deleteTicket} message="Delete this ticket?" className="mt-2">
                <input type="hidden" name="id" value={ticket.id} />
                <button type="submit" className="btn-danger w-full text-xs">
                  Delete Ticket
                </button>
              </ConfirmForm>
            )}
          </div>
        ))}
        {tickets.length === 0 && (
          <p className="card p-12 text-center text-sm text-gray-500">No tickets found</p>
        )}
      </div>
    </div>
  );
}
