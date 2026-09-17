import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { User, Task } from '../../types/index.js';
import { Badge, PriorityBadge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Drawer } from '../../components/common/Drawer.js';
import { TableSkeleton } from '../../components/common/Skeleton.js';
import {
  Users,
  Mail,
  Phone,
  Building2,
  CheckSquare,
  Calendar,
  Target,
  Edit2,
  Plus,
  Search,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Briefcase,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { format } from 'date-fns';

export const TeamPage: React.FC<{ initialUserId?: string }> = ({ initialUserId }) => {
  const { user: currentUser, isAdmin, isDev, updateUser } = useAuth();
  const { showToast } = useNotification();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showDrawerPassword, setShowDrawerPassword] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'DEV' | 'ADMIN' | 'SALES'>('ALL');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [editFormData, setEditFormData] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    department: '',
    avatarUrl: '',
    role: 'SALES',
    isActive: true,
    newPassword: '',
  });

  const [addFormData, setAddFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SALES',
    department: 'Sales & Outreach',
    phone: '',
  });

  const fetchTeam = async () => {
    try {
      setIsLoading(true);
      const res = await api.users.list();
      setUsers(res.users || []);

      if (initialUserId && !selectedUser) {
        api.users.get(initialUserId).then((uRes) => setSelectedUser(uRes.user)).catch(() => {});
      }
    } catch (err) {
      showToast('Failed to load team directory', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleOpenUser = async (u: User) => {
    try {
      const res = await api.users.get(u.id);
      setSelectedUser(res.user);
    } catch (err) {
      setSelectedUser(u);
    }
  };

  const handleStartEdit = (u: User, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditFormData({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      department: u.department || '',
      avatarUrl: u.avatarUrl || '',
      role: u.role,
      isActive: u.isActive !== undefined ? u.isActive : true,
      newPassword: '',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.name || !editFormData.email) {
      showToast('Name and email are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone || null,
        department: editFormData.department || null,
        avatarUrl: editFormData.avatarUrl || null,
      };

      if (isAdmin) {
        payload.role = editFormData.role;
        payload.isActive = editFormData.isActive;
      }

      if (editFormData.newPassword && editFormData.newPassword.length >= 6) {
        payload.password = editFormData.newPassword;
      }

      const res = await api.users.update(editFormData.id, payload);

      if (currentUser?.id === editFormData.id) {
        updateUser(res.user);
      }

      // If drawer was open for this user, refresh it
      if (selectedUser?.id === editFormData.id) {
        const uRes = await api.users.get(editFormData.id);
        setSelectedUser(uRes.user);
      }

      showToast('Member profile updated successfully', 'success');
      setIsEditModalOpen(false);
      fetchTeam();
    } catch (err: any) {
      showToast(err.message || 'Failed to update member', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormData.name || !addFormData.email || !addFormData.password) {
      showToast('Name, email, and initial password are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.users.create(addFormData);
      showToast('New team member account created', 'success');
      setIsAddModalOpen(false);
      setAddFormData({
        name: '',
        email: '',
        password: '',
        role: 'SALES',
        department: 'Sales & Outreach',
        phone: '',
      });
      fetchTeam();
    } catch (err: any) {
      showToast(err.message || 'Failed to create member', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} to clipboard`, 'success');
  };

  // Filtered members
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery)) ||
      (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-900">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" /> Team Directory
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Octagram organization members, contact info, departments, and active workloads.
          </p>
        </div>

        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Team Member
          </Button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/40 p-3 rounded-xl border border-zinc-850 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by name, email, phone, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-zinc-500 text-[11px] shrink-0">Role:</span>
          <div className="flex items-center bg-zinc-850 p-0.5 rounded-lg border border-zinc-750">
            {(['ALL', 'DEV', 'ADMIN', 'SALES'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                  roleFilter === role
                    ? 'bg-zinc-700 text-zinc-100 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {role === 'ALL' ? 'All' : role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Team Cards Grid */}
      {isLoading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : filteredUsers.length === 0 ? (
        <div className="p-8 text-center bg-zinc-900/30 rounded-xl border border-zinc-850 space-y-2">
          <p className="text-sm font-medium text-zinc-300">No team members match your search</p>
          <p className="text-xs text-zinc-500">Try adjusting your search terms or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((u) => {
            const canEditThisUser = isAdmin || currentUser?.id === u.id;

            return (
              <div
                key={u.id}
                onClick={() => handleOpenUser(u)}
                className="p-5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-850/80 border border-zinc-800 transition-all cursor-pointer space-y-4 group relative"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-100 overflow-hidden shrink-0 shadow-inner">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        u.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-sky-300 transition-colors">
                          {u.name}
                        </h3>
                        {currentUser?.id === u.id && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 font-mono flex items-center gap-1 mt-0.5">
                        <Briefcase className="w-3 h-3 text-zinc-500" />
                        {u.department || 'Operations'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={u.role === 'DEV' ? 'purple' : u.role === 'ADMIN' ? 'zinc' : 'neutral'}
                      size="xs"
                      dot={u.role === 'DEV'}
                    >
                      {u.role}
                    </Badge>
                    {canEditThisUser && (
                      <button
                        title="Edit member contact & profile"
                        onClick={(e) => handleStartEdit(u, e)}
                        className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-1.5 text-xs text-zinc-400 pt-1">
                  <div className="flex items-center justify-between group/line">
                    <a
                      href={`mailto:${u.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 truncate hover:text-sky-400 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate font-mono text-[11px]">{u.email}</span>
                    </a>
                    <button
                      onClick={(e) => copyToClipboard(u.email, 'email', e)}
                      className="opacity-0 group-hover/line:opacity-100 p-1 hover:text-zinc-200 transition-opacity"
                      title="Copy email"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between group/line">
                    {u.phone ? (
                      <>
                        <a
                          href={`tel:${u.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 font-mono text-[11px] hover:text-emerald-400 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span>{u.phone}</span>
                        </a>
                        <button
                          onClick={(e) => copyToClipboard(u.phone!, 'phone', e)}
                          className="opacity-0 group-hover/line:opacity-100 p-1 hover:text-zinc-200 transition-opacity"
                          title="Copy phone number"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => canEditThisUser && handleStartEdit(u, e)}
                        className="flex items-center gap-2 text-zinc-600 hover:text-zinc-400 text-[11px]"
                      >
                        <Phone className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                        <span>{canEditThisUser ? '+ Add phone number' : 'No phone set'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Workload Stats Row */}
                <div className="pt-3 border-t border-zinc-850 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-1.5 rounded-lg bg-zinc-950/40 border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">TASKS</span>
                    <span className="font-mono font-bold text-zinc-200">{u._count?.assignedTasks || 0}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-zinc-950/40 border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">LEADS</span>
                    <span className="font-mono font-bold text-zinc-200">{u._count?.assignedLeads || 0}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-zinc-950/40 border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">CLIENTS</span>
                    <span className="font-mono font-bold text-zinc-200">{u._count?.managedClients || 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EMPLOYEE DETAIL DRAWER */}
      <Drawer
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.name || 'Employee Profile'}
        subtitle={`${selectedUser?.role} • ${selectedUser?.department || 'Operations'}`}
        width="lg"
      >
        {selectedUser && (
          <div className="space-y-6 text-xs">
            {/* Header info & edit button */}
            <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                <span className="text-zinc-400 font-semibold">Contact & Profile Information</span>
                {(isAdmin || currentUser?.id === selectedUser.id) && (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => handleStartEdit(selectedUser)}
                    icon={<Edit2 className="w-3 h-3" />}
                  >
                    Edit Details
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Email Address</span>
                  <a
                    href={`mailto:${selectedUser.email}`}
                    className="font-mono text-zinc-200 hover:text-sky-400 flex items-center gap-1"
                  >
                    {selectedUser.email}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Phone Number</span>
                  <span className="font-mono text-zinc-200">{selectedUser.phone || 'None provided'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Department</span>
                  <span className="text-zinc-200">{selectedUser.department || 'Operations'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Account Status</span>
                  <span className={selectedUser.isActive !== false ? 'text-emerald-400 font-medium' : 'text-rose-400'}>
                    {selectedUser.isActive !== false ? 'Active Member' : 'Deactivated'}
                  </span>
                </div>
                {isDev && selectedUser.plainPassword && (
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
                    <span className="text-zinc-500">Account Password</span>
                    <div className="flex items-center gap-1.5 font-mono text-zinc-200 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                      <span>{showDrawerPassword ? selectedUser.plainPassword : '••••••••'}</span>
                      <button
                        type="button"
                        onClick={() => setShowDrawerPassword(!showDrawerPassword)}
                        className="p-0.5 text-zinc-400 hover:text-zinc-100"
                        title={showDrawerPassword ? "Hide" : "Reveal"}
                      >
                        {showDrawerPassword ? <EyeOff className="w-3.5 h-3.5 text-purple-400" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => copyToClipboard(selectedUser.plainPassword, 'password', e)}
                        className="p-0.5 text-zinc-400 hover:text-zinc-100"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Assigned Open Tasks */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-amber-400" /> Current Workload ({selectedUser.assignedTasks?.length || 0})
              </span>

              {selectedUser.assignedTasks?.length === 0 ? (
                <p className="text-zinc-500 italic p-3 bg-zinc-950/40 rounded-lg border border-zinc-850">
                  No active tasks currently assigned.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {selectedUser.assignedTasks?.map((task: Task) => (
                    <div
                      key={task.id}
                      className="p-2.5 bg-zinc-950/60 rounded-lg border border-zinc-850 flex items-center justify-between"
                    >
                      <span className="font-medium text-zinc-200 truncate">{task.title}</span>
                      <PriorityBadge priority={task.priority} size="xs" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Managed Clients */}
            {selectedUser.managedClients && selectedUser.managedClients.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Account Managed Clients ({selectedUser.managedClients.length})
                </span>

                <div className="grid grid-cols-2 gap-2">
                  {selectedUser.managedClients.map((c: any) => (
                    <div key={c.id} className="p-2 bg-zinc-950/60 rounded-lg border border-zinc-850">
                      <p className="font-semibold text-zinc-200 truncate">{c.name}</p>
                      <p className="text-[10px] text-zinc-500">{c.industry || 'General'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* EDIT TEAM MEMBER MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Team Member Details"
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Department</label>
              <input
                type="text"
                placeholder="e.g. Sales, Operations, Engineering"
                value={editFormData.department}
                onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Avatar Image URL (Optional)</label>
            <input
              type="url"
              placeholder="https://..."
              value={editFormData.avatarUrl}
              onChange={(e) => setEditFormData({ ...editFormData, avatarUrl: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
            />
          </div>

          {/* Admin-only controls: Role and Active status */}
          {isAdmin && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Role / Permissions</label>
                <select
                  value={editFormData.role}
                  disabled={!isDev && editFormData.role === 'DEV'}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-medium disabled:opacity-50"
                >
                  {isDev && <option value="DEV">DEV (Superuser & Full Developer)</option>}
                  <option value="ADMIN">ADMIN (Full Access)</option>
                  <option value="SALES">SALES (Pipeline & Tasks)</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Account Status</label>
                <select
                  value={editFormData.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.value === 'active' })}
                  className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Deactivated</option>
                </select>
              </div>
            </div>
          )}

          {/* Optional password update */}
          <div className="pt-2 border-t border-zinc-800">
            <label className="block text-zinc-300 font-medium mb-1">
              Reset Password <span className="text-zinc-500 font-normal">(Leave blank to keep unchanged)</span>
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={editFormData.newPassword}
              onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ADD TEAM MEMBER MODAL (Admin Only) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Team Member"
        maxWidth="md"
      >
        <form onSubmit={handleCreateMember} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Alex Johnson"
                value={addFormData.name}
                onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Email Address *</label>
              <input
                type="email"
                required
                placeholder="alex@octagramai.com"
                value={addFormData.email}
                onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Initial Password *</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={addFormData.password}
                onChange={(e) => setAddFormData({ ...addFormData, password: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={addFormData.phone}
                onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Role</label>
              <select
                value={addFormData.role}
                onChange={(e) => setAddFormData({ ...addFormData, role: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-medium"
              >
                {isDev && <option value="DEV">DEV (Superuser & Developer)</option>}
                <option value="ADMIN">ADMIN (Full Operations)</option>
                <option value="SALES">SALES (CRM & Pipeline)</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Department</label>
              <input
                type="text"
                placeholder="e.g. Sales & Outreach"
                value={addFormData.department}
                onChange={(e) => setAddFormData({ ...addFormData, department: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Create Member Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
