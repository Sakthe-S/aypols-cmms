import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendPendingWhatsAppNotifications, isWhatsAppConfigured } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  if (!isWhatsAppConfigured()) {
    return NextResponse.json({ configured: false, sent: 0, errors: 0 });
  }

  const result = await sendPendingWhatsAppNotifications();
  return NextResponse.json({ configured: true, ...result });
}