import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { api } from '../../services/api.js';
import { User, ActivityLog } from '../../types/index.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Tabs } from '../../components/common/Tabs.js';
import { Modal } from '../../components/common/Modal.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { TableSkeleton } from '../../components/common/Skeleton.js';
import {
  ShieldCheck,
  Users,
  FileText,
  Download,
  Settings,
  Plus,
  Edit2,
  Lock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface AdminPageProps {
  initialTab?: 'users' | 'audit' | 'settings';
  onNavigate: (path: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  initialTab = 'users',
  onNavigate,
}) => {
  const { isAdmin } = useAuth();
  const { showToast } = useNotification();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // User Management Modals
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SALES',
    department: 'Sales & Outreach',
    phone: '',
  });

  const [editingUser, setEditingUser] = useState<User | null>(null);

  const fetchAdminData = async () => {
    if (!isAdmin) return;
    try {
      setIsLoading(true);
      const [usersRes, auditRes] = await Promise.all([
        api.users.list(),
        api.audit.list({ limit: '100' }),
      ]);
      setUsers(usersRes.users || []);
      setAuditLogs(auditRes.logs || []);
    } catch (err) {
      showToast('Failed to load admin records', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) return;
    try {
      await api.users.create(newUser);
      showToast('User account created successfully', 'success');
      setIsCreateUserModalOpen(false);
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'SALES',
        department: 'Sales & Outreach',
        phone: '',
      });
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create user', 'error');
    }
  };

  const handleUpdateUserRole = async (u: User, newRole: string) => {
    try {
      await api.users.update(u.id, { role: newRole });
      showToast(`Updated role for ${u.name}`, 'success');
      fetchAdminData();
    } catch (err) {
      showToast('Failed to update role', 'error');
    }
  };

  const handleToggleUserActive = async (u: User) => {
    try {
      await api.users.update(u.id, { isActive: !u.isActive });
      showToast(`User account ${u.isActive ? 'deactivated' : 'activated'}`, 'info');
      fetchAdminData();
    } catch (err) {
      showToast('Failed to update account status', 'error');
    }
  };

  const handleExport = async (entity: string) => {
    try {
      showToast(`Generating ${entity} export...`, 'info');
      await api.export.downloadCsv(entity);
      showToast('Export downloaded', 'success');
    } catch (err) {
      showToast('Export failed', 'error');
    }
  };

  if (!isAdmin) {
    return (
      <EmptyState
        title="Admin Access Required"
        description="This section is restricted to Octagram administrators."
        actionLabel="Go to Dashboard"
        onAction={() => onNavigate('/')}
      />
    );
  }

  const tabsList = [
    { id: 'users', label: 'Users & Roles', count: users.length },
    { id: 'audit', label: 'Activity & Audit Trail', count: auditLogs.length },
    { id: 'settings', label: 'Data Export & Settings' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-900">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-zinc-300" /> Admin & Governance
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            User provisioning, role-based access control, activity logs, and system data exports.
          </p>
        </div>

        {activeTab === 'users' && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateUserModalOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Provision User
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabsList}
        activeTab={activeTab}
        onChange={(tabId: string) => {
          setActiveTab(tabId as any);
          onNavigate(`/admin/${tabId}`);
        }}
      />

      {/* TAB 1: USERS & ROLES */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Assigned Role</th>
                  <th className="px-4 py-3">Account Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-850/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-100">{u.name}</div>
                      <div className="text-[11px] font-mono text-zinc-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{u.department || 'Operations'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleUpdateUserRole(u, e.target.value)}
                        className="px-2 py-1 bg-zinc-850 border border-zinc-750 rounded text-xs text-zinc-100 font-medium"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="SALES">SALES</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="subtle"
                        size="xs"
                        onClick={() => handleToggleUserActive(u)}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVITY & AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Append-Only System Audit Trail
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport('audit')}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export Audit CSV
            </Button>
          </div>

          <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor / User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target Entity</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-850/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-zinc-400 text-[11px] whitespace-nowrap">
                      {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm:ss')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-zinc-200">
                      {log.user?.name || 'System Auto-Engine'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] uppercase font-bold text-zinc-300 bg-zinc-850 px-1.5 py-0.5 rounded border border-zinc-750">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">
                      {log.entityType}
                    </td>
                    <td className="px-4 py-3 text-zinc-300 text-[11px] truncate max-w-md">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DATA EXPORT & SETTINGS */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Export Data Box */}
          <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-850 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" /> Export System Data (CSV)
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Download structured records for external analytics, accounting, or offline backup.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              {[
                { id: 'clients', label: 'Export Clients' },
                { id: 'leads', label: 'Export CRM Leads' },
                { id: 'tasks', label: 'Export Tasks' },
                { id: 'payments', label: 'Export Payments' },
                { id: 'expenses', label: 'Export Expenses' },
                { id: 'audit', label: 'Export Audit Logs' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleExport(item.id)}
                  className="p-3 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-200 font-medium text-xs transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>{item.label}</span>
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              ))}
            </div>
          </div>

          {/* System Configuration Info */}
          <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-850 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-sky-400" /> Platform Deployment Settings
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Subdomain deployment and operational environment parameters.
              </p>
            </div>

            <div className="space-y-2.5 p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500">Host Subdomain:</span>
                <span className="text-zinc-200">hub.octagramai.com</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">API Endpoint:</span>
                <span className="text-zinc-200">hub.octagramai.com/api</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">RBAC Enforcement:</span>
                <span className="text-emerald-400">Strict Centralized (Node/Prisma)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Automation Engine:</span>
                <span className="text-emerald-400">7-Day Payment & Follow-up Daemon</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Provision User Modal */}
      <Modal
        isOpen={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        title="Provision New Employee Account"
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Nikita Sharma"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Email Address *</label>
              <input
                type="email"
                required
                placeholder="name@octagramai.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Initial Password *</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-medium"
              >
                <option value="SALES">SALES</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Department</label>
              <input
                type="text"
                placeholder="e.g. Design & Sales"
                value={newUser.department}
                onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateUserModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Provision Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
