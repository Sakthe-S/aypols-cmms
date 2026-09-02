import { query, queryOne, execute, toCamel } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import {
  User,
  Bell,
  Shield,
  Database,
  Save,
  Calendar,
  KeyRound,
  Building2,
  UserPlus,
  Lock,
} from 'lucide-react';
import { isWhatsAppConfigured, sendWhatsApp } from '@/lib/whatsapp';
import { ROLES, isAdmin as isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { whatsapp?: string; success?: string; error?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as any)?.id);
  const userRole = (session?.user as any)?.role;
  const isAdmin = isAdminRole(userRole);

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

  // Load app config (admin); lazily create a default row if missing
  let appConfigRow = (await queryOne<Record<string, unknown>>(
    `SELECT * FROM app_config ORDER BY id LIMIT 1`
  ));
  if (!appConfigRow) {
    await execute(`INSERT INTO app_config (company_name) VALUES ('Aypols Polymers')`);
    appConfigRow = await queryOne<Record<string, unknown>>(
      `SELECT * FROM app_config ORDER BY id LIMIT 1`
    );
  }
  const config = appConfigRow ? toCamel(appConfigRow) : {};

  // ---- Server Actions ----

  async function updateProfile(formData: FormData) {
    'use server';
    if (!userId) return;
    await execute(
      `UPDATE users SET name = $1, phone = $2, trade = $3 WHERE id = $4`,
      [
        (formData.get('name') as string) || '',
        (formData.get('phone') as string) || null,
        (formData.get('trade') as string) || null,
        userId,
      ]
    );
    revalidatePath('/settings');
    redirect('/settings');
  }

  async function changePassword(formData: FormData) {
    'use server';
    if (!userId) return;
    const current = formData.get('currentPassword') as string;
    const next = formData.get('newPassword') as string;
    const confirm = formData.get('confirmPassword') as string;
    if (!current || !next || next !== confirm || next.length < 6) {
      redirect('/settings?error=password');
    }
    const row = await queryOne<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId]
    );
    if (!row || !(await bcrypt.compare(current, row.password_hash))) {
      redirect('/settings?error=password');
    }
    const hash = await bcrypt.hash(next, 10);
    await execute(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, userId]);
    revalidatePath('/settings');
    redirect('/settings?success=password');
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
    if (!isAdmin) return;
    const targetUserId = Number(formData.get('userId'));
    const newRole = formData.get('role') as string;
    await execute(`UPDATE users SET role = $1 WHERE id = $2`, [newRole, targetUserId]);
    revalidatePath('/settings');
    redirect('/settings');
  }

  async function toggleUserActive(formData: FormData) {
    'use server';
    if (!isAdmin) return;
    const targetUserId = Number(formData.get('userId'));
    const isActive = formData.get('isActive') === 'true';
    await execute(`UPDATE users SET is_active = $1 WHERE id = $2`, [!isActive, targetUserId]);
    revalidatePath('/settings');
    redirect('/settings');
  }

  async function createUser(formData: FormData) {
    'use server';
    if (!isAdmin) return;
    const name = formData.get('name') as string;
    const email = (formData.get('email') as string).toLowerCase().trim();
    const role = formData.get('role') as string;
    const trade = (formData.get('trade') as string) || null;
    const phone = (formData.get('phone') as string) || null;
    const rawPass = formData.get('password') as string;
    if (!name || !email) redirect('/settings?error=create');
    if (!rawPass || rawPass.length < 6) redirect('/settings?error=password-create');
    const existing = await queryOne<{ id: number }>(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing) redirect('/settings?error=create');
    const hash = await bcrypt.hash(rawPass, 10);
    await execute(
      `INSERT INTO users (name, email, password_hash, role, trade, phone)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [name, email, hash, role, trade, phone]
    );
    revalidatePath('/settings');
    redirect('/settings?success=create');
  }

  async function updateConfig(formData: FormData) {
    'use server';
    if (!isAdmin) return;
    await execute(
      `UPDATE app_config SET
        company_name = $1, company_address = $2, company_phone = $3, company_email = $4,
        currency = $5, default_labor_rate = $6, default_pm_lead_days = $7, low_stock_threshold = $8,
        updated_at = NOW()
       WHERE id = $9`,
      [
        (formData.get('company_name') as string) || 'Aypols Polymers',
        (formData.get('company_address') as string) || null,
        (formData.get('company_phone') as string) || null,
        (formData.get('company_email') as string) || null,
        (formData.get('currency') as string) || 'INR',
        Number(formData.get('default_labor_rate')) || 0,
        Number(formData.get('default_pm_lead_days')) || 7,
        Number(formData.get('low_stock_threshold')) || 0,
        Number(config.id),
      ]
    );
    revalidatePath('/settings');
    redirect('/settings?success=config');
  }

  async function updatePmLeadDays(formData: FormData) {
    'use server';
    if (!isAdmin) return;
    const scheduleId = Number(formData.get('scheduleId'));
    const leadDays = Number(formData.get('leadDays'));
    await execute(`UPDATE pm_schedules SET lead_days = $1 WHERE id = $2`, [leadDays, scheduleId]);
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
        <p className="text-sm text-gray-500">
          Manage your profile, security, notifications, users, and system configuration
        </p>
      </div>

      {/* Success / error banners */}
      <Banner search={searchParams} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left column: profile, security, notifications */}
        <div className="space-y-8 lg:col-span-2">
          {/* My Profile */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <User className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">My Profile</h2>
            </div>
            <div className="card-body">
              <form action={updateProfile} className="max-w-xl space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Name</label>
                    <input type="text" name="name" defaultValue={currentUser?.name} className="input-field" />
                  </div>
                  <div>
                    <label className="label">Trade</label>
                    <input type="text" name="trade" defaultValue={currentUser?.trade || ''} placeholder="e.g. mechanical, electrical" className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" defaultValue={currentUser?.email} className="input-field" disabled />
                  <p className="mt-1 text-xs text-gray-400">Email cannot be changed</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Phone</label>
                    <input type="text" name="phone" defaultValue={currentUser?.phone || ''} className="input-field" />
                  </div>
                  <div>
                    <label className="label">Role</label>
                    <input type="text" defaultValue={currentUser?.role} className="input-field" disabled />
                  </div>
                </div>
                <button type="submit" className="btn-primary">
                  <Save className="mr-2 h-4 w-4" /> Save Profile
                </button>
              </form>
            </div>
          </div>

          {/* Change Password */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
            </div>
            <div className="card-body">
              <form action={changePassword} className="max-w-xl space-y-4">
                <div>
                  <label className="label">Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input type="password" name="currentPassword" required className="input-field pl-10" placeholder="Enter current password" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">New Password</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input type="password" name="newPassword" required minLength={6} className="input-field pl-10" placeholder="Min 6 characters" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Confirm New Password</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input type="password" name="confirmPassword" required className="input-field pl-10" placeholder="Re-enter new password" />
                    </div>
                  </div>
                </div>
                <button type="submit" className="btn-secondary">
                  <KeyRound className="mr-2 h-4 w-4" /> Update Password
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
        </div>

        {/* Right column: company/system info */}
        <div className="space-y-8">
          {/* Company Settings (Admin only) */}
          {isAdmin && (
            <div className="card">
              <div className="card-header flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Company Settings</h2>
              </div>
              <div className="card-body">
                <form action={updateConfig} className="space-y-4">
                  <div>
                    <label className="label">Company Name</label>
                    <input type="text" name="company_name" defaultValue={config.companyName || 'Aypols Polymers'} className="input-field" />
                  </div>
                  <div>
                    <label className="label">Address</label>
                    <textarea name="company_address" defaultValue={config.companyAddress || ''} rows={2} className="input-field" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Phone</label>
                      <input type="text" name="company_phone" defaultValue={config.companyPhone || ''} className="input-field" />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input type="email" name="company_email" defaultValue={config.companyEmail || ''} className="input-field" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Currency</label>
                      <select name="currency" defaultValue={config.currency || 'INR'} className="input-field">
                        <option value="INR">Indian Rupee (₹)</option>
                        <option value="USD">US Dollar ($)</option>
                        <option value="EUR">Euro (€)</option>
                        <option value="GBP">British Pound (£)</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Default Labor Rate / hr</label>
                      <input type="number" name="default_labor_rate" defaultValue={config.defaultLaborRate ?? 400} className="input-field" min="0" step="0.01" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Default PM Lead Days</label>
                      <input type="number" name="default_pm_lead_days" defaultValue={config.defaultPmLeadDays ?? 7} className="input-field" min="1" max="90" />
                    </div>
                    <div>
                      <label className="label">Low Stock Alert Threshold</label>
                      <input type="number" name="low_stock_threshold" defaultValue={config.lowStockThreshold ?? 0} className="input-field" min="0" />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary w-full">
                    <Save className="mr-2 h-4 w-4" /> Save Company Settings
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* System Information */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Database className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">System Information</h2>
            </div>
            <div className="card-body space-y-3">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <p className="text-xs text-gray-500">Application</p>
                <p className="text-sm font-medium">Aypols CMMS v1.0</p>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <p className="text-xs text-gray-500">Phase</p>
                <p className="text-sm font-medium">Phase 1 - Maintenance &amp; EHS</p>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <p className="text-xs text-gray-500">Total Users</p>
                <p className="text-sm font-medium">{allUsers.length}</p>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <p className="text-xs text-gray-500">Active Users</p>
                <p className="text-sm font-medium">{allUsers.filter((u) => u.isActive).length}</p>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <p className="text-xs text-gray-500">PM Schedules</p>
                <p className="text-sm font-medium">{pmSchedules.length}</p>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <p className="text-xs text-gray-500">Database</p>
                <p className="text-sm font-medium">PostgreSQL</p>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <p className="text-xs text-gray-500">Currency</p>
                <p className="text-sm font-medium">{config.currency || 'INR'}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-xs text-gray-500">WhatsApp Integration</p>
                <p className={`text-sm font-medium ${waConfigured ? 'text-green-600' : 'text-yellow-600'}`}>
                  {waConfigured ? 'Configured' : 'Pending API Setup'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Management (Admin only) */}
      {isAdmin && (
        <>
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
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase().replace('_', ' ')}</option>
                            ))}
                          </select>
                          <button type="submit" className="ml-1 text-xs text-primary-600 hover:underline">Update</button>
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

          {/* Add New User */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Add New User</h2>
            </div>
            <div className="card-body">
              <form action={createUser} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="label">Full Name *</label>
                  <input type="text" name="name" required className="input-field" placeholder="John Doe" />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input type="email" name="email" required className="input-field" placeholder="john@aypols.com" />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select name="role" defaultValue="EMPLOYEE" className="input-field">
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase().replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Trade</label>
                  <input type="text" name="trade" className="input-field" placeholder="e.g. mechanical" />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input type="text" name="phone" className="input-field" placeholder="9876543210" />
                </div>
                <div>
                  <label className="label">Initial Password *</label>
                  <input type="text" name="password" required minLength={6} className="input-field" placeholder="Minimum 6 characters" />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <button type="submit" className="btn-success">
                    <UserPlus className="mr-2 h-4 w-4" /> Create User
                  </button>
                  <p className="mt-2 text-xs text-gray-400">A password is required; the user can change it later.</p>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* PM Reminder Lead Days (Admin only) */}
      {isAdmin && (
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">PM Reminder Lead Days</h2>
          </div>
          <p className="px-6 pt-4 text-sm text-gray-500">
            Configure how many days before the due date reminders are sent for each PM schedule.
            Default applies to new schedules: <span className="font-medium">{config.defaultPmLeadDays ?? 7} days</span>.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header px-6 py-3">PM Task</th>
                  <th className="table-header px-6 py-3">Machine</th>
                  <th className="table-header px-6 py-3">Frequency</th>
                  <th className="table-header px-6 py-3">Lead Days</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Banner({ search }: { search?: { whatsapp?: string; success?: string; error?: string } }) {
  if (search?.error === 'password') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Password change failed. Check your current password and that the new password matches (min 6 characters).
      </div>
    );
  }
  if (search?.error === 'create') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Could not create user. Name and email are required, and the email must be unique.
      </div>
    );
  }
  if (search?.error === 'password-create') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Could not create user. An initial password of at least 6 characters is required.
      </div>
    );
  }
  if (search?.success === 'password') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Your password has been updated successfully.
      </div>
    );
  }
  if (search?.success === 'create') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        New user created successfully.
      </div>
    );
  }
  if (search?.success === 'config') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Company settings saved.
      </div>
    );
  }
  return null;
}
