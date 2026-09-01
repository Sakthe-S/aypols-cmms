'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency, getStatusColor } from '@/lib/utils';
import { Wrench } from 'lucide-react';
import ViewToggle, { type ViewMode } from '@/components/ViewToggle';

type Machine = {
  id: number;
  machineName: string;
  serialNumber: string | null;
  department: string | null;
  location: string | null;
  currentStatus: string;
  lifetimeMaintenanceCost: number;
  _count: { tickets: number };
};

const STORAGE_KEY = 'machines-view';

export default function MachinesView({ machines }: { machines: Machine[] }) {
  const [mode, setMode] = useState<ViewMode>('card');

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{machines.length} registered machines</p>
        <ViewToggle mode={mode} onChange={changeMode} />
      </div>

      {mode === 'card' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {machines.map((machine) => (
            <div key={machine.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary-50 p-2">
                    <Wrench className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <Link href={`/machines/${machine.id}`} className="font-semibold text-gray-900 hover:text-primary-600">
                      {machine.machineName}
                    </Link>
                    <p className="text-xs text-gray-500">{machine.serialNumber}</p>
                  </div>
                </div>
                <span className={`badge ${getStatusColor(machine.currentStatus)}`}>
                  {machine.currentStatus}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Department</span>
                  <span className="font-medium">{machine.department || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Location</span>
                  <span className="font-medium">{machine.location || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Tickets</span>
                  <span className="font-medium">{machine._count.tickets}</span>
                </div>
                <div className="flex justify-between">
                  <span>Lifetime Cost</span>
                  <span className="font-bold text-primary-600">
                    {formatCurrency(machine.lifetimeMaintenanceCost)}
                  </span>
                </div>
              </div>
              <Link href={`/machines/${machine.id}`} className="mt-3 inline-block text-xs font-medium text-primary-600 hover:underline">
                View Details →
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">Machine</th>
                  <th className="table-header px-6 py-3">Serial No</th>
                  <th className="table-header px-6 py-3">Department</th>
                  <th className="table-header px-6 py-3">Location</th>
                  <th className="table-header px-6 py-3">Status</th>
                  <th className="table-header px-6 py-3">Tickets</th>
                  <th className="table-header px-6 py-3">Lifetime Cost</th>
                  <th className="table-header px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {machines.map((machine) => (
                  <tr key={machine.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      <Link href={`/machines/${machine.id}`} className="hover:text-primary-600">
                        {machine.machineName}
                      </Link>
                    </td>
                    <td className="px-6 py-3">{machine.serialNumber || '-'}</td>
                    <td className="px-6 py-3">{machine.department || '-'}</td>
                    <td className="px-6 py-3">{machine.location || '-'}</td>
                    <td className="px-6 py-3">
                      <span className={`badge ${getStatusColor(machine.currentStatus)}`}>
                        {machine.currentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-3">{machine._count.tickets}</td>
                    <td className="px-6 py-3 font-medium text-primary-600">
                      {formatCurrency(machine.lifetimeMaintenanceCost)}
                    </td>
                    <td className="px-6 py-3">
                      <Link href={`/machines/${machine.id}`} className="text-xs font-medium text-primary-600 hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
                {machines.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">No machines registered</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
