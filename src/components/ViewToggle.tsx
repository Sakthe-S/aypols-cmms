'use client';

import { LayoutGrid, Table as TableIcon } from 'lucide-react';

export type ViewMode = 'card' | 'table';

export default function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
      <button
        type="button"
        onClick={() => onChange('card')}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'card' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" /> Box
      </button>
      <button
        type="button"
        onClick={() => onChange('table')}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'table' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
        }`}
      >
        <TableIcon className="h-3.5 w-3.5" /> Table
      </button>
    </div>
  );
}
