import { queryOne, execute, toCamel } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function EditPartPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  if (userRole !== 'STORE_ADMIN' && userRole !== 'ADMIN') redirect('/inventory');

  const partId = Number(params.id);
  const partRow = await queryOne<Record<string, unknown>>(
    `SELECT * FROM spare_parts WHERE id = $1`,
    [partId]
  );
  if (!partRow) notFound();
  const part: any = toCamel(partRow);

  async function updatePart(formData: FormData) {
    'use server';
    if (userRole !== 'STORE_ADMIN' && userRole !== 'ADMIN') return;
    await execute(
      `UPDATE spare_parts SET
        part_name = $1, category = $2, unit = $3, purchase_rate = $4,
        reorder_qty = $5, storage_room = $6, rack_bin = $7, supplier = $8,
        notes = $9, hsn_sac = $10, sale_rate = $11
       WHERE id = $12`,
      [
        formData.get('partName') as string,
        (formData.get('category') as string) || null,
        formData.get('unit') as string,
        parseFloat(formData.get('purchaseRate') as string) || 0,
        parseFloat(formData.get('reorderQty') as string) || 0,
        (formData.get('storageRoom') as string) || null,
        (formData.get('rackBin') as string) || null,
        (formData.get('supplier') as string) || null,
        (formData.get('notes') as string) || null,
        (formData.get('hsnSac') as string) || null,
        parseFloat(formData.get('saleRate') as string) || 0,
        partId,
      ]
    );
    revalidatePath(`/inventory/${partId}`);
    redirect(`/inventory/${partId}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Spare Part</h1>
        <p className="text-sm text-gray-500">
          {part.partCode} &middot; {part.partName}
        </p>
      </div>

      <form action={updatePart} className="card space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Part Name *</label>
            <input type="text" name="partName" className="input-field" required defaultValue={part.partName} />
          </div>
          <div>
            <label className="label">Category</label>
            <select name="category" className="input-field" defaultValue={part.category || ''}>
              <option value="">Select category</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Electrical">Electrical</option>
              <option value="Hydraulic">Hydraulic</option>
              <option value="Instrumentation">Instrumentation</option>
              <option value="Consumable">Consumable</option>
              <option value="Safety">Safety</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Unit *</label>
            <select name="unit" className="input-field" required defaultValue={part.unit || 'pcs'}>
              <option value="pcs">Pcs</option>
              <option value="kg">Kg</option>
              <option value="litre">Litre</option>
              <option value="meter">Meter</option>
              <option value="set">Set</option>
              <option value="box">Box</option>
            </select>
          </div>
          <div>
            <label className="label">Purchase Rate (₹) *</label>
            <input type="number" name="purchaseRate" className="input-field" step="0.01" required defaultValue={part.purchaseRate} />
          </div>
          <div>
            <label className="label">Sale Rate (₹)</label>
            <input type="number" name="saleRate" className="input-field" step="0.01" defaultValue={part.saleRate || ''} />
          </div>
          <div>
            <label className="label">HSN / SAC Code</label>
            <input type="text" name="hsnSac" className="input-field" maxLength={10} defaultValue={part.hsnSac || ''} />
          </div>
          <div>
            <label className="label">Reorder Quantity</label>
            <input type="number" name="reorderQty" className="input-field" step="0.01" defaultValue={part.reorderQty || 0} />
          </div>
          <div>
            <label className="label">Storage Room</label>
            <input type="text" name="storageRoom" className="input-field" defaultValue={part.storageRoom || ''} />
          </div>
          <div>
            <label className="label">Rack / Bin</label>
            <input type="text" name="rackBin" className="input-field" defaultValue={part.rackBin || ''} />
          </div>
          <div>
            <label className="label">Supplier</label>
            <input type="text" name="supplier" className="input-field" defaultValue={part.supplier || ''} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea name="notes" className="input-field" rows={2} defaultValue={part.notes || ''} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">Save Changes</button>
          <a href={`/inventory/${partId}`} className="btn-secondary">Cancel</a>
        </div>
      </form>
    </div>
  );
}