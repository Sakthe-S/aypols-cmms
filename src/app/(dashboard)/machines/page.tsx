import prisma from '@/lib/prisma';
import Link from 'next/link';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { Plus, Wrench } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MachinesPage() {
  const machines = await prisma.machine.findMany({
    orderBy: { machineName: 'asc' },
    include: {
      _count: { select: { tickets: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Machines / Assets</h1>
          <p className="text-sm text-gray-500">{machines.length} registered machines</p>
        </div>
        <Link href="/machines/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Add Machine
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {machines.map((machine) => (
          <Link key={machine.id} href={`/machines/${machine.id}`} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary-50 p-2">
                  <Wrench className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{machine.machineName}</h3>
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
          </Link>
        ))}
      </div>
    </div>
  );
}
