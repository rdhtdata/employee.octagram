import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { api } from '../../services/api.js';
import { Payment, Expense, Client, User } from '../../types/index.js';
import { StatusBadge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Tabs } from '../../components/common/Tabs.js';
import { Modal } from '../../components/common/Modal.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { TableSkeleton } from '../../components/common/Skeleton.js';
import { PaymentEditModal } from '../../components/finance/PaymentEditModal.js';
import { ExpenseEditModal } from '../../components/finance/ExpenseEditModal.js';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Building2,
  Calendar,
  Clock,
  Download,
  Repeat,
  Coins,
  Edit3,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';

interface AccountsPageProps {
  initialTab?: 'incoming' | 'outgoing' | 'overview' | 'future_incoming';
  onNavigate: (path: string) => void;
}

export const AccountsPage: React.FC<AccountsPageProps> = ({
  initialTab = 'overview',
  onNavigate,
}) => {
  const { isAdmin } = useAuth();
  const { showToast } = useNotification();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [stats, setStats] = useState<any>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Modals State
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isPaymentEditOpen, setIsPaymentEditOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isExpenseEditOpen, setIsExpenseEditOpen] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // New Payment Form
  const [newPayment, setNewPayment] = useState({
    clientId: '',
    amount: '',
    dueDate: new Date().toISOString().split('T')[0],
    invoiceRef: '',
    status: 'UPCOMING',
    recurrence: 'NONE',
    notes: '',
  });

  // New Expense Form
  const [newExpense, setNewExpense] = useState({
    vendor: '',
    category: 'SOFTWARE',
    amount: '',
    dueDate: new Date().toISOString().split('T')[0],
    recurrence: 'NONE',
    clientId: '',
    notes: '',
  });

  const fetchAccountsData = async () => {
    if (!isAdmin) return;
    try {
      setIsLoading(true);
      const [statsRes, paymentsRes, expensesRes, clientsRes, usersRes] = await Promise.all([
        api.accounts.getStats(),
        api.accounts.getPayments({ status: statusFilter !== 'ALL' ? statusFilter : '', search: searchQuery }),
        api.accounts.getExpenses({ search: searchQuery }),
        api.clients.list(),
        api.users.list().catch(() => ({ users: [] })),
      ]);

      setStats(statsRes);
      setPayments(paymentsRes.payments || []);
      setExpenses(expensesRes.expenses || []);
      setClientsList(clientsRes.clients || []);
      setUsersList(usersRes.users || []);
    } catch (err: any) {
      showToast('Failed to load accounts information', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountsData();
  }, [statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAccountsData();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleTogglePaymentPaid = async (payment: Payment) => {
    const isCurrentlyPaid = payment.status === 'PAID';
    const newStatus = isCurrentlyPaid ? 'UPCOMING' : 'PAID';
    try {
      await api.accounts.updatePayment(payment.id, {
        status: newStatus,
        paymentDate: isCurrentlyPaid ? null : new Date().toISOString().split('T')[0],
      });
      showToast(
        isCurrentlyPaid
          ? 'Payment marked as unpaid & reminder tasks reopened'
          : 'Payment marked as PAID & reminder tasks completed',
        'success'
      );
      fetchAccountsData();
    } catch (err) {
      showToast('Failed to update payment status', 'error');
    }
  };

  const handleToggleExpensePaid = async (expense: Expense) => {
    const isCurrentlyPaid = expense.status === 'PAID';
    const newStatus = isCurrentlyPaid ? 'UPCOMING' : 'PAID';
    try {
      await api.accounts.updateExpense(expense.id, {
        status: newStatus,
        paymentDate: isCurrentlyPaid ? null : new Date().toISOString().split('T')[0],
      });
      showToast(
        isCurrentlyPaid
          ? 'Expense marked as unpaid'
          : 'Expense marked as PAID & next cycle updated',
        'success'
      );
      fetchAccountsData();
    } catch (err) {
      showToast('Failed to update expense status', 'error');
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.clientId || !newPayment.amount) return;
    try {
      await api.accounts.createPayment({
        ...newPayment,
        amount: Number(newPayment.amount),
      });
      setIsPaymentModalOpen(false);
      setNewPayment({
        clientId: '',
        amount: '',
        dueDate: new Date().toISOString().split('T')[0],
        invoiceRef: '',
        status: 'UPCOMING',
        recurrence: 'NONE',
        notes: '',
      });
      showToast('Payment created & task auto-synced', 'success');
      fetchAccountsData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create payment', 'error');
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.vendor || !newExpense.amount) return;
    try {
      await api.accounts.createExpense({
        ...newExpense,
        amount: Number(newExpense.amount),
        relatedClientId: newExpense.clientId || undefined,
      });
      setIsExpenseModalOpen(false);
      setNewExpense({
        vendor: '',
        category: 'SOFTWARE',
        amount: '',
        dueDate: new Date().toISOString().split('T')[0],
        recurrence: 'NONE',
        clientId: '',
        notes: '',
      });
      showToast('Expense recorded & task auto-synced', 'success');
      fetchAccountsData();
    } catch (err: any) {
      showToast(err.message || 'Failed to record expense', 'error');
    }
  };

  if (!isAdmin) {
    return (
      <EmptyState
        title="Access Restricted"
        description="The Accounts module is restricted to Octagram Administrative personnel."
        actionLabel="Go to Dashboard"
        onAction={() => onNavigate('/')}
      />
    );
  }

  const now = new Date();
  const futurePayments = payments
    .filter((p) => p.status !== 'PAID' && p.status !== 'CANCELLED' && new Date(p.dueDate) >= now)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const tabsList = [
    { id: 'overview', label: 'Financial Overview' },
    { id: 'incoming', label: 'Incoming Payments', count: payments.filter(p => p.status !== 'PAID').length },
    { id: 'future_incoming', label: 'Future Incoming Payments', count: futurePayments.length },
    { id: 'outgoing', label: 'Outgoing Expenses', count: expenses.filter(e => e.status !== 'PAID').length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-900">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" /> Accounts & Financial Tracker
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Admin ledger, incoming client milestones, outgoing infrastructure expenses, and revenue flow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => api.export.downloadCsv('payments')}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Export CSV
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsExpenseModalOpen(true)}
            icon={<ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />}
          >
            Add Expense
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsPaymentModalOpen(true)}
            icon={<ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />}
          >
            Record Payment
          </Button>
        </div>
      </div>

      {/* Top Level Financial Metric Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-medium tracking-wide">TOTAL RECEIVED</span>
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              ₹{stats.incoming.totalReceived.toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              Expected: ₹{stats.incoming.totalExpected.toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-medium tracking-wide">TOTAL OUTSTANDING</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400">
              ₹{stats.incoming.totalOutstanding.toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-500">Scheduled client milestones</p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-medium tracking-wide">TOTAL OVERDUE</span>
              <AlertCircle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-400">
              ₹{stats.incoming.totalOverdue.toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-500">Requires immediate escalation</p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-medium tracking-wide">TOTAL EXPENSES</span>
              <ArrowUpRight className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              ₹{stats.outgoing.totalExpenses.toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              Paid: ₹{stats.outgoing.paidExpenses.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={tabsList}
        activeTab={activeTab}
        onChange={(tabId: string) => {
          setActiveTab(tabId as any);
          onNavigate(tabId === 'overview' ? '/accounts' : `/accounts/${tabId}`);
        }}
      />

      {/* INCOMING PAYMENTS TAB */}
      {(activeTab === 'incoming' || activeTab === 'overview') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Incoming Client Payments
            </h3>
            {activeTab === 'overview' && (
              <button
                onClick={() => setActiveTab('incoming')}
                className="text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                View all ({payments.length})
              </button>
            )}
          </div>

          {isLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : payments.length === 0 ? (
            <EmptyState
              title="No payment records found"
              description="Record your first incoming client milestone."
              actionLabel="Record Payment"
              onAction={() => setIsPaymentModalOpen(true)}
            />
          ) : (
            <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-x-auto touch-pan-x">
              <table className="w-full text-left text-xs min-w-[640px]">
                <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Invoice / Ref</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Schedule</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Responsible</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-850/40 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          onClick={() => onNavigate(`/clients/${p.clientId}?tab=finances`)}
                          className="font-semibold text-zinc-100 hover:text-emerald-400 cursor-pointer"
                        >
                          {p.client?.name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-300">
                        {p.invoiceRef || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-zinc-100">
                        {p.currency === 'INR' ? '₹' : '$'}
                        {p.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {p.recurrence && p.recurrence !== 'NONE' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                            <Repeat className="w-2.5 h-2.5" />
                            {p.recurrence}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-mono">One-time</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-400">
                        {format(new Date(p.dueDate), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {p.responsibleUser?.name || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {p.status !== 'PAID' ? (
                            <Button
                              variant="subtle"
                              size="xs"
                              onClick={() => handleTogglePaymentPaid(p)}
                              icon={<CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                            >
                              Mark Paid
                            </Button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleTogglePaymentPaid(p)}
                              className="text-[11px] text-emerald-400 hover:text-amber-300 hover:bg-zinc-800 px-2 py-0.5 rounded border border-emerald-900/60 transition-colors flex items-center gap-1 font-medium cursor-pointer"
                              title="Click to uncheck / mark as unpaid"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Paid</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setEditingPayment(p);
                              setIsPaymentEditOpen(true);
                            }}
                            className="p-1 text-zinc-400 hover:text-sky-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                            title="Modify Payment & Dates"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPayment(p);
                              setIsPaymentEditOpen(true);
                            }}
                            className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                            title="Delete Payment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* FUTURE INCOMING PAYMENTS TAB */}
      {activeTab === 'future_incoming' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/40 p-4 rounded-xl border border-zinc-850">
            <div>
              <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-400" /> Future Scheduled Incoming Payments ({futurePayments.length})
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1">
                Forward-dated milestones, retainers, and recurring payment cycles. These are future-dated pipeline funds (not overdue) automatically tracked across all clients.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsPaymentModalOpen(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Record Future Payment
            </Button>
          </div>

          {isLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : futurePayments.length === 0 ? (
            <EmptyState
              title="No future payments scheduled"
              description="Record recurring retainer cycles or future project milestone invoices."
              actionLabel="Schedule Payment"
              onAction={() => setIsPaymentModalOpen(true)}
            />
          ) : (
            <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-x-auto touch-pan-x">
              <table className="w-full text-left text-xs min-w-[720px]">
                <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Invoice / Ref</th>
                    <th className="px-4 py-3">Scheduled Amount</th>
                    <th className="px-4 py-3">Recurrence Schedule</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Time Remaining</th>
                    <th className="px-4 py-3">Responsible Rep</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {futurePayments.map((p) => {
                    const daysRemaining = Math.ceil((new Date(p.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={p.id} className="hover:bg-zinc-850/40 transition-colors">
                        <td className="px-4 py-3">
                          <span
                            onClick={() => onNavigate(`/clients/${p.clientId}?tab=future_payments`)}
                            className="font-semibold text-zinc-100 hover:text-emerald-400 cursor-pointer flex items-center gap-1.5"
                          >
                            <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                            {p.client?.name || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-300">
                          <div>{p.invoiceRef || 'Milestone / Retainer'}</div>
                          {p.notes && <div className="text-[10px] text-zinc-500 font-sans truncate max-w-xs">{p.notes}</div>}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-400 text-sm">
                          {p.currency === 'INR' ? '₹' : '$'}
                          {p.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {p.recurrence && p.recurrence !== 'NONE' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                              <Repeat className="w-2.5 h-2.5" />
                              {p.recurrence}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500 font-mono">One-time</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-300">
                          {format(new Date(p.dueDate), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px]">
                          <span className="inline-flex items-center gap-1 text-sky-300 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded font-medium">
                            <Clock className="w-3 h-3 text-sky-400" />
                            {daysRemaining <= 0 ? 'Due Today' : `In ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {p.responsibleUser?.name || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded text-[10px] font-medium font-mono border border-zinc-700">
                            Future Scheduled
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="subtle"
                              size="xs"
                              onClick={() => handleTogglePaymentPaid(p)}
                              icon={<CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                            >
                              Mark Paid
                            </Button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPayment(p);
                                setIsPaymentEditOpen(true);
                              }}
                              className="p-1 text-zinc-400 hover:text-sky-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                              title="Modify Payment & Dates"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPayment(p);
                                setIsPaymentEditOpen(true);
                              }}
                              className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                              title="Delete Payment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* OUTGOING EXPENSES TAB */}
      {(activeTab === 'outgoing' || activeTab === 'overview') && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Outgoing Expenses & Infrastructure Costs
            </h3>
            {activeTab === 'overview' && (
              <button
                onClick={() => setActiveTab('outgoing')}
                className="text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                View all ({expenses.length})
              </button>
            )}
          </div>

          {isLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : expenses.length === 0 ? (
            <EmptyState
              title="No expenses logged"
              description="Record recurring software licenses, domain renewals, or contractor payouts."
              actionLabel="Add Expense"
              onAction={() => setIsExpenseModalOpen(true)}
            />
          ) : (
            <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-x-auto touch-pan-x">
              <table className="w-full text-left text-xs min-w-[640px]">
                <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Vendor / Service</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Related Client</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Schedule</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-zinc-850/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-zinc-100">
                        <div>{e.vendor}</div>
                        {e.notes && <div className="text-[10px] text-zinc-500 font-sans truncate max-w-xs">{e.notes}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-750">
                          {e.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {e.client ? (
                          <span
                            onClick={() => onNavigate(`/clients/${e.relatedClientId}?tab=finances`)}
                            className="text-zinc-300 hover:text-emerald-400 cursor-pointer"
                          >
                            {e.client.name}
                          </span>
                        ) : (
                          <span className="text-zinc-500 font-mono text-[11px]">General / Overhead</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-zinc-100">
                        {e.currency === 'INR' ? '₹' : '$'}
                        {e.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {e.recurrence && e.recurrence !== 'NONE' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                            <Repeat className="w-2.5 h-2.5" />
                            {e.recurrence}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-mono">One-time</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-400">
                        {format(new Date(e.dueDate), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={e.status} size="xs" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {e.status !== 'PAID' ? (
                            <Button
                              variant="subtle"
                              size="xs"
                              onClick={() => handleToggleExpensePaid(e)}
                              icon={<CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                            >
                              Mark Paid
                            </Button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleExpensePaid(e)}
                              className="text-[11px] text-emerald-400 hover:text-amber-300 hover:bg-zinc-800 px-2 py-0.5 rounded border border-emerald-900/60 transition-colors flex items-center gap-1 font-medium cursor-pointer"
                              title="Click to uncheck / mark as unpaid"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Paid</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpense(e);
                              setIsExpenseEditOpen(true);
                            }}
                            className="p-1 text-zinc-400 hover:text-sky-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                            title="Modify Expense & Dates"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpense(e);
                              setIsExpenseEditOpen(true);
                            }}
                            className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Incoming Client Payment"
        maxWidth="md"
      >
        <form onSubmit={handleCreatePayment} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Client *</label>
            <select
              required
              value={newPayment.clientId}
              onChange={(e) => setNewPayment({ ...newPayment, clientId: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
            >
              <option value="">Select client...</option>
              {clientsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Amount (₹) *</label>
              <input
                type="number"
                required
                placeholder="30000"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Due Date *</label>
              <input
                type="date"
                required
                value={newPayment.dueDate}
                onChange={(e) => setNewPayment({ ...newPayment, dueDate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Recurrence Schedule</label>
              <select
                value={newPayment.recurrence}
                onChange={(e) => setNewPayment({ ...newPayment, recurrence: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              >
                <option value="NONE">One-time Milestone</option>
                <option value="WEEKLY">Weekly Retainer</option>
                <option value="MONTHLY">Monthly Retainer</option>
                <option value="QUARTERLY">Quarterly Cycle</option>
                <option value="YEARLY">Yearly Retainer / Domain</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Invoice / Reference #</label>
              <input
                type="text"
                placeholder="OCT-2026-102"
                value={newPayment.invoiceRef}
                onChange={(e) => setNewPayment({ ...newPayment, invoiceRef: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notes / Description</label>
            <textarea
              rows={2}
              placeholder="e.g. Monthly SEO and CMS retainer"
              value={newPayment.notes}
              onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Expense Modal */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Add Outgoing Expense"
        maxWidth="md"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Vendor / Service *</label>
              <input
                type="text"
                required
                placeholder="e.g. AWS Cloud Hosting"
                value={newExpense.vendor}
                onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Category</label>
              <select
                value={newExpense.category}
                onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value as any })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              >
                <option value="HOSTING">Hosting & Cloud</option>
                <option value="SOFTWARE">Software & Tools</option>
                <option value="DOMAINS">Domains & DNS</option>
                <option value="CONTRACTORS">Contractors</option>
                <option value="ADVERTISING">Advertising</option>
                <option value="OFFICE">Office Expenses</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Related Client (Optional)</label>
              <select
                value={newExpense.clientId}
                onChange={(e) => setNewExpense({ ...newExpense, clientId: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              >
                <option value="">General Overhead / Internal</option>
                {clientsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Recurrence Schedule</label>
              <select
                value={newExpense.recurrence}
                onChange={(e) => setNewExpense({ ...newExpense, recurrence: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              >
                <option value="NONE">One-time Expense</option>
                <option value="WEEKLY">Weekly Recurring</option>
                <option value="MONTHLY">Monthly Subscription</option>
                <option value="QUARTERLY">Quarterly Renewal</option>
                <option value="YEARLY">Annual Renewal / License</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Amount (₹) *</label>
              <input
                type="number"
                required
                placeholder="10000"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Due Date *</label>
              <input
                type="date"
                required
                value={newExpense.dueDate}
                onChange={(e) => setNewExpense({ ...newExpense, dueDate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notes / Item Details</label>
            <textarea
              rows={2}
              placeholder="e.g. Dedicated EC2 instance for client portal"
              value={newExpense.notes}
              onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-zinc-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsExpenseModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Expense
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Payment Modal */}
      <PaymentEditModal
        isOpen={isPaymentEditOpen}
        onClose={() => {
          setIsPaymentEditOpen(false);
          setEditingPayment(null);
        }}
        onSuccess={fetchAccountsData}
        onDeleteSuccess={fetchAccountsData}
        payment={editingPayment}
        usersList={usersList}
      />

      {/* Edit Expense Modal */}
      <ExpenseEditModal
        isOpen={isExpenseEditOpen}
        onClose={() => {
          setIsExpenseEditOpen(false);
          setEditingExpense(null);
        }}
        onSuccess={fetchAccountsData}
        onDeleteSuccess={fetchAccountsData}
        expense={editingExpense}
        usersList={usersList}
        clientsList={clientsList}
      />
    </div>
  );
};
