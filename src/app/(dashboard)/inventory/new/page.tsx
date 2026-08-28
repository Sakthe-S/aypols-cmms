import { execute } from '@/lib/db';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function NewPartPage() {
  async function createPart(formData: FormData) {
    'use server';
    await execute(
      `INSERT INTO spare_parts (part_code, part_name, category, unit, purchase_rate, current_qty, min_threshold, reorder_qty, storage_room, rack_bin, supplier, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        formData.get('partCode') as string,
        formData.get('partName') as string,
        formData.get('category') as string || null,
        formData.get('unit') as string,
        parseFloat(formData.get('purchaseRate') as string) || 0,
        parseFloat(formData.get('currentQty') as string) || 0,
        parseFloat(formData.get('minThreshold') as string) || 0,
        parseFloat(formData.get('reorderQty') as string) || 0,
        formData.get('storageRoom') as string || null,
        formData.get('rackBin') as string || null,
        formData.get('supplier') as string || null,
        formData.get('notes') as string || null,
      ]
    );
    redirect('/inventory');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add New Spare Part</h1>
        <p className="text-sm text-gray-500">Add a part to the inventory master</p>
      </div>

      <form action={createPart} className="card space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Part Code *</label>
            <input type="text" name="partCode" className="input-field" required placeholder="e.g. BRG-001" />
          </div>
          <div>
            <label className="label">Part Name *</label>
            <input type="text" name="partName" className="input-field" required placeholder="e.g. Main Bearing" />
          </div>
          <div>
            <label className="label">Category</label>
            <select name="category" className="input-field">
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
            <select name="unit" className="input-field" required>
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
            <input type="number" name="purchaseRate" className="input-field" step="0.01" required />
          </div>
          <div>
            <label className="label">Current Quantity *</label>
            <input type="number" name="currentQty" className="input-field" step="0.01" required defaultValue="0" />
          </div>
          <div>
            <label className="label">Minimum Threshold *</label>
            <input type="number" name="minThreshold" className="input-field" step="0.01" required defaultValue="0" />
          </div>
          <div>
            <label className="label">Reorder Quantity</label>
            <input type="number" name="reorderQty" className="input-field" step="0.01" defaultValue="0" />
          </div>
          <div>
            <label className="label">Storage Room</label>
            <input type="text" name="storageRoom" className="input-field" placeholder="e.g. Main Store" />
          </div>
          <div>
            <label className="label">Rack / Bin</label>
            <input type="text" name="rackBin" className="input-field" placeholder="e.g. R1-B1" />
          </div>
          <div>
            <label className="label">Supplier</label>
            <input type="text" name="supplier" className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea name="notes" className="input-field" rows={2} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">Add Part</button>
          <a href="/inventory" className="btn-secondary">Cancel</a>
        </div>
      </form>
    </div>
  );
}
