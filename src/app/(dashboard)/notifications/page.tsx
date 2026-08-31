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
                  {n.sentViaWhatsapp && (
                    <span className="mt-1 inline-flex items-center text-xs text-green-600">
                      <svg className="mr-1 h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2A10 10 0 0 0 2 12c0 1.77.47 3.46 1.3 4.94L2 22l5.18-1.27A9.94 9.94 0 0 0 12 22a10 10 0 1 0 0-20Zm0 18c-1.66 0-3.24-.5-4.56-1.36l-.33-.2-3.07.75.76-3.02-.21-.34A7.97 7.97 0 1 1 12 20Zm5-5.94c-.27-.14-1.62-.8-1.87-.89-.25-.1-.43-.14-.62.14-.18.28-.71.89-.87 1.07-.16.18-.32.2-.59.07-.27-.14-1.15-.42-2.19-1.35-.81-.72-1.35-1.61-1.51-1.88-.16-.27-.02-.42.12-.55.12-.12.27-.32.4-.48.13-.16.18-.27.27-.46.09-.18.04-.34-.02-.48-.07-.14-.62-1.49-.85-2.04-.22-.53-.45-.46-.62-.47h-.53c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.29 0 1.35.98 2.66 1.12 2.84.14.18 1.93 2.95 4.68 4.14.65.28 1.16.45 1.56.57.66.21 1.25.18 1.72.11.53-.08 1.62-.66 1.85-1.3.23-.64.23-1.18.16-1.3-.07-.12-.25-.18-.52-.32Z"/>
                      </svg>
                      WhatsApp
                    </span>
                  )}
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
