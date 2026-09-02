import { query, queryOne, execute, withTransaction, toCamel } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { formatCurrency, formatDateTime, getStatusColor, getPriorityColor } from '@/lib/utils';
import ConfirmForm from '@/components/ConfirmForm';
import TicketPhotos from '@/components/TicketPhotos';
import { deleteTicketPhotos } from '@/lib/ticketPhotos';
import { isSupervisor, isAdmin } from '@/lib/roles';
import {
  Clock,
  Wrench,
  User,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Package,
  Plus,
  MessageSquare,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type TicketRow = Record<string, unknown>;

function buildTicket(row: TicketRow) {
  const r = toCamel(row);
  return {
    ...r,
    machine: { ...(row['machine_machine_id'] != null ? { id: row['machine_machine_id'] } : {}), machineName: r.machineMachineName },
    reportedBy: { name: r.reporterName },
    assignedTo: row['assigned_name'] != null ? { id: row['assigned_id'], name: r.assignedName } : null,
    closureVerifiedBy: row['verifier_name'] != null ? { name: r.verifierName } : null,
  };
}

export default async function TicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = Number((session?.user as any)?.id);
  const ticketId = Number(params.id);

  const ticketRow = await queryOne<TicketRow>(
    `SELECT t.*,
            m.machine_name AS machine_machine_name, m.id AS machine_machine_id,
            r.name AS reporter_name,
            a.name AS assigned_name, a.id AS assigned_id,
            v.name AS verifier_name
     FROM maintenance_tickets t
     JOIN machines m ON m.id = t.machine_id
     JOIN users r ON r.id = t.reported_by_id
     LEFT JOIN users a ON a.id = t.assigned_to_id
     LEFT JOIN users v ON v.id = t.closure_verified_by_id
     WHERE t.id = $1`,
    [ticketId]
  );

  if (!ticketRow) notFound();

  const ticket = buildTicket(ticketRow) as any & {
    sparePartsUsed: any[];
    progressLogs: any[];
  };

  const sparePartsRows = await query<Record<string, unknown>>(
    `SELECT tsp.*, p.part_name, p.part_code, p.unit
     FROM ticket_spare_parts tsp
     JOIN spare_parts p ON p.id = tsp.part_id
     WHERE tsp.ticket_id = $1
     ORDER BY tsp.created_at DESC`,
    [ticketId]
  );
  ticket.sparePartsUsed = sparePartsRows.map(row => ({
    ...toCamel(row),
    part: { partName: row['part_name'], partCode: row['part_code'], unit: row['unit'] },
  }));

  const logRows = await query<Record<string, unknown>>(
    `SELECT l.*, u.name AS user_name
     FROM ticket_progress_logs l
     JOIN users u ON u.id = l.user_id
     WHERE l.ticket_id = $1
     ORDER BY l.created_at DESC`,
    [ticketId]
  );
  ticket.progressLogs = logRows.map(row => ({
    ...toCamel(row),
    user: { name: row['user_name'] },
  }));

  const spareParts = (await query<Record<string, unknown>>(
    `SELECT * FROM spare_parts ORDER BY part_name ASC`
  )).map(toCamel);

  const technicians = (await query<Record<string, unknown>>(
    `SELECT * FROM users WHERE role = ANY($1) ORDER BY name ASC`,
    [['TECHNICIAN', 'SUPERVISOR']]
  )).map(toCamel);

  const defaultLaborRateRow = await queryOne<{ default_labor_rate: number | null }>(
    `SELECT default_labor_rate FROM app_config ORDER BY id LIMIT 1`
  );
  const defaultLaborRate = Number(defaultLaborRateRow?.default_labor_rate || 0);

  // Safety checklist gate
  const applicableChecklist = ticket.category
    ? await queryOne<any>(
        `SELECT * FROM safety_checklists WHERE job_type = $1 AND is_active = true LIMIT 1`,
        [ticket.category]
      )
    : null;

  // Null-safe snapshot for server-action argument binding (avoids eager
  // evaluation of applicableChecklist.checklist_items when the checklist
  // or its items are missing, which otherwise crashes page render).
  const checklistItems: string[] = applicableChecklist
    ? (() => {
        try {
          const parsed = JSON.parse(applicableChecklist.checklist_items as string);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
    : [];
  const hasChecklistItems = checklistItems.length > 0;
  const applicableChecklistId = applicableChecklist ? applicableChecklist.id : null;

  const hasApprovedChecklist = applicableChecklist
    ? await queryOne<{ id: number }>(
        `SELECT id FROM safety_checklist_completions
         WHERE checklist_id = $1 AND ticket_id = $2 AND is_approved = true
         ORDER BY approved_at DESC NULLS LAST LIMIT 1`,
        [applicableChecklist.id, ticketId]
      )
    : null;

  const hasPendingChecklist = applicableChecklist
    ? await queryOne<{ id: number }>(
        `SELECT id FROM safety_checklist_completions
         WHERE checklist_id = $1 AND ticket_id = $2 AND is_approved = false AND override_by_id IS NULL
         ORDER BY completed_at DESC LIMIT 1`,
        [applicableChecklist.id, ticketId]
      )
    : null;

  const canAddParts = ['in_progress', 'allocated'].includes(ticket.status);
  const canAddNotes = ['in_progress', 'allocated', 'completed'].includes(ticket.status);
  const isOpen = ['open', 'allocated', 'in_progress', 'completed'].includes(ticket.status);
  const isAssignedTechnician = ticket.assignedToId === userId;
  const isSupervisorUser = isSupervisor(userRole);
  const isAdminUser = isAdmin(userRole);

  async function allocateTicket(formData: FormData) {
    'use server';
    if (userRole !== 'SUPERVISOR' && userRole !== 'ADMIN') return;
    const assignedToId = Number(formData.get('assignedToId'));
    const expectedCompletionDate = formData.get('expectedCompletionDate') as string || null;
    await withTransaction(async (tx) => {
      await tx.query(
        `UPDATE maintenance_tickets SET assigned_to_id = $1, status = 'allocated', allocated_date = NOW(), expected_completion_date = COALESCE($3, expected_completion_date) WHERE id = $2`,
        [assignedToId, ticketId, expectedCompletionDate || null]
      );
      await tx.query(
        `INSERT INTO ticket_progress_logs (ticket_id, user_id, notes, log_type) VALUES ($1, $2, $3, $4)`,
        [ticketId, userId, 'Ticket allocated to technician', 'status_change']
      );
      await tx.query(
        `INSERT INTO notifications (user_id, title, message, type, link_url)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          assignedToId,
          'Ticket Assigned',
          `${ticket.ticketNumber} - ${ticket.machine.machineName}: ${String(ticket.issueDescription || '').slice(0, 120)}`,
          'ticket_assigned',
          `/tickets/${ticketId}`,
        ]
      );
      const assignedUser = await tx.query<{ name: string }>(
        `SELECT name FROM users WHERE id = $1`,
        [assignedToId]
      );
      const assignedName = assignedUser.rows[0]?.name || 'a technician';
      const allocationMessage = `${ticket.ticketNumber} allocated to ${assignedName}: ${String(ticket.issueDescription || '').slice(0, 120)}`;
      const supervisorRows = await tx.query<{ id: number }>(
        `SELECT id FROM users WHERE role IN ('SUPERVISOR', 'ADMIN') AND id <> $1 AND is_active = true`,
        [assignedToId]
      );
      for (const sup of supervisorRows.rows) {
        await tx.query(
          `INSERT INTO notifications (user_id, title, message, type, link_url)
           VALUES ($1, $2, $3, $4, $5)`,
          [sup.id, 'Ticket Allocated', allocationMessage, 'ticket_assigned', `/tickets/${ticketId}`]
        );
      }
    });
    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function startWork() {
    'use server';
    if (!isAssignedTechnician) return;
    if (ticket.status !== 'allocated') return;

    const needChecklist = hasChecklistItems;
    if (needChecklist) {
      const approval = await queryOne<{ id: number }>(
        `SELECT id FROM safety_checklist_completions
         WHERE ticket_id = $1 AND is_approved = true
         ORDER BY approved_at DESC NULLS LAST LIMIT 1`,
        [ticketId]
      );
      if (!approval) return;
    }

    await withTransaction(async (tx) => {
      await tx.query(
        `UPDATE maintenance_tickets SET status = 'in_progress', start_time = NOW() WHERE id = $1 AND assigned_to_id = $2`,
        [ticketId, userId]
      );
      await tx.query(
        `INSERT INTO ticket_progress_logs (ticket_id, user_id, notes, log_type) VALUES ($1, $2, $3, $4)`,
        [ticketId, userId, 'Work started', 'status_change']
      );
    });
    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function completeSafetyChecklist(formData: FormData) {
    'use server';
    if (!isAssignedTechnician) return;
    if (!hasChecklistItems) return;
    const items = checklistItems;
    const responses = items.map((item: string, i: number) => ({
      item,
      checked: formData.get(`check_${i}`) === 'on',
      notes: (formData.get(`note_${i}`) as string) || '',
    }));
    const allChecked = responses.every((r: any) => r.checked);

    await withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO safety_checklist_completions (checklist_id, ticket_id, completed_by_id, is_approved, responses)
         VALUES ($1, $2, $3, $4, $5)`,
        [applicableChecklistId, ticketId, userId, false, JSON.stringify(responses)]
      );

      await tx.query(
        `INSERT INTO ticket_progress_logs (ticket_id, user_id, notes, log_type) VALUES ($1, $2, $3, $4)`,
        [
          ticketId,
          userId,
          `Safety checklist submitted: ${allChecked ? 'All items passed - awaiting supervisor approval' : 'Some items failed - requires supervisor override'}`,
          'status_change',
        ]
      );
    });

    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function approveSafetyChecklist() {
    'use server';
    if (!isSupervisorUser && !isAdminUser) return;

    await withTransaction(async (tx) => {
      await tx.query(
        `UPDATE safety_checklist_completions
         SET is_approved = true, supervisor_id = $1, approved_at = NOW()
         WHERE ticket_id = $2
           AND is_approved = false
           AND override_by_id IS NULL`,
        [userId, ticketId]
      );
      await tx.query(
        `INSERT INTO ticket_progress_logs (ticket_id, user_id, notes, log_type) VALUES ($1, $2, $3, $4)`,
        [ticketId, userId, 'Safety checklist approved by supervisor', 'status_change']
      );
    });

    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function overrideSafetyChecklist(formData: FormData) {
    'use server';
    if (!isSupervisorUser && !isAdminUser) return;
    if (!applicableChecklistId) return;
    const reason = formData.get('reason') as string;

    await withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO safety_checklist_completions (checklist_id, ticket_id, completed_by_id, override_by_id, override_reason, is_approved, responses)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          applicableChecklistId,
          ticketId,
          userId,
          userId,
          reason,
          true,
          JSON.stringify([{ item: 'Override', checked: true, notes: reason }]),
        ]
      );

      await tx.query(
        `INSERT INTO ticket_progress_logs (ticket_id, user_id, notes, log_type) VALUES ($1, $2, $3, $4)`,
        [ticketId, userId, `Safety checklist overridden by supervisor. Reason: ${reason}`, 'status_change']
      );
    });

    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function addPartsUsed(formData: FormData) {
    'use server';
    if (!(isAssignedTechnician || isSupervisorUser || isAdminUser)) return;
    if (!['in_progress', 'allocated'].includes(ticket.status)) return;
    const partId = Number(formData.get('partId'));
    const qty = parseFloat(formData.get('qty') as string);

    await withTransaction(async (tx) => {
      const partRes = await tx.query<Record<string, unknown>>(
        `SELECT * FROM spare_parts WHERE id = $1`,
        [partId]
      );
      const part = partRes.rows[0] as any;
      if (!part) throw new Error('Part not found');
      if (part.current_qty < qty) throw new Error(`Insufficient stock. Available: ${part.current_qty} ${part.unit}`);

      const totalCost = qty * Number(part.purchase_rate);

      await tx.query(
        `INSERT INTO ticket_spare_parts (ticket_id, part_id, qty, unit_price, total_cost, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ticketId, partId, qty, part.purchase_rate, totalCost, userId]
      );
      await tx.query(
        `UPDATE spare_parts SET current_qty = current_qty - $1 WHERE id = $2`,
        [qty, partId]
      );
      await tx.query(
        `INSERT INTO stock_transactions (part_id, transaction_type, quantity, reason, reference_ticket_id, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [partId, 'stock_out', qty, `Issued for ticket ${ticket.ticketNumber}`, ticketId, userId]
      );

      await tx.query(
        `INSERT INTO ticket_progress_logs (ticket_id, user_id, notes, log_type) VALUES ($1, $2, $3, $4)`,
        [ticketId, userId, `Added ${qty} ${part.unit} of ${part.part_name} (₹${totalCost.toLocaleString('en-IN')})`, 'parts_request']
      );
    });

    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function addProgressNote(formData: FormData) {
    'use server';
    if (!(isAssignedTechnician || isSupervisorUser || isAdminUser || ticket.reportedById === userId)) return;
    if (!['in_progress', 'allocated', 'completed'].includes(ticket.status)) return;
    const notes = formData.get('notes') as string;
    await execute(
      `INSERT INTO ticket_progress_logs (ticket_id, user_id, notes, log_type) VALUES ($1, $2, $3, $4)`,
      [ticketId, userId, notes, 'note']
    );
    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function completeWork(formData: FormData) {
    'use server';
    if (!isAssignedTechnician) return;
    if (ticket.status !== 'in_progress') return;
    const diagnosis = formData.get('diagnosis') as string;
    const rootCause = formData.get('rootCause') as string;
    const actionsTaken = formData.get('actionsTaken') as string;
    const laborHours = parseFloat(formData.get('laborHours') as string) || 0;
    const laborRateRaw = parseFloat(formData.get('laborRate') as string);
    const defaultRateRow = await queryOne<{ default_labor_rate: number | null }>(
      `SELECT default_labor_rate FROM app_config ORDER BY id LIMIT 1`
    );
    const defaultRate = Number(defaultRateRow?.default_labor_rate || 0);
    const laborRate = laborRateRaw || defaultRate || 0;
    const contractorCharges = parseFloat(formData.get('contractorCharges') as string) || 0;
    const otherCosts = parseFloat(formData.get('otherCosts') as string) || 0;

    const currentParts = await query<{ total_cost: number }>(
      `SELECT total_cost FROM ticket_spare_parts WHERE ticket_id = $1`,
      [ticketId]
    );
    const partsCost = currentParts.reduce((sum, p) => sum + Number(p.total_cost), 0);
    const laborCost = laborHours * laborRate;
    const totalRepairCost = partsCost + laborCost + contractorCharges + otherCosts;

    const endTime = new Date();
    const startTime = ticket.startTime ? new Date(ticket.startTime) : new Date();
    const downtimeMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    await withTransaction(async (tx) => {
      await tx.query(
        `UPDATE maintenance_tickets SET
           status = 'completed', diagnosis = $1, rootcause = $2, actions_taken = $3,
           labor_hours = $4, labor_rate_per_hour = $5, labor_cost = $6,
           contractor_charges = $7, other_costs = $8, parts_cost = $9, total_repair_cost = $10,
           end_time = $11, downtime_minutes = $12
         WHERE id = $13`,
        [diagnosis, rootCause, actionsTaken, laborHours, laborRate, laborCost, contractorCharges, otherCosts, partsCost, totalRepairCost, endTime, downtimeMinutes, ticketId]
      );
      await tx.query(
        `INSERT INTO ticket_progress_logs (ticket_id, user_id, notes, log_type) VALUES ($1, $2, $3, $4)`,
        [ticketId, userId, `Work completed. Total cost: ${formatCurrency(totalRepairCost)}`, 'status_change']
      );
    });
    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function verifyAndClose(formData: FormData) {
    'use server';
    if (!isSupervisorUser && !isAdminUser) return;
    const outcome = (formData.get('closureOutcome') as string) || 'closed';
    if (!['closed', 'pending', 'carry_forward', 'complaint'].includes(outcome)) return;
    await withTransaction(async (tx) => {
      const finalParts = await tx.query<{ total_cost: number }>(
        `SELECT total_cost FROM ticket_spare_parts WHERE ticket_id = $1`,
        [ticketId]
      );
      const partsCost = finalParts.rows.reduce((sum, p) => sum + Number(p.total_cost), 0);

      const finalTicket = await tx.query<Record<string, unknown>>(
        `SELECT * FROM maintenance_tickets WHERE id = $1`,
        [ticketId]
      );
      const ft = finalTicket.rows[0] as any;
      const laborCost = Number(ft?.labor_cost || 0);
      const contractorCharges = Number(ft?.contractor_charges || 0);
      const otherCosts = Number(ft?.other_costs || 0);
      const totalRepairCost = partsCost + laborCost + contractorCharges + otherCosts;

      await tx.query(
        `UPDATE maintenance_tickets SET
           status = 'closed', closure_outcome = $1, closure_verified_by_id = $2,
           closure_date = NOW(), parts_cost = $3, total_repair_cost = $4
         WHERE id = $5`,
        [outcome, userId, partsCost, totalRepairCost, ticketId]
      );

      await tx.query(
        `UPDATE machines SET
           lifetime_maintenance_cost = lifetime_maintenance_cost + $1,
           last_service_date = NOW()
         WHERE id = $2`,
        [totalRepairCost, ticket.machineId]
      );

      await tx.query(
        `INSERT INTO ticket_progress_logs (ticket_id, user_id, notes, log_type) VALUES ($1, $2, $3, $4)`,
        [ticketId, userId, `Ticket verified and closed (${outcome.replace('_', ' ')}). Final cost: ${formatCurrency(totalRepairCost)}`, 'status_change']
      );
    });

    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');
    redirect(`/tickets/${ticketId}`);
  }

  async function deleteTicket() {
    'use server';
    if (userRole !== 'SUPERVISOR' && userRole !== 'ADMIN') return;
    if (ticket.status !== 'open') return;

    await withTransaction(async (tx) => {
      await tx.query(`DELETE FROM ticket_progress_logs WHERE ticket_id = $1`, [ticketId]);
      await tx.query(`DELETE FROM safety_checklist_completions WHERE ticket_id = $1`, [ticketId]);
      await tx.query(
        `UPDATE spare_parts SET current_qty = current_qty + tsp.qty
         FROM ticket_spare_parts tsp WHERE tsp.part_id = spare_parts.id AND tsp.ticket_id = $1`,
        [ticketId]
      );
      await tx.query(`DELETE FROM ticket_spare_parts WHERE ticket_id = $1`, [ticketId]);
      await tx.query(`DELETE FROM stock_transactions WHERE reference_ticket_id = $1`, [ticketId]);
      await tx.query(`DELETE FROM notifications WHERE link_url = $1`, [`/tickets/${ticketId}`]);
      await tx.query(`DELETE FROM maintenance_tickets WHERE id = $1`, [ticketId]);
    });

    await deleteTicketPhotos(ticket.photoPaths);
    redirect('/tickets');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{ticket.ticketNumber}</h1>
            <span className={`badge ${getStatusColor(ticket.status)}`}>
              {ticket.status.replace('_', ' ')}
            </span>
            <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {ticket.machine.machineName} &middot; Reported by {ticket.reportedBy.name} on{' '}
            {formatDateTime(ticket.reportedDate)}
          </p>
          {ticket.expectedCompletionDate && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700">
              <Clock className="h-4 w-4" />
              Expected completion: {formatDateTime(ticket.expectedCompletionDate)}
            </p>
          )}
        </div>
        {ticket.status === 'open' && (userRole === 'SUPERVISOR' || userRole === 'ADMIN') && (
          <ConfirmForm action={deleteTicket} message="Delete this ticket? This cannot be undone.">
            <button type="submit" className="btn-danger">
              Delete Ticket
            </button>
          </ConfirmForm>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Issue */}
          <div className="card p-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Issue Description</h3>
            <p className="text-sm text-gray-700">{ticket.issueDescription}</p>
            <div className="mt-4">
              <TicketPhotos paths={ticket.photoPaths} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-500">Category:</span>{' '}
                <span className="text-gray-700">{ticket.category || 'Not specified'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Machine:</span>{' '}
                <span className="text-gray-700">{ticket.machine.machineName}</span>
              </div>
            </div>
          </div>

          {/* Diagnosis & Actions */}
          {(ticket.diagnosis || ticket.actionsTaken) && (
            <div className="card p-6">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Diagnosis & Actions</h3>
              <div className="space-y-3 text-sm">
                {ticket.diagnosis && (
                  <div>
                    <span className="font-medium text-gray-500">Diagnosis:</span>
                    <p className="mt-1 text-gray-700">{ticket.diagnosis}</p>
                  </div>
                )}
                {ticket.rootCause && (
                  <div>
                    <span className="font-medium text-gray-500">Root Cause:</span>
                    <p className="mt-1 text-gray-700">{ticket.rootCause}</p>
                  </div>
                )}
                {ticket.actionsTaken && (
                  <div>
                    <span className="font-medium text-gray-500">Actions Taken:</span>
                    <p className="mt-1 text-gray-700">{ticket.actionsTaken}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Requested Parts (REQ-6.1-01) */}
          {Array.isArray(ticket.requestedParts) && ticket.requestedParts.length > 0 && (
            <div className="card p-6">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">
                <Package className="inline h-5 w-5 mr-1" /> Requested Parts
              </h3>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="table-header px-4 py-2">Part</th>
                      <th className="table-header px-4 py-2">Code</th>
                      <th className="table-header px-4 py-2">Requested Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ticket.requestedParts.map((rp: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 font-medium">{rp.partName}</td>
                        <td className="px-4 py-2 text-gray-500">{rp.partCode}</td>
                        <td className="px-4 py-2">{rp.qty} {rp.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 md:hidden">
                {ticket.requestedParts.map((rp: any, idx: number) => (
                  <div key={idx} className="rounded-lg border border-gray-100 p-3">
                    <p className="font-medium text-gray-900">{rp.partName}</p>
                    <p className="text-xs text-gray-500">{rp.partCode} &middot; Requested: {rp.qty} {rp.unit}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parts Used */}
          <div className="card p-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">
              <Package className="inline h-5 w-5 mr-1" /> Parts Used
            </h3>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-header px-4 py-2">Part</th>
                    <th className="table-header px-4 py-2">Code</th>
                    <th className="table-header px-4 py-2">Qty</th>
                    <th className="table-header px-4 py-2">Unit Price</th>
                    <th className="table-header px-4 py-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ticket.sparePartsUsed.map((ps: any) => (
                    <tr key={ps.id}>
                      <td className="px-4 py-2 font-medium">{ps.part.partName}</td>
                      <td className="px-4 py-2 text-gray-500">{ps.part.partCode}</td>
                      <td className="px-4 py-2">{ps.qty} {ps.part.unit}</td>
                      <td className="px-4 py-2">{formatCurrency(ps.unitPrice)}</td>
                      <td className="px-4 py-2 font-medium">{formatCurrency(ps.totalCost)}</td>
                    </tr>
                  ))}
                  {ticket.sparePartsUsed.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">
                        No parts added yet
                      </td>
                    </tr>
                  )}
                </tbody>
                {ticket.sparePartsUsed.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-300">
                      <td colSpan={4} className="px-4 py-2 text-right font-semibold">Total Parts Cost:</td>
                      <td className="px-4 py-2 font-bold text-primary-600">
                        {formatCurrency(ticket.sparePartsUsed.reduce((sum: number, p: any) => sum + p.totalCost, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {ticket.sparePartsUsed.map((ps: any) => (
                <div key={ps.id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{ps.part.partName}</p>
                      <p className="text-xs text-gray-500">{ps.part.partCode}</p>
                    </div>
                    <span className="text-sm font-semibold shrink-0">{formatCurrency(ps.totalCost)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                    <span>{ps.qty} {ps.part.unit}</span>
                    <span>Unit: {formatCurrency(ps.unitPrice)}</span>
                  </div>
                </div>
              ))}
              {ticket.sparePartsUsed.length === 0 && (
                <p className="py-2 text-center text-sm text-gray-500">No parts added yet</p>
              )}
              {ticket.sparePartsUsed.length > 0 && (
                <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                  <span className="text-sm font-semibold">Total Parts Cost</span>
                  <span className="font-bold text-primary-600">
                    {formatCurrency(ticket.sparePartsUsed.reduce((sum: number, p: any) => sum + p.totalCost, 0))}
                  </span>
                </div>
              )}
            </div>

            {/* Add Parts Used Form */}
            {canAddParts && (
              <form action={addPartsUsed} className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="label">Select Part</label>
                  <select name="partId" className="input-field" required>
                    <option value="">Choose part...</option>
                    {spareParts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.partCode} - {p.partName} (Qty: {p.currentQty} {p.unit}, ₹{p.purchaseRate}/{p.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <label className="label">Quantity</label>
                  <input type="number" name="qty" className="input-field" step="0.01" min="0.01" required />
                </div>
                <button type="submit" className="btn-primary">
                  <Plus className="mr-1 h-4 w-4" /> Add Part
                </button>
              </form>
            )}
          </div>

          {/* Add Progress Note */}
          {canAddNotes && (
            <div className="card p-6">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">
                <MessageSquare className="inline h-5 w-5 mr-1" /> Add Note
              </h3>
              <form action={addProgressNote} className="flex gap-3">
                <input
                  type="text"
                  name="notes"
                  className="input-field flex-1"
                  placeholder="Add a progress note..."
                  required
                />
                <button type="submit" className="btn-secondary">
                  Add Note
                </button>
              </form>
            </div>
          )}

          {/* Activity Log */}
          {ticket.progressLogs.length > 0 && (
            <div className="card p-6">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Activity Log</h3>
              <div className="space-y-3">
                {ticket.progressLogs.map((log: any) => (
                  <div key={log.id} className="flex gap-3 text-sm">
                    <div className={`h-2 w-2 mt-1.5 flex-shrink-0 rounded-full ${
                      log.log_type === 'status_change' ? 'bg-blue-500' :
                      log.log_type === 'parts_request' ? 'bg-orange-500' : 'bg-gray-400'
                    }`} />
                    <div>
                      <p className="text-gray-700">{log.notes}</p>
                      <p className="text-xs text-gray-500">
                        {log.user.name} &middot; {formatDateTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Actions */}
          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Actions</h3>

            {/* Allocate (Supervisor/Admin only) */}
            {['open'].includes(ticket.status) && (userRole === 'SUPERVISOR' || userRole === 'ADMIN') && (
              <form action={allocateTicket} className="space-y-3">
                <div>
                  <label className="label">Assign Technician</label>
                  <select name="assignedToId" className="input-field" required>
                    <option value="">Select technician</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Expected Completion Date</label>
                  <input
                    type="datetime-local"
                    name="expectedCompletionDate"
                    className="input-field"
                    defaultValue={ticket.expectedCompletionDate ? new Date(ticket.expectedCompletionDate).toISOString().slice(0, 16) : ''}
                  />
                </div>
                <button type="submit" className="btn-primary w-full">
                  <User className="mr-2 h-4 w-4" /> Allocate Ticket
                </button>
              </form>
            )}

            {/* Start Work (Assigned Technician only) - gated by safety checklist */}
            {ticket.status === 'allocated' && ticket.assignedToId === userId && (
              <>
                {hasChecklistItems && !hasApprovedChecklist ? (
                  <div className="border border-yellow-300 rounded-lg p-4 bg-yellow-50">
                    <h4 className="font-semibold text-yellow-800 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> Safety Checklist Required
                    </h4>
                    {hasPendingChecklist ? (
                      <div className="mt-2">
                        <p className="text-sm text-yellow-700">
                          Your checklist has been submitted and is <strong>awaiting supervisor approval.</strong>
                        </p>
                        {hasPendingChecklist && (isSupervisorUser || isAdminUser) && (
                          <form action={approveSafetyChecklist} className="mt-3">
                            <button type="submit" className="btn-success w-full text-xs">
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Checklist
                            </button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="mt-1 text-sm text-yellow-700">
                          Complete the safety checklist before starting work: <strong>{applicableChecklist.name}</strong>
                        </p>
                        <form action={completeSafetyChecklist} className="mt-3 space-y-2">
                          {checklistItems.map((item: string, i: number) => (
                            <label key={i} className="flex items-start gap-2 text-sm">
                              <input type="checkbox" name={`check_${i}`} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                              <span className="text-gray-700">{item}</span>
                            </label>
                          ))}
                          <button type="submit" className="btn-success w-full mt-2">
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Submit Checklist
                          </button>
                          <p className="text-xs text-yellow-700">
                            All items must pass; a supervisor will approve before work can start.
                          </p>
                        </form>
                        {(isSupervisorUser || isAdminUser) && (
                          <form action={overrideSafetyChecklist} className="mt-3 space-y-2 border-t pt-3">
                            <p className="text-xs text-yellow-700 font-medium">Supervisor Override:</p>
                            <input type="text" name="reason" className="input-field" placeholder="Override reason" required />
                            <button type="submit" className="btn-danger w-full text-xs">
                              Override & Start Work
                            </button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <form action={startWork}>
                    <button type="submit" className="btn-primary w-full">
                      <Clock className="mr-2 h-4 w-4" /> Start Work
                    </button>
                  </form>
                )}
              </>
            )}

            {/* Complete Work (Assigned Technician) */}
            {ticket.status === 'in_progress' && ticket.assignedToId === userId && (
              <form action={completeWork} className="space-y-3">
                <div>
                  <label className="label">Diagnosis</label>
                  <textarea name="diagnosis" className="input-field" rows={2} />
                </div>
                <div>
                  <label className="label">Root Cause</label>
                  <textarea name="rootCause" className="input-field" rows={2} />
                </div>
                <div>
                  <label className="label">Actions Taken</label>
                  <textarea name="actionsTaken" className="input-field" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Labor Hours</label>
                    <input type="number" name="laborHours" className="input-field" step="0.5" />
                  </div>
                  <div>
                    <label className="label">Labor Rate/hr</label>
                    <input type="number" name="laborRate" className="input-field" defaultValue={defaultLaborRate || ''} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Contractor</label>
                    <input type="number" name="contractorCharges" className="input-field" defaultValue="0" />
                  </div>
                  <div>
                    <label className="label">Other Costs</label>
                    <input type="number" name="otherCosts" className="input-field" defaultValue="0" />
                  </div>
                </div>
                <button type="submit" className="btn-success w-full">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Complete Work
                </button>
              </form>
            )}

            {/* Verify & Close (Supervisor) */}
            {ticket.status === 'completed' && (isSupervisorUser || isAdminUser) && (
              <form action={verifyAndClose} className="space-y-3">
                <div>
                  <label className="label">Closure Outcome</label>
                  <select name="closureOutcome" className="input-field" defaultValue="closed">
                    <option value="closed">Closed</option>
                    <option value="pending">Pending</option>
                    <option value="carry_forward">Carry-Forward</option>
                    <option value="complaint">Complaint</option>
                  </select>
                </div>
                <button type="submit" className="btn-primary w-full">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Verify &amp; Close
                </button>
              </form>
            )}

            {ticket.status === 'closed' && (
              <p className="text-center text-sm text-gray-500">
                This ticket is closed. Outcome: <span className="font-medium">{ticket.closureOutcome || 'closed'}</span>.
              </p>
            )}
          </div>

          {/* Cost Summary */}
          {(ticket.totalRepairCost || ticket.partsCost || ticket.laborCost) && (
            <div className="card p-6">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">
                <DollarSign className="inline h-5 w-5" /> Cost Summary
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Parts Cost</span>
                  <span className="font-medium">{formatCurrency(ticket.partsCost || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Labor ({ticket.laborHours || 0}h)</span>
                  <span className="font-medium">{formatCurrency(ticket.laborCost || 0)}</span>
                </div>
                {ticket.contractorCharges ? (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Contractor</span>
                    <span className="font-medium">{formatCurrency(ticket.contractorCharges)}</span>
                  </div>
                ) : null}
                {ticket.otherCosts ? (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Other</span>
                    <span className="font-medium">{formatCurrency(ticket.otherCosts)}</span>
                  </div>
                ) : null}
                <div className="border-t pt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold">Total Repair Cost</span>
                    <span className="font-bold text-primary-600">{formatCurrency(ticket.totalRepairCost || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ticket Info */}
          <div className="card p-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Reported By</span>
                <span className="text-gray-700">{ticket.reportedBy.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Assigned To</span>
                <span className="text-gray-700">{ticket.assignedTo?.name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expected Completion</span>
                <span className="text-gray-700">
                  {ticket.expectedCompletionDate ? formatDateTime(ticket.expectedCompletionDate) : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Downtime</span>
                <span className="text-gray-700">
                  {ticket.downtimeMinutes ? `${ticket.downtimeMinutes} min` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Verified By</span>
                <span className="text-gray-700">{ticket.closureVerifiedBy?.name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Closure Date</span>
                <span className="text-gray-700">
                  {ticket.closureDate ? formatDateTime(ticket.closureDate) : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
