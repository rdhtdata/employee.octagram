import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { api } from '../../services/api.js';
import { CalendarEvent } from '../../types/index.js';
import { Badge, PriorityBadge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Building2,
  Target,
  CheckSquare,
  Wallet,
  User,
  ExternalLink,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';

export const CalendarPage: React.FC<{ initialMeetingId?: string; onNavigate: (path: string) => void }> = ({
  initialMeetingId,
  onNavigate,
}) => {
  const { user, isAdmin } = useAuth();
  const { showToast } = useNotification();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEventType, setSelectedEventType] = useState('ALL');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const start = startOfMonth(subMonths(currentDate, 1)).toISOString();
      const end = endOfMonth(addMonths(currentDate, 1)).toISOString();

      const params: Record<string, string> = { start, end };
      if (selectedEventType !== 'ALL') params.eventType = selectedEventType;

      const res = await api.calendar.getEvents(params);
      const isSales = user?.role === 'SALES';
      let fetched = res.events || [];
      if (isSales) {
        fetched = fetched.filter((e: CalendarEvent) => {
          if (e.type === 'PAYMENT_DUE' || e.type === 'EXPENSE_DUE') return false;
          if (e.relatedEntity && e.relatedEntity.type === 'CLIENT') return false;
          const text = (e.title || '').toLowerCase();
          if (text.includes('payment') || text.includes('income due') || text.includes('expense') || text.includes('invoice') || text.includes('retainer')) return false;
          return true;
        });
      }
      setEvents(fetched);

      if (initialMeetingId && !selectedEvent) {
        const found = fetched.find((e: any) => e.id.includes(initialMeetingId));
        if (found) setSelectedEvent(found);
      }
    } catch (err) {
      showToast('Failed to load calendar events', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate, selectedEventType]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'MEETING':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/80';
      case 'TASK_DEADLINE':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/80';
      case 'LEAD_FOLLOWUP':
        return 'bg-sky-950/80 text-sky-300 border-sky-800/80';
      case 'PAYMENT_DUE':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80';
      case 'EXPENSE_DUE':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/80';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-900">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-purple-400" /> Operations Calendar
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Unified schedule of client meetings, task deadlines, lead calls, and milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-xs">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                viewMode === 'month' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                viewMode === 'agenda' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400'
              }`}
            >
              Agenda
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              const event = new CustomEvent('open-quick-action', { detail: { type: 'meeting' } });
              window.dispatchEvent(event);
            }}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Schedule Event
          </Button>
        </div>
      </div>

      {/* Month Navigation & Event Type Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/40 p-3 rounded-xl border border-zinc-850">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-zinc-100 font-mono tracking-wide">
            {format(currentDate, 'MMMM yyyy')}
          </h2>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-1 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[11px] font-medium"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-1 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter by Type */}
        <select
          value={selectedEventType}
          onChange={(e) => setSelectedEventType(e.target.value)}
          className="px-3 py-1.5 bg-zinc-850 border border-zinc-750 rounded-lg text-xs text-zinc-100 focus:outline-none"
        >
          <option value="ALL">All Event Types</option>
          <option value="MEETING">Meetings Only</option>
          <option value="TASK_DEADLINE">Task Deadlines</option>
          <option value="LEAD_FOLLOWUP">Lead Follow-ups</option>
          {isAdmin && <option value="PAYMENT_DUE">Client Invoices Due</option>}
          {isAdmin && <option value="EXPENSE_DUE">Expenses & Renewals Due</option>}
        </select>
      </div>

      {/* CALENDAR VIEWS */}
      {viewMode === 'month' ? (
        /* MONTH GRID */
        <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-900/80 text-[10px] sm:text-[11px] font-semibold text-zinc-400 text-center py-2 uppercase tracking-wider">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d}>
                <span className="hidden sm:inline">{d}</span>
                <span className="sm:hidden">{d.slice(0, 1)}</span>
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-zinc-850 text-xs">
            {calendarDays.map((day, i) => {
              const dayEvents = events.filter((e) => isSameDay(new Date(e.start), day));
              const isCurrMonth = isSameMonth(day, currentDate);
              const isTodayDate = isToday(day);

              return (
                <div
                  key={i}
                  className={`min-h-[72px] sm:min-h-[110px] p-1 sm:p-2 flex flex-col justify-between transition-colors ${
                    isCurrMonth ? 'bg-zinc-950/40 hover:bg-zinc-900/40' : 'bg-zinc-950/10 opacity-35'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] sm:text-[11px] font-mono font-medium rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center ${
                        isTodayDate ? 'bg-zinc-100 text-zinc-950 font-bold' : 'text-zinc-400'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[9px] sm:text-[10px] text-zinc-500 font-mono">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Day Events Stack */}
                  <div className="space-y-0.5 sm:space-y-1 mt-1 flex-1 overflow-y-auto max-h-16 sm:max-h-24">
                    {dayEvents.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
                        onClick={() => setSelectedEvent(e)}
                        className={`px-1 sm:px-1.5 py-0.5 rounded border text-[9px] sm:text-[10px] truncate cursor-pointer font-medium transition-opacity hover:opacity-80 ${getEventBadge(
                          e.type
                        )}`}
                      >
                        <span className="hidden sm:inline">{e.title}</span>
                        <span className="sm:hidden">{e.title.slice(0, 10)}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[9px] sm:text-[10px] text-zinc-500 font-mono block pl-0.5 sm:pl-1">
                        +{dayEvents.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* AGENDA LIST VIEW */
        <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-hidden divide-y divide-zinc-850">
          {events.length === 0 ? (
            <EmptyState
              title="No events found"
              description="Schedule a meeting or add follow-ups to populate your agenda."
              actionLabel="Schedule Event"
              onAction={() => {
                const event = new CustomEvent('open-quick-action', { detail: { type: 'meeting' } });
                window.dispatchEvent(event);
              }}
            />
          ) : (
            events.map((e) => (
              <div
                key={e.id}
                onClick={() => setSelectedEvent(e)}
                className="p-3.5 hover:bg-zinc-850/40 transition-colors flex items-center justify-between gap-4 cursor-pointer text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-medium ${getEventBadge(e.type)}`}>
                    {e.type.replace('_', ' ')}
                  </span>
                  <div>
                    <p className="font-semibold text-zinc-100 truncate">{e.title}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {e.relatedEntity?.name ? `Related: ${e.relatedEntity.name}` : ''}{' '}
                      {e.assignedUser?.name ? `• Lead/Owner: ${e.assignedUser.name}` : ''}
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono text-[11px] text-zinc-400 shrink-0">
                  {format(new Date(e.start), 'dd MMM yyyy')}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Event Details Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title || 'Event Details'}
        maxWidth="sm"
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs">
            <div className="space-y-2 p-3 bg-zinc-950/60 rounded-xl border border-zinc-850">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Event Type</span>
                <span className={`px-2 py-0.5 rounded border text-[10px] font-mono ${getEventBadge(selectedEvent.type)}`}>
                  {selectedEvent.type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Date</span>
                <span className="font-mono text-zinc-200">
                  {format(new Date(selectedEvent.start), 'EEEE, dd MMMM yyyy')}
                </span>
              </div>
              {selectedEvent.relatedEntity && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Entity</span>
                  <span className="font-medium text-zinc-100">{selectedEvent.relatedEntity.name}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <Button variant="primary" size="sm" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
