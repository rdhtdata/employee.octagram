import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { api } from '../../services/api.js';
import { Button } from '../../components/common/Button.js';
import { User, Lock, Phone, Building2, Check, Shield } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { showToast } = useNotification();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password reset state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      const res = await api.users.update(user.id, {
        name,
        email,
        phone,
        department,
        avatarUrl,
      });
      updateUser(res.user);
      showToast('Profile information updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await api.auth.resetPassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password successfully changed', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update password', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="pb-2 border-b border-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
          <User className="w-5 h-5 text-zinc-400" /> Employee Profile & Settings
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Manage your personal information, contact preferences, and account security.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* Personal Details Form */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-850 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <User className="w-4 h-4 text-sky-400" /> Personal Details
          </h2>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@octagramai.com"
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Design & Operations"
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Avatar Image URL</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>

            <div className="pt-2">
              <Button variant="primary" size="sm" type="submit" isLoading={isUpdatingProfile}>
                Save Profile
              </Button>
            </div>
          </form>
        </div>

        {/* Security & Password Form */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-850 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" /> Security & Password
          </h2>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 font-mono"
              />
            </div>

            <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Shield className="w-3 h-3 text-zinc-400" />
                <span>Account Role: <strong className="text-zinc-100">{user?.role}</strong></span>
              </div>
              <p>Passwords must be at least 6 characters long.</p>
            </div>

            <div className="pt-2">
              <Button variant="secondary" size="sm" type="submit" isLoading={isUpdatingPassword}>
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
