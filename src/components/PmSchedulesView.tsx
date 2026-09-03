'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';
import { CheckCircle2, Pencil, Search } from 'lucide-react';
import ViewToggle, { type ViewMode } from '@/components/ViewToggle';
import ConfirmForm from '@/components/ConfirmForm';

type PmSchedule = {
  id: number;
  taskName: string;
  machine: { machineName: string };
  frequency: string;
  description: string | null;
  nextDueDate: Date | null;
  leadDays: number;
  checklistItems: string | null;
  logs: { completedAt: Date; completedBy: { name: string } }[];
};

const STORAGE_KEY = 'pm-view';

export default function PmSchedulesView({
  schedules,
  canManage,
  isAdmin,
  now,
  onMarkDone,
  onUpdate,
  onDelete,
}: {
  schedules: PmSchedule[];
  canManage: boolean;
  isAdmin: boolean;
  now: Date;
  onMarkDone: (id: number) => Promise<void>;
  onUpdate: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
}) {
  const [mode, setMode] = useState<ViewMode>('card');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'card' || saved === 'table') setMode(saved);
    }
  }, []);

  const changeMode = (m: ViewMode) => {
    setMode(m);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, m);
  };

  const isOverdue = (pm: PmSchedule) => !!pm.nextDueDate && pm.nextDueDate < now;
  const isDueSoon = (pm: PmSchedule) =>
    !!pm.nextDueDate && !isOverdue(pm) && pm.nextDueDate.getTime() - now.getTime() < pm.leadDays * 86400000;
  const statusBadge = (pm: PmSchedule) =>
    isOverdue(pm) ? 'bg-red-100 text-red-700' : isDueSoon(pm) ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
  const statusLabel = (pm: PmSchedule) => (isOverdue(pm) ? 'Overdue' : isDueSoon(pm) ? 'Due Soon' : 'On Track');

  const normQuery = query.trim().toLowerCase();
  const filteredSchedules = schedules.filter((pm) => {
    const matchesQuery =
      !normQuery ||
      pm.taskName.toLowerCase().includes(normQuery) ||
      pm.machine.machineName.toLowerCase().includes(normQuery);
    const matchesStatus = statusFilter === 'all' || statusLabel(pm) === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{filteredSchedules.length} of {schedules.length} active schedules</p>
        <ViewToggle mode={mode} onChange={changeMode} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by task or machine..."
            className="input-field pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">All Status</option>
          <option value="Overdue">Overdue</option>
          <option value="Due Soon">Due Soon</option>
          <option value="On Track">On Track</option>
        </select>
      </div>

      {mode === 'card' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSchedules.map((pm) => (
            <div key={pm.id} className={`card p-5 ${isOverdue(pm) ? 'border-red-300 bg-red-50' : isDueSoon(pm) ? 'border-yellow-300 bg-yellow-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{pm.taskName}</h3>
                  <p className="text-sm text-gray-500">{pm.machine.machineName}</p>
                </div>
                <span className="badge bg-gray-100 text-gray-800">{pm.frequency}</span>
              </div>
              <p className="mt-2 text-sm text-gray-600">{pm.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-gray-500">Next Due: </span>
                  <span className={`font-medium ${isOverdue(pm) ? 'text-red-600' : isDueSoon(pm) ? 'text-yellow-600' : 'text-gray-900'}`}>
                    {pm.nextDueDate ? formatDate(pm.nextDueDate) : 'Not set'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onMarkDone(pm.id)}
                  className="btn-success text-xs px-3 py-1.5"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Mark Done
                </button>
              </div>
              {pm.logs[0] && (
                <p className="mt-2 text-xs text-gray-500">
                  Last done: {formatDate(pm.logs[0].completedAt)} by {pm.logs[0].completedBy.name}
                </p>
              )}
              {canManage && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <details className="group">
                    <summary className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary-600 hover:underline">
                      <Pencil className="h-3 w-3" /> Edit Schedule
                    </summary>
                    <form action={onUpdate} className="mt-3 space-y-3">
                      <input type="hidden" name="id" value={pm.id} />
                      <div>
                        <label className="label">Task Name</label>
                        <input type="text" name="taskName" className="input-field" defaultValue={pm.taskName} required />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Frequency</label>
                          <select name="frequency" className="input-field" defaultValue={pm.frequency}>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="half_yearly">Half Yearly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">Next Due Date</label>
                          <input
                            type="date"
                            name="nextDueDate"
                            className="input-field"
                            defaultValue={pm.nextDueDate ? new Date(pm.nextDueDate).toISOString().slice(0, 10) : ''}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label">Description</label>
                        <textarea name="description" className="input-field" rows={2} defaultValue={pm.description ?? ''} />
                      </div>
                      <div>
                        <label className="label">Checklist Items (one per line)</label>
                        <textarea
                          name="checklistItems"
                          className="input-field"
                          rows={2}
                          defaultValue={pm.checklistItems ? JSON.parse(pm.checklistItems).join('\n') : ''}
                        />
                      </div>
                      <button type="submit" className="btn-primary w-full text-xs">Save Changes</button>
                    </form>
                  </details>
                  {isAdmin && (
                    <ConfirmForm action={onDelete} message="Delete this PM schedule?" className="mt-2">
                      <input type="hidden" name="id" value={pm.id} />
                      <button type="submit" className="btn-danger w-full text-xs">
                        Delete Schedule
                      </button>
                    </ConfirmForm>
                  )}
                </div>
              )}
            </div>
          ))}
          {filteredSchedules.length === 0 && (
            <p className="col-span-3 py-8 text-center text-gray-500">No PM schedules configured</p>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">Task</th>
                  <th className="table-header px-6 py-3">Machine</th>
                  <th className="table-header px-6 py-3">Frequency</th>
                  <th className="table-header px-6 py-3">Description</th>
                  <th className="table-header px-6 py-3">Next Due</th>
                  <th className="table-header px-6 py-3">Status</th>
                  <th className="table-header px-6 py-3">Last Done</th>
                  <th className="table-header px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSchedules.map((pm) => (
                  <tr key={pm.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{pm.taskName}</td>
                    <td className="px-6 py-3">{pm.machine.machineName}</td>
                    <td className="px-6 py-3">
                      <span className="badge bg-gray-100 text-gray-800">{pm.frequency}</span>
                    </td>
                    <td className="max-w-[280px] truncate px-6 py-3 text-gray-600" title={pm.description ?? ''}>
                      {pm.description || '-'}
                    </td>
                    <td className="px-6 py-3">{pm.nextDueDate ? formatDate(pm.nextDueDate) : 'Not set'}</td>
                    <td className="px-6 py-3">
                      <span className={`badge ${statusBadge(pm)}`}>{statusLabel(pm)}</span>
                    </td>
                    <td className="px-6 py-3">
                      {pm.logs[0] ? `${formatDate(pm.logs[0].completedAt)} (${pm.logs[0].completedBy.name})` : '-'}
                    </td>
                    <td className="px-6 py-3">
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onMarkDone(pm.id)}
                            className="text-xs font-medium text-green-600 hover:underline"
                          >
                            Mark Done
                          </button>
                          <details className="group relative">
                            <summary className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary-600 hover:underline">
                              <Pencil className="h-3 w-3" /> Edit
                            </summary>
                            <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                              <form action={onUpdate} className="space-y-3">
                                <input type="hidden" name="id" value={pm.id} />
                                <input
                                  type="text"
                                  name="taskName"
                                  className="input-field"
                                  defaultValue={pm.taskName}
                                  required
                                />
                                <select name="frequency" className="input-field" defaultValue={pm.frequency}>
                                  <option value="daily">Daily</option>
                                  <option value="weekly">Weekly</option>
                                  <option value="monthly">Monthly</option>
                                  <option value="quarterly">Quarterly</option>
                                  <option value="half_yearly">Half Yearly</option>
                                  <option value="yearly">Yearly</option>
                                </select>
                                <input
                                  type="date"
                                  name="nextDueDate"
                                  className="input-field"
                                  defaultValue={pm.nextDueDate ? new Date(pm.nextDueDate).toISOString().slice(0, 10) : ''}
                                />
                                <textarea name="description" className="input-field" rows={2} defaultValue={pm.description ?? ''} placeholder="Description" />
                                <textarea
                                  name="checklistItems"
                                  className="input-field"
                                  rows={2}
                                  defaultValue={pm.checklistItems ? JSON.parse(pm.checklistItems).join('\n') : ''}
                                  placeholder="Checklist items (one per line)"
                                />
                                <button type="submit" className="btn-primary w-full text-xs">Save</button>
                              </form>
                            </div>
                          </details>
                          {isAdmin && (
                            <ConfirmForm action={onDelete} message="Delete this PM schedule?">
                              <input type="hidden" name="id" value={pm.id} />
                              <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                                Delete
                              </button>
                            </ConfirmForm>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onMarkDone(pm.id)}
                          className="text-xs font-medium text-green-600 hover:underline"
                        >
                          Mark Done
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredSchedules.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">No PM schedules configured</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
