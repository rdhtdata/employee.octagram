import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { api } from '../../services/api.js';
import { Task, User } from '../../types/index.js';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Drawer } from '../../components/common/Drawer.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { TableSkeleton } from '../../components/common/Skeleton.js';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.js';
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Search,
  Filter,
  Calendar as CalendarIcon,
  MessageSquare,
  Building2,
  Send,
  Trash2,
  User as UserIcon,
  CheckSquare,
} from 'lucide-react';
import { format } from 'date-fns';

export const TasksPage: React.FC<{ initialTaskId?: string }> = ({ initialTaskId }) => {
  const { user, isAdmin } = useAuth();
  const { showToast } = useNotification();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [activeView, setActiveView] = useState<'my' | 'team' | 'today' | 'overdue' | 'upcoming' | 'all'>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [assignedFilter, setAssignedFilter] = useState('');

  // Selected Task Drawer
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      if (activeView !== 'all') params.view = activeView;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (priorityFilter !== 'ALL') params.priority = priorityFilter;
      if (assignedFilter) params.assignedUserId = assignedFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.tasks.list(params);
      setTasks(res.tasks || []);

      // If initialTaskId provided, select it
      if (initialTaskId && !selectedTask) {
        const found = res.tasks?.find((t: Task) => t.id === initialTaskId);
        if (found) setSelectedTask(found);
        else {
          api.tasks.get(initialTaskId).then(tRes => setSelectedTask(tRes.task)).catch(() => {});
        }
      }
    } catch (err) {
      showToast('Failed to load tasks', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [activeView, statusFilter, priorityFilter, assignedFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTasks();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    api.users.list().then(res => setUsersList(res.users || [])).catch(() => {});
    api.clients.list().then(res => setClientsList(res.clients || [])).catch(() => {});
  }, []);

  const handleToggleComplete = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    try {
      await api.tasks.update(task.id, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus as any } : t));
      if (selectedTask?.id === task.id) {
        setSelectedTask(prev => prev ? { ...prev, status: newStatus as any } : null);
      }
      showToast(newStatus === 'COMPLETED' ? 'Task marked as completed' : 'Task reopened', 'success');
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleOpenTask = async (task: Task) => {
    try {
      const res = await api.tasks.get(task.id);
      setSelectedTask(res.task);
    } catch (err) {
      setSelectedTask(task);
    }
  };

  const handleUpdateTaskField = async (fields: Partial<Task>) => {
    if (!selectedTask) return;
    try {
      const res = await api.tasks.update(selectedTask.id, fields);
      setSelectedTask(res.task);
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, ...fields } : t));
      showToast('Task updated', 'success');
    } catch (err) {
      showToast('Failed to update task', 'error');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || !selectedTask) return;
    setIsSubmittingComment(true);
    try {
      const res = await api.tasks.addComment(selectedTask.id, commentContent.trim());
      setSelectedTask(prev => prev ? {
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

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    try {
      await api.tasks.delete(selectedTask.id);
      setTasks(prev => prev.filter(t => t.id !== selectedTask.id));
      setSelectedTask(null);
      setIsDeleteDialogOpen(false);
      showToast('Task deleted successfully', 'success');
    } catch (err) {
      showToast('Failed to delete task', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-900">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-zinc-400" /> Task Management
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Central task tracking across team, client projects, and operations.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            const event = new CustomEvent('open-quick-action', { detail: { type: 'task' } });
            window.dispatchEvent(event);
          }}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          New Task
        </Button>
      </div>

      {/* Views Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-zinc-850">
        {[
          { id: 'my', label: 'My Tasks' },
          { id: 'team', label: 'Team Tasks' },
          { id: 'today', label: 'Today' },
          { id: 'overdue', label: 'Overdue' },
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'all', label: 'All Tasks' },
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id as any)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeView === view.id
                ? 'bg-zinc-800 text-zinc-100 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-900/40 p-3 rounded-xl border border-zinc-850">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search task title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="BLOCKED">Blocked</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none"
        >
          <option value="ALL">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        {/* Assignee Filter */}
        <select
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
          className="px-3 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none"
        >
          <option value="">All Assignees</option>
          {usersList.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Task List Table / Rows */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="w-5 h-5" />}
          title="No tasks found"
          description="No tasks match the active filters. Create a new task or adjust your filters."
          actionLabel="Create Task"
          onAction={() => {
            const event = new CustomEvent('open-quick-action', { detail: { type: 'task' } });
            window.dispatchEvent(event);
          }}
        />
      ) : (
        <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-hidden divide-y divide-zinc-850">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => handleOpenTask(task)}
              className="p-3.5 hover:bg-zinc-850/40 transition-colors flex items-center justify-between gap-4 cursor-pointer group"
            >
              {/* Left Checkbox & Title */}
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <button
                  onClick={(e) => handleToggleComplete(task, e)}
                  className="text-zinc-500 hover:text-emerald-400 p-0.5 rounded transition-colors shrink-0 cursor-pointer"
                >
                  {task.status === 'COMPLETED' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium text-zinc-200 truncate ${
                        task.status === 'COMPLETED' ? 'line-through text-zinc-500' : ''
                      }`}
                    >
                      {task.title}
                    </span>
                    {task.automatedType && (
                      <span className="text-[9px] font-mono px-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                        {task.automatedType === 'PAYMENT_REMINDER' ? 'Payment Reminder' : 'Automated'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-0.5">
                    {task.client && (
                      <span className="flex items-center gap-1 text-zinc-300">
                        <Building2 className="w-3 h-3 text-zinc-500" />
                        {task.client.name}
                      </span>
                    )}
                    {task.assignee && (
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3 text-zinc-500" />
                        {task.assignee.name}
                      </span>
                    )}
                    {task._count?.comments ? (
                      <span className="flex items-center gap-1 text-zinc-400">
                        <MessageSquare className="w-3 h-3" />
                        {task._count.comments}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Right Badges & Deadline */}
              <div className="flex items-center gap-3 shrink-0">
                {task.deadline && (
                  <span className="text-[11px] font-mono text-zinc-400">
                    {format(new Date(task.deadline), 'dd MMM yyyy')}
                  </span>
                )}
                <PriorityBadge priority={task.priority} size="xs" />
                <StatusBadge status={task.status} size="xs" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TASK DETAIL SLIDE-OVER DRAWER */}
      <Drawer
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title || 'Task Details'}
        subtitle={selectedTask?.client ? `Client: ${selectedTask.client.name}` : 'Internal Operations'}
        width="xl"
      >
        {selectedTask && (
          <div className="space-y-6 text-xs">
            {/* Action Bar */}
            <div className="flex items-center justify-between gap-3 p-3 bg-zinc-850/60 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-2">
                <select
                  value={selectedTask.status}
                  onChange={(e) => handleUpdateTaskField({ status: e.target.value as any })}
                  className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 font-medium"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                <select
                  value={selectedTask.priority}
                  onChange={(e) => handleUpdateTaskField({ priority: e.target.value as any })}
                  className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 font-medium"
                >
                  <option value="LOW">Low Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="HIGH">High Priority</option>
                  <option value="CRITICAL">Critical Priority</option>
                </select>
              </div>

              <button
                onClick={() => setIsDeleteDialogOpen(true)}
                className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Description
              </label>
              <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-850 text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {selectedTask.description || 'No additional description provided.'}
              </div>
            </div>

            {/* Assignment & Meta Grid */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-950/40 border border-zinc-850">
              <div>
                <span className="text-zinc-500 block mb-1">Assignee</span>
                <select
                  value={selectedTask.assignedUserId || ''}
                  onChange={(e) => handleUpdateTaskField({ assignedUserId: e.target.value || null })}
                  className="w-full px-2 py-1 bg-zinc-850 border border-zinc-750 rounded text-xs text-zinc-100"
                >
                  <option value="">Unassigned</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-zinc-500 block mb-1">Deadline</span>
                <input
                  type="date"
                  value={selectedTask.deadline ? selectedTask.deadline.split('T')[0] : ''}
                  onChange={(e) => handleUpdateTaskField({ deadline: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="w-full px-2 py-1 bg-zinc-850 border border-zinc-750 rounded text-xs text-zinc-100"
                />
              </div>

              <div>
                <span className="text-zinc-500 block mb-1">Related Client</span>
                <p className="text-zinc-200 font-medium">{selectedTask.client?.name || 'None'}</p>
              </div>

              <div>
                <span className="text-zinc-500 block mb-1">Created By</span>
                <p className="text-zinc-200">{selectedTask.creator?.name || 'System'}</p>
              </div>
            </div>

            {/* Collaborators */}
            {selectedTask.collaborators && selectedTask.collaborators.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Collaborators
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedTask.collaborators.map((c, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-zinc-850 rounded border border-zinc-750 text-zinc-300 text-[11px]"
                    >
                      {c.user.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Thread */}
            <div className="space-y-3 pt-4 border-t border-zinc-800">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5" /> Comments & Collaboration
              </label>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {selectedTask.comments && selectedTask.comments.length > 0 ? (
                  selectedTask.comments.map((comment) => (
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
                  <p className="text-zinc-500 text-[11px] italic">No comments yet. Mention colleagues with @name.</p>
                )}
              </div>

              {/* Add Comment Form */}
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a comment... (use @name to mention)"
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message={`Are you sure you want to permanently delete "${selectedTask?.title}"? This action cannot be undone.`}
      />
    </div>
  );
};
