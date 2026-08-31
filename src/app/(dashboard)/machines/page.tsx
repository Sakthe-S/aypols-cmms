import { query, queryOne, execute, toCamel } from '@/lib/db';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { Plus, Wrench } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ConfirmForm from '@/components/ConfirmForm';

export const dynamic = 'force-dynamic';

export default async function MachinesPage() {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = Number((session?.user as any)?.id);
  const rows = await query<Record<string, unknown>>(
    `SELECT m.*,
            (SELECT count(*)::int FROM maintenance_tickets t WHERE t.machine_id = m.id) AS ticket_count
     FROM machines m
     ORDER BY m.machine_name ASC`
  );

  const machines = rows.map(row => {
    const r = toCamel(row);
    return {
      ...r,
      _count: { tickets: Number(r.ticketCount || 0) },
    };
  });

  async function deleteMachine(formData: FormData) {
    'use server';
    if (userRole !== 'ADMIN') return;
    const machineId = Number(formData.get('id'));
    const ticketCount = await queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM maintenance_tickets WHERE machine_id = $1`,
      [machineId]
    );
    if (ticketCount?.count) return;
    await execute(`DELETE FROM pm_schedules WHERE machine_id = $1`, [machineId]);
    await execute(`DELETE FROM amc_records WHERE machine_id = $1`, [machineId]);
    await execute(`DELETE FROM calibration_records WHERE machine_id = $1`, [machineId]);
    await execute(`DELETE FROM machines WHERE id = $1`, [machineId]);
    revalidatePath('/machines');
    redirect('/machines');
  }

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
            {userRole === 'ADMIN' && machine._count.tickets === 0 && (
              <ConfirmForm action={deleteMachine} message="Delete this machine?" className="mt-2">
                <input type="hidden" name="id" value={machine.id} />
                <button type="submit" className="btn-danger w-full text-xs">
                  Delete Machine
                </button>
              </ConfirmForm>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
