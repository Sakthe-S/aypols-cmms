import { query, toCamel } from '@/lib/db';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import MachinesView from '@/components/MachinesView';

export const dynamic = 'force-dynamic';

type MachineRow = {
  id: number;
  machineName: string;
  serialNumber: string | null;
  department: string | null;
  location: string | null;
  currentStatus: string;
  lifetimeMaintenanceCost: number;
  ticketCount: number;
};

type Machine = Omit<MachineRow, 'ticketCount'> & {
  _count: { tickets: number };
};

export default async function MachinesPage() {
  const rows = await query<Record<string, unknown>>(
    `SELECT m.*,
            (SELECT count(*)::int FROM maintenance_tickets t WHERE t.machine_id = m.id) AS ticket_count
     FROM machines m
     ORDER BY m.machine_name ASC`
  );

  const machines: Machine[] = rows.map(row => {
    const r = toCamel(row) as unknown as MachineRow;
    return {
      id: r.id,
      machineName: r.machineName,
      serialNumber: r.serialNumber,
      department: r.department,
      location: r.location,
      currentStatus: r.currentStatus,
      lifetimeMaintenanceCost: Number(r.lifetimeMaintenanceCost || 0),
      _count: { tickets: Number(r.ticketCount || 0) },
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Machines / Assets</h1>
        </div>
        <Link href="/machines/new" className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Add Machine
        </Link>
      </div>

      <MachinesView machines={machines} />
    </div>
  );
}
