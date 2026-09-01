import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'tickets');

export function isImageFile(file: { type: string }): boolean {
  return file.type.startsWith('image/');
}

export function toPublicPath(filePath: string): string {
  return '/uploads/tickets/' + path.basename(filePath);
}

export async function saveTicketPhoto(file: File, ticketId: number): Promise<string> {
  const ext = path.extname(file.name) || '.jpg';
  const safeExt = /^\.\w{1,8}$/.test(ext) ? ext.toLowerCase() : '.jpg';
  const filename = `ticket-${ticketId}-${Date.now()}-${randomUUID().slice(0, 8)}${safeExt}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  await mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return toPublicPath(filePath);
}

export async function saveTicketPhotos(files: File[], ticketId: number): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    if (!isImageFile(file)) continue;
    try {
      paths.push(await saveTicketPhoto(file, ticketId));
    } catch (err) {
      console.error('Failed to save ticket photo:', err);
    }
  }
  return paths;
}

export async function deleteTicketPhotos(photoPaths: string[]): Promise<void> {
  for (const p of photoPaths || []) {
    if (!p.startsWith('/uploads/tickets/')) continue;
    try {
      await unlink(path.join(process.cwd(), 'public', p.replace(/^\//, '')));
    } catch (err) {
      console.error('Failed to delete ticket photo:', p, err);
    }
  }
}
