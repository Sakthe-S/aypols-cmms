import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateReminders } from '@/lib/scheduled';
import { sendPendingWhatsAppNotifications, isWhatsAppConfigured } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

// Scheduled job endpoint. Intended to be called by an external scheduler
// (Vercel Cron / GitHub Actions / Windows Task Scheduler) with the CRON_SECRET
// header so it runs headlessly and does not depend on a user loading a page.
//
//   curl -X POST https://<host>/api/scheduled/run -H "x-cron-secret: <CRON_SECRET>"
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Headless cron: require the shared secret when it is configured.
  if (cronSecret) {
    const presented = req.headers.get('x-cron-secret');
    if (presented === cronSecret) {
      return runScheduled();
    }
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Fallback for in-app manual triggering: require an authenticated session.
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  return runScheduled();
}

async function runScheduled() {
  const started = Date.now();
  const reminder = await generateReminders();

  let whatsapp;
  if (isWhatsAppConfigured()) {
    whatsapp = await sendPendingWhatsAppNotifications();
  } else {
    whatsapp = { sent: 0, errors: 0 };
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - started,
    remindersCreated: reminder.created,
    whatsapp,
  });
}