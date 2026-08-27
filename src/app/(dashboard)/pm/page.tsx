import prisma from '@/lib/prisma';
import { formatDate, getStatusColor } from '@/lib/utils';
import { Calendar, Clock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function PmPage() {
  const session = await getServerSession(authOptions);
  const schedules = await prisma.pmSchedule.findMany({
    where: { isActive: true },
    include: { machine: true, logs: { orderBy: { completedAt: 'desc' }, take: 1, include: { completedBy: true } } },
    orderBy: { nextDueDate: 'asc' },
  });

  const amcRecords = await prisma.amcRecord.findMany({
    where: { isActive: true },
    orderBy: { nextServiceDate: 'asc' },
  });

  const calibrationRecords = await prisma.calibrationRecord.findMany({
    where: { isActive: true },
    orderBy: { nextDueDate: 'asc' },
  });

  async function markPmComplete(scheduleId: number) {
    'use server';
    const userId = Number((session?.user as any)?.id);
    const schedule = await prisma.pmSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) return;

    await prisma.pmLog.create({
      data: {
        scheduleId,
        completedById: userId,
        notes: 'PM completed',
      },
    });

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

    await prisma.pmSchedule.update({
      where: { id: scheduleId },
      data: { lastCompletedAt: now, nextDueDate: nextDue },
    });

    revalidatePath('/pm');
    redirect('/pm');
  }

  const now = new Date();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Preventive Maintenance & Schedules</h1>
        <p className="text-sm text-gray-500">Manage PM, AMC, and calibration schedules</p>
      </div>

      {/* PM Schedules */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">PM Schedules</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schedules.map((pm) => {
            const isOverdue = pm.nextDueDate && pm.nextDueDate < now;
            const isDueSoon = pm.nextDueDate && !isOverdue && (pm.nextDueDate.getTime() - now.getTime()) < pm.leadDays * 86400000;
            return (
              <div key={pm.id} className={`card p-5 ${isOverdue ? 'border-red-300 bg-red-50' : isDueSoon ? 'border-yellow-300 bg-yellow-50' : ''}`}>
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
                    <span className={`font-medium ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : 'text-gray-900'}`}>
                      {pm.nextDueDate ? formatDate(pm.nextDueDate) : 'Not set'}
                    </span>
                  </div>
                  <form action={markPmComplete.bind(null, pm.id)}>
                    <button type="submit" className="btn-success text-xs px-3 py-1.5">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Mark Done
                    </button>
                  </form>
                </div>
                {pm.logs[0] && (
                  <p className="mt-2 text-xs text-gray-500">
                    Last done: {formatDate(pm.logs[0].completedAt)} by {pm.logs[0].completedBy.name}
                  </p>
                )}
              </div>
            );
          })}
          {schedules.length === 0 && (
            <p className="col-span-3 py-8 text-center text-gray-500">No PM schedules configured</p>
          )}
        </div>
      </div>

      {/* AMC Records */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">AMC Contracts</h2>
        <div className="card overflow-hidden">
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
      </div>

      {/* Calibration Records */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Calibration Records</h2>
        <div className="card overflow-hidden">
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
      </div>
    </div>
  );
}
