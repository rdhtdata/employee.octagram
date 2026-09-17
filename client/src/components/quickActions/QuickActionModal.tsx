import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { api } from '../../services/api.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { CheckSquare, Calendar, Ticket, Target, Building2, ArrowDownLeft, ArrowUpRight, Users, Check } from 'lucide-react';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultType?: 'task' | 'meeting' | 'ticket' | 'lead' | 'client' | 'payment' | 'expense';
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultType = 'task',
}) => {
  const { user, isAdmin } = useAuth();
  const { showToast } = useNotification();
  const [activeType, setActiveType] = useState<string>(defaultType);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Users & Clients list for select dropdowns
  const [usersList, setUsersList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);

  // Task Form State
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    assignedUserId: '',
    relatedClientId: '',
    priority: 'MEDIUM',
    deadline: '',
    isPersonal: false,
  });
  const [taskAudienceMode, setTaskAudienceMode] = useState<'ASSIGNEE_ONLY' | 'ALL' | 'SELECTED'>('SELECTED');
  const [taskCollaboratorIds, setTaskCollaboratorIds] = useState<string[]>([]);

  // Meeting Form State
  const [meetingData, setMeetingData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '14:00',
    endTime: '15:00',
    relatedClientId: '',
    locationOrLink: '',
    agenda: '',
  });

  // Ticket Form State
  const [ticketData, setTicketData] = useState({
    title: '',
    description: '',
    category: 'CLIENT',
    priority: 'MEDIUM',
    relatedClientId: '',
    assignedUserId: '',
  });
  const [ticketAudienceMode, setTicketAudienceMode] = useState<'ASSIGNEE_ONLY' | 'ALL' | 'SELECTED'>('SELECTED');
  const [ticketCollaboratorIds, setTicketCollaboratorIds] = useState<string[]>([]);

  // Lead Form State
  const [leadData, setLeadData] = useState({
    businessName: '',
    category: '',
    industry: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    crmStatus: 'NEW',
    leadScore: 60,
    assignedUserId: '',
    notes: '',
  });

  // Client Form State
  const [clientData, setClientData] = useState({
    name: '',
    industry: '',
    accountManagerId: '',
    phone: '',
    email: '',
    website: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  });

  // Payment Form State (Admin Only)
  const [paymentData, setPaymentData] = useState({
    clientId: '',
    amount: '',
    currency: 'INR',
    dueDate: new Date().toISOString().split('T')[0],
    recurrence: 'NONE',
    status: 'UPCOMING',
    invoiceRef: '',
    notes: '',
  });

  // Expense Form State (Admin Only)
  const [expenseData, setExpenseData] = useState({
    vendor: '',
    category: 'SOFTWARE',
    relatedClientId: '',
    amount: '',
    currency: 'INR',
    dueDate: new Date().toISOString().split('T')[0],
    recurrence: 'NONE',
    status: 'UPCOMING',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      setActiveType(defaultType);
      // Load dropdown references
      api.users.list().then(res => setUsersList(res.users || [])).catch(() => {});
      api.clients.list().then(res => setClientsList(res.clients || [])).catch(() => {});
    }
  }, [isOpen, defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (activeType === 'task') {
        if (!taskData.title.trim()) throw new Error('Task title is required');
        await api.tasks.create({
          ...taskData,
          audienceMode: taskAudienceMode,
          collaboratorIds: taskAudienceMode === 'SELECTED' ? taskCollaboratorIds : [],
        });
        showToast('Task created successfully', 'success');
      } else if (activeType === 'meeting') {
        if (!meetingData.title.trim()) throw new Error('Meeting title is required');
        await api.meetings.create(meetingData);
        showToast('Meeting scheduled successfully', 'success');
      } else if (activeType === 'ticket') {
        if (!ticketData.title.trim() || !ticketData.description.trim()) throw new Error('Title and description are required');
        await api.tickets.create({
          ...ticketData,
          audienceMode: ticketAudienceMode,
          collaboratorIds: ticketAudienceMode === 'SELECTED' ? ticketCollaboratorIds : [],
        });
        showToast('Ticket logged successfully', 'success');
      } else if (activeType === 'lead') {
        if (!leadData.businessName.trim()) throw new Error('Business name is required');
        await api.leads.create(leadData);
        showToast('Lead added to CRM', 'success');
      } else if (activeType === 'client') {
        if (!clientData.name.trim()) throw new Error('Client name is required');
        await api.clients.create(clientData);
        showToast('Client created successfully', 'success');
      } else if (activeType === 'payment') {
        if (!paymentData.clientId || !paymentData.amount) throw new Error('Client and amount are required');
        await api.accounts.createPayment({
          ...paymentData,
          amount: Number(paymentData.amount),
        });
        showToast('Payment record added & reminder task synchronized', 'success');
      } else if (activeType === 'expense') {
        if (!expenseData.vendor || !expenseData.amount) throw new Error('Vendor and amount are required');
        await api.accounts.createExpense({
          ...expenseData,
          amount: Number(expenseData.amount),
          relatedClientId: expenseData.relatedClientId || undefined,
        });
        showToast('Expense recorded', 'success');
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const actionTabs = [
    { id: 'task', label: 'Task', icon: <CheckSquare className="w-3.5 h-3.5" /> },
    { id: 'meeting', label: 'Meeting', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'ticket', label: 'Ticket', icon: <Ticket className="w-3.5 h-3.5" /> },
    { id: 'lead', label: 'Lead', icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'client', label: 'Client', icon: <Building2 className="w-3.5 h-3.5" /> },
    ...(isAdmin ? [
      { id: 'payment', label: 'Payment', icon: <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" /> },
      { id: 'expense', label: 'Expense', icon: <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" /> },
    ] : [])
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Create" maxWidth="lg">
      <div className="space-y-4">
        {/* Action Type Selector Pills */}
        <div className="flex flex-wrap gap-1.5 pb-3 border-b border-zinc-800">
          {actionTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveType(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeType === tab.id
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'bg-zinc-850 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Dynamic Creation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* TASK FORM */}
          {activeType === 'task' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prepare website proposal"
                  value={taskData.title}
                  onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Assign To</label>
                  <select
                    value={taskData.assignedUserId}
                    onChange={(e) => setTaskData({ ...taskData, assignedUserId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="">Myself ({user?.name})</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Priority</label>
                  <select
                    value={taskData.priority}
                    onChange={(e) => setTaskData({ ...taskData, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Related Client</label>
                  <select
                    value={taskData.relatedClientId}
                    onChange={(e) => setTaskData({ ...taskData, relatedClientId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="">None (Internal)</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Deadline</label>
                  <input
                    type="date"
                    value={taskData.deadline}
                    onChange={(e) => setTaskData({ ...taskData, deadline: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Add details, links, or instructions..."
                  value={taskData.description}
                  onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Relevant People / Collaborators */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    Who is this task relevant for?
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {taskAudienceMode === 'ALL'
                      ? 'All team members'
                      : taskAudienceMode === 'SELECTED'
                      ? `${taskCollaboratorIds.length} selected`
                      : 'Assignee only'}
                  </span>
                </div>

                {/* Audience Selection Pills */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-900 rounded-lg border border-zinc-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setTaskAudienceMode('SELECTED')}
                    className={`py-1.5 px-2 rounded-md font-medium transition-all text-center cursor-pointer ${
                      taskAudienceMode === 'SELECTED'
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Selected People
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskAudienceMode('ALL');
                      setTaskCollaboratorIds(usersList.map(u => u.id));
                    }}
                    className={`py-1.5 px-2 rounded-md font-medium transition-all text-center cursor-pointer ${
                      taskAudienceMode === 'ALL'
                        ? 'bg-indigo-950/80 text-indigo-200 shadow-sm border border-indigo-700/60'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Everyone (All)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskAudienceMode('ASSIGNEE_ONLY');
                      setTaskCollaboratorIds([]);
                    }}
                    className={`py-1.5 px-2 rounded-md font-medium transition-all text-center cursor-pointer ${
                      taskAudienceMode === 'ASSIGNEE_ONLY'
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Assignee Only
                  </button>
                </div>

                {/* Selected People Checkboxes Matrix */}
                {taskAudienceMode === 'SELECTED' && (
                  <div className="space-y-2 p-2.5 bg-zinc-900/60 rounded-lg border border-zinc-800/80">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 px-0.5">
                      <span>Select colleagues who should see & collaborate on this task:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTaskCollaboratorIds(usersList.map(u => u.id))}
                          className="text-indigo-400 hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setTaskCollaboratorIds([])}
                          className="text-zinc-400 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {usersList.map((u) => {
                        const isSelected = taskCollaboratorIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setTaskCollaboratorIds(prev => prev.filter(id => id !== u.id));
                              } else {
                                setTaskCollaboratorIds(prev => [...prev, u.id]);
                              }
                            }}
                            className={`p-1.5 rounded flex items-center justify-between text-left text-xs transition-all border cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-950/40 border-indigo-700/60 text-zinc-100 font-medium'
                                : 'bg-zinc-850/40 border-zinc-750/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                            }`}
                          >
                            <div className="truncate pr-1">
                              <span>{u.name}</span>
                              <span className="text-[10px] text-zinc-500 ml-1">({u.role})</span>
                            </div>
                            {isSelected && <Check className="w-3 h-3 text-indigo-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* MEETING FORM */}
          {activeType === 'meeting' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Meeting Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Website Redesign Sync"
                  value={meetingData.title}
                  onChange={(e) => setMeetingData({ ...meetingData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={meetingData.date}
                    onChange={(e) => setMeetingData({ ...meetingData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={meetingData.startTime}
                    onChange={(e) => setMeetingData({ ...meetingData, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={meetingData.endTime}
                    onChange={(e) => setMeetingData({ ...meetingData, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Related Client</label>
                  <select
                    value={meetingData.relatedClientId}
                    onChange={(e) => setMeetingData({ ...meetingData, relatedClientId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  >
                    <option value="">Internal / No Client</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Location or Meet URL</label>
                  <input
                    type="text"
                    placeholder="https://meet.google.com/..."
                    value={meetingData.locationOrLink}
                    onChange={(e) => setMeetingData({ ...meetingData, locationOrLink: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 placeholder-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Agenda</label>
                <textarea
                  rows={2}
                  placeholder="Key topics to cover..."
                  value={meetingData.agenda}
                  onChange={(e) => setMeetingData({ ...meetingData, agenda: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                />
              </div>
            </>
          )}

          {/* TICKET FORM */}
          {activeType === 'ticket' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Ticket Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Contact form not sending notifications"
                  value={ticketData.title}
                  onChange={(e) => setTicketData({ ...ticketData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
                  <select
                    value={ticketData.category}
                    onChange={(e) => setTicketData({ ...ticketData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  >
                    <option value="CLIENT">Client</option>
                    <option value="TECHNICAL">Technical</option>
                    <option value="INTERNAL">Internal</option>
                    <option value="SALES">Sales</option>
                    <option value="ADMIN">Administrative</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Priority</label>
                  <select
                    value={ticketData.priority}
                    onChange={(e) => setTicketData({ ...ticketData, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Related Client (Optional)</label>
                  <select
                    value={ticketData.relatedClientId}
                    onChange={(e) => setTicketData({ ...ticketData, relatedClientId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  >
                    <option value="">Internal / No Client</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Assignee</label>
                  <select
                    value={ticketData.assignedUserId}
                    onChange={(e) => setTicketData({ ...ticketData, assignedUserId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  >
                    <option value="">Unassigned</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Issue Description *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detailed description of the issue or request..."
                  value={ticketData.description}
                  onChange={(e) => setTicketData({ ...ticketData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                />
              </div>

              {/* Who is this ticket relevant for? (Collaborators / Visibility) */}
              <div className="space-y-2 pt-1 border-t border-zinc-850">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-zinc-300">
                    Who is this ticket relevant for?
                  </label>
                  <span className="text-[10px] text-zinc-500">Shared collaborators & notifications</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-900 rounded-lg border border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setTicketAudienceMode('SELECTED')}
                    className={`py-1.5 px-2 rounded-md font-medium transition-all text-center cursor-pointer ${
                      ticketAudienceMode === 'SELECTED'
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Selected People
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTicketAudienceMode('ALL');
                      setTicketCollaboratorIds(usersList.map(u => u.id));
                    }}
                    className={`py-1.5 px-2 rounded-md font-medium transition-all text-center cursor-pointer ${
                      ticketAudienceMode === 'ALL'
                        ? 'bg-indigo-950/80 text-indigo-200 shadow-sm border border-indigo-700/60'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Everyone (All)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTicketAudienceMode('ASSIGNEE_ONLY');
                      setTicketCollaboratorIds([]);
                    }}
                    className={`py-1.5 px-2 rounded-md font-medium transition-all text-center cursor-pointer ${
                      ticketAudienceMode === 'ASSIGNEE_ONLY'
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Assignee Only
                  </button>
                </div>

                {/* Selected People Checkboxes Matrix */}
                {ticketAudienceMode === 'SELECTED' && (
                  <div className="space-y-2 p-2.5 bg-zinc-900/60 rounded-lg border border-zinc-800/80">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 px-0.5">
                      <span>Select colleagues who should see & collaborate on this ticket:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTicketCollaboratorIds(usersList.map(u => u.id))}
                          className="text-indigo-400 hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setTicketCollaboratorIds([])}
                          className="text-zinc-400 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {usersList.map((u) => {
                        const isSelected = ticketCollaboratorIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setTicketCollaboratorIds(prev => prev.filter(id => id !== u.id));
                              } else {
                                setTicketCollaboratorIds(prev => [...prev, u.id]);
                              }
                            }}
                            className={`p-1.5 rounded flex items-center justify-between text-left text-xs transition-all border cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-950/40 border-indigo-700/60 text-zinc-100 font-medium'
                                : 'bg-zinc-850/40 border-zinc-750/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                            }`}
                          >
                            <div className="truncate pr-1">
                              <span>{u.name}</span>
                              <span className="text-[10px] text-zinc-500 ml-1">({u.role})</span>
                            </div>
                            {isSelected && <Check className="w-3 h-3 text-indigo-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* LEAD FORM */}
          {activeType === 'lead' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Blue Tokai Coffee"
                  value={leadData.businessName}
                  onChange={(e) => setLeadData({ ...leadData, businessName: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Industry</label>
                  <input
                    type="text"
                    placeholder="e.g. Dental Clinic / Home Baker"
                    value={leadData.industry}
                    onChange={(e) => setLeadData({ ...leadData, industry: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Category / Sub-type</label>
                  <input
                    type="text"
                    placeholder="e.g. Cake Shop / Specialty Clinic"
                    value={leadData.category}
                    onChange={(e) => setLeadData({ ...leadData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Vikram Sharma"
                    value={leadData.contactName}
                    onChange={(e) => setLeadData({ ...leadData, contactName: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Assign To Rep</label>
                  <select
                    value={leadData.assignedUserId}
                    onChange={(e) => setLeadData({ ...leadData, assignedUserId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  >
                    <option value="">Myself ({user?.name})</option>
                    <option value="UNASSIGNED">⚪ Leave Unassigned</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={leadData.phone}
                    onChange={(e) => setLeadData({ ...leadData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="contact@business.com"
                    value={leadData.email}
                    onChange={(e) => setLeadData({ ...leadData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
              </div>
            </>
          )}

          {/* CLIENT FORM */}
          {activeType === 'client' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Client Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Petals Suites & Hotel"
                  value={clientData.name}
                  onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Industry</label>
                  <input
                    type="text"
                    placeholder="e.g. Hospitality"
                    value={clientData.industry}
                    onChange={(e) => setClientData({ ...clientData, industry: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Account Manager</label>
                  <select
                    value={clientData.accountManagerId}
                    onChange={(e) => setClientData({ ...clientData, accountManagerId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="">Myself ({user?.name})</option>
                    <option value="UNASSIGNED">⚪ Leave Unassigned</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Website</label>
                  <input
                    type="url"
                    placeholder="https://client.com"
                    value={clientData.website}
                    onChange={(e) => setClientData({ ...clientData, website: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Phone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={clientData.phone}
                    onChange={(e) => setClientData({ ...clientData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <span className="text-[11px] font-semibold text-zinc-400 block mb-2">Primary Contact</span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Contact Name"
                    value={clientData.contactName}
                    onChange={(e) => setClientData({ ...clientData, contactName: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-zinc-850 border border-zinc-750 rounded text-xs text-zinc-100"
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    value={clientData.contactPhone}
                    onChange={(e) => setClientData({ ...clientData, contactPhone: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-zinc-850 border border-zinc-750 rounded text-xs text-zinc-100"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={clientData.contactEmail}
                    onChange={(e) => setClientData({ ...clientData, contactEmail: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-zinc-850 border border-zinc-750 rounded text-xs text-zinc-100"
                  />
                </div>
              </div>
            </>
          )}

          {/* PAYMENT FORM (Admin Only) */}
          {activeType === 'payment' && isAdmin && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Client *</label>
                  <select
                    required
                    value={paymentData.clientId}
                    onChange={(e) => setPaymentData({ ...paymentData, clientId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  >
                    <option value="">Select client...</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="30000"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentData.dueDate}
                    onChange={(e) => setPaymentData({ ...paymentData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Recurrence Schedule</label>
                  <select
                    value={paymentData.recurrence}
                    onChange={(e) => setPaymentData({ ...paymentData, recurrence: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  >
                    <option value="NONE">One-time Milestone</option>
                    <option value="WEEKLY">Weekly Retainer</option>
                    <option value="MONTHLY">Monthly Retainer</option>
                    <option value="QUARTERLY">Quarterly Cycle</option>
                    <option value="YEARLY">Yearly Retainer / Domain</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Invoice / Reference #</label>
                <input
                  type="text"
                  placeholder="OCT-2026-089"
                  value={paymentData.invoiceRef}
                  onChange={(e) => setPaymentData({ ...paymentData, invoiceRef: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                />
              </div>
            </>
          )}

          {/* EXPENSE FORM (Admin Only) */}
          {activeType === 'expense' && isAdmin && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Vendor / Service *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AWS Cloud Hosting"
                    value={expenseData.vendor}
                    onChange={(e) => setExpenseData({ ...expenseData, vendor: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
                  <select
                    value={expenseData.category}
                    onChange={(e) => setExpenseData({ ...expenseData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
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
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Related Client (Optional)</label>
                  <select
                    value={expenseData.relatedClientId}
                    onChange={(e) => setExpenseData({ ...expenseData, relatedClientId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  >
                    <option value="">General Overhead / Internal</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Recurrence Schedule</label>
                  <select
                    value={expenseData.recurrence}
                    onChange={(e) => setExpenseData({ ...expenseData, recurrence: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
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
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="15000"
                    value={expenseData.amount}
                    onChange={(e) => setExpenseData({ ...expenseData, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseData.dueDate}
                    onChange={(e) => setExpenseData({ ...expenseData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100"
                  />
                </div>
              </div>
            </>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isLoading}>
              Create {activeType.charAt(0).toUpperCase() + activeType.slice(1)}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
