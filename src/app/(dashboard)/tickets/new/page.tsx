import { query, queryOne, execute, toCamel } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Camera } from 'lucide-react';
import TicketPhotoUpload from '@/components/TicketPhotoUpload';
import RequestPartsInput from '@/components/RequestPartsInput';
import SearchableMachineSelect from '@/components/SearchableMachineSelect';
import { saveTicketPhotos } from '@/lib/ticketPhotos';

export const dynamic = 'force-dynamic';

export default async function NewTicketPage() {
  const session = await getServerSession(authOptions);
  const machines = (await query<Record<string, unknown>>(
    `SELECT * FROM machines ORDER BY machine_name ASC`
  )).map(toCamel);
  const parts = (await query<Record<string, unknown>>(
    `SELECT id, part_code, part_name, current_qty, unit FROM spare_parts ORDER BY part_name ASC`
  )).map(toCamel);

  async function createTicket(formData: FormData) {
    'use server';
    const machineId = Number(formData.get('machineId'));
    const priority = formData.get('priority') as string;
    const category = formData.get('category') as string;
    const issueDescription = formData.get('issueDescription') as string;
    const expectedCompletionDate = formData.get('expectedCompletionDate') as string || null;
    const photoFiles = (formData.getAll('photos') as File[]).filter((f) => f && f.size > 0);
    const userId = Number((session?.user as any)?.id);
    if (!userId) return;

    const seqRes = await queryOne<{ ticket_number: string }>(
      `SELECT 'TKT-' || EXTRACT(YEAR FROM CURRENT_DATE)::int || '-' ||
              LPAD(nextval('maintenance_ticket_num_seq')::text, 3, '0') AS ticket_number`
    );
    const ticketNumber = seqRes?.ticket_number;
    if (!ticketNumber) return;

    // Optional parts requested at creation (REQ-6.1-01)
    const requestedParts: { partId: number; partCode: string; partName: string; qty: number; unit: string }[] = [];
    const requestPartIds = (formData.getAll('requestPartId') as string[]).map(Number);
    const requestQtys = (formData.getAll('requestQty') as string[]).map((v) => Number(v) || 0);
    const partRows = (await query<Record<string, unknown>>(
      `SELECT id, part_code, part_name, unit FROM spare_parts WHERE id = ANY($1)`,
      [requestPartIds]
    )).map(toCamel);
    for (let i = 0; i < requestPartIds.length; i++) {
      const pid = requestPartIds[i];
      const qty = requestQtys[i];
      if (!pid || qty <= 0) continue;
      const p = partRows.find((x: any) => x.id === pid);
      if (!p) continue;
      requestedParts.push({
        partId: pid,
        partCode: p.partCode,
        partName: p.partName,
        qty,
        unit: p.unit || 'pcs',
      });
    }

    const isEhs = category === 'environmental_health_safety' || category === 'EHS';

    const insertRes = await queryOne<{ id: number }>(
      `INSERT INTO maintenance_tickets (ticket_number, machine_id, reported_by_id, priority, category, issue_description, expected_completion_date, requested_parts, is_ehs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [ticketNumber, machineId, userId, priority, category || null, issueDescription, expectedCompletionDate || null, JSON.stringify(requestedParts), isEhs]
    );
    const ticketId = insertRes?.id;
    if (!ticketId) return;

    let photoPaths: string[] = [];
    if (photoFiles.length > 0) {
      photoPaths = await saveTicketPhotos(photoFiles, ticketId);
      await execute(
        `UPDATE maintenance_tickets SET photo_paths = $1 WHERE id = $2`,
        [photoPaths, ticketId]
      );
    }

    const machineRow = await queryOne<{ machine_name: string }>(
      `SELECT machine_name FROM machines WHERE id = $1`,
      [machineId]
    );
    const notifTitle = `New Ticket ${ticketNumber}`;
    const notifMessage = `${ticketNumber} - ${machineRow?.machine_name || ''}: ${String(issueDescription || '').slice(0, 120)}`;

    const supervisors = await query<{ id: number }>(
      `SELECT id FROM users WHERE role IN ('SUPERVISOR', 'ADMIN') AND is_active = true`
    );
    for (const sup of supervisors) {
      await execute(
        `INSERT INTO notifications (user_id, title, message, type, link_url)
         VALUES ($1, $2, $3, $4, $5)`,
        [sup.id, notifTitle, notifMessage, 'ticket_created', `/tickets/${ticketId}`]
      );
    }

    redirect('/tickets');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Raise New Ticket</h1>
        <p className="text-sm text-gray-500">Report a maintenance issue or breakdown</p>
      </div>

      <form action={createTicket} className="card space-y-6 p-6">
        <div>
          <label className="label">Machine *</label>
          <SearchableMachineSelect machines={machines as any} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Priority *</label>
            <select name="priority" className="input-field" required defaultValue="medium">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select name="category" className="input-field">
              <option value="">Select category</option>
              <option value="mechanical">Mechanical</option>
              <option value="electrical">Electrical</option>
              <option value="hydraulic">Hydraulic</option>
              <option value="pneumatic">Pneumatic</option>
              <option value="instrumentation">Instrumentation</option>
              <option value="civil">Civil</option>
              <option value="environmental_health_safety">EHS (Environmental, Health & Safety)</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Issue Description *</label>
          <textarea
            name="issueDescription"
            className="input-field"
            rows={4}
            placeholder="Describe the issue in detail..."
            required
          />
        </div>

        <div>
          <label className="label">Expected Completion Date</label>
          <input
            type="datetime-local"
            name="expectedCompletionDate"
            className="input-field"
          />
        </div>

        <div>
          <label className="label">
            <Camera className="mr-1 inline h-4 w-4 align-text-bottom" />
            Attach Photos (optional)
          </label>
          <TicketPhotoUpload />
          <p className="mt-1 text-xs text-gray-500">
            Capture a photo of the issue from your camera, or upload photos from your gallery.
          </p>
        </div>

        {/* Optional parts request (REQ-6.1-01) */}
        <div>
          <label className="label">Requested Spare Parts (optional)</label>
          <p className="mb-3 text-xs text-gray-500">
            List parts you anticipate needing for this job. These are recorded as a
            request when the ticket is raised and do not deduct stock.
          </p>
          <RequestPartsInput parts={parts} />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">
            Submit Ticket
          </button>
          <a href="/tickets" className="btn-secondary">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
