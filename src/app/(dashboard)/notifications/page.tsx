import { query, execute, toCamel } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';
import { Bell, CheckCircle, AlertTriangle, Calendar, Package, Ticket } from 'lucide-react';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as any)?.id);

  const notifications = (await query<Record<string, unknown>>(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  )).map(toCamel);

  const unreadCount = notifications.filter(n => !(n as any).isRead).length;

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

  const getIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return <Package className="h-5 w-5 text-red-500" />;
      case 'pm_reminder': return <Calendar className="h-5 w-5 text-yellow-500" />;
      case 'ticket_assigned': return <Ticket className="h-5 w-5 text-blue-500" />;
      case 'escalation': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'training_reminder': return <CheckCircle className="h-5 w-5 text-purple-500" />;
      default: return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

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

      <div className="space-y-2">
        {notifications.map((n) => (
          <form key={n.id} action={markRead.bind(null, n.id)}>
            <button
              type="submit"
              className={`card w-full p-4 text-left transition-colors hover:shadow-md ${
                !n.isRead ? 'border-l-4 border-l-primary-500 bg-primary-50/30' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getIcon(n.type)}</div>
                <div className="flex-1">
                  <h3 className={`text-sm ${!n.isRead ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                    {n.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">{n.message}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <span className="h-2.5 w-2.5 rounded-full bg-primary-500" />
                )}
              </div>
            </button>
          </form>
        ))}
        {notifications.length === 0 && (
          <div className="card py-12 text-center">
            <Bell className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-gray-500">No notifications</p>
          </div>
        )}
      </div>
    </div>
  );
}
