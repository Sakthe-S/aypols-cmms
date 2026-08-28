import { query, toCamel } from '@/lib/db';
import { formatDate } from '@/lib/utils';
import { Shield, BookOpen, Heart, FileCheck } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function EhsPage() {
  const session = await getServerSession(authOptions);

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

  const now = new Date();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">EHS - Environment, Health & Safety</h1>
        <p className="text-sm text-gray-500">Manage safety checklists, training, and compliance</p>
      </div>

      {/* Safety Checklists */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Safety Checklists</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checklists.map((cl) => {
            const items = JSON.parse(cl.checklistItems);
            return (
              <div key={cl.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{cl.name}</h3>
                    <p className="text-sm text-gray-500">Job Type: {cl.jobType}</p>
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
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Training & Compliance</h2>
        </div>
        <div className="card overflow-hidden">
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
                  <th className="table-header px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trainings.map((tr) => {
                  const assigned = JSON.parse(tr.assignedToIds || '[]');
                  const completedCount = tr.completions.filter((c: any) => c.status === 'completed').length;
                  const isOverdue = tr.nextDueDate && tr.nextDueDate < now;
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
                      <td className="px-6 py-3">
                        {isOverdue ? (
                          <span className="badge bg-red-100 text-red-800">Overdue</span>
                        ) : completedCount >= assigned.length ? (
                          <span className="badge bg-green-100 text-green-800">Complete</span>
                        ) : (
                          <span className="badge bg-yellow-100 text-yellow-800">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {trainings.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No training records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Health & Legal Compliance */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Health & Legal Compliance</h2>
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">Record</th>
                  <th className="table-header px-6 py-3">Type</th>
                  <th className="table-header px-6 py-3">Frequency</th>
                  <th className="table-header px-6 py-3">Next Due</th>
                  <th className="table-header px-6 py-3">Status</th>
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
                    </tr>
                  );
                })}
                {healthRecords.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No compliance records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
