import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { api } from '../../services/api.js';
import { Client, Task, Meeting, Payment, Ticket, Communication, ClientNote, User as UserType } from '../../types/index.js';
import { StatusBadge, PriorityBadge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Tabs } from '../../components/common/Tabs.js';
import { Modal } from '../../components/common/Modal.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { TableSkeleton } from '../../components/common/Skeleton.js';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Plus,
  Calendar,
  CheckSquare,
  Wallet,
  MessageSquare,
  FileText,
  Clock,
  Send,
  User as UserIcon,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Pin,
  Edit3,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Repeat,
  CreditCard,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ClientWorkspacePageProps {
  clientId: string;
  initialTab?: string;
  onNavigate: (path: string) => void;
}

export const ClientWorkspacePage: React.FC<ClientWorkspacePageProps> = ({
  clientId,
  initialTab = 'overview',
  onNavigate,
}) => {
  const { user, isAdmin } = useAuth();
  const { showToast } = useNotification();

  const [client, setClient] = useState<Client | null>(null);
  const [usersList, setUsersList] = useState<UserType[]>([]);
  const [isUpdatingManager, setIsUpdatingManager] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Client Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    industry: '',
    status: 'ACTIVE',
    accountManagerId: 'UNASSIGNED',
    phone: '',
    email: '',
    website: '',
    address: '',
  });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    api.users.list().then(res => setUsersList(res.users || [])).catch(() => {});
  }, []);

  // Quick Action Modals inside workspace
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [isNotePinned, setIsNotePinned] = useState(false);

  const [isCommModalOpen, setIsCommModalOpen] = useState(false);
  const [commType, setCommType] = useState('CALL');
  const [commSubject, setCommSubject] = useState('');
  const [commContent, setCommContent] = useState('');

  // Income / Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDueDate, setPaymentDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentInvoice, setPaymentInvoice] = useState('');
  const [paymentRecurrence, setPaymentRecurrence] = useState('NONE');
  const [paymentResponsibleId, setPaymentResponsibleId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Expenditure / Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseVendor, setExpenseVendor] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<string>('SOFTWARE');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDueDate, setExpenseDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseRecurrence, setExpenseRecurrence] = useState('NONE');
  const [expenseResponsibleId, setExpenseResponsibleId] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');

  // Financial Sub-tab filter
  const [financeView, setFinanceView] = useState<'ALL' | 'INCOME' | 'EXPENSES'>('ALL');

  const fetchClientWorkspace = async () => {
    try {
      setIsLoading(true);
      const res = await api.clients.get(clientId);
      setClient(res.client);
    } catch (err: any) {
      showToast(err.message || 'Failed to load client workspace', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClientWorkspace();
  }, [clientId]);

  const handleAccountManagerChange = async (newManagerId: string) => {
    if (!client) return;
    try {
      setIsUpdatingManager(true);
      const res = await api.clients.update(client.id, {
        accountManagerId: newManagerId === 'UNASSIGNED' ? 'UNASSIGNED' : newManagerId
      });
      setClient((prev) => prev ? { ...prev, ...res.client } : res.client);
      const managerName = res.client.accountManager?.name || 'Unassigned';
      showToast(`Account Manager updated to ${managerName}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update account manager', 'error');
    } finally {
      setIsUpdatingManager(false);
    }
  };

  const handleSaveClientDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !editFormData.name.trim()) return;
    try {
      const res = await api.clients.update(client.id, {
        name: editFormData.name.trim(),
        industry: editFormData.industry.trim() || null,
        status: editFormData.status,
        accountManagerId: editFormData.accountManagerId,
        phone: editFormData.phone.trim() || null,
        email: editFormData.email.trim() || null,
        website: editFormData.website.trim() || null,
        address: editFormData.address.trim() || null,
      });
      setClient((prev) => prev ? { ...prev, ...res.client } : res.client);
      setIsEditModalOpen(false);
      showToast('Client details updated successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update client details', 'error');
    }
  };

  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    try {
      await api.tasks.update(task.id, { status: newStatus });
      showToast(newStatus === 'COMPLETED' ? 'Task completed' : 'Task reopened', 'success');
      fetchClientWorkspace();
    } catch (err) {
      showToast('Failed to update task', 'error');
    }
  };

  const handleMarkPaymentPaid = async (paymentId: string) => {
    try {
      await api.accounts.updatePayment(paymentId, { status: 'PAID' });
      showToast('Payment marked as PAID (recurring cycle synchronized if active)', 'success');
      fetchClientWorkspace();
    } catch (err: any) {
      showToast(err.message || 'Failed to update payment status', 'error');
    }
  };

  const handleMarkExpensePaid = async (expenseId: string) => {
    try {
      await api.accounts.updateExpense(expenseId, { status: 'PAID' });
      showToast('Expense marked as PAID (recurring cycle synchronized if active)', 'success');
      fetchClientWorkspace();
    } catch (err: any) {
      showToast(err.message || 'Failed to update expense status', 'error');
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    try {
      await api.clients.addNote(clientId, { content: noteContent.trim(), isPinned: isNotePinned });
      setNoteContent('');
      setIsNotePinned(false);
      setIsNoteModalOpen(false);
      showToast('Internal note saved', 'success');
      fetchClientWorkspace();
    } catch (err) {
      showToast('Failed to save note', 'error');
    }
  };

  const handleLogComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commContent.trim()) return;
    try {
      await api.clients.addCommunication(clientId, {
        type: commType,
        subject: commSubject.trim() || undefined,
        content: commContent.trim(),
      });
      setCommContent('');
      setCommSubject('');
      setIsCommModalOpen(false);
      showToast('Communication logged to activity timeline', 'success');
      fetchClientWorkspace();
    } catch (err) {
      showToast('Failed to log communication', 'error');
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || !paymentDueDate) return;
    try {
      await api.accounts.createPayment({
        clientId,
        amount: Number(paymentAmount),
        dueDate: paymentDueDate,
        invoiceRef: paymentInvoice.trim() || undefined,
        recurrence: paymentRecurrence,
        responsibleUserId: paymentResponsibleId || client?.accountManagerId || user?.id,
        notes: paymentNotes.trim() || undefined,
      });
      setPaymentAmount('');
      setPaymentInvoice('');
      setPaymentRecurrence('NONE');
      setPaymentResponsibleId('');
      setPaymentNotes('');
      setIsPaymentModalOpen(false);
      showToast('Income / payment scheduled & reminder task synchronized', 'success');
      fetchClientWorkspace();
    } catch (err: any) {
      showToast(err.message || 'Failed to record payment', 'error');
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseVendor || !expenseAmount || !expenseDueDate) return;
    try {
      await api.accounts.createExpense({
        clientId,
        vendor: expenseVendor.trim(),
        category: expenseCategory,
        amount: Number(expenseAmount),
        dueDate: expenseDueDate,
        recurrence: expenseRecurrence,
        responsibleUserId: expenseResponsibleId || client?.accountManagerId || user?.id,
        notes: expenseNotes.trim() || undefined,
      });
      setExpenseVendor('');
      setExpenseAmount('');
      setExpenseRecurrence('NONE');
      setExpenseResponsibleId('');
      setExpenseNotes('');
      setIsExpenseModalOpen(false);
      showToast('Client expense recorded & reminder task synchronized', 'success');
      fetchClientWorkspace();
    } catch (err: any) {
      showToast(err.message || 'Failed to record expense', 'error');
    }
  };

  if (isLoading) {
    return <TableSkeleton rows={8} cols={4} />;
  }

  if (!client) {
    return (
      <EmptyState
        title="Client Not Found"
        description="The requested client workspace does not exist or has been removed."
        actionLabel="Back to Clients"
        onAction={() => onNavigate('/clients')}
      />
    );
  }

  const now = new Date();
  const futurePayments = client.payments?.filter(p => p.status !== 'PAID' && p.status !== 'CANCELLED' && new Date(p.dueDate) >= now) || [];

  const workspaceTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks', count: client.tasks?.filter(t => t.status !== 'COMPLETED').length },
    { id: 'future_payments', label: 'Future Incoming Payments', count: futurePayments.length },
    { id: 'meetings', label: 'Meetings', count: client.meetings?.length },
    { id: 'communication', label: 'Communication' },
    { id: 'finances', label: 'Finances & Accounts', count: (client.payments?.length || 0) + (client.expenses?.length || 0) },
    { id: 'notes', label: 'Internal Notes', count: client.notes?.length },
    { id: 'activity', label: 'Activity Audit' },
  ];

  return (
    <div className="space-y-6">
      {/* Back Button & Header Profile */}
      <div className="space-y-4">
        <button
          onClick={() => onNavigate('/clients')}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Clients
        </button>

        {/* Client Workspace Hero Header */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">{client.name}</h1>
                <StatusBadge status={client.status} size="sm" />
              </div>
              <p className="text-xs text-zinc-400">{client.industry || 'Enterprise Client'}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditFormData({
                    name: client.name,
                    industry: client.industry || '',
                    status: client.status,
                    accountManagerId: client.accountManagerId || 'UNASSIGNED',
                    phone: client.phone || '',
                    email: client.email || '',
                    website: client.website || '',
                    address: client.address || '',
                  });
                  setIsEditModalOpen(true);
                }}
                icon={<Edit3 className="w-3.5 h-3.5" />}
              >
                Edit Client
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCommModalOpen(true)}
                icon={<Phone className="w-3.5 h-3.5" />}
              >
                Log Call / Email
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const event = new CustomEvent('open-quick-action', { detail: { type: 'task' } });
                  window.dispatchEvent(event);
                }}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Task
              </Button>
            </div>
          </div>

          {/* Quick Contact & Manager Meta Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-zinc-800/80 text-xs">
            <div>
              <span className="text-[11px] text-zinc-500 block mb-1 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-emerald-400" /> Account Manager
              </span>
              <select
                value={client.accountManagerId || 'UNASSIGNED'}
                onChange={(e) => handleAccountManagerChange(e.target.value)}
                disabled={isUpdatingManager}
                className="w-full bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-750 hover:border-zinc-600 rounded-md px-2 py-1 text-xs font-medium focus:outline-none focus:border-zinc-500 transition-colors cursor-pointer"
              >
                <option value="UNASSIGNED">⚪ Unassigned</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-[11px] text-zinc-500 block mb-1">Website</span>
              {client.website ? (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline flex items-center gap-1 font-mono text-[11px] py-1"
                >
                  {client.website.replace('https://', '')} <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-zinc-500 py-1 block">None</span>
              )}
            </div>
            <div>
              <span className="text-[11px] text-zinc-500 block mb-1">Phone</span>
              <span className="text-zinc-300 font-mono text-[11px] py-1 block">{client.phone || '—'}</span>
            </div>
            <div>
              <span className="text-[11px] text-zinc-500 block mb-1">Primary Contact</span>
              <span className="text-zinc-200 py-1 block">
                {client.contacts?.[0]?.name || 'Not set'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs
        tabs={workspaceTabs}
        activeTab={activeTab}
        onChange={(tabId: string) => {
          setActiveTab(tabId);
          onNavigate(`/clients/${clientId}?tab=${tabId}`);
        }}
      />

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
          {/* Left 2 Cols: Open Tasks & Upcoming Meetings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Open Tasks */}
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-850 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                <span className="font-semibold text-zinc-200 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-amber-400" /> Open Tasks
                </span>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  View all ({client.tasks?.length || 0})
                </button>
              </div>

              {!client.tasks || client.tasks.length === 0 ? (
                <p className="text-zinc-500 italic py-2">No tasks linked to this client.</p>
              ) : (
                <div className="space-y-1.5">
                  {client.tasks.slice(0, 5).map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={() => handleToggleTask(t)}
                          className="text-zinc-500 hover:text-emerald-400"
                        >
                          {t.status === 'COMPLETED' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                        <span className={`truncate font-medium text-zinc-200 ${t.status === 'COMPLETED' ? 'line-through text-zinc-500' : ''}`}>
                          {t.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {t.deadline && (
                          <span className="text-[10px] font-mono text-zinc-400">
                            {format(new Date(t.deadline), 'dd MMM')}
                          </span>
                        )}
                        <PriorityBadge priority={t.priority} size="xs" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Meetings */}
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-850 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                <span className="font-semibold text-zinc-200 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-400" /> Meetings & Syncs
                </span>
                <button
                  onClick={() => setActiveTab('meetings')}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  View all
                </button>
              </div>

              {!client.meetings || client.meetings.length === 0 ? (
                <p className="text-zinc-500 italic py-2">No meetings logged.</p>
              ) : (
                <div className="space-y-2">
                  {client.meetings.slice(0, 3).map((m) => (
                    <div
                      key={m.id}
                      className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-lg space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-100">{m.title}</span>
                        <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-900/50">
                          {format(new Date(m.date), 'dd MMM')} • {m.startTime}
                        </span>
                      </div>
                      {m.agenda && <p className="text-zinc-400 text-[11px] line-clamp-2">{m.agenda}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right 1 Col: Pinned Notes & Contacts */}
          <div className="space-y-6">
            {/* Pinned Notes */}
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-850 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Pin className="w-3.5 h-3.5 text-amber-400" /> Important Notes
                </span>
                <button
                  onClick={() => setIsNoteModalOpen(true)}
                  className="text-[11px] text-sky-400 hover:text-sky-300"
                >
                  + Add Note
                </button>
              </div>

              {client.notes?.filter(n => n.isPinned).length === 0 ? (
                <p className="text-zinc-500 italic py-2">No pinned notes. Add critical client requirements here.</p>
              ) : (
                client.notes?.filter(n => n.isPinned).map((note) => (
                  <div key={note.id} className="p-3 bg-amber-950/10 border border-amber-900/40 rounded-lg space-y-1 text-zinc-300">
                    <p className="leading-relaxed">{note.content}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">By {note.author.name}</p>
                  </div>
                ))
              )}
            </div>

            {/* Contacts Card */}
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-850 space-y-3">
              <span className="font-semibold text-zinc-200 block pb-2 border-b border-zinc-850">
                Client Contacts
              </span>
              <div className="space-y-2">
                {client.contacts?.map((c) => (
                  <div key={c.id} className="p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-800 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-100">{c.name}</span>
                      {c.isPrimary && (
                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 rounded">
                          PRIMARY
                        </span>
                      )}
                    </div>
                    {c.title && <p className="text-[11px] text-zinc-400">{c.title}</p>}
                    <div className="text-[11px] text-zinc-500 font-mono pt-1">
                      {c.phone && <div>📞 {c.phone}</div>}
                      {c.email && <div>✉️ {c.email}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Client Tasks ({client.tasks?.length || 0})
            </h3>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const event = new CustomEvent('open-quick-action', { detail: { type: 'task' } });
                window.dispatchEvent(event);
              }}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Client Task
            </Button>
          </div>

          <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-hidden divide-y divide-zinc-850">
            {client.tasks?.map((task) => (
              <div
                key={task.id}
                className="p-3.5 flex items-center justify-between gap-4 hover:bg-zinc-850/40 text-xs"
              >
                <div className="flex items-center gap-3">
                  <button onClick={() => handleToggleTask(task)} className="text-zinc-500 hover:text-emerald-400">
                    {task.status === 'COMPLETED' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </button>
                  <div>
                    <p className={`font-medium text-zinc-200 ${task.status === 'COMPLETED' ? 'line-through text-zinc-500' : ''}`}>
                      {task.title}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Assigned to: {task.assignee?.name || 'Unassigned'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <PriorityBadge priority={task.priority} size="xs" />
                  <StatusBadge status={task.status} size="xs" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: FUTURE INCOMING PAYMENTS */}
      {activeTab === 'future_payments' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/40 p-4 rounded-xl border border-zinc-850">
            <div>
              <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-400" /> Future Scheduled Incoming Payments ({futurePayments.length})
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1">
                Upcoming retainer cycles, scheduled milestones, and recurring subscription instances. These are future-dated (not overdue) and actively synced to open tasks.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setPaymentResponsibleId(client.accountManagerId || user?.id || '');
                setIsPaymentModalOpen(true);
              }}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Schedule Future Payment
            </Button>
          </div>

          <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-hidden">
            {futurePayments.length === 0 ? (
              <EmptyState
                title="No future payments scheduled"
                description="Schedule a recurring retainer or future milestone payment for this client."
                actionLabel="Schedule Payment"
                onAction={() => {
                  setPaymentResponsibleId(client.accountManagerId || user?.id || '');
                  setIsPaymentModalOpen(true);
                }}
              />
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Invoice / Ref</th>
                    <th className="px-4 py-3">Scheduled Amount</th>
                    <th className="px-4 py-3">Recurrence Schedule</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Time Remaining</th>
                    <th className="px-4 py-3">Responsible Account Rep</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {futurePayments.map((payment) => {
                    const daysRemaining = Math.ceil((new Date(payment.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={payment.id} className="hover:bg-zinc-850/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-zinc-200">
                          <div>{payment.invoiceRef || 'Scheduled Milestone'}</div>
                          {payment.notes && <div className="text-[10px] text-zinc-500 font-sans truncate max-w-xs">{payment.notes}</div>}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-400 text-sm">
                          {payment.currency === 'INR' ? '₹' : '$'}
                          {payment.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {payment.recurrence && payment.recurrence !== 'NONE' ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-950/50 border border-amber-900/40 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono">
                              <Repeat className="w-2.5 h-2.5" /> {payment.recurrence}
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-[10px] font-mono">One-time</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-300">
                          {format(new Date(payment.dueDate), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px]">
                          <span className="inline-flex items-center gap-1 text-sky-300 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded font-medium">
                            <Clock className="w-3 h-3 text-sky-400" />
                            {daysRemaining <= 0 ? 'Due Today' : `In ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {payment.responsibleUser?.name || client.accountManager?.name || 'Account Manager'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded text-[10px] font-medium font-mono border border-zinc-700">
                            Future Scheduled
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="subtle"
                            size="xs"
                            onClick={() => handleMarkPaymentPaid(payment.id)}
                          >
                            Mark Paid
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: FINANCES & ACCOUNTS (Income & Expenditure) */}
      {activeTab === 'finances' && (
        <div className="space-y-6">
          {/* Financial Metrics Cards */}
          {(() => {
            const totalIncome = client.payments?.reduce((acc, p) => acc + (p.status !== 'CANCELLED' ? p.amount : 0), 0) || 0;
            const paidIncome = client.payments?.filter(p => p.status === 'PAID').reduce((acc, p) => acc + p.amount, 0) || 0;
            const totalExpenses = client.expenses?.reduce((acc, e) => acc + (e.status !== 'CANCELLED' ? e.amount : 0), 0) || 0;
            const paidExpenses = client.expenses?.filter(e => e.status === 'PAID').reduce((acc, e) => acc + e.amount, 0) || 0;
            const netProfit = paidIncome - paidExpenses;
            const pendingIncome = client.payments?.filter(p => p.status !== 'PAID' && p.status !== 'CANCELLED').reduce((acc, p) => acc + p.amount, 0) || 0;
            const pendingExpenses = client.expenses?.filter(e => e.status !== 'PAID' && e.status !== 'CANCELLED').reduce((acc, e) => acc + e.amount, 0) || 0;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] font-medium flex items-center gap-1.5">
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" /> Total Invoiced / Income
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-950/40 px-1.5 py-0.5 rounded">
                      {client.payments?.length || 0} invoices
                    </span>
                  </div>
                  <p className="text-xl font-bold font-mono text-zinc-100">
                    ₹{totalIncome.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    ₹{paidIncome.toLocaleString()} collected • ₹{pendingIncome.toLocaleString()} pending
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] font-medium flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" /> Client Expenditure
                    </span>
                    <span className="text-[10px] font-mono text-rose-400/80 bg-rose-950/40 px-1.5 py-0.5 rounded">
                      {client.expenses?.length || 0} costs
                    </span>
                  </div>
                  <p className="text-xl font-bold font-mono text-zinc-100">
                    ₹{totalExpenses.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    ₹{paidExpenses.toLocaleString()} paid • ₹{pendingExpenses.toLocaleString()} due
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] font-medium flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-sky-400" /> Net Profit Realized
                    </span>
                  </div>
                  <p className={`text-xl font-bold font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ₹{netProfit.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Realized margin on collected revenue
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] font-medium flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5 text-amber-400" /> Active Recurring
                    </span>
                  </div>
                  <p className="text-xl font-bold font-mono text-zinc-100">
                    {(client.payments?.filter(p => p.recurrence && p.recurrence !== 'NONE').length || 0) +
                     (client.expenses?.filter(e => e.recurrence && e.recurrence !== 'NONE').length || 0)}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Subscriptions & retained services
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Action Header & Sub-filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800 w-fit text-xs">
              <button
                type="button"
                onClick={() => setFinanceView('ALL')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  financeView === 'ALL' ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All Financials
              </button>
              <button
                type="button"
                onClick={() => setFinanceView('INCOME')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                  financeView === 'INCOME' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ArrowDownLeft className="w-3 h-3 text-emerald-400" /> Income ({client.payments?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setFinanceView('EXPENSES')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                  financeView === 'EXPENSES' ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ArrowUpRight className="w-3 h-3 text-rose-400" /> Expenses ({client.expenses?.length || 0})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setExpenseResponsibleId(client.accountManagerId || user?.id || '');
                  setIsExpenseModalOpen(true);
                }}
                icon={<Plus className="w-3.5 h-3.5 text-rose-400" />}
              >
                Add Client Expense
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setPaymentResponsibleId(client.accountManagerId || user?.id || '');
                  setIsPaymentModalOpen(true);
                }}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Record Income / Payment
              </Button>
            </div>
          </div>

          {/* INCOME (PAYMENTS) TABLE */}
          {(financeView === 'ALL' || financeView === 'INCOME') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" /> Client Invoices & Inflow ({client.payments?.length || 0})
                </h4>
              </div>

              <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-hidden">
                {!client.payments || client.payments.length === 0 ? (
                  <p className="text-zinc-500 text-xs italic p-4 text-center">No incoming payments recorded for this client.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Invoice / Ref</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Due Date</th>
                        <th className="px-4 py-3">Recurrence</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {client.payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-zinc-850/40 transition-colors">
                          <td className="px-4 py-3 font-mono font-medium text-zinc-200">
                            <div>{payment.invoiceRef || 'Manual Entry'}</div>
                            {payment.notes && <div className="text-[10px] text-zinc-500 font-sans truncate max-w-xs">{payment.notes}</div>}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                            {payment.currency === 'INR' ? '₹' : '$'}
                            {payment.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-400">
                            {format(new Date(payment.dueDate), 'dd MMM yyyy')}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px]">
                            {payment.recurrence && payment.recurrence !== 'NONE' ? (
                              <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-950/50 border border-amber-900/40 px-2 py-0.5 rounded-full text-[10px] font-medium">
                                <Repeat className="w-2.5 h-2.5" /> {payment.recurrence}
                              </span>
                            ) : (
                              <span className="text-zinc-500">One-time</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={payment.status} size="xs" />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {payment.status !== 'PAID' ? (
                              <Button
                                variant="subtle"
                                size="xs"
                                onClick={() => handleMarkPaymentPaid(payment.id)}
                              >
                                Mark Paid
                              </Button>
                            ) : (
                              <span className="text-[11px] text-emerald-400 flex items-center justify-end gap-1 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* EXPENDITURE (EXPENSES) TABLE */}
          {(financeView === 'ALL' || financeView === 'EXPENSES') && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" /> Client-Related Expenses & Costs ({client.expenses?.length || 0})
                </h4>
              </div>

              <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-hidden">
                {!client.expenses || client.expenses.length === 0 ? (
                  <p className="text-zinc-500 text-xs italic p-4 text-center">No expenses logged for this client (e.g. hosting, domain, contractor costs).</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Vendor / Service</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Due Date</th>
                        <th className="px-4 py-3">Recurrence</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {client.expenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-zinc-850/40 transition-colors">
                          <td className="px-4 py-3 font-medium text-zinc-200">
                            <div>{expense.vendor}</div>
                            {expense.notes && <div className="text-[10px] text-zinc-500 font-sans truncate max-w-xs">{expense.notes}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-750">
                              {expense.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-rose-400">
                            {expense.currency === 'INR' ? '₹' : '$'}
                            {expense.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-400">
                            {format(new Date(expense.dueDate), 'dd MMM yyyy')}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px]">
                            {expense.recurrence && expense.recurrence !== 'NONE' ? (
                              <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-950/50 border border-amber-900/40 px-2 py-0.5 rounded-full text-[10px] font-medium">
                                <Repeat className="w-2.5 h-2.5" /> {expense.recurrence}
                              </span>
                            ) : (
                              <span className="text-zinc-500">One-time</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={expense.status} size="xs" />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {expense.status !== 'PAID' ? (
                              <Button
                                variant="subtle"
                                size="xs"
                                onClick={() => handleMarkExpensePaid(expense.id)}
                              >
                                Mark Paid
                              </Button>
                            ) : (
                              <span className="text-[11px] text-emerald-400 flex items-center justify-end gap-1 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: COMMUNICATION TIMELINE */}
      {activeTab === 'communication' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Communication Timeline
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCommModalOpen(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Log Interaction
            </Button>
          </div>

          <div className="space-y-3">
            {client.communications?.map((c) => (
              <div key={c.id} className="p-3.5 bg-zinc-900/60 border border-zinc-850 rounded-xl space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase font-bold text-sky-400 bg-sky-950/60 px-1.5 py-0.2 rounded">
                      {c.type}
                    </span>
                    <span className="font-semibold text-zinc-200">{c.subject || 'Interaction'}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {format(new Date(c.occurredAt), 'dd MMM yyyy HH:mm')}
                  </span>
                </div>
                <p className="text-zinc-300 leading-relaxed pt-1">{c.content}</p>
                <p className="text-[10px] text-zinc-500">Logged by {c.author.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: INTERNAL NOTES */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Client Notes & Requirements
            </h3>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsNoteModalOpen(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Note
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {client.notes?.map((n) => (
              <div key={n.id} className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>Author: {n.author.name}</span>
                  <span>{format(new Date(n.createdAt), 'dd MMM yyyy')}</span>
                </div>
                <p className="text-zinc-200 leading-relaxed">{n.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: ACTIVITY LOGS */}
      {activeTab === 'activity' && (
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-850 space-y-3 text-xs">
          <h3 className="font-semibold text-zinc-200 pb-2 border-b border-zinc-850">
            Audit Activity Trail
          </h3>
          <div className="space-y-2.5">
            {client.activities?.map((act) => (
              <div key={act.id} className="flex items-center justify-between text-zinc-300 py-1">
                <span>
                  <strong className="text-zinc-100">{act.user?.name || 'System'}</strong> performed{' '}
                  <span className="font-mono text-xs">{act.action}</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Internal Note Modal */}
      <Modal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title="Add Internal Client Note"
        maxWidth="md"
      >
        <form onSubmit={handleCreateNote} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Note Content *</label>
            <textarea
              required
              rows={4}
              placeholder="Record client preferences, launch constraints, or internal directives..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
            <input
              type="checkbox"
              checked={isNotePinned}
              onChange={(e) => setIsNotePinned(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700"
            />
            <span>Pin this note to client overview header</span>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsNoteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Note
            </Button>
          </div>
        </form>
      </Modal>

      {/* Log Communication Modal */}
      <Modal
        isOpen={isCommModalOpen}
        onClose={() => setIsCommModalOpen(false)}
        title="Log Client Communication"
        maxWidth="md"
      >
        <form onSubmit={handleLogComm} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Channel</label>
              <select
                value={commType}
                onChange={(e) => setCommType(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              >
                <option value="CALL">Phone Call</option>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="MEETING">Meeting</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Subject</label>
              <input
                type="text"
                placeholder="e.g. Discussed Q4 milestone"
                value={commSubject}
                onChange={(e) => setCommSubject(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Summary / Notes *</label>
            <textarea
              required
              rows={3}
              placeholder="What was discussed?"
              value={commContent}
              onChange={(e) => setCommContent(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsCommModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Interaction
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Income / Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Record Income / Payment — ${client.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleCreatePayment} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Amount (₹) *</label>
              <input
                type="number"
                required
                placeholder="30000"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Due Date *</label>
              <input
                type="date"
                required
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Recurrence Schedule</label>
              <select
                value={paymentRecurrence}
                onChange={(e) => setPaymentRecurrence(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="NONE">One-time Payment</option>
                <option value="WEEKLY">Weekly Recurring</option>
                <option value="MONTHLY">Monthly Retainer</option>
                <option value="QUARTERLY">Quarterly Recurring</option>
                <option value="YEARLY">Yearly Annual Renewal</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Responsible Account Rep</label>
              <select
                value={paymentResponsibleId}
                onChange={(e) => setPaymentResponsibleId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="">Client Manager ({client.accountManager?.name || user?.name})</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Invoice / Reference #</label>
            <input
              type="text"
              placeholder="e.g. OCT-2026-101"
              value={paymentInvoice}
              onChange={(e) => setPaymentInvoice(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notes / Description</label>
            <textarea
              rows={2}
              placeholder="Details about retainer scope, milestone, or terms..."
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save & Schedule Income
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Client Expense Modal */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title={`Add Client Expense — ${client.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Vendor / Item Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. AWS Cloud Server / Namecheap Domain"
                value={expenseVendor}
                onChange={(e) => setExpenseVendor(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Category</label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="HOSTING">Hosting & Infrastructure</option>
                <option value="DOMAINS">Domains & DNS</option>
                <option value="SOFTWARE">Software & APIs</option>
                <option value="CONTRACTORS">Contractors & Freelancers</option>
                <option value="ADVERTISING">Advertising / Meta Ads</option>
                <option value="OFFICE">Client Deliverables / Office</option>
                <option value="OTHER">Other Expense</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Amount (₹) *</label>
              <input
                type="number"
                required
                placeholder="5000"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Due Date *</label>
              <input
                type="date"
                required
                value={expenseDueDate}
                onChange={(e) => setExpenseDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Recurrence Schedule</label>
              <select
                value={expenseRecurrence}
                onChange={(e) => setExpenseRecurrence(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="NONE">One-time Expense</option>
                <option value="WEEKLY">Weekly Recurring</option>
                <option value="MONTHLY">Monthly Subscription</option>
                <option value="QUARTERLY">Quarterly Recurring</option>
                <option value="YEARLY">Yearly Renewal</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Responsible Person</label>
              <select
                value={expenseResponsibleId}
                onChange={(e) => setExpenseResponsibleId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="">Myself ({user?.name})</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notes / Description</label>
            <textarea
              rows={2}
              placeholder="Details regarding service, login account, or purpose..."
              value={expenseNotes}
              onChange={(e) => setExpenseNotes(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsExpenseModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Client Expense
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Client Details Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Client Details"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveClientDetails} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Client Name *</label>
              <input
                type="text"
                required
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Status</label>
              <select
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="PENDING">PENDING</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Industry</label>
              <input
                type="text"
                placeholder="e.g. Hospitality, Retail"
                value={editFormData.industry}
                onChange={(e) => setEditFormData({ ...editFormData, industry: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Account Manager</label>
              <select
                value={editFormData.accountManagerId}
                onChange={(e) => setEditFormData({ ...editFormData, accountManagerId: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="UNASSIGNED">⚪ Leave Unassigned</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Phone / WhatsApp</label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Email</label>
              <input
                type="email"
                placeholder="client@company.com"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Website URL</label>
              <input
                type="url"
                placeholder="https://client.com"
                value={editFormData.website}
                onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Address / Location</label>
              <input
                type="text"
                placeholder="City, State"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
