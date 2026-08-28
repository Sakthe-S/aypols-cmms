import { query, queryOne, execute, toCamel } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { User, Bell, Shield, Database, Save, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as any)?.id);
  const userRole = (session?.user as any)?.role;

  const currentUserRow = await queryOne<Record<string, unknown>>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );
  const currentUser = currentUserRow ? toCamel(currentUserRow) : null;
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
            Configure how you receive notifications. WhatsApp integration is pending API setup.
          </p>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300 text-primary-600" />
              <span className="text-sm text-gray-700">In-App Notifications</span>
              <span className="badge bg-green-100 text-green-800">Active</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" disabled />
              <span className="text-sm text-gray-700">WhatsApp Notifications</span>
              <span className="badge bg-yellow-100 text-yellow-800">Pending Setup</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" disabled />
              <span className="text-sm text-gray-700">Email Notifications</span>
              <span className="badge bg-gray-100 text-gray-800">Future Phase</span>
            </label>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Low Stock Alerts</label>
              <select className="input-field" defaultValue="in_app">
                <option value="in_app">In-App Only</option>
                <option value="whatsapp" disabled>WhatsApp (Coming Soon)</option>
              </select>
            </div>
            <div>
              <label className="label">PM Reminders</label>
              <select className="input-field" defaultValue="in_app">
                <option value="in_app">In-App Only</option>
                <option value="whatsapp" disabled>WhatsApp (Coming Soon)</option>
              </select>
            </div>
            <div>
              <label className="label">Ticket Assignments</label>
              <select className="input-field" defaultValue="in_app">
                <option value="in_app">In-App Only</option>
                <option value="whatsapp" disabled>WhatsApp (Coming Soon)</option>
              </select>
            </div>
            <div>
              <label className="label">Training Reminders</label>
              <select className="input-field" defaultValue="in_app">
                <option value="in_app">In-App Only</option>
                <option value="whatsapp" disabled>WhatsApp (Coming Soon)</option>
              </select>
            </div>
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
              <p className="font-medium text-yellow-600">Pending</p>
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
