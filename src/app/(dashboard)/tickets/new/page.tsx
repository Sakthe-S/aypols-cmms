import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function NewTicketPage() {
  const session = await getServerSession(authOptions);
  const machines = await prisma.machine.findMany({ orderBy: { machineName: 'asc' } });

  async function createTicket(formData: FormData) {
    'use server';
    const machineId = Number(formData.get('machineId'));
    const priority = formData.get('priority') as string;
    const category = formData.get('category') as string;
    const issueDescription = formData.get('issueDescription') as string;
    const userId = Number((session?.user as any)?.id);

    const lastTicket = await prisma.maintenanceTicket.findFirst({
      orderBy: { id: 'desc' },
    });
    const nextNum = (lastTicket?.id || 0) + 1;
    const year = new Date().getFullYear();
    const ticketNumber = `TKT-${year}-${String(nextNum).padStart(3, '0')}`;

    await prisma.maintenanceTicket.create({
      data: {
        ticketNumber,
        machineId,
        reportedById: userId,
        priority,
        category,
        issueDescription,
      },
    });

    redirect('/tickets');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Raise New Ticket</h1>
        <p className="text-sm text-gray-500">Report a maintenance issue or breakdown</p>
      </div>

      <form action={createTicket} className="card space-y-6 p-6">
        <div>
          <label className="label">Machine *</label>
          <select name="machineId" className="input-field" required>
            <option value="">Select machine</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.machineName} ({m.location})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Priority *</label>
            <select name="priority" className="input-field" required>
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select name="category" className="input-field">
              <option value="">Select category</option>
              <option value="mechanical">Mechanical</option>
              <option value="electrical">Electrical</option>
              <option value="hydraulic">Hydraulic</option>
              <option value="pneumatic">Pneumatic</option>
              <option value="instrumentation">Instrumentation</option>
              <option value="civil">Civil</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Issue Description *</label>
          <textarea
            name="issueDescription"
            className="input-field"
            rows={4}
            placeholder="Describe the issue in detail..."
            required
          />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">
            Submit Ticket
          </button>
          <a href="/tickets" className="btn-secondary">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
