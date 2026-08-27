import prisma from '@/lib/prisma';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { Plus, Package, AlertTriangle, Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string; stock?: string };
}) {
  const where: any = {};
  if (searchParams.category && searchParams.category !== 'all') {
    where.category = searchParams.category;
  }
  if (searchParams.search) {
    where.OR = [
      { partName: { contains: searchParams.search } },
      { partCode: { contains: searchParams.search } },
    ];
  }
  if (searchParams.stock === 'low') {
    where.id = { in: (await prisma.$queryRawUnsafe<[{id: number}]>(`SELECT id FROM spare_parts WHERE current_qty <= min_threshold`)).map(r => r.id) };
  }

  const parts = await prisma.sparePart.findMany({
    where,
    orderBy: { partName: 'asc' },
  });

  const categories = await prisma.sparePart.findMany({
    select: { category: true },
    distinct: ['category'],
    where: { category: { not: null } },
  });

  const lowStockCountRaw = await prisma.$queryRawUnsafe<[{count: number}]>(
    `SELECT COUNT(*) as count FROM spare_parts WHERE current_qty <= min_threshold`
  );
  const lowStockCount = Number(lowStockCountRaw[0]?.count || 0);

  const totalValue = await prisma.sparePart.aggregate({
    _sum: { purchaseRate: true },
  });

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
                {totalValue._sum.purchaseRate ? formatCurrency(totalValue._sum.purchaseRate) : '₹0'}
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

      {/* Parts Table */}
      <div className="card overflow-hidden">
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
                  </tr>
                );
              })}
              {parts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                    No parts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
