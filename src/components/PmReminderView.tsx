'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/utils';
import { AlertTriangle, CalendarClock } from 'lucide-react';

type Reminder = {
  id: number;
  taskName: string;
  machine: { machineName: string };
  nextDueDate: Date | null;
  frequency: string;
};

export default function PmReminderView({
  schedules,
  now,
}: {
  schedules: Reminder[];
  now: Date;
}) {
  const [priority, setPriority] = useState<'high' | 'low' | 'all'>('all');
  const [showAll, setShowAll] = useState(false);
  const INITIAL_COUNT = 10;

  const withDate = schedules.filter((s) => s.nextDueDate);
  const sorted = [...withDate].sort(
    (a, b) => new Date(a.nextDueDate as Date).getTime() - new Date(b.nextDueDate as Date).getTime()
  );

  const reminders = sorted.map((s) => {
    const due = new Date(s.nextDueDate as Date);
    const overdue = due < now;
    return { ...s, overdue };
  });

  const filtered = reminders.filter((r) => {
    if (priority === 'high') return r.overdue;
    if (priority === 'low') return !r.overdue;
    return true;
  });

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_COUNT);
  const hiddenCount = filtered.length - visible.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Priority:</span>
        {(
          [
            { key: 'all', label: 'All' },
            { key: 'high', label: 'High (Overdue)' },
            { key: 'low', label: 'Low (Upcoming)' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setPriority(opt.key)}
            className={`badge cursor-pointer ${priority === opt.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-gray-500">No PM reminders in this priority.</p>
      )}

      <div className="space-y-2">
        {visible.map((r) => (
          <div
            key={r.id}
            className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${r.overdue ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}
          >
            <div className="flex items-start gap-2">
              {r.overdue ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              ) : (
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">{r.taskName}</p>
                <p className="text-xs text-gray-600">
                  {r.machine.machineName} · {r.frequency}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-xs font-semibold ${r.overdue ? 'text-red-700' : 'text-yellow-700'}`}>
                {r.overdue ? 'Overdue' : 'Due'}
              </p>
              <p className="text-xs text-gray-600">{r.nextDueDate ? formatDate(r.nextDueDate) : '-'}</p>
            </div>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50"
        >
          {showAll ? `Show fewer (top ${INITIAL_COUNT})` : `Show more (${hiddenCount} more)`}
        </button>
      )}
    </div>
  );
}
