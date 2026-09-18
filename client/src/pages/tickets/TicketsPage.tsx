import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { api } from '../../services/api.js';
import { Ticket, User } from '../../types/index.js';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Drawer } from '../../components/common/Drawer.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { TableSkeleton } from '../../components/common/Skeleton.js';
import {
  Ticket as TicketIcon,
  Plus,
  Search,
  MessageSquare,
  Building2,
  Send,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';

export const TicketsPage: React.FC<{ initialTicketId?: string }> = ({ initialTicketId }) => {
  const { user } = useAuth();
  const { showToast } = useNotification();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Selected Ticket Drawer
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.tickets.list(params);
      setTickets(res.tickets || []);

      if (initialTicketId && !selectedTicket) {
        api.tickets.get(initialTicketId).then(tRes => setSelectedTicket(tRes.ticket)).catch(() => {});
      }
    } catch (err) {
      showToast('Failed to load tickets', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTickets();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    api.users.list().then(res => setUsersList(res.users || [])).catch(() => {});
  }, []);

  const handleOpenTicket = async (ticket: Ticket) => {
    try {
      const res = await api.tickets.get(ticket.id);
      setSelectedTicket(res.ticket);
    } catch (err) {
      setSelectedTicket(ticket);
    }
  };

  const handleUpdateTicket = async (fields: Partial<Ticket>) => {
    if (!selectedTicket) return;
    try {
      const res = await api.tickets.update(selectedTicket.id, fields);
      setSelectedTicket(res.ticket);
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, ...fields } : t));
      showToast('Ticket updated', 'success');
    } catch (err) {
      showToast('Failed to update ticket', 'error');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || !selectedTicket) return;
    setIsSubmittingComment(true);
    try {
      const res = await api.tickets.addComment(selectedTicket.id, commentContent.trim());
      setSelectedTicket(prev => prev ? {
        ...prev,
        comments: [...(prev.comments || []), res.comment]
      } : null);
      setCommentContent('');
      showToast('Comment posted', 'success');
    } catch (err) {
      showToast('Failed to post comment', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-900">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
            <TicketIcon className="w-5 h-5 text-rose-400" /> Internal Ticketing
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Client bug reports, technical fixes, internal operations, and request queues.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            const event = new CustomEvent('open-quick-action', { detail: { type: 'ticket' } });
            window.dispatchEvent(event);
          }}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          New Ticket
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-900/40 p-3 rounded-xl border border-zinc-850">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search tickets..."
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
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING">Waiting</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none"
        >
          <option value="ALL">All Categories</option>
          <option value="CLIENT">Client</option>
          <option value="TECHNICAL">Technical</option>
          <option value="INTERNAL">Internal</option>
          <option value="SALES">Sales</option>
          <option value="ADMIN">Administrative</option>
        </select>
      </div>

      {/* Tickets List Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<TicketIcon className="w-5 h-5" />}
          title="No tickets found"
          description="Create a ticket to report an operational issue or feature request."
          actionLabel="Create Ticket"
          onAction={() => {
            const event = new CustomEvent('open-quick-action', { detail: { type: 'ticket' } });
            window.dispatchEvent(event);
          }}
        />
      ) : (
        <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-hidden divide-y divide-zinc-850">
          {tickets.map((t) => (
            <div
              key={t.id}
              onClick={() => handleOpenTicket(t)}
              className="p-3 sm:p-3.5 hover:bg-zinc-850/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 cursor-pointer text-xs group"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 w-full">
                <span className="font-mono text-[11px] font-bold text-zinc-400 bg-zinc-850 px-2 py-0.5 rounded border border-zinc-750 shrink-0 mt-0.5 sm:mt-0">
                  #{t.ticketNumber}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-100 group-hover:text-rose-400 transition-colors truncate">
                    {t.title}
                  </p>
                  <div className="flex items-center gap-2 sm:gap-3 text-[11px] text-zinc-400 mt-0.5 flex-wrap">
                    <span className="font-mono text-[10px] uppercase text-zinc-500">[{t.category}]</span>
                    {t.client && <span>🏢 {t.client.name}</span>}
                    {t.assignee && <span>👤 {t.assignee.name}</span>}
                    {t.collaborators && t.collaborators.length > 0 && (
                      <span className="flex items-center gap-1 text-indigo-400 font-medium">
                        <Users className="w-3 h-3 text-indigo-400" />
                        {t.collaborators.length} shared
                      </span>
                    )}
                    {t._count?.comments ? (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-zinc-500" />
                        {t._count.comments}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0 border-t border-zinc-850/40 sm:border-0">
                <PriorityBadge priority={t.priority} size="xs" />
                <StatusBadge status={t.status} size="xs" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TICKET DETAIL DRAWER */}
      <Drawer
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket ? `#${selectedTicket.ticketNumber} ${selectedTicket.title}` : 'Ticket Details'}
        subtitle={`Category: ${selectedTicket?.category} • Created by ${selectedTicket?.creator?.name || 'System'}`}
        width="xl"
      >
        {selectedTicket && (
          <div className="space-y-6 text-xs">
            {/* Status & Priority Controls */}
            <div className="flex items-center justify-between gap-3 p-3 bg-zinc-850/60 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-2">
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleUpdateTicket({ status: e.target.value as any })}
                  className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 font-medium"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="WAITING">Waiting</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>

                <select
                  value={selectedTicket.priority}
                  onChange={(e) => handleUpdateTicket({ priority: e.target.value as any })}
                  className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 font-medium"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Assignee:</span>
                <select
                  value={selectedTicket.assignedUserId || ''}
                  onChange={(e) => handleUpdateTicket({ assignedUserId: e.target.value || null })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 font-medium"
                >
                  <option value="">Unassigned</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Ticket Description
              </label>
              <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-850 text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {selectedTicket.description}
              </div>
            </div>

            {/* Collaborators / Shared With */}
            <div className="space-y-2 pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" /> Relevant People & Collaborators ({selectedTicket.collaborators?.length || 0})
                </label>
              </div>

              {selectedTicket.collaborators && selectedTicket.collaborators.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTicket.collaborators.map((c, i) => (
                    <div
                      key={c.user?.id || i}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-[11px] text-zinc-300"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span className="font-medium text-zinc-200">{c.user?.name || 'User'}</span>
                      <span className="text-[10px] text-zinc-500">({c.user?.role})</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-[11px] italic">Only assigned user and creator have direct relevance.</p>
              )}
            </div>

            {/* Comments Stream */}
            <div className="space-y-3 pt-3 border-t border-zinc-800">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5" /> Comments & Activity
              </label>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {selectedTicket.comments && selectedTicket.comments.length > 0 ? (
                  selectedTicket.comments.map((comment) => (
                    <div key={comment.id} className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-850 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-zinc-200">{comment.author?.name}</span>
                        <span className="text-zinc-500 font-mono text-[10px]">
                          {format(new Date(comment.createdAt), 'dd MMM HH:mm')}
                        </span>
                      </div>
                      <p className="text-zinc-300 leading-snug">{comment.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-500 text-[11px] italic">No comments on this ticket yet.</p>
                )}
              </div>

              {/* Post Comment Form */}
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Post comment or troubleshooting update..."
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmittingComment}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
