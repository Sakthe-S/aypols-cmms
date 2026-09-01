'use client';

import { useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';

type Photo = { file: File; url: string };

export default function TicketPhotoUpload() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const submitRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const syncSubmitFiles = (list: Photo[]) => {
    if (!submitRef.current) return;
    const dt = new DataTransfer();
    list.forEach((p) => dt.items.add(p.file));
    submitRef.current.files = dt.files;
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const next = [...photos];
    for (const f of Array.from(incoming)) {
      if (!f.type.startsWith('image/')) continue;
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    setPhotos(next);
    syncSubmitFiles(next);
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    const next = photos.filter((_, i) => i !== index);
    setPhotos(next);
    syncSubmitFiles(next);
  };

  const clearAll = () => {
    setPhotos([]);
    syncSubmitFiles([]);
  };

  return (
    <div>
      <input ref={submitRef} type="file" name="photos" accept="image/*" multiple className="hidden" />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="btn-secondary"
        >
          <Camera className="mr-2 h-4 w-4" /> Take Photo
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="btn-secondary"
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          {photos.length > 0 ? 'Add More' : 'Choose Photos'}
        </button>
        {photos.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="btn-secondary text-red-600"
          >
            <X className="mr-2 h-4 w-4" /> Clear ({photos.length})
          </button>
        )}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p, i) => (
            <div key={i} className="relative">
              <img src={p.url} alt={`Photo ${i + 1}`} className="h-20 w-24 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-1 text-white shadow-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
