import prisma from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function NewMachinePage() {
  async function createMachine(formData: FormData) {
    'use server';
    await prisma.machine.create({
      data: {
        machineName: formData.get('machineName') as string,
        serialNumber: formData.get('serialNumber') as string || undefined,
        department: formData.get('department') as string || undefined,
        location: formData.get('location') as string || undefined,
        manufacturer: formData.get('manufacturer') as string || undefined,
        model: formData.get('model') as string || undefined,
        installationDate: formData.get('installationDate')
          ? new Date(formData.get('installationDate') as string)
          : undefined,
      },
    });
    redirect('/machines');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add New Machine</h1>
        <p className="text-sm text-gray-500">Register a new machine or asset</p>
      </div>

      <form action={createMachine} className="card space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Machine Name *</label>
            <input type="text" name="machineName" className="input-field" required placeholder="e.g. Mixer M101" />
          </div>
          <div>
            <label className="label">Serial Number</label>
            <input type="text" name="serialNumber" className="input-field" placeholder="e.g. MX-2020-001" />
          </div>
          <div>
            <label className="label">Department</label>
            <input type="text" name="department" className="input-field" placeholder="e.g. Production" />
          </div>
          <div>
            <label className="label">Location</label>
            <input type="text" name="location" className="input-field" placeholder="e.g. Bay 1" />
          </div>
          <div>
            <label className="label">Installation Date</label>
            <input type="date" name="installationDate" className="input-field" />
          </div>
          <div>
            <label className="label">Manufacturer</label>
            <input type="text" name="manufacturer" className="input-field" />
          </div>
          <div>
            <label className="label">Model</label>
            <input type="text" name="model" className="input-field" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">Add Machine</button>
          <a href="/machines" className="btn-secondary">Cancel</a>
        </div>
      </form>
    </div>
  );
}
