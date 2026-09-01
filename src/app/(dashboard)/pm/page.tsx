import { query, queryOne, execute, toCamel } from '@/lib/db';
import { formatDate } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import PmSchedulesView from '@/components/PmSchedulesView';

export const dynamic = 'force-dynamic';

type PmRow = Record<string, unknown>;

export default async function PmPage() {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const canManage = userRole === 'SUPERVISOR' || userRole === 'ADMIN';
  const now = new Date();
  const pmRows = await query<PmRow>(
    `SELECT ps.*, m.machine_name,
            (SELECT l.completed_at FROM pm_logs l WHERE l.schedule_id = ps.id ORDER BY l.completed_at DESC LIMIT 1) AS last_completed_at,
            (SELECT u.name FROM pm_logs l JOIN users u ON u.id = l.completed_by_id WHERE l.schedule_id = ps.id ORDER BY l.completed_at DESC LIMIT 1) AS last_completed_by
     FROM pm_schedules ps
     JOIN machines m ON m.id = ps.machine_id
     WHERE ps.is_active = true
     ORDER BY ps.next_due_date ASC NULLS LAST`
  );
  const schedules = pmRows.map(row => {
    const r = toCamel(row);
    const lastDone = row['last_completed_at'] != null
      ? [{ completedAt: r.lastCompletedAt, completedBy: { name: r.lastCompletedBy } }]
      : [];
    return {
      ...r,
      machine: { machineName: r.machineName },
      logs: lastDone,
    };
  });

  const amcRows = await query<Record<string, unknown>>(
    `SELECT ar.*, m.machine_name
     FROM amc_records ar
     LEFT JOIN machines m ON m.id = ar.machine_id
     WHERE ar.is_active = true
     ORDER BY ar.next_service_date ASC NULLS LAST`
  );
  const amcRecords = amcRows.map(row => {
    const r = toCamel(row);
    return { ...r, machine: row['machine_name'] != null ? { machineName: r.machineName } : null };
  });

  const calibrationRows = await query<Record<string, unknown>>(
    `SELECT cr.*, m.machine_name
     FROM calibration_records cr
     LEFT JOIN machines m ON m.id = cr.machine_id
     WHERE cr.is_active = true
     ORDER BY cr.next_due_date ASC NULLS LAST`
  );
  const calibrationRecords = calibrationRows.map(row => {
    const r = toCamel(row);
    return { ...r, machine: row['machine_name'] != null ? { machineName: r.machineName } : null };
  });

  async function markPmComplete(scheduleId: number) {
    'use server';
    const userId = Number((session?.user as any)?.id);
    const schedule = await queryOne<Record<string, unknown>>(
      `SELECT * FROM pm_schedules WHERE id = $1`,
      [scheduleId]
    );
    if (!schedule) return;

    await execute(
      `INSERT INTO pm_logs (schedule_id, completed_by_id, notes)
       VALUES ($1, $2, $3)`,
      [scheduleId, userId, 'PM completed']
    );

    const now = new Date();
    let nextDue: Date | null = null;
    switch (schedule.frequency) {
      case 'daily': nextDue = new Date(now.getTime() + 1 * 86400000); break;
      case 'weekly': nextDue = new Date(now.getTime() + 7 * 86400000); break;
      case 'monthly': nextDue = new Date(now.getTime() + 30 * 86400000); break;
      case 'quarterly': nextDue = new Date(now.getTime() + 90 * 86400000); break;
      case 'half_yearly': nextDue = new Date(now.getTime() + 180 * 86400000); break;
      case 'yearly': nextDue = new Date(now.getTime() + 365 * 86400000); break;
    }

    await execute(
      `UPDATE pm_schedules SET last_completed_at = $1, next_due_date = $2 WHERE id = $3`,
      [now, nextDue, scheduleId]
    );

    revalidatePath('/pm');
    redirect('/pm');
  }

  async function updatePmSchedule(formData: FormData) {
    'use server';
    if (!canManage) return;
    const scheduleId = Number(formData.get('id'));
    const taskName = formData.get('taskName') as string;
    const frequency = formData.get('frequency') as string;
    const description = formData.get('description') as string;
    const checklistItems = formData.get('checklistItems') as string;
    const nextDueDate = formData.get('nextDueDate') as string || null;
    const leadDays = parseInt(formData.get('leadDays') as string, 10) || 7;

    await execute(
      `UPDATE pm_schedules SET
         task_name = $1, frequency = $2, description = $3,
         checklist_items = $4, next_due_date = $5, lead_days = $6
       WHERE id = $7`,
      [taskName, frequency, description, checklistItems
        ? JSON.stringify(checklistItems.split('\n').map((s: string) => s.trim()).filter(Boolean))
        : null, nextDueDate || null, leadDays, scheduleId]
    );

    revalidatePath('/pm');
    redirect('/pm');
  }

  async function deletePmSchedule(formData: FormData) {
    'use server';
    if (userRole !== 'ADMIN') return;
    const scheduleId = Number(formData.get('id'));
    await execute(
      `DELETE FROM pm_logs WHERE schedule_id = $1`,
      [scheduleId]
    );
    await execute(
      `DELETE FROM pm_schedules WHERE id = $1`,
      [scheduleId]
    );
    revalidatePath('/pm');
    redirect('/pm');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Preventive Maintenance & Schedules</h1>
        <p className="text-sm text-gray-500">Manage PM, AMC, and calibration schedules</p>
      </div>

      {/* PM Schedules */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">PM Schedules</h2>
        <PmSchedulesView
          schedules={schedules}
          canManage={canManage}
          isAdmin={userRole === 'ADMIN'}
          now={now}
          onMarkDone={markPmComplete}
          onUpdate={updatePmSchedule}
          onDelete={deletePmSchedule}
        />
      </div>

      {/* AMC Records */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">AMC Contracts</h2>
        <div className="card hidden overflow-hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">Contract #</th>
                  <th className="table-header px-6 py-3">Machine</th>
                  <th className="table-header px-6 py-3">Vendor</th>
                  <th className="table-header px-6 py-3">Period</th>
                  <th className="table-header px-6 py-3">Next Service</th>
                  <th className="table-header px-6 py-3">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {amcRecords.map((amc) => (
                  <tr key={amc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">{amc.contractNumber || '-'}</td>
                    <td className="px-6 py-3">{amc.machine?.machineName || '-'}</td>
                    <td className="px-6 py-3">{amc.vendorName}</td>
                    <td className="px-6 py-3">{formatDate(amc.startDate)} - {formatDate(amc.endDate)}</td>
                    <td className="px-6 py-3">
                      {amc.nextServiceDate ? formatDate(amc.nextServiceDate) : '-'}
                    </td>
                    <td className="px-6 py-3">₹{(amc.cost || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                {amcRecords.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No AMC records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-3 md:hidden">
          {amcRecords.map((amc) => (
            <div key={amc.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{amc.contractNumber || '-'}</p>
                  <p className="text-sm text-gray-700">{amc.machine?.machineName || '-'}</p>
                  <p className="text-xs text-gray-500">{amc.vendorName}</p>
                </div>
                <p className="text-sm font-bold text-primary-600">₹{(amc.cost || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="mt-3 space-y-1 border-t border-gray-100 pt-2 text-xs text-gray-500">
                <p>Period: {formatDate(amc.startDate)} - {formatDate(amc.endDate)}</p>
                <p>Next Service: {amc.nextServiceDate ? formatDate(amc.nextServiceDate) : '-'}</p>
              </div>
            </div>
          ))}
          {amcRecords.length === 0 && (
            <p className="card p-8 text-center text-gray-500">No AMC records</p>
          )}
        </div>
      </div>

      {/* Calibration Records */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Calibration Records</h2>
        <div className="card hidden overflow-hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">Instrument</th>
                  <th className="table-header px-6 py-3">Machine</th>
                  <th className="table-header px-6 py-3">Type</th>
                  <th className="table-header px-6 py-3">Frequency</th>
                  <th className="table-header px-6 py-3">Last Calibration</th>
                  <th className="table-header px-6 py-3">Next Due</th>
                  <th className="table-header px-6 py-3">Lab</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {calibrationRecords.map((cr) => (
                  <tr key={cr.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">{cr.instrumentName}</td>
                    <td className="px-6 py-3">{cr.machine?.machineName || '-'}</td>
                    <td className="px-6 py-3">{cr.calibrationType}</td>
                    <td className="px-6 py-3">{cr.frequency}</td>
                    <td className="px-6 py-3">{cr.lastCalibration ? formatDate(cr.lastCalibration) : '-'}</td>
                    <td className="px-6 py-3">{cr.nextDueDate ? formatDate(cr.nextDueDate) : '-'}</td>
                    <td className="px-6 py-3">{cr.labName || '-'}</td>
                  </tr>
                ))}
                {calibrationRecords.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No calibration records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-3 md:hidden">
          {calibrationRecords.map((cr) => (
            <div key={cr.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{cr.instrumentName}</p>
                  <p className="text-sm text-gray-700">{cr.machine?.machineName || '-'}</p>
                </div>
                <span className="badge shrink-0 bg-gray-100 text-gray-800">{cr.calibrationType}</span>
              </div>
              <div className="mt-3 space-y-1 border-t border-gray-100 pt-2 text-xs text-gray-500">
                <p>Frequency: {cr.frequency}</p>
                <p>Last: {cr.lastCalibration ? formatDate(cr.lastCalibration) : '-'}</p>
                <p>Next Due: {cr.nextDueDate ? formatDate(cr.nextDueDate) : '-'}</p>
                <p>Lab: {cr.labName || '-'}</p>
              </div>
            </div>
          ))}
          {calibrationRecords.length === 0 && (
            <p className="card p-8 text-center text-gray-500">No calibration records</p>
          )}
        </div>
      </div>
    </div>
  );
}
