import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { api } from '../../services/api.js';
import { Client, User } from '../../types/index.js';
import { StatusBadge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { TableSkeleton } from '../../components/common/Skeleton.js';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  Phone,
  Mail,
  User as UserIcon,
  CheckSquare,
  Calendar,
  Ticket,
  ChevronRight,
  Info,
  Lock,
} from 'lucide-react';

interface ClientsPageProps {
  onNavigate: (path: string) => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const isSales = user?.role === 'SALES';
  const { showToast } = useNotification();

  const [clients, setClients] = useState<Client[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [industryFilter, setIndustryFilter] = useState('ALL');
  const [managerFilter, setManagerFilter] = useState('');

  const fetchClients = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (industryFilter !== 'ALL') params.industry = industryFilter;
      if (managerFilter) params.accountManagerId = managerFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.clients.list(params);
      setClients(res.clients || []);
    } catch (err) {
      showToast('Failed to load clients', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [statusFilter, industryFilter, managerFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    api.users.list().then(res => setUsersList(res.users || [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Header & Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-900">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" /> Client Management
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Active client accounts, dedicated workspaces, contracts, and timelines.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            const event = new CustomEvent('open-quick-action', { detail: { type: 'client' } });
            window.dispatchEvent(event);
          }}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          New Client
        </Button>
      </div>

      {/* Sales Overview Banner */}
      {isSales && (
        <div className="flex items-center gap-2.5 p-3.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-xs text-zinc-400">
          <Info className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            <strong className="text-zinc-200">Client Directory Dashboard:</strong> Sales personnel have directory overview access. Individual client account workspaces and financial ledgers are restricted to Account Managers and Administrators.
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-900/40 p-3 rounded-xl border border-zinc-850">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search clients, industries, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <select
          value={managerFilter}
          onChange={(e) => setManagerFilter(e.target.value)}
          className="px-3 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none"
        >
          <option value="">All Account Managers</option>
          {usersList.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Clients Cards Grid */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-5 h-5" />}
          title="No clients found"
          description="Add a new client record or convert a lead from CRM."
          actionLabel="Create Client"
          onAction={() => {
            const event = new CustomEvent('open-quick-action', { detail: { type: 'client' } });
            window.dispatchEvent(event);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <div
              key={client.id}
              onClick={() => {
                if (!isSales) {
                  onNavigate(`/clients/${client.id}`);
                }
              }}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-4 ${
                isSales
                  ? 'bg-zinc-900/40 border-zinc-850/80 cursor-default'
                  : 'bg-zinc-900/60 hover:bg-zinc-850/80 border-zinc-800 cursor-pointer group'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3
                      className={`text-sm font-semibold transition-colors ${
                        isSales ? 'text-zinc-200' : 'text-zinc-100 group-hover:text-emerald-400'
                      }`}
                    >
                      {client.name}
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{client.industry || 'Business'}</p>
                  </div>
                  <StatusBadge status={client.status} size="xs" />
                </div>

                <div className="text-xs text-zinc-400 space-y-1 pt-1">
                  {client.website && (
                    <p className="flex items-center gap-1.5 truncate">
                      <ExternalLink className="w-3 h-3 text-zinc-500 shrink-0" />
                      <span className="truncate">{client.website.replace('https://', '')}</span>
                    </p>
                  )}
                  {client.phone && (
                    <p className="flex items-center gap-1.5 font-mono text-[11px]">
                      <Phone className="w-3 h-3 text-zinc-500 shrink-0" />
                      <span>{client.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Footer Meta */}
              <div className="pt-3 border-t border-zinc-850 flex items-center justify-between text-[11px] text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{client.accountManager?.name || 'Unassigned'}</span>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px]">
                  {client._count?.tasks ? (
                    <span className="text-zinc-300">
                      {client._count.tasks} task{client._count.tasks === 1 ? '' : 's'}
                    </span>
                  ) : null}
                  {!isSales ? (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                  ) : (
                    <span className="text-[10px] text-zinc-500 font-sans">Directory</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
