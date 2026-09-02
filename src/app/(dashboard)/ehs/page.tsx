import { query, queryOne, execute, toCamel } from '@/lib/db';
import { formatDate } from '@/lib/utils';
import { Shield, BookOpen, Heart, FileCheck, History } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ConfirmForm from '@/components/ConfirmForm';

export const dynamic = 'force-dynamic';

export default async function EhsPage() {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = Number((session?.user as any)?.id);
  const isAdmin = userRole === 'ADMIN';
  const canManage = userRole === 'EHS_OFFICER' || userRole === 'ADMIN' || userRole === 'SUPERVISOR';
  const now = new Date();

  const checklistRows = await query<Record<string, unknown>>(
    `SELECT * FROM safety_checklists WHERE is_active = true`
  );
  const completionRows = await query<Record<string, unknown>>(
    `SELECT * FROM safety_checklist_completions ORDER BY completed_at DESC`
  );
  const checklists = checklistRows.map(row => {
    const r = toCamel(row) as any;
    r.completions = completionRows.filter((c: any) => c.checklist_id === r.id).map(toCamel);
    return r;
  });

  const trainingRows = await query<Record<string, unknown>>(
    `SELECT * FROM training_records WHERE is_active = true`
  );
  const trainingCompletionRows = await query<Record<string, unknown>>(
    `SELECT * FROM training_completions`
  );
  const trainings = trainingRows.map(row => {
    const r = toCamel(row) as any;
    r.completions = trainingCompletionRows.filter((c: any) => c.training_id === r.id).map(toCamel);
    return r;
  });

  const healthRecords = (await query<Record<string, unknown>>(
    `SELECT * FROM health_compliance_records WHERE is_active = true`
  )).map(toCamel);

  // EHS tickets raised through the ticket system (REQ-6.10-03)
  const ehsTickets = (await query<Record<string, unknown>>(
    `SELECT t.id, t.ticket_number, t.machine_id, t.priority, t.status,
            t.issue_description, t.reported_date, t.closure_outcome,
            m.machine_name, r.name AS reporter_name
     FROM maintenance_tickets t
     JOIN machines m ON m.id = t.machine_id
     JOIN users r ON r.id = t.reported_by_id
     WHERE t.is_ehs = true
     ORDER BY t.reported_date DESC
     LIMIT 50`
  )).map(row => ({
    ...toCamel(row),
    machine: { machineName: row['machine_name'] },
    reportedBy: { name: row['reporter_name'] },
  }));

  const overrideHistoryRows = await query<Record<string, unknown>>(
    `SELECT oh.*, u.name AS overridden_by_name
     FROM compliance_override_history oh
     LEFT JOIN users u ON u.id = oh.overridden_by_id
     ORDER BY oh.created_at DESC
     LIMIT 100`
  );
  const overrideHistory = overrideHistoryRows.map(row => ({
    ...toCamel(row),
    overriddenBy: { name: row['overridden_by_name'] || 'Unknown' },
  }));

  async function recordOverride(formData: FormData) {
    'use server';
    if (userRole !== 'EHS_OFFICER' && userRole !== 'ADMIN' && userRole !== 'SUPERVISOR') return;
    const recordType = formData.get('recordType') as string;
    const recordId = Number(formData.get('recordId'));
    const reason = (formData.get('reason') as string) || '';
    if (!reason) return;

    await execute(
      `INSERT INTO compliance_override_history (record_type, record_id, overridden_by_id, reason)
       VALUES ($1, $2, $3, $4)`,
      [recordType, recordId, userId, reason]
    );
    revalidatePath('/ehs');
    redirect('/ehs');
  }

  async function markChecklistComplete(formData: FormData) {
    'use server';
    if (userRole !== 'EHS_OFFICER' && userRole !== 'ADMIN' && userRole !== 'SUPERVISOR') return;
    const checklistId = Number(formData.get('checklistId'));
    await execute(
      `INSERT INTO safety_checklist_completions (checklist_id, completed_by_id, is_approved, responses)
       VALUES ($1, $2, true, $3)`,
      [checklistId, userId, JSON.stringify([{ item: 'Completed', checked: true, notes: '' }])]
    );
    revalidatePath('/ehs');
    redirect('/ehs');
  }

  async function addChecklist(formData: FormData) {
    'use server';
    if (userRole !== 'EHS_OFFICER' && userRole !== 'ADMIN') return;
    const name = formData.get('name') as string;
    const jobType = formData.get('jobType') as string;
    const items = (formData.get('items') as string) || '';
    const itemList = items.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!name || itemList.length === 0) return;
    await execute(
      `INSERT INTO safety_checklists (name, job_type, checklist_items, is_active)
       VALUES ($1, $2, $3, true)`,
      [name, jobType || 'general', JSON.stringify(itemList)]
    );
    revalidatePath('/ehs');
    redirect('/ehs');
  }

  async function deleteChecklist(formData: FormData) {
    'use server';
    if (userRole !== 'ADMIN') return;
    const id = Number(formData.get('id'));
    await execute(`DELETE FROM safety_checklists WHERE id = $1`, [id]);
    revalidatePath('/ehs');
    redirect('/ehs');
  }

  async function addTraining(formData: FormData) {
    'use server';
    if (userRole !== 'EHS_OFFICER' && userRole !== 'ADMIN') return;
    const trainingName = formData.get('trainingName') as string;
    const trainingType = formData.get('trainingType') as string;
    const description = formData.get('description') as string;
    const frequency = formData.get('frequency') as string;
    const nextDueDate = formData.get('nextDueDate') as string || null;
    const assignedToIds = (formData.get('assignedToIds') as string) || '';
    const ids = assignedToIds.split(',').map((s) => Number(s.trim())).filter(Boolean);
    if (!trainingName) return;
    await execute(
      `INSERT INTO training_records (training_name, training_type, description, frequency, next_due_date, assigned_to_ids, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [trainingName, trainingType || 'safety', description || null, frequency || 'once', nextDueDate || null, JSON.stringify(ids)]
    );
    revalidatePath('/ehs');
    redirect('/ehs');
  }

  async function deleteTraining(formData: FormData) {
    'use server';
    if (userRole !== 'ADMIN') return;
    const id = Number(formData.get('id'));
    await execute(`DELETE FROM training_completions WHERE training_id = $1`, [id]);
    await execute(`DELETE FROM training_records WHERE id = $1`, [id]);
    revalidatePath('/ehs');
    redirect('/ehs');
  }

  // Employees self-report training completion; EHS Officer/Admin may record on their behalf.
  async function reportTrainingCompletion(formData: FormData) {
    'use server';
    const trainingId = Number(formData.get('trainingId'));
    const training = await queryOne<Record<string, unknown>>(
      `SELECT assigned_to_ids FROM training_records WHERE id = $1 AND is_active = true`,
      [trainingId]
    );
    if (!training) return;
    const assignedIds = JSON.parse((training['assigned_to_ids'] as string) || '[]') as number[];
    const eligible =
      userRole === 'EHS_OFFICER' || userRole === 'ADMIN' || userRole === 'SUPERVISOR' ||
      assignedIds.includes(userId);
    if (!eligible) return;

    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM training_completions WHERE training_id = $1 AND user_id = $2`,
      [trainingId, userId]
    );
    if (existing) return;

    await execute(
      `INSERT INTO training_completions (training_id, user_id, status, completed_at)
       VALUES ($1, $2, 'completed', NOW())`,
      [trainingId, userId]
    );
    revalidatePath('/ehs');
    redirect('/ehs');
  }

  // EHS Officer verification (REQ-6.10-03) - only EHS Officers and Admins approve.
  async function verifyTrainingCompletion(formData: FormData) {
    'use server';
    if (userRole !== 'EHS_OFFICER' && userRole !== 'ADMIN') return;
    const completionId = Number(formData.get('completionId'));
    await execute(
      `UPDATE training_completions
       SET status = 'verified', verified_by_id = $1, verified_at = NOW()
       WHERE id = $2 AND verified_at IS NULL`,
      [userId, completionId]
    );
    revalidatePath('/ehs');
    redirect('/ehs');
  }

  async function addHealthRecord(formData: FormData) {
    'use server';
    if (userRole !== 'EHS_OFFICER' && userRole !== 'ADMIN') return;
    const recordName = formData.get('recordName') as string;
    const recordType = formData.get('recordType') as string;
    const frequency = formData.get('frequency') as string;
    const nextDueDate = formData.get('nextDueDate') as string || null;
    if (!recordName) return;
    await execute(
      `INSERT INTO health_compliance_records (record_name, record_type, frequency, next_due_date, is_active)
       VALUES ($1, $2, $3, $4, true)`,
      [recordName, recordType || 'health', frequency || 'once', nextDueDate || null]
    );
    revalidatePath('/ehs');
    redirect('/ehs');
  }

  async function deleteHealthRecord(formData: FormData) {
    'use server';
    if (userRole !== 'ADMIN') return;
    const id = Number(formData.get('id'));
    await execute(`DELETE FROM health_compliance_records WHERE id = $1`, [id]);
    revalidatePath('/ehs');
    redirect('/ehs');
  }


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">EHS - Environment, Health & Safety</h1>
        <p className="text-sm text-gray-500">Manage safety checklists, training, and compliance</p>
      </div>

      {/* Safety Checklists */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Safety Checklists</h2>
          </div>
          {canManage && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-primary-600 hover:underline">+ Add Checklist</summary>
              <form action={addChecklist} className="card mt-2 w-80 space-y-3 p-4">
                <div>
                  <label className="label">Name *</label>
                  <input type="text" name="name" className="input-field" required />
                </div>
                <div>
                  <label className="label">Job Type</label>
                  <input type="text" name="jobType" className="input-field" placeholder="e.g. mechanical" />
                </div>
                <div>
                  <label className="label">Checklist Items (one per line)</label>
                  <textarea name="items" className="input-field" rows={3} required />
                </div>
                <button type="submit" className="btn-primary w-full text-xs">Add Checklist</button>
              </form>
            </details>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checklists.map((cl) => {
            const items = JSON.parse(cl.checklistItems);
            return (
              <div key={cl.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{cl.name}</h3>
                    <p className="text-sm text-gray-500">Job Type: {cl.jobType || '-'}</p>
                  </div>
                  <span className="badge bg-blue-100 text-blue-800">{items.length} items</span>
                </div>
                <ul className="mt-3 space-y-1">
                  {items.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-500" />
                      {item}
                    </li>
                  ))}
                </ul>
                {cl.completions.length > 0 && (
                  <p className="mt-3 text-xs text-gray-500">
                    Last completed: {formatDate(cl.completions[0].completedAt)}
                    {cl.completions[0].isApproved ? ' (Approved)' : ' (Pending Approval)'}
                  </p>
                )}
                {canManage && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    <form action={markChecklistComplete}>
                      <input type="hidden" name="checklistId" value={cl.id} />
                      <button type="submit" className="btn-success w-full text-xs">Mark Complete</button>
                    </form>
                    <details>
                      <summary className="cursor-pointer text-xs font-medium text-yellow-700 hover:underline">
                        Override with Reason
                      </summary>
                      <form action={recordOverride} className="mt-2 space-y-2">
                        <input type="hidden" name="recordType" value="safety_checklist" />
                        <input type="hidden" name="recordId" value={cl.id} />
                        <input
                          type="text"
                          name="reason"
                          className="input-field"
                          placeholder="Override reason (required)"
                          required
                        />
                        <button type="submit" className="btn-danger w-full text-xs">Submit Override</button>
                      </form>
                    </details>
                    {isAdmin && (
                      <ConfirmForm action={deleteChecklist} message="Delete this checklist?">
                        <input type="hidden" name="id" value={cl.id} />
                        <button type="submit" className="btn-danger w-full text-xs">
                          Delete Checklist
                        </button>
                      </ConfirmForm>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {checklists.length === 0 && (
            <p className="col-span-3 py-8 text-center text-gray-500">No safety checklists configured</p>
          )}
        </div>
      </div>

      {/* Training Records */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Training & Compliance</h2>
          </div>
          {canManage && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-primary-600 hover:underline">+ Add Training</summary>
              <form action={addTraining} className="card mt-2 w-80 space-y-3 p-4">
                <div>
                  <label className="label">Training Name *</label>
                  <input type="text" name="trainingName" className="input-field" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Type</label>
                    <select name="trainingType" className="input-field">
                      <option value="fire">Fire</option>
                      <option value="first_aid">First Aid</option>
                      <option value="safety">Safety</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Frequency</label>
                    <input type="text" name="frequency" className="input-field" placeholder="e.g. yearly" />
                  </div>
                </div>
                <div>
                  <label className="label">Next Due</label>
                  <input type="date" name="nextDueDate" className="input-field" />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea name="description" className="input-field" rows={2} />
                </div>
                <div>
                  <label className="label">Assigned User IDs (comma separated)</label>
                  <input type="text" name="assignedToIds" className="input-field" placeholder="1,2,3" />
                </div>
                <button type="submit" className="btn-primary w-full text-xs">Add Training</button>
              </form>
            </details>
          )}
        </div>
        <div className="card hidden overflow-hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">Training</th>
                  <th className="table-header px-6 py-3">Type</th>
                  <th className="table-header px-6 py-3">Frequency</th>
                  <th className="table-header px-6 py-3">Next Due</th>
                  <th className="table-header px-6 py-3">Assigned</th>
                  <th className="table-header px-6 py-3">Completed</th>
                  <th className="table-header px-6 py-3">EHS Verified</th>
                  <th className="table-header px-6 py-3">Status</th>
                  {canManage && <th className="table-header px-6 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trainings.map((tr) => {
                  const assigned = JSON.parse(tr.assignedToIds || '[]');
                  const completedCount = tr.completions.filter((c: any) => c.status === 'completed' || c.status === 'verified').length;
                  const verifiedCount = tr.completions.filter((c: any) => c.verifiedAt).length;
                  const pendingCompletion = tr.completions.find((c: any) => !c.verifiedAt);
                  const isOverdue = tr.nextDueDate && tr.nextDueDate < now;
                  const canReport = !tr.completions.some((c: any) => c.userId === userId) && (assigned.includes(userId) || userRole === 'EHS_OFFICER' || userRole === 'ADMIN' || userRole === 'SUPERVISOR');
                  return (
                    <tr key={tr.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium">{tr.trainingName}</td>
                      <td className="px-6 py-3">
                        <span className="badge bg-blue-100 text-blue-800">{tr.trainingType}</span>
                      </td>
                      <td className="px-6 py-3">{tr.frequency}</td>
                      <td className="px-6 py-3">
                        <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                          {tr.nextDueDate ? formatDate(tr.nextDueDate) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-3">{assigned.length} employees</td>
                      <td className="px-6 py-3">{completedCount}/{assigned.length}</td>
                      <td className="px-6 py-3">{verifiedCount}/{assigned.length}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          {isOverdue ? (
                            <span className="badge bg-red-100 text-red-800">Overdue</span>
                          ) : completedCount >= assigned.length ? (
                            <span className="badge bg-green-100 text-green-800">Complete</span>
                          ) : (
                            <span className="badge bg-yellow-100 text-yellow-800">Pending</span>
                          )}
                          {canReport && (
                            <form action={reportTrainingCompletion}>
                              <input type="hidden" name="trainingId" value={tr.id} />
                              <button
                                type="submit"
                                className="btn-secondary px-2 py-1 text-xs"
                                title="Report that I completed this training"
                              >
                                Mark Complete
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                      {canManage && (
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            {pendingCompletion && (userRole === 'EHS_OFFICER' || userRole === 'ADMIN') && (
                              <form action={verifyTrainingCompletion}>
                                <input type="hidden" name="completionId" value={pendingCompletion.id} />
                                <button
                                  type="submit"
                                  className="btn-success px-2 py-1 text-xs"
                                  title="Approve the pending completion as EHS Officer"
                                >
                                  Verify
                                </button>
                              </form>
                            )}
                            <details>
                              <summary className="cursor-pointer text-xs font-medium text-yellow-700 hover:underline">
                                Override
                              </summary>
                              <form action={recordOverride} className="mt-1 flex items-center gap-1">
                                <input type="hidden" name="recordType" value="training" />
                                <input type="hidden" name="recordId" value={tr.id} />
                                <input
                                  type="text"
                                  name="reason"
                                  className="input-field"
                                  placeholder="Reason"
                                  required
                                />
                                <button type="submit" className="btn-danger text-xs px-2 py-1">OK</button>
                              </form>
                            </details>
                            {isAdmin && (
                              <ConfirmForm action={deleteTraining} message="Delete this training?" className="inline">
                                <input type="hidden" name="id" value={tr.id} />
                                <button type="submit" className="btn-danger text-xs px-2 py-1">
                                  Delete
                                </button>
                              </ConfirmForm>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {trainings.length === 0 && (
                  <tr><td colSpan={canManage ? 9 : 8} className="px-6 py-8 text-center text-gray-500">No training records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-3 md:hidden">
          {trainings.map((tr) => {
            const assigned = JSON.parse(tr.assignedToIds || '[]');
            const completedCount = tr.completions.filter((c: any) => c.status === 'completed' || c.status === 'verified').length;
            const verifiedCount = tr.completions.filter((c: any) => c.verifiedAt).length;
            const pendingCompletion = tr.completions.find((c: any) => !c.verifiedAt);
            const isOverdue = tr.nextDueDate && tr.nextDueDate < now;
            const canReport = !tr.completions.some((c: any) => c.userId === userId) && (assigned.includes(userId) || userRole === 'EHS_OFFICER' || userRole === 'ADMIN' || userRole === 'SUPERVISOR');
            return (
              <div key={tr.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{tr.trainingName}</p>
                    <p className="text-xs text-gray-500">{tr.frequency}</p>
                  </div>
                  {isOverdue ? (
                    <span className="badge shrink-0 bg-red-100 text-red-800">Overdue</span>
                  ) : completedCount >= assigned.length ? (
                    <span className="badge shrink-0 bg-green-100 text-green-800">Complete</span>
                  ) : (
                    <span className="badge shrink-0 bg-yellow-100 text-yellow-800">Pending</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="badge bg-blue-100 text-blue-800">{tr.trainingType}</span>
                  <p className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                    Next Due: {tr.nextDueDate ? formatDate(tr.nextDueDate) : '-'}
                  </p>
                </div>
                <div className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
                  {completedCount}/{assigned.length} employees completed &middot; EHS Verified: {verifiedCount}
                </div>
                {canReport && (
                  <form action={reportTrainingCompletion} className="mt-2">
                    <input type="hidden" name="trainingId" value={tr.id} />
                    <button type="submit" className="btn-secondary w-full text-xs">Mark Training Complete</button>
                  </form>
                )}
                {pendingCompletion && (userRole === 'EHS_OFFICER' || userRole === 'ADMIN') && (
                  <form action={verifyTrainingCompletion} className="mt-2">
                    <input type="hidden" name="completionId" value={pendingCompletion.id} />
                    <button type="submit" className="btn-success w-full text-xs">Verify Completion as EHS Officer</button>
                  </form>
                )}
              </div>
            );
          })}
          {trainings.length === 0 && (
            <p className="card p-8 text-center text-gray-500">No training records</p>
          )}
        </div>
      </div>

      {/* Health & Legal Compliance */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Health & Legal Compliance</h2>
          </div>
          {canManage && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-primary-600 hover:underline">+ Add Record</summary>
              <form action={addHealthRecord} className="card mt-2 w-80 space-y-3 p-4">
                <div>
                  <label className="label">Record Name *</label>
                  <input type="text" name="recordName" className="input-field" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Type</label>
                    <select name="recordType" className="input-field">
                      <option value="health">Health</option>
                      <option value="legal">Legal</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Frequency</label>
                    <input type="text" name="frequency" className="input-field" placeholder="e.g. yearly" />
                  </div>
                </div>
                <div>
                  <label className="label">Next Due</label>
                  <input type="date" name="nextDueDate" className="input-field" />
                </div>
                <button type="submit" className="btn-primary w-full text-xs">Add Record</button>
              </form>
            </details>
          )}
        </div>
        <div className="card hidden overflow-hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">Record</th>
                  <th className="table-header px-6 py-3">Type</th>
                  <th className="table-header px-6 py-3">Frequency</th>
                  <th className="table-header px-6 py-3">Next Due</th>
                  <th className="table-header px-6 py-3">Status</th>
                  {canManage && <th className="table-header px-6 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {healthRecords.map((hr) => {
                  const isOverdue = hr.nextDueDate && hr.nextDueDate < now;
                  return (
                    <tr key={hr.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium">{hr.recordName}</td>
                      <td className="px-6 py-3">
                        <span className="badge bg-purple-100 text-purple-800">{hr.recordType}</span>
                      </td>
                      <td className="px-6 py-3">{hr.frequency}</td>
                      <td className="px-6 py-3">
                        <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                          {hr.nextDueDate ? formatDate(hr.nextDueDate) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {isOverdue ? (
                          <span className="badge bg-red-100 text-red-800">Overdue</span>
                        ) : (
                          <span className="badge bg-green-100 text-green-800">Current</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <details>
                              <summary className="cursor-pointer text-xs font-medium text-yellow-700 hover:underline">
                                Override
                              </summary>
                              <form action={recordOverride} className="mt-1 flex items-center gap-1">
                                <input type="hidden" name="recordType" value="health_compliance" />
                                <input type="hidden" name="recordId" value={hr.id} />
                                <input
                                  type="text"
                                  name="reason"
                                  className="input-field"
                                  placeholder="Reason"
                                  required
                                />
                                <button type="submit" className="btn-danger text-xs px-2 py-1">OK</button>
                              </form>
                            </details>
                            {isAdmin && (
                              <ConfirmForm action={deleteHealthRecord} message="Delete this record?" className="inline">
                                <input type="hidden" name="id" value={hr.id} />
                                <button type="submit" className="btn-danger text-xs px-2 py-1">
                                  Delete
                                </button>
                              </ConfirmForm>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {healthRecords.length === 0 && (
                  <tr><td colSpan={canManage ? 6 : 5} className="px-6 py-8 text-center text-gray-500">No compliance records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-3 md:hidden">
          {healthRecords.map((hr) => {
            const isOverdue = hr.nextDueDate && hr.nextDueDate < now;
            return (
              <div key={hr.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{hr.recordName}</p>
                    <p className="text-xs text-gray-500">{hr.frequency}</p>
                  </div>
                  {isOverdue ? (
                    <span className="badge shrink-0 bg-red-100 text-red-800">Overdue</span>
                  ) : (
                    <span className="badge shrink-0 bg-green-100 text-green-800">Current</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="badge bg-purple-100 text-purple-800">{hr.recordType}</span>
                  <p className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                    Next Due: {hr.nextDueDate ? formatDate(hr.nextDueDate) : '-'}
                  </p>
                </div>
              </div>
            );
          })}
          {healthRecords.length === 0 && (
            <p className="card p-8 text-center text-gray-500">No compliance records</p>
          )}
        </div>
      </div>

      {/* EHS Tickets (REQ-6.10-03) - EHS matters tracked as tickets */}
      {ehsTickets.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">EHS Tickets</h2>
            <a href="/tickets" className="ml-auto text-xs font-medium text-primary-600 hover:underline">
              View all tickets
            </a>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">Ticket</th>
                  <th className="table-header px-6 py-3">Machine</th>
                  <th className="table-header px-6 py-3">Priority</th>
                  <th className="table-header px-6 py-3">Status</th>
                  <th className="table-header px-6 py-3">Reported By</th>
                  <th className="table-header px-6 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ehsTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <a href={`/tickets/${t.id}`} className="font-semibold text-primary-600 hover:underline">
                        {t.ticketNumber}
                      </a>
                    </td>
                    <td className="px-6 py-3 text-gray-700">{t.machine.machineName}</td>
                    <td className="px-6 py-3">
                      <span className={`badge ${
                        t.priority === 'critical' ? 'bg-red-100 text-red-800' :
                        t.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        t.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="badge bg-gray-100 text-gray-700">{t.status}</span>
                    </td>
                    <td className="px-6 py-3 text-gray-700">{t.reportedBy.name}</td>
                    <td className="px-6 py-3 text-gray-600">{t.issueDescription}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Override History (Admin only) */}
      {isAdmin && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Override History</h2>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">Date</th>
                  <th className="table-header px-6 py-3">Record Type</th>
                  <th className="table-header px-6 py-3">Record ID</th>
                  <th className="table-header px-6 py-3">Overridden By</th>
                  <th className="table-header px-6 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overrideHistory.map((oh) => (
                  <tr key={oh.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-3 text-gray-500">
                      {formatDate(oh.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3">
                      <span className="badge bg-yellow-100 text-yellow-800">{oh.recordType.replace('_', ' ')}</span>
                    </td>
                    <td className="px-6 py-3 text-gray-700">#{oh.recordId}</td>
                    <td className="px-6 py-3 text-gray-700">{oh.overriddenBy.name}</td>
                    <td className="px-6 py-3 text-gray-600">{oh.reason}</td>
                  </tr>
                ))}
                {overrideHistory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No overrides recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
