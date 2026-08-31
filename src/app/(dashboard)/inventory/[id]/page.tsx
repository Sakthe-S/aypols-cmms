import { query, queryOne, execute, withTransaction, toCamel } from '@/lib/db';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AlertTriangle, Trash2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PartDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as any)?.id);
  const userRole = (session?.user as any)?.role;
  const canDelete = userRole === 'STORE_ADMIN' || userRole === 'ADMIN';
  const partId = Number(params.id);

  const partRow = await queryOne<Record<string, unknown>>(
    `SELECT * FROM spare_parts WHERE id = $1`,
    [partId]
  );

  if (!partRow) notFound();

  const [txRows, usageRows] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT st.*, u.name AS user_name
       FROM stock_transactions st
       JOIN users u ON u.id = st.user_id
       WHERE st.part_id = $1
       ORDER BY st.created_at DESC
       LIMIT 20`,
      [partId]
    ),
    query<Record<string, unknown>>(
      `SELECT tsp.*, t.ticket_number
       FROM ticket_spare_parts tsp
       JOIN maintenance_tickets t ON t.id = tsp.ticket_id
       WHERE tsp.part_id = $1
       ORDER BY tsp.created_at DESC
       LIMIT 10`,
      [partId]
    ),
  ]);

  const part: any = {
    ...toCamel(partRow),
    stockTransactions: txRows.map(row => ({
      ...toCamel(row),
      user: { name: row['user_name'] },
    })),
    ticketUsage: usageRows.map(row => ({
      ...toCamel(row),
      ticket: { ticketNumber: row['ticket_number'] },
    })),
  };

  if (!part) notFound();
  const isLow = part.currentQty <= part.minThreshold;

  async function stockIn(formData: FormData) {
    'use server';
    const qty = parseFloat(formData.get('quantity') as string);
    const reason = formData.get('reason') as string;
    await withTransaction(async (tx) => {
      await tx.query(
        `UPDATE spare_parts SET current_qty = current_qty + $1 WHERE id = $2`,
        [qty, partId]
      );
      await tx.query(
        `INSERT INTO stock_transactions (part_id, transaction_type, quantity, reason, user_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [partId, 'stock_in', qty, reason, userId]
      );
    });
    revalidatePath(`/inventory/${partId}`);
    redirect(`/inventory/${partId}`);
  }

  async function stockOut(formData: FormData) {
    'use server';
    const qty = parseFloat(formData.get('quantity') as string);
    const reason = formData.get('reason') as string;

    const currentPart = await queryOne<any>(
      `SELECT * FROM spare_parts WHERE id = $1`,
      [partId]
    );
    if (!currentPart) throw new Error('Part not found');
    if (currentPart.current_qty < qty) throw new Error(`Insufficient stock. Available: ${currentPart.current_qty} ${currentPart.unit}`);

    await withTransaction(async (tx) => {
      await tx.query(
        `UPDATE spare_parts SET current_qty = current_qty - $1 WHERE id = $2`,
        [qty, partId]
      );
      await tx.query(
        `INSERT INTO stock_transactions (part_id, transaction_type, quantity, reason, user_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [partId, 'stock_out', qty, reason, userId]
      );
    });
    revalidatePath(`/inventory/${partId}`);
    redirect(`/inventory/${partId}`);
  }

  async function stockTransfer(formData: FormData) {
    'use server';
    const qty = parseFloat(formData.get('quantity') as string);
    const toLocation = formData.get('toLocation') as string;
    const reason = formData.get('reason') as string;

    const currentPart = await queryOne<any>(
      `SELECT * FROM spare_parts WHERE id = $1`,
      [partId]
    );
    if (!currentPart) throw new Error('Part not found');
    if (currentPart.current_qty < qty) throw new Error(`Insufficient stock. Available: ${currentPart.current_qty} ${currentPart.unit}`);

    await withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO stock_transactions (part_id, transaction_type, quantity, from_location, to_location, reason, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [partId, 'transfer', qty, currentPart.storage_room, toLocation, reason, userId]
      );
      await tx.query(
        `UPDATE spare_parts SET storage_room = $1 WHERE id = $2`,
        [toLocation, partId]
      );
    });
    revalidatePath(`/inventory/${partId}`);
    redirect(`/inventory/${partId}`);
  }

  async function deleteStockTransaction(formData: FormData) {
    'use server';
    if (userRole !== 'STORE_ADMIN' && userRole !== 'ADMIN') return;
    const transactionId = Number(formData.get('transactionId'));
    const txn = await queryOne<any>(
      `SELECT * FROM stock_transactions WHERE id = $1`,
      [transactionId]
    );
    if (!txn) return;
    if (txn.transaction_type === 'stock_in') {
      await execute(
        `UPDATE spare_parts SET current_qty = current_qty - $1 WHERE id = $2`,
        [txn.quantity, partId]
      );
    } else if (txn.transaction_type === 'stock_out') {
      await execute(
        `UPDATE spare_parts SET current_qty = current_qty + $1 WHERE id = $2`,
        [txn.quantity, partId]
      );
    }
    await execute(`DELETE FROM stock_transactions WHERE id = $1`, [transactionId]);
    revalidatePath(`/inventory/${partId}`);
    redirect(`/inventory/${partId}`);
  }

  async function deletePart() {
    'use server';
    if (userRole !== 'ADMIN') return;
    await execute(`DELETE FROM stock_transactions WHERE part_id = $1`, [partId]);
    await execute(`DELETE FROM ticket_spare_parts WHERE part_id = $1`, [partId]);
    await execute(`DELETE FROM spare_parts WHERE id = $1`, [partId]);
    redirect('/inventory');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{part.partName}</h1>
            <span className="font-mono text-sm text-gray-500">{part.partCode}</span>
            {isLow && (
              <span className="badge bg-red-100 text-red-800">
                <AlertTriangle className="mr-1 h-3 w-3" /> Low Stock
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {part.category} &middot; {part.storageRoom}{part.rackBin ? `, ${part.rackBin}` : ''}
          </p>
        </div>
        {userRole === 'ADMIN' && (
          <form action={deletePart} onSubmit={() => confirm('Delete this part and all its history?')}>
            <button type="submit" className="btn-danger">
              <Trash2 className="mr-2 h-4 w-4" /> Delete Part
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Stock actions */}
        <div className="space-y-6">
          {/* Current Stock */}
          <div className={`card p-6 ${isLow ? 'border-red-300 bg-red-50' : ''}`}>
            <h3 className="text-lg font-semibold text-gray-900">Current Stock</h3>
            <p className={`mt-2 text-4xl font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
              {part.currentQty} <span className="text-lg">{part.unit}</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">Min: {part.minThreshold} &middot; Reorder: {part.reorderQty}</p>
            <p className="mt-1 text-sm text-gray-500">Unit Price: {formatCurrency(part.purchaseRate)}</p>
          </div>

          {/* Stock In */}
          <div className="card p-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Stock In</h3>
            <form action={stockIn} className="space-y-3">
              <div>
                <label className="label">Quantity *</label>
                <input type="number" name="quantity" className="input-field" step="0.01" required />
              </div>
              <div>
                <label className="label">Reason</label>
                <input type="text" name="reason" className="input-field" placeholder="e.g. Purchase receipt" />
              </div>
              <button type="submit" className="btn-success w-full">Stock In</button>
            </form>
          </div>

          {/* Stock Out */}
          <div className="card p-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Stock Out</h3>
            <form action={stockOut} className="space-y-3">
              <div>
                <label className="label">Quantity *</label>
                <input type="number" name="quantity" className="input-field" step="0.01" max={part.currentQty} required />
              </div>
              <div>
                <label className="label">Reason</label>
                <input type="text" name="reason" className="input-field" placeholder="e.g. Issued for maintenance" />
              </div>
              <button type="submit" className="btn-danger w-full">Stock Out</button>
            </form>
          </div>

          {/* Stock Transfer */}
          <div className="card p-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Transfer Location</h3>
            <form action={stockTransfer} className="space-y-3">
              <div>
                <label className="label">Quantity *</label>
                <input type="number" name="quantity" className="input-field" step="0.01" max={part.currentQty} required />
              </div>
              <div>
                <label className="label">To Location *</label>
                <input type="text" name="toLocation" className="input-field" placeholder="e.g. Bay 2 Store" required />
              </div>
              <div>
                <label className="label">Reason</label>
                <input type="text" name="reason" className="input-field" placeholder="e.g. Transfer to production area" />
              </div>
              <button type="submit" className="btn-secondary w-full">Transfer</button>
            </form>
          </div>
        </div>

        {/* Part Info & Transaction History */}
        <div className="space-y-6 lg:col-span-2">
          {/* Part Details */}
          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Part Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Supplier</span>
                <p className="font-medium">{part.supplier || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Storage</span>
                <p className="font-medium">{part.storageRoom || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Rack/Bin</span>
                <p className="font-medium">{part.rackBin || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Notes</span>
                <p className="font-medium">{part.notes || '-'}</p>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-header px-6 py-3">Date</th>
                    <th className="table-header px-6 py-3">Type</th>
                    <th className="table-header px-6 py-3">Qty</th>
                    <th className="table-header px-6 py-3">User</th>
                    <th className="table-header px-6 py-3">Reason</th>
                    {canDelete && <th className="table-header px-6 py-3">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {part.stockTransactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-500">{formatDateTime(tx.createdAt)}</td>
                      <td className="px-6 py-3">
                        <span className={`badge ${
                          tx.transactionType === 'stock_in' ? 'bg-green-100 text-green-800' :
                          tx.transactionType === 'stock_out' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {tx.transactionType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-medium">
                        {tx.transactionType === 'stock_in' ? '+' : '-'}{tx.quantity} {part.unit}
                      </td>
                      <td className="px-6 py-3 text-gray-700">{tx.user.name}</td>
                      <td className="px-6 py-3 text-gray-500">{tx.reason || '-'}</td>
                      {canDelete && (
                        <td className="px-6 py-3">
                          <form action={deleteStockTransaction} onSubmit={() => confirm('Delete this transaction? Stock quantity will be adjusted.')}>
                            <input type="hidden" name="transactionId" value={tx.id} />
                            <button type="submit" className="btn-danger px-3 py-1 text-xs">
                              <Trash2 className="mr-1 h-3 w-3" /> Delete
                            </button>
                          </form>
                        </td>
                      )}
                    </tr>
                  ))}
                  {part.stockTransactions.length === 0 && (
                    <tr>
                      <td colSpan={canDelete ? 6 : 5} className="px-6 py-8 text-center text-gray-500">
                        No transactions yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-4 md:hidden">
              {part.stockTransactions.map((tx: any) => (
                <div key={tx.id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`badge shrink-0 ${
                      tx.transactionType === 'stock_in' ? 'bg-green-100 text-green-800' :
                      tx.transactionType === 'stock_out' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {tx.transactionType.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-semibold">
                      {tx.transactionType === 'stock_in' ? '+' : '-'}{tx.quantity} {part.unit}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>{tx.user.name}</span>
                    <span>{formatDateTime(tx.createdAt)}</span>
                  </div>
                  {tx.reason && <p className="mt-1 text-xs text-gray-500">Reason: {tx.reason}</p>}
                </div>
              ))}
              {part.stockTransactions.length === 0 && (
                <p className="py-4 text-center text-gray-500">No transactions yet</p>
              )}
            </div>
          </div>

          {/* Usage History */}
          {part.ticketUsage.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Usage History (Tickets)</h3>
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="table-header px-6 py-3">Ticket</th>
                      <th className="table-header px-6 py-3">Qty Used</th>
                      <th className="table-header px-6 py-3">Unit Price</th>
                      <th className="table-header px-6 py-3">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {part.ticketUsage.map((usage: any) => (
                      <tr key={usage.id}>
                        <td className="px-6 py-3">
                          <a href={`/tickets/${usage.ticketId}`} className="text-primary-600 hover:underline">
                            {usage.ticket.ticketNumber}
                          </a>
                        </td>
                        <td className="px-6 py-3">{usage.qty} {part.unit}</td>
                        <td className="px-6 py-3">{formatCurrency(usage.unitPrice)}</td>
                        <td className="px-6 py-3 font-medium">{formatCurrency(usage.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {part.ticketUsage.map((usage: any) => (
                  <div key={usage.id} className="rounded-lg border border-gray-100 p-3">
                    <a href={`/tickets/${usage.ticketId}`} className="text-primary-600 hover:underline">
                      {usage.ticket.ticketNumber}
                    </a>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-gray-500">{usage.qty} {part.unit}</span>
                      <span className="font-semibold">{formatCurrency(usage.totalCost)}</span>
                    </div>
                    <p className="text-xs text-gray-500">Unit Price: {formatCurrency(usage.unitPrice)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
