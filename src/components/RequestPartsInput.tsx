'use client';

import { useState, useRef } from 'react';
import SearchablePartSelect from '@/components/SearchablePartSelect';

export default function RequestPartsInput({ parts }: { parts: { id: number; partCode: string; partName: string }[] }) {
  const [rows, setRows] = useState<number[]>([0]);
  const nextRef = useRef(1);

  return (
    <div className="space-y-2">
      {rows.map((key) => (
        <div key={key} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label">Part</label>
            <SearchablePartSelect parts={parts} name="requestPartId" />
          </div>
          <div className="w-28">
            <label className="label">Qty</label>
            <input type="number" name="requestQty" className="input-field" step="1" min="1" defaultValue="" />
          </div>
          {rows.length > 1 && (
            <button
              type="button"
              className="mb-1 text-xs font-medium text-red-600 hover:underline"
              onClick={() => setRows((r) => r.filter((k) => k !== key))}
            >
              Remove
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="text-xs font-medium text-primary-600 hover:underline"
        onClick={() => {
          setRows((r) => [...r, nextRef.current]);
          nextRef.current += 1;
        }}
      >
        + Add another part
      </button>
    </div>
  );
}