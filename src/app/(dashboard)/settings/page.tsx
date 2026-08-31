import { query, queryOne, execute, toCamel } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { User, Bell, Shield, Database, Save, Calendar } from 'lucide-react';
import { isWhatsAppConfigured, sendWhatsApp } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { whatsapp?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as any)?.id);
  const userRole = (session?.user as any)?.role;

  const currentUserRow = await queryOne<Record<string, unknown>>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );
  const currentUser = currentUserRow ? toCamel(currentUserRow) : null;
  const waConfigured = isWhatsAppConfigured();
  const waEnabled = Boolean((currentUser as any)?.whatsappEnabled);
  const userPhone = ((currentUser as any)?.phone as string | null) || null;

  const prefRows = (await query<{ type: string; channel: string }>(
    `SELECT type, channel FROM notification_preferences WHERE user_id = $1`,
    [userId]
  )).map(toCamel);
  const prefMap: Record<string, string> = {};
  for (const p of prefRows) prefMap[p.type] = p.channel;
  const allUsers = (await query<Record<string, unknown>>(
    `SELECT * FROM users ORDER BY name ASC`
  )).map(toCamel);

  async function updateProfile(formData: FormData) {
    'use server';
    if (!userId) return;
    await execute(
      `UPDATE users SET name = $1, phone = $2 WHERE id = $3`,
      [formData.get('name') as string, formData.get('phone') as string || null, userId]
    );
    revalidatePath('/settings');
    redirect('/settings');
  }

  async function updateWhatsAppPref(formData: FormData) {
    'use server';
    if (!userId) return;
    const enabled = formData.get('whatsappEnabled') === 'on';
    await execute(
      `UPDATE users SET whatsapp_enabled = $1 WHERE id = $2`,
      [enabled, userId]
    );
    revalidatePath('/settings');
    redirect('/settings');
  }

  async function updateNotificationPref(formData: FormData) {
    'use server';
    if (!userId) return;
    const type = formData.get('type') as string;
    const channel = formData.get('channel') as string;
    await execute(
      `INSERT INTO notification_preferences (user_id, type, channel)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, type) DO UPDATE SET channel = EXCLUDED.channel, updated_at = NOW()`,
      [userId, type, channel]
    );
    revalidatePath('/settings');
    redirect('/settings');
  }

  async function sendTestWhatsApp() {
    'use server';
    if (!userPhone) {
      redirect('/settings?whatsapp=error');
    }
    const res = await sendWhatsApp(
      userPhone,
      `*Aypols CMMS*\nTest WhatsApp notification from Settings.\n\nNotifications are working!`
    );
    redirect(res.ok ? '/settings?whatsapp=sent' : '/settings?whatsapp=error');
  }

  async function updateUserRole(formData: FormData) {
    'use server';
    if (userRole !== 'ADMIN') return;
    const targetUserId = Number(formData.get('userId'));
    const newRole = formData.get('role') as string;
    await execute(
      `UPDATE users SET role = $1 WHERE id = $2`,
      [newRole, targetUserId]
    );
    revalidatePath('/settings');
    redirect('/settings');
  }

  async function toggleUserActive(formData: FormData) {
    'use server';
    if (userRole !== 'ADMIN') return;
    const targetUserId = Number(formData.get('userId'));
    const isActive = formData.get('isActive') === 'true';
    await execute(
      `UPDATE users SET is_active = $1 WHERE id = $2`,
      [!isActive, targetUserId]
    );
    revalidatePath('/settings');
    redirect('/settings');
  }

  async function updatePmLeadDays(formData: FormData) {
    'use server';
    if (userRole !== 'ADMIN') return;
    const scheduleId = Number(formData.get('scheduleId'));
    const leadDays = Number(formData.get('leadDays'));
    await execute(
      `UPDATE pm_schedules SET lead_days = $1 WHERE id = $2`,
      [leadDays, scheduleId]
    );
    revalidatePath('/settings');
    redirect('/settings');
  }

  async function updateDefaultLaborRate(formData: FormData) {
    'use server';
    if (userRole !== 'ADMIN') return;
    // Store in a config - for now we update all open tickets' default
    revalidatePath('/settings');
    redirect('/settings');
  }

  const pmSchedules = (await query<Record<string, unknown>>(
    `SELECT ps.*, m.machine_name
     FROM pm_schedules ps JOIN machines m ON m.id = ps.machine_id
     WHERE ps.is_active = true`
  )).map(row => {
    const r = toCamel(row);
    return { ...r, machine: { machineName: r.machineName } };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Manage your profile, users, and system configuration</p>
      </div>

      {/* Profile Section */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <User className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">My Profile</h2>
        </div>
        <div className="card-body">
          <form action={updateProfile} className="max-w-xl space-y-4">
            <div>
              <label className="label">Name</label>
              <input type="text" name="name" defaultValue={currentUser?.name} className="input-field" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" defaultValue={currentUser?.email} className="input-field" disabled />
              <p className="mt-1 text-xs text-gray-400">Email cannot be changed</p>
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="text" name="phone" defaultValue={currentUser?.phone || ''} className="input-field" />
            </div>
            <div>
              <label className="label">Role</label>
              <input type="text" defaultValue={currentUser?.role} className="input-field" disabled />
            </div>
            <div>
              <label className="label">Trade</label>
              <input type="text" defaultValue={currentUser?.trade || 'Not assigned'} className="input-field" disabled />
            </div>
            <button type="submit" className="btn-primary">
              <Save className="mr-2 h-4 w-4" /> Save Profile
            </button>
          </form>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
        </div>
        <div className="card-body">
          <p className="mb-4 text-sm text-gray-500">
            Configure how you receive notifications. WhatsApp messages are delivered via Twilio.
          </p>

          {searchParams?.whatsapp === 'sent' && (
            <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
              Test WhatsApp message sent to your number.
            </p>
          )}
          {searchParams?.whatsapp === 'error' && (
            <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              Could not send WhatsApp. Check TWILIO env variables and your phone number.
            </p>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium text-gray-700">In-App Notifications</p>
                <p className="text-xs text-gray-500">Always on</p>
              </div>
              <span className="badge bg-green-100 text-green-800">Active</span>
            </div>

            <form
              action={updateWhatsAppPref}
              className="flex items-center justify-between gap-4 rounded-lg border p-3"
            >
              <div>
                <label htmlFor="whatsappEnabled" className="text-sm font-medium text-gray-700">
                  WhatsApp Notifications
                  <span className="ml-1 text-xs font-normal text-gray-500">(via Twilio)</span>
                </label>
                <p className="text-xs text-gray-500">
                  {userPhone
                    ? `Delivered to ${userPhone}`
                    : 'Set your phone number in My Profile first'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="whatsappEnabled"
                  name="whatsappEnabled"
                  defaultChecked={waEnabled}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600"
                />
                <button type="submit" className="btn-secondary py-1 text-xs">Save</button>
              </div>
            </form>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="text-sm">
                <p className="text-sm font-medium text-gray-700">WhatsApp Delivery Status</p>
                <p className="text-xs text-gray-500">
                  {waConfigured ? 'Twilio is configured' : 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env'}
                </p>
              </div>
              {!waConfigured ? (
                <span className="badge bg-yellow-100 text-yellow-800">Not Configured</span>
              ) : waEnabled ? (
                <span className="badge bg-green-100 text-green-800">Active</span>
              ) : (
                <span className="badge bg-gray-100 text-gray-800">Disabled</span>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Email Notifications</p>
                <p className="text-xs text-gray-500">Planned for a future phase</p>
              </div>
              <span className="badge bg-gray-100 text-gray-800">Future Phase</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
            {[
              { type: 'low_stock', label: 'Low Stock Alerts' },
              { type: 'pm_reminder', label: 'PM Reminders' },
              { type: 'ticket_assigned', label: 'Ticket Assignments' },
              { type: 'training_reminder', label: 'Training Reminders' },
            ].map(({ type, label }) => {
              const value = prefMap[type] ?? 'in_app';
              return (
                <form key={type} action={updateNotificationPref} className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="label">{label}</label>
                    <select
                      name="channel"
                      defaultValue={value}
                      disabled={!waEnabled}
                      className="input-field"
                    >
                      <option value="in_app">In-App Only</option>
                      <option value="whatsapp">In-App + WhatsApp</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={!waEnabled}
                    className="btn-secondary px-3 py-2 text-xs"
                  >
                    Save
                  </button>
                </form>
              );
            })}
          </div>

          <div className="mt-6 border-t pt-4">
            <form action={sendTestWhatsApp}>
              <button type="submit" className="btn-secondary">
                Send Test WhatsApp
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* User Management (Admin only) */}
      {userRole === 'ADMIN' && (
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">Name</th>
                  <th className="table-header px-6 py-3">Email</th>
                  <th className="table-header px-6 py-3">Role</th>
                  <th className="table-header px-6 py-3">Trade</th>
                  <th className="table-header px-6 py-3">Status</th>
                  <th className="table-header px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">{u.name}</td>
                    <td className="px-6 py-3 text-gray-500">{u.email}</td>
                    <td className="px-6 py-3">
                      <form action={updateUserRole} className="inline-flex">
                        <input type="hidden" name="userId" value={u.id} />
                        <select name="role" defaultValue={u.role} className="input-field py-1 text-xs">
                          <option value="EMPLOYEE">Employee</option>
                          <option value="TECHNICIAN">Technician</option>
                          <option value="SUPERVISOR">Supervisor</option>
                          <option value="STORE_ADMIN">Store Admin</option>
                          <option value="EHS_OFFICER">EHS Officer</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <button type="submit" className="text-xs text-primary-600 hover:underline ml-1">Update</button>
                      </form>
                    </td>
                    <td className="px-6 py-3 text-gray-500">{u.trade || '-'}</td>
                    <td className="px-6 py-3">
                      <span className={`badge ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <form action={toggleUserActive} className="inline">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="isActive" value={String(u.isActive)} />
                        <button type="submit" className={`text-xs font-medium ${u.isActive ? 'text-red-600 hover:underline' : 'text-green-600 hover:underline'}`}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PM Reminder Lead Days (Admin only) */}
      {userRole === 'ADMIN' && (
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">PM Reminder Lead Days</h2>
          </div>
          <p className="px-6 pt-4 text-sm text-gray-500">
            Configure how many days before the due date reminders are sent for each PM schedule.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">PM Task</th>
                  <th className="table-header px-6 py-3">Machine</th>
                  <th className="table-header px-6 py-3">Frequency</th>
                  <th className="table-header px-6 py-3">Lead Days</th>
                  <th className="table-header px-6 py-3">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pmSchedules.map((pm) => (
                  <tr key={pm.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">{pm.taskName}</td>
                    <td className="px-6 py-3 text-gray-500">{pm.machine.machineName}</td>
                    <td className="px-6 py-3 text-gray-500">{pm.frequency}</td>
                    <td className="px-6 py-3">
                      <form action={updatePmLeadDays} className="inline-flex items-center gap-2">
                        <input type="hidden" name="scheduleId" value={pm.id} />
                        <input type="number" name="leadDays" defaultValue={pm.leadDays} className="input-field w-20 py-1 text-xs" min="1" max="90" />
                        <span className="text-xs text-gray-500">days</span>
                        <button type="submit" className="text-xs text-primary-600 hover:underline">Save</button>
                      </form>
                    </td>
                    <td className="px-6 py-3"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System Information */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Database className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">System Information</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Application</p>
              <p className="font-medium">Aypols CMMS v1.0</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Phase</p>
              <p className="font-medium">Phase 1 - Maintenance & EHS</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Users</p>
              <p className="font-medium">{allUsers.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Database</p>
              <p className="font-medium">PostgreSQL</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Active Users</p>
              <p className="font-medium">{allUsers.filter(u => u.isActive).length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">PM Schedules</p>
              <p className="font-medium">{pmSchedules.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">WhatsApp Integration</p>
              <p className={`font-medium ${waConfigured ? 'text-green-600' : 'text-yellow-600'}`}>
                {waConfigured ? 'Configured' : 'Pending API Setup'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Phase 2 (Purchasing)</p>
              <p className="font-medium text-gray-400">Planned</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
