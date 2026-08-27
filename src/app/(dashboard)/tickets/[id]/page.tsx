import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { formatCurrency, formatDateTime, getStatusColor, getPriorityColor } from '@/lib/utils';
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

export default async function TicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = Number((session?.user as any)?.id);
  const ticketId = Number(params.id);

  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id: ticketId },
    include: {
      machine: true,
      reportedBy: true,
      assignedTo: true,
      closureVerifiedBy: true,
      sparePartsUsed: { include: { part: true } },
      progressLogs: { include: { user: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!ticket) notFound();

  const spareParts = await prisma.sparePart.findMany({
    orderBy: { partName: 'asc' },
  });

  const technicians = await prisma.user.findMany({
    where: { role: { in: ['TECHNICIAN', 'SUPERVISOR'] } },
    orderBy: { name: 'asc' },
  });

  // Safety checklist gate
  const applicableChecklist = ticket.category
    ? await prisma.safetyChecklist.findFirst({
        where: { jobType: ticket.category, isActive: true },
      })
    : null;

  const hasChecklistCompletion = applicableChecklist
    ? await prisma.safetyChecklistCompletion.findFirst({
        where: { checklistId: applicableChecklist.id, ticketId: ticketId },
      })
    : null;

  const canAddParts = ['in_progress', 'allocated'].includes(ticket.status);
  const canAddNotes = ['in_progress', 'allocated', 'completed'].includes(ticket.status);
  const isOpen = ['open', 'allocated', 'in_progress', 'completed'].includes(ticket.status);

  async function allocateTicket(formData: FormData) {
    'use server';
    const assignedToId = Number(formData.get('assignedToId'));
    await prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: { assignedToId, status: 'allocated', allocatedDate: new Date() },
    });
    await prisma.ticketProgressLog.create({
      data: { ticketId, userId, notes: `Ticket allocated to technician`, logType: 'status_change' },
    });
    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function startWork() {
    'use server';
    await prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: { status: 'in_progress', startTime: new Date() },
    });
    await prisma.ticketProgressLog.create({
      data: { ticketId, userId, notes: `Work started`, logType: 'status_change' },
    });
    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function completeSafetyChecklist(formData: FormData) {
    'use server';
    if (!applicableChecklist) return;
    const items = JSON.parse(applicableChecklist.checklistItems);
    const responses = items.map((item: string, i: number) => ({
      item,
      checked: formData.get(`check_${i}`) === 'on',
      notes: (formData.get(`note_${i}`) as string) || '',
    }));
    const allChecked = responses.every((r: any) => r.checked);

    await prisma.safetyChecklistCompletion.create({
      data: {
        checklistId: applicableChecklist.id,
        ticketId,
        completedById: userId,
        isApproved: allChecked,
        responses: JSON.stringify(responses),
      },
    });

    await prisma.ticketProgressLog.create({
      data: {
        ticketId,
        userId,
        notes: `Safety checklist completed: ${allChecked ? 'All items passed' : 'Some items failed - requires supervisor override'}`,
        logType: 'status_change',
      },
    });

    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function overrideSafetyChecklist(formData: FormData) {
    'use server';
    if (!applicableChecklist) return;
    const reason = formData.get('reason') as string;

    await prisma.safetyChecklistCompletion.create({
      data: {
        checklistId: applicableChecklist.id,
        ticketId,
        completedById: userId,
        overrideById: userId,
        overrideReason: reason,
        isApproved: true,
        responses: JSON.stringify([{ item: 'Override', checked: true, notes: reason }]),
      },
    });

    await prisma.ticketProgressLog.create({
      data: {
        ticketId,
        userId,
        notes: `Safety checklist overridden by supervisor. Reason: ${reason}`,
        logType: 'status_change',
      },
    });

    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function addPartsUsed(formData: FormData) {
    'use server';
    const partId = Number(formData.get('partId'));
    const qty = parseFloat(formData.get('qty') as string);

    const part = await prisma.sparePart.findUnique({ where: { id: partId } });
    if (!part) throw new Error('Part not found');
    if (part.currentQty < qty) throw new Error(`Insufficient stock. Available: ${part.currentQty} ${part.unit}`);

    const totalCost = qty * part.purchaseRate;

    await prisma.$transaction([
      prisma.ticketSparePart.create({
        data: {
          ticketId,
          partId,
          qty,
          unitPrice: part.purchaseRate,
          totalCost,
          userId,
        },
      }),
      prisma.sparePart.update({
        where: { id: partId },
        data: { currentQty: { decrement: qty } },
      }),
      prisma.stockTransaction.create({
        data: {
          partId,
          transactionType: 'stock_out',
          quantity: qty,
          reason: `Issued for ticket ${ticket.ticketNumber}`,
          referenceTicketId: ticketId,
          userId,
        },
      }),
    ]);
    await prisma.ticketProgressLog.create({
      data: { ticketId, userId, notes: `Added ${qty} ${part.unit} of ${part.partName} (₹${totalCost.toLocaleString('en-IN')})`, logType: 'parts_request' },
    });
    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function addProgressNote(formData: FormData) {
    'use server';
    const notes = formData.get('notes') as string;
    await prisma.ticketProgressLog.create({
      data: { ticketId, userId, notes, logType: 'note' },
    });
    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function completeWork(formData: FormData) {
    'use server';
    const diagnosis = formData.get('diagnosis') as string;
    const rootCause = formData.get('rootCause') as string;
    const actionsTaken = formData.get('actionsTaken') as string;
    const laborHours = parseFloat(formData.get('laborHours') as string) || 0;
    const laborRate = parseFloat(formData.get('laborRate') as string) || 400;
    const contractorCharges = parseFloat(formData.get('contractorCharges') as string) || 0;
    const otherCosts = parseFloat(formData.get('otherCosts') as string) || 0;

    const currentParts = await prisma.ticketSparePart.findMany({
      where: { ticketId },
    });
    const partsCost = currentParts.reduce((sum, p) => sum + p.totalCost, 0);
    const laborCost = laborHours * laborRate;
    const totalRepairCost = partsCost + laborCost + contractorCharges + otherCosts;

    const endTime = new Date();
    const startTime = ticket.startTime || new Date();
    const downtimeMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    await prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        status: 'completed',
        diagnosis,
        rootCause,
        actionsTaken,
        laborHours,
        laborRatePerHour: laborRate,
        laborCost,
        contractorCharges,
        otherCosts,
        partsCost,
        totalRepairCost,
        endTime,
        downtimeMinutes,
      },
    });
    await prisma.ticketProgressLog.create({
      data: { ticketId, userId, notes: `Work completed. Total cost: ${formatCurrency(totalRepairCost)}`, logType: 'status_change' },
    });
    revalidatePath(`/tickets/${ticketId}`);
    redirect(`/tickets/${ticketId}`);
  }

  async function verifyAndClose() {
    'use server';
    const finalParts = await prisma.ticketSparePart.findMany({
      where: { ticketId },
    });
    const partsCost = finalParts.reduce((sum, p) => sum + p.totalCost, 0);

    const finalTicket = await prisma.maintenanceTicket.findUnique({ where: { id: ticketId } });
    const laborCost = finalTicket?.laborCost || 0;
    const contractorCharges = finalTicket?.contractorCharges || 0;
    const otherCosts = finalTicket?.otherCosts || 0;
    const totalRepairCost = partsCost + laborCost + contractorCharges + otherCosts;

    await prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        status: 'closed',
        closureOutcome: 'closed',
        closureVerifiedById: userId,
        closureDate: new Date(),
        partsCost,
        totalRepairCost,
      },
    });

    await prisma.machine.update({
      where: { id: ticket.machineId },
      data: {
        lifetimeMaintenanceCost: { increment: totalRepairCost },
        lastServiceDate: new Date(),
      },
    });

    await prisma.ticketProgressLog.create({
      data: { ticketId, userId, notes: `Ticket verified and closed. Final cost: ${formatCurrency(totalRepairCost)}`, logType: 'status_change' },
    });

    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');
    redirect(`/tickets/${ticketId}`);
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Issue */}
          <div className="card p-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Issue Description</h3>
            <p className="text-sm text-gray-700">{ticket.issueDescription}</p>
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

          {/* Parts Used */}
          <div className="card p-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">
              <Package className="inline h-5 w-5 mr-1" /> Parts Used
            </h3>
            <div className="overflow-x-auto">
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
                  {ticket.sparePartsUsed.map((ps) => (
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
                        {formatCurrency(ticket.sparePartsUsed.reduce((sum, p) => sum + p.totalCost, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
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
                {ticket.progressLogs.map((log) => (
                  <div key={log.id} className="flex gap-3 text-sm">
                    <div className={`h-2 w-2 mt-1.5 flex-shrink-0 rounded-full ${
                      log.logType === 'status_change' ? 'bg-blue-500' :
                      log.logType === 'parts_request' ? 'bg-orange-500' : 'bg-gray-400'
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
                <button type="submit" className="btn-primary w-full">
                  <User className="mr-2 h-4 w-4" /> Allocate Ticket
                </button>
              </form>
            )}

            {/* Start Work (Assigned Technician only) - gated by safety checklist */}
            {ticket.status === 'allocated' && ticket.assignedToId === userId && (
              <>
                {applicableChecklist && !hasChecklistCompletion ? (
                  <div className="border border-yellow-300 rounded-lg p-4 bg-yellow-50">
                    <h4 className="font-semibold text-yellow-800 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> Safety Checklist Required
                    </h4>
                    <p className="mt-1 text-sm text-yellow-700">
                      Complete the safety checklist before starting work: <strong>{applicableChecklist.name}</strong>
                    </p>
                    <form action={completeSafetyChecklist} className="mt-3 space-y-2">
                      {JSON.parse(applicableChecklist.checklistItems).map((item: string, i: number) => (
                        <label key={i} className="flex items-start gap-2 text-sm">
                          <input type="checkbox" name={`check_${i}`} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                          <span className="text-gray-700">{item}</span>
                        </label>
                      ))}
                      <button type="submit" className="btn-success w-full mt-2">
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Complete Checklist & Start Work
                      </button>
                    </form>
                    {(userRole === 'SUPERVISOR' || userRole === 'ADMIN') && (
                      <form action={overrideSafetyChecklist} className="mt-3 space-y-2 border-t pt-3">
                        <p className="text-xs text-yellow-700 font-medium">Supervisor Override:</p>
                        <input type="text" name="reason" className="input-field" placeholder="Override reason" required />
                        <button type="submit" className="btn-danger w-full text-xs">
                          Override & Start Work
                        </button>
                      </form>
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
                    <input type="number" name="laborRate" className="input-field" defaultValue="400" />
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
            {ticket.status === 'completed' && (userRole === 'SUPERVISOR' || userRole === 'ADMIN') && (
              <form action={verifyAndClose}>
                <button type="submit" className="btn-primary w-full">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Verify & Close
                </button>
              </form>
            )}

            {ticket.status === 'closed' && (
              <p className="text-center text-sm text-gray-500">This ticket is closed.</p>
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
