'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Check, ChevronDown } from 'lucide-react';

type Machine = { id: number; machineName: string; location?: string | null };

export default function SearchableMachineSelect({ machines }: { machines: Machine[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Machine | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const norm = search.trim().toLowerCase();
  const filtered = machines.filter(
    (m) =>
      m.machineName.toLowerCase().includes(norm) ||
      (m.location ?? '').toLowerCase().includes(norm)
  );

  function pick(m: Machine) {
    setSelected(m);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <input type="hidden" name="machineId" value={selected ? String(selected.id) : ''} required />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input-field flex w-full items-center justify-between text-left"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? `${selected.machineName}${selected.location ? ` (${selected.location})` : ''}` : 'Search & select machine...'}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center border-b border-gray-100 px-3">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search machines..."
              className="w-full border-0 bg-transparent p-2 text-sm outline-none"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-gray-500">No machines found</li>
            )}
            {filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pick(m)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary-50"
                >
                  <span className="flex-1">
                    {m.machineName}
                    {m.location ? <span className="text-xs text-gray-500"> ({m.location})</span> : null}
                  </span>
                  {selected?.id === m.id && <Check className="h-4 w-4 text-primary-600" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
