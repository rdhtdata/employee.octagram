import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Ticket,
  Calendar,
  Target,
  Kanban,
  Building2,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  FileText,
  Settings,
  LogOut,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate, onCloseMobile }) => {
  const { user, isAdmin, logout } = useAuth();

  const handleNav = (path: string) => {
    onNavigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  const navItemClass = (path: string) => {
    let isActive = false;
    if (path === '/') {
      isActive = currentPath === '/' || currentPath === '';
    } else if (path === '/accounts') {
      isActive = currentPath === '/accounts';
    } else if (path === '/crm/leads') {
      isActive = currentPath === '/crm/leads' || currentPath.startsWith('/crm/leads/');
    } else if (path === '/clients') {
      isActive = currentPath === '/clients' || currentPath.startsWith('/clients/');
    } else {
      isActive = currentPath === path;
    }

    return `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer select-none ${
      isActive
        ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70'
    }`;
  };

  return (
    <aside className="w-60 bg-zinc-950 border-r border-zinc-900 flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="p-4 pb-3 border-b border-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 font-bold text-xs tracking-wider shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <div>
            <div className="text-xs font-bold tracking-widest text-zinc-100 uppercase">OCTAGRAM</div>
            <div className="text-[10px] text-zinc-500 font-mono tracking-tight">Operations Hub</div>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {/* Core */}
        <div>
          <button
            onClick={() => handleNav('/')}
            className={`w-full ${navItemClass('/')}`}
          >
            <LayoutDashboard className="w-4 h-4 text-zinc-400 shrink-0" />
            <span>Dashboard</span>
          </button>
        </div>

        {/* WORK Section */}
        <div>
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Work
          </div>
          <div className="space-y-0.5">
            <button onClick={() => handleNav('/tasks')} className={`w-full ${navItemClass('/tasks')}`}>
              <CheckSquare className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>Tasks</span>
            </button>
            <button onClick={() => handleNav('/tickets')} className={`w-full ${navItemClass('/tickets')}`}>
              <Ticket className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>Tickets</span>
            </button>
            <button onClick={() => handleNav('/calendar')} className={`w-full ${navItemClass('/calendar')}`}>
              <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>Calendar</span>
            </button>
          </div>
        </div>

        {/* CRM Section */}
        <div>
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            CRM & Pipeline
          </div>
          <div className="space-y-0.5">
            <button onClick={() => handleNav('/crm/leads')} className={`w-full ${navItemClass('/crm/leads')}`}>
              <Target className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>Leads</span>
            </button>
            <button onClick={() => handleNav('/crm/pipeline')} className={`w-full ${navItemClass('/crm/pipeline')}`}>
              <Kanban className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>Pipeline</span>
            </button>
          </div>
        </div>

        {/* CLIENTS Section */}
        <div>
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Clients
          </div>
          <div className="space-y-0.5">
            <button onClick={() => handleNav('/clients')} className={`w-full ${navItemClass('/clients')}`}>
              <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>Clients</span>
            </button>
          </div>
        </div>

        {/* FINANCE Section (Admin Only) */}
        {isAdmin && (
          <div>
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Finance
            </div>
            <div className="space-y-0.5">
              <button onClick={() => handleNav('/accounts')} className={`w-full ${navItemClass('/accounts')}`}>
                <Wallet className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Accounts Overview</span>
              </button>
              <button onClick={() => handleNav('/accounts/incoming')} className={`w-full ${navItemClass('/accounts/incoming')}`}>
                <ArrowDownLeft className="w-4 h-4 text-emerald-400/80 shrink-0" />
                <span>Incoming Payments</span>
              </button>
              <button onClick={() => handleNav('/accounts/outgoing')} className={`w-full ${navItemClass('/accounts/outgoing')}`}>
                <ArrowUpRight className="w-4 h-4 text-amber-400/80 shrink-0" />
                <span>Outgoing Expenses</span>
              </button>
            </div>
          </div>
        )}

        {/* TEAM Section */}
        <div>
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Organization
          </div>
          <div className="space-y-0.5">
            <button onClick={() => handleNav('/team')} className={`w-full ${navItemClass('/team')}`}>
              <Users className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>Team Directory</span>
            </button>
          </div>
        </div>

        {/* ADMIN Section (Admin Only) */}
        {isAdmin && (
          <div>
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Admin & Governance
            </div>
            <div className="space-y-0.5">
              <button onClick={() => handleNav('/admin/users')} className={`w-full ${navItemClass('/admin/users')}`}>
                <ShieldCheck className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Users & Roles</span>
              </button>
              <button onClick={() => handleNav('/admin/audit')} className={`w-full ${navItemClass('/admin/audit')}`}>
                <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Activity & Audit</span>
              </button>
              <button onClick={() => handleNav('/admin/settings')} className={`w-full ${navItemClass('/admin/settings')}`}>
                <Settings className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Settings & Export</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer User Profile & Logout */}
      <div className="p-3 border-t border-zinc-900 bg-zinc-950/80">
        <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-850">
          <div
            className="flex items-center gap-2 overflow-hidden cursor-pointer"
            onClick={() => handleNav('/profile')}
          >
            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[11px] font-bold text-zinc-200 shrink-0 overflow-hidden">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0) || 'U'
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-zinc-200 truncate leading-tight">{user?.name}</p>
              <p className="text-[10px] text-zinc-500 font-mono leading-none mt-0.5">{user?.role}</p>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
