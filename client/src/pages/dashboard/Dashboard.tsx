import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { api } from '../../services/api.js';
import { Task, Meeting, ActivityLog } from '../../types/index.js';
import { PriorityBadge, StatusBadge, Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Skeleton, CardSkeleton } from '../../components/common/Skeleton.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  AlertCircle,
  Building2,
  Plus,
  ArrowRight,
  TrendingUp,
  Target,
  Ticket,
  ChevronRight,
  User,
  Sparkles,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface DashboardProps {
  onNavigate: (path: string) => void;
  onOpenQuickAction: (type?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onOpenQuickAction }) => {
  const { user, isAdmin } = useAuth();
  const { showToast } = useNotification();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTaskTab, setActiveTaskTab] = useState<'today' | 'overdue' | 'upcoming' | 'completed'>('today');

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      const res = await api.dashboard.get();
      setData(res);
    } catch (err: any) {
      showToast('Failed to load operations dashboard', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleToggleTaskStatus = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    try {
      await api.tasks.update(task.id, { status: newStatus });
      showToast(newStatus === 'COMPLETED' ? 'Task completed' : 'Task reopened', 'success');
      fetchDashboard();
    } catch (err) {
      showToast('Failed to update task status', 'error');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const isSales = user?.role === 'SALES';

  const filterSalesTask = (t: Task) => {
    if (!isSales) return true;
    if (t.relatedClientId || t.client) return false;
    if (t.automatedType === 'PAYMENT_REMINDER' || t.automatedType === 'EXPENSE_REMINDER') return false;
    const text = ((t.title || '') + ' ' + (t.description || '')).toLowerCase();
    if (text.includes('payment') || text.includes('invoice') || text.includes('income due') || text.includes('expense') || text.includes('retainer')) return false;
    return true;
  };

  const priorityItems = (data?.priorityItems || []).filter((item: any) => {
    if (!isSales) return true;
    if (item.type === 'PAYMENT') return false;
    const text = ((item.title || '') + ' ' + (item.subtitle || '')).toLowerCase();
    if (text.includes('payment') || text.includes('invoice') || text.includes('income due') || text.includes('expense') || text.includes('retainer') || text.includes('client:')) return false;
    return true;
  });

  const rawMyTasks = data?.myTasks || { today: [], overdue: [], upcoming: [], completed: [] };
  const myTasks = {
    today: (rawMyTasks.today || []).filter(filterSalesTask),
    overdue: (rawMyTasks.overdue || []).filter(filterSalesTask),
    upcoming: (rawMyTasks.upcoming || []).filter(filterSalesTask),
    completed: (rawMyTasks.completed || []).filter(filterSalesTask),
    totalOpenCount: 0,
  };
  myTasks.totalOpenCount = myTasks.today.length + myTasks.overdue.length + myTasks.upcoming.length;

  const teamTasks = (data?.teamTasks || []).filter(filterSalesTask);
  const upcomingMeetings = (data?.upcomingMeetings || []).filter((m: Meeting) => !isSales || (!m.relatedClientId && !m.client));
  const recentActivity = (data?.recentActivity || []).filter((act: ActivityLog) => {
    if (!isSales) return true;
    if (act.entityType === 'PAYMENT' || act.entityType === 'EXPENSE' || act.entityType === 'CLIENT') return false;
    return true;
  });
  const adminStats = data?.adminStats;

  const currentTasksList: Task[] = (myTasks as any)[activeTaskTab] || [];

  return (
    <div className="space-y-6">
      {/* Top Personalized Greeting Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-900">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-tight">
            {getGreeting()}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">
            {format(new Date(), 'EEEE, dd MMMM yyyy')} • Octagram Hub
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenQuickAction('meeting')}
            icon={<Calendar className="w-3.5 h-3.5" />}
          >
            Meeting
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onOpenQuickAction('task')}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Create Task
          </Button>
        </div>
      </div>

      {/* Admin KPI Overview Cards (Admin Only) */}
      {isAdmin && adminStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div
            onClick={() => onNavigate('/clients')}
            className="p-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium tracking-wide">ACTIVE CLIENTS</span>
              <Building2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-100">{adminStats.totalActiveClients}</div>
            <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
              <span>View clients</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>

          <div
            onClick={() => onNavigate('/crm/leads')}
            className="p-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium tracking-wide">ACTIVE PIPELINE LEADS</span>
              <Target className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-100">{adminStats.newLeadsCount}</div>
            <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
              <span>View pipeline</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>

          <div
            onClick={() => onNavigate('/tasks')}
            className="p-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium tracking-wide">OPEN TASKS</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-100">{adminStats.openTasksCount}</div>
            <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
              <span>Track progress</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>

          <div
            onClick={() => onNavigate('/tickets')}
            className="p-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium tracking-wide">OPEN TICKETS</span>
              <Ticket className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-100">{adminStats.openTicketsCount}</div>
            <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
              <span>Review support</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>
        </div>
      )}

      {/* PRIORITY URGENT SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-zinc-400">
              Priority & Action Needed
            </span>
            {priorityItems.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">
            {priorityItems.length} urgent item{priorityItems.length === 1 ? '' : 's'}
          </span>
        </div>

        {priorityItems.length === 0 ? (
          <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-850 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs text-zinc-400">
              No urgent blockers or overdue items. Everything is on schedule!
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {priorityItems.map((item: any) => {
              const isOverdue = item.urgency === 'OVERDUE';
              const isDueToday = item.urgency === 'DUE_TODAY';

              return (
                <div
                  key={item.id}
                  onClick={() => onNavigate(item.url)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isOverdue
                      ? 'bg-rose-950/20 border-rose-900/50 hover:bg-rose-950/30 hover:border-rose-800'
                      : isDueToday
                      ? 'bg-amber-950/20 border-amber-900/50 hover:bg-amber-950/30 hover:border-amber-800'
                      : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-850'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-rose-500' : 'bg-amber-500'}`} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                          {item.urgency.replace('_', ' ')}
                        </span>
                      </div>
                      <PriorityBadge priority={item.priorityBadge} size="xs" />
                    </div>

                    <h4 className="text-xs font-semibold text-zinc-100 leading-snug line-clamp-2">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 truncate">{item.subtitle}</p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-2 border-t border-zinc-850/60">
                    <span>
                      {item.dueDate ? `Due: ${format(new Date(item.dueDate), 'dd MMM')}` : 'Immediate'}
                    </span>
                    <span className="text-zinc-300 font-medium flex items-center gap-1">
                      Action <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Grid: My Tasks & Team Tasks | Upcoming & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: My Tasks & Shared Team Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* MY TASKS PANEL */}
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-850">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  My Tasks
                </h3>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-400 font-mono">
                  {myTasks.totalOpenCount} open
                </span>
              </div>

              {/* Task Tabs */}
              <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-xs">
                {(['today', 'overdue', 'upcoming', 'completed'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTaskTab(tab)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors capitalize cursor-pointer ${
                      activeTaskTab === tab
                        ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tab} ({myTasks[tab]?.length || 0})
                  </button>
                ))}
              </div>
            </div>

            {/* Tasks List */}
            {currentTasksList.length === 0 ? (
              <EmptyState
                title={`No ${activeTaskTab} tasks`}
                description={
                  activeTaskTab === 'today'
                    ? "You have completed all tasks scheduled for today. You're all caught up!"
                    : `No tasks found in ${activeTaskTab} view.`
                }
                actionLabel="Create Task"
                onAction={() => onOpenQuickAction('task')}
              />
            ) : (
              <div className="space-y-1.5">
                {currentTasksList.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onNavigate(`/tasks?taskId=${task.id}`)}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-800/80 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={(e) => handleToggleTaskStatus(task, e)}
                        className="text-zinc-500 hover:text-emerald-400 p-0.5 rounded transition-colors shrink-0"
                      >
                        {task.status === 'COMPLETED' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <p
                          className={`text-xs font-medium text-zinc-200 truncate ${
                            task.status === 'COMPLETED' ? 'line-through text-zinc-500' : ''
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                          {task.client && (
                            <span className="text-zinc-300">🏢 {task.client.name}</span>
                          )}
                          {task.lead && (
                            <span className="text-zinc-300">🎯 {task.lead.businessName}</span>
                          )}
                          {task.deadline && (
                            <span className="font-mono text-[10px]">
                              Due: {format(new Date(task.deadline), 'dd MMM')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <PriorityBadge priority={task.priority} size="xs" />
                      <StatusBadge status={task.status} size="xs" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SHARED TEAM TASKS PANEL */}
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Shared Team Tasks
                </h3>
                <span className="text-[10px] text-zinc-500">Live operational sync</span>
              </div>
              <button
                onClick={() => onNavigate('/tasks?view=team')}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-zinc-850/60">
              {teamTasks.map((t: Task) => (
                <div
                  key={t.id}
                  onClick={() => onNavigate(`/tasks?taskId=${t.id}`)}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-zinc-850/30 px-2 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-300 shrink-0">
                      {t.assignee?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-200 truncate">{t.title}</p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        Assigned to {t.assignee?.name || 'Unassigned'} {t.client ? `• ${t.client.name}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {t.deadline && (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {format(new Date(t.deadline), 'dd MMM')}
                      </span>
                    )}
                    <PriorityBadge priority={t.priority} size="xs" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Upcoming Schedule & Recent Activity Timeline */}
        <div className="space-y-6">
          {/* UPCOMING MEETINGS & REMINDERS */}
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Upcoming Meetings
              </h3>
              <button
                onClick={() => onNavigate('/calendar')}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
              >
                Calendar <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {upcomingMeetings.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">
                No meetings scheduled.
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingMeetings.map((m: Meeting) => (
                  <div
                    key={m.id}
                    onClick={() => onNavigate(`/calendar?meetingId=${m.id}`)}
                    className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-850 transition-colors cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-900/50">
                        {format(new Date(m.date), 'dd MMM')} • {m.startTime}
                      </span>
                      {m.client && (
                        <span className="text-[10px] text-zinc-400 truncate max-w-[100px]">
                          {m.client.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-zinc-100 leading-snug">{m.title}</p>
                    {m.locationOrLink && (
                      <p className="text-[10px] text-zinc-400 truncate">{m.locationOrLink}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RECENT ACTIVITY TIMELINE */}
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Recent Operations Feed
              </h3>
              {isAdmin && (
                <button
                  onClick={() => onNavigate('/admin/audit')}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Audit Log
                </button>
              )}
            </div>

            <div className="space-y-3">
              {recentActivity.map((act: ActivityLog) => {
                let parsedDetails: any = {};
                try {
                  parsedDetails = JSON.parse(act.details);
                } catch {
                  parsedDetails = { raw: act.details };
                }

                return (
                  <div key={act.id} className="flex items-start gap-2.5 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-300 leading-snug">
                        <strong className="text-zinc-100">{act.user?.name || 'System'}</strong>{' '}
                        {act.action === 'CREATE' ? 'created' : act.action === 'PAYMENT_RECORDED' ? 'recorded payment for' : 'updated'}{' '}
                        <span className="text-zinc-200 font-mono text-[11px]">
                          {act.entityType.toLowerCase()}
                        </span>
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
