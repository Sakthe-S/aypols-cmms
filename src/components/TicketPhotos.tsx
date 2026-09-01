'use client';

import { useState } from 'react';
import { Camera, X } from 'lucide-react';

export default function TicketPhotos({ paths }: { paths: string[] }) {
  const [active, setActive] = useState<number | null>(null);

  const valid = (paths || []).filter(Boolean);
  if (valid.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
        <Camera className="h-4 w-4 text-primary-600" /> Photos ({valid.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {valid.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className="overflow-hidden rounded-lg border border-gray-200 hover:opacity-90"
          >
            <img src={src} alt={`Photo ${i + 1}`} className="h-24 w-28 object-cover" />
          </button>
        ))}
      </div>

      {active !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            onClick={() => setActive(null)}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={valid[active]}
            alt={`Photo ${active + 1}`}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1 text-sm text-white">
            {active + 1} / {valid.length}
          </div>
        </div>
      )}
    </div>
  );
}
