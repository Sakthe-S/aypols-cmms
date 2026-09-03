import { query, execute, toCamel } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Bell } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import NotificationsList from '@/components/NotificationsList';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as any)?.id);

  const raw = (await query<Record<string, unknown>>(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  )).map(toCamel);

  const notifications = raw.map((n: any) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    isRead: !!n.isRead,
    createdAt: n.createdAt ? (n.createdAt instanceof Date ? n.createdAt.toISOString() : String(n.createdAt)) : null,
    sentViaWhatsapp: !!n.sentViaWhatsapp,
  }));

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markAllRead() {
    'use server';
    await execute(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    revalidatePath('/notifications');
  }

  async function markRead(id: number) {
    'use server';
    await execute(
      `UPDATE notifications SET is_read = true WHERE id = $1`,
      [id]
    );
    revalidatePath('/notifications');
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllRead}>
            <button type="submit" className="btn-secondary">Mark All Read</button>
          </form>
        )}
      </div>

      <NotificationsList notifications={notifications} markRead={markRead} />
    </div>
  );
}
