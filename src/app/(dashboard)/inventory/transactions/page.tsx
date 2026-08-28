import { query, toCamel } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage() {
  const rows = await query<Record<string, unknown>>(
    `SELECT st.*, p.part_name, p.part_code, p.unit, u.name AS user_name
     FROM stock_transactions st
     JOIN spare_parts p ON p.id = st.part_id
     JOIN users u ON u.id = st.user_id
     ORDER BY st.created_at DESC
     LIMIT 50`
  );

  const transactions = rows.map(row => ({
    ...toCamel(row),
    part: { partName: row['part_name'], partCode: row['part_code'], unit: row['unit'] },
    user: { name: row['user_name'] },
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stock Ledger</h1>
        <p className="text-sm text-gray-500">All stock movements across inventory</p>
      </div>

      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header px-6 py-3">Date</th>
                <th className="table-header px-6 py-3">Part</th>
                <th className="table-header px-6 py-3">Type</th>
                <th className="table-header px-6 py-3">Quantity</th>
                <th className="table-header px-6 py-3">User</th>
                <th className="table-header px-6 py-3">Reason</th>
                <th className="table-header px-6 py-3">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-500">{formatDateTime(tx.createdAt)}</td>
                  <td className="px-6 py-3">
                    <span className="font-medium">{tx.part.partName}</span>
                    <span className="ml-1 text-gray-500">({tx.part.partCode})</span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`badge ${
                      tx.transactionType === 'stock_in' ? 'bg-green-100 text-green-800' :
                      tx.transactionType === 'stock_out' ? 'bg-red-100 text-red-800' :
                      tx.transactionType === 'transfer' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {tx.transactionType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-semibold">
                    {tx.transactionType === 'stock_in' ? '+' : tx.transactionType === 'stock_out' ? '-' : ''}{tx.quantity} {tx.part.unit}
                  </td>
                  <td className="px-6 py-3 text-gray-700">{tx.user.name}</td>
                  <td className="px-6 py-3 text-gray-500">{tx.reason || '-'}</td>
                  <td className="px-6 py-3 text-gray-500">{tx.referencePo || '-'}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No transactions recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactions Cards (mobile) */}
      <div className="space-y-3 md:hidden">
        {transactions.map((tx) => (
          <div key={tx.id} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{tx.part.partName}</p>
                <p className="text-xs text-gray-500">{tx.part.partCode}</p>
              </div>
              <span className={`badge shrink-0 ${
                tx.transactionType === 'stock_in' ? 'bg-green-100 text-green-800' :
                tx.transactionType === 'stock_out' ? 'bg-red-100 text-red-800' :
                tx.transactionType === 'transfer' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {tx.transactionType.replace('_', ' ')}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-semibold">
                {tx.transactionType === 'stock_in' ? '+' : tx.transactionType === 'stock_out' ? '-' : ''}{tx.quantity} {tx.part.unit}
              </span>
              <span className="text-xs text-gray-500">{formatDateTime(tx.createdAt)}</span>
            </div>
            <div className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
              <p>User: {tx.user.name}</p>
              <p>Reason: {tx.reason || '-'}</p>
              {tx.referencePo && <p>Reference: {tx.referencePo}</p>}
            </div>
          </div>
        ))}
        {transactions.length === 0 && (
          <p className="card p-12 text-center text-gray-500">No transactions recorded</p>
        )}
      </div>
    </div>
  );
}
