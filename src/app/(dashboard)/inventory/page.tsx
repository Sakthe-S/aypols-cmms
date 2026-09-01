import { query, queryOne, execute, toCamel } from '@/lib/db';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { Plus, Package, AlertTriangle, Search } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ConfirmForm from '@/components/ConfirmForm';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string; stock?: string };
}) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const canDelete = userRole === 'STORE_ADMIN' || userRole === 'ADMIN';
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (searchParams.category && searchParams.category !== 'all') {
    params.push(searchParams.category);
    conditions.push(`category = $${params.length}`);
  }
  if (searchParams.search) {
    params.push(`%${searchParams.search}%`, `%${searchParams.search}%`);
    conditions.push(`(part_name ILIKE $${params.length - 1} OR part_code ILIKE $${params.length})`);
  }
  if (searchParams.stock === 'low') {
    conditions.push(`current_qty <= min_threshold`);
  }
  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const parts = (await query<Record<string, unknown>>(
    `SELECT * FROM spare_parts ${whereSql} ORDER BY part_name ASC`,
    params
  )).map(toCamel);

  const categories = (await query<Record<string, unknown>>(
    `SELECT DISTINCT category FROM spare_parts WHERE category IS NOT NULL AND category != ''`
  )).map(toCamel);

  const lowStockCount = (await queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM spare_parts WHERE current_qty <= min_threshold`
  ))?.count || 0;

  const totalValue = (await queryOne<{ total: number | null }>(
    `SELECT COALESCE(SUM(purchase_rate), 0)::float8 AS total FROM spare_parts`
  ))?.total || 0;

  async function deletePart(formData: FormData) {
    'use server';
    if (userRole !== 'STORE_ADMIN' && userRole !== 'ADMIN') return;
    const partId = Number(formData.get('id'));
    await execute(`DELETE FROM stock_transactions WHERE part_id = $1`, [partId]);
    await execute(`DELETE FROM ticket_spare_parts WHERE part_id = $1`, [partId]);
    await execute(`DELETE FROM spare_parts WHERE id = $1`, [partId]);
    revalidatePath('/inventory');
    redirect('/inventory');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Spare Parts Inventory</h1>
          <p className="text-sm text-gray-500">{parts.length} parts &middot; {lowStockCount} low stock alerts</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/transactions" className="btn-secondary">
            Stock Ledger
          </Link>
          <Link href="/inventory/new" className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Add Part
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <Package className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Parts</p>
              <p className="text-xl font-bold">{parts.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Low Stock Items</p>
              <p className="text-xl font-bold text-red-600">{lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Stock Value</p>
              <p className="text-xl font-bold">
                {totalValue ? formatCurrency(totalValue) : '₹0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <form className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                name="search"
                placeholder="Search parts..."
                defaultValue={searchParams.search}
                className="input-field pl-10"
              />
            </div>
          </div>
          <select name="category" defaultValue={searchParams.category || 'all'} className="input-field w-auto">
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.category} value={c.category!}>{c.category}</option>
            ))}
          </select>
          <select name="stock" defaultValue={searchParams.stock || 'all'} className="input-field w-auto">
            <option value="all">All Stock</option>
            <option value="low">Low Stock Only</option>
          </select>
          <button type="submit" className="btn-secondary">Filter</button>
        </form>
      </div>

      {/* Parts Table (desktop) */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header px-6 py-3">Part Code</th>
                <th className="table-header px-6 py-3">Part Name</th>
                <th className="table-header px-6 py-3">Category</th>
                <th className="table-header px-6 py-3">Qty</th>
                <th className="table-header px-6 py-3">Min Threshold</th>
                <th className="table-header px-6 py-3">Unit Price</th>
                <th className="table-header px-6 py-3">Location</th>
                <th className="table-header px-6 py-3">Status</th>
                {canDelete && <th className="table-header px-6 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parts.map((part) => {
                const isLow = part.currentQty <= part.minThreshold;
                return (
                  <tr key={part.id} className={`hover:bg-gray-50 ${isLow ? 'bg-red-50' : ''}`}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link href={`/inventory/${part.id}`} className="font-semibold text-primary-600 hover:underline">
                        {part.partCode}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {part.partName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{part.category || '-'}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold">
                      {part.currentQty} {part.unit}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{part.minThreshold}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {formatCurrency(part.purchaseRate)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {part.storageRoom}{part.rackBin ? `, ${part.rackBin}` : ''}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {isLow ? (
                        <span className="badge bg-red-100 text-red-800">
                          <AlertTriangle className="mr-1 h-3 w-3" /> Low Stock
                        </span>
                      ) : (
                        <span className="badge bg-green-100 text-green-800">In Stock</span>
                      )}
                    </td>
                    {canDelete && (
                      <td className="whitespace-nowrap px-6 py-4">
                        <ConfirmForm action={deletePart} message="Delete this part and its history?" className="inline">
                          <input type="hidden" name="id" value={part.id} />
                          <button type="submit" className="btn-danger px-3 py-1 text-xs">
                            Delete
                          </button>
                        </ConfirmForm>
                      </td>
                    )}
                  </tr>
                );
              })}
              {parts.length === 0 && (
                <tr>
                  <td colSpan={canDelete ? 9 : 8} className="px-6 py-12 text-center text-sm text-gray-500">
                    No parts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parts Cards (mobile) */}
      <div className="space-y-3 md:hidden">
        {parts.map((part) => {
          const isLow = part.currentQty <= part.minThreshold;
          return (
            <div
              key={part.id}
              className={`card block p-4 hover:shadow-md transition-shadow ${isLow ? 'border-red-200 bg-red-50/30' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/inventory/${part.id}`} className="font-semibold text-primary-600">{part.partCode}</Link>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{part.partName}</p>
                  <p className="text-xs text-gray-500">{part.category || '-'}</p>
                </div>
                {isLow ? (
                  <span className="badge shrink-0 bg-red-100 text-red-800">
                    <AlertTriangle className="mr-1 h-3 w-3" /> Low Stock
                  </span>
                ) : (
                  <span className="badge shrink-0 bg-green-100 text-green-800">In Stock</span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center">
                <div>
                  <p className="text-xs text-gray-500">Qty</p>
                  <p className="text-sm font-semibold">{part.currentQty} {part.unit}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Min</p>
                  <p className="text-sm text-gray-700">{part.minThreshold}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Price</p>
                  <p className="text-sm font-semibold text-primary-600">{formatCurrency(part.purchaseRate)}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">{part.storageRoom}{part.rackBin ? `, ${part.rackBin}` : ''}</p>
              {canDelete && (
                <ConfirmForm action={deletePart} message="Delete this part and its history?" className="mt-2">
                  <input type="hidden" name="id" value={part.id} />
                  <button type="submit" className="btn-danger w-full text-xs">
                    Delete Part
                  </button>
                </ConfirmForm>
              )}
            </div>
          );
        })}
        {parts.length === 0 && (
          <p className="card p-12 text-center text-sm text-gray-500">No parts found</p>
        )}
      </div>
    </div>
  );
}
