import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PartDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as any)?.id);
  const partId = Number(params.id);

  const part = await prisma.sparePart.findUnique({
    where: { id: partId },
    include: {
      stockTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: true },
      },
      ticketUsage: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { ticket: true },
      },
    },
  });

  if (!part) notFound();
  const isLow = part.currentQty <= part.minThreshold;

  async function stockIn(formData: FormData) {
    'use server';
    const qty = parseFloat(formData.get('quantity') as string);
    const reason = formData.get('reason') as string;
    await prisma.$transaction([
      prisma.sparePart.update({
        where: { id: partId },
        data: { currentQty: { increment: qty } },
      }),
      prisma.stockTransaction.create({
        data: {
          partId,
          transactionType: 'stock_in',
          quantity: qty,
          reason,
          userId,
        },
      }),
    ]);
    revalidatePath(`/inventory/${partId}`);
    redirect(`/inventory/${partId}`);
  }

  async function stockOut(formData: FormData) {
    'use server';
    const qty = parseFloat(formData.get('quantity') as string);
    const reason = formData.get('reason') as string;

    const currentPart = await prisma.sparePart.findUnique({ where: { id: partId } });
    if (!currentPart) throw new Error('Part not found');
    if (currentPart.currentQty < qty) throw new Error(`Insufficient stock. Available: ${currentPart.currentQty} ${currentPart.unit}`);

    await prisma.$transaction([
      prisma.sparePart.update({
        where: { id: partId },
        data: { currentQty: { decrement: qty } },
      }),
      prisma.stockTransaction.create({
        data: {
          partId,
          transactionType: 'stock_out',
          quantity: qty,
          reason,
          userId,
        },
      }),
    ]);
    revalidatePath(`/inventory/${partId}`);
    redirect(`/inventory/${partId}`);
  }

  async function stockTransfer(formData: FormData) {
    'use server';
    const qty = parseFloat(formData.get('quantity') as string);
    const toLocation = formData.get('toLocation') as string;
    const reason = formData.get('reason') as string;

    const currentPart = await prisma.sparePart.findUnique({ where: { id: partId } });
    if (!currentPart) throw new Error('Part not found');
    if (currentPart.currentQty < qty) throw new Error(`Insufficient stock. Available: ${currentPart.currentQty} ${currentPart.unit}`);

    await prisma.stockTransaction.create({
      data: {
        partId,
        transactionType: 'transfer',
        quantity: qty,
        fromLocation: currentPart.storageRoom,
        toLocation,
        reason,
        userId,
      },
    });
    await prisma.sparePart.update({
      where: { id: partId },
      data: { storageRoom: toLocation },
    });
    revalidatePath(`/inventory/${partId}`);
    redirect(`/inventory/${partId}`);
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-header px-6 py-3">Date</th>
                    <th className="table-header px-6 py-3">Type</th>
                    <th className="table-header px-6 py-3">Qty</th>
                    <th className="table-header px-6 py-3">User</th>
                    <th className="table-header px-6 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {part.stockTransactions.map((tx) => (
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
                    </tr>
                  ))}
                  {part.stockTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No transactions yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Usage History */}
          {part.ticketUsage.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Usage History (Tickets)</h3>
              </div>
              <div className="overflow-x-auto">
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
                    {part.ticketUsage.map((usage) => (
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
