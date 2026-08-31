import { query, execute } from '@/lib/db';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM;

export function isWhatsAppConfigured(): boolean {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN && FROM);
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10) digits = '91' + digits;
  return `whatsapp:+${digits}`;
}

type SendResult = { ok: boolean; status?: number; error?: string };

export async function sendWhatsApp(toPhone: string, body: string): Promise<SendResult> {
  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM) {
    return { ok: false, error: 'WhatsApp not configured' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
  const form = new URLSearchParams();
  form.set('To', normalizePhone(toPhone));
  form.set('From', FROM);
  form.set('Body', body);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, error: text.slice(0, 300) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function sendPendingWhatsAppNotifications(): Promise<{
  sent: number;
  errors: number;
}> {
  if (!isWhatsAppConfigured()) return { sent: 0, errors: 0 };

  type PendingRow = {
    id: number;
    phone: string;
    title: string;
    message: string;
  };

  const rows = await query<PendingRow>(
    `SELECT n.id, u.phone, n.title, n.message
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     WHERE n.sent_via_whatsapp = false
       AND u.whatsapp_enabled = true
       AND u.phone IS NOT NULL
       AND (
         NOT EXISTS (SELECT 1 FROM notification_preferences np
                     WHERE np.user_id = n.user_id AND np.type = n.type)
         OR EXISTS (SELECT 1 FROM notification_preferences np
                    WHERE np.user_id = n.user_id AND np.type = n.type
                      AND np.channel = 'whatsapp')
       )
     ORDER BY n.created_at ASC
     LIMIT 500`
  );

  let sent = 0;
  let errors = 0;

  for (const row of rows) {
    const res = await sendWhatsApp(
      row.phone,
      `*Aypols CMMS*\n${row.title}\n\n${row.message}`
    );
    if (res.ok) {
      await execute(
        `UPDATE notifications SET sent_via_whatsapp = true, whatsapp_sent_at = NOW() WHERE id = $1`,
        [row.id]
      );
      sent += 1;
    } else {
      errors += 1;
    }
  }

  return { sent, errors };
}