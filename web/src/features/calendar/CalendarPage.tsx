import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileSignature,
  Filter,
  Home,
  Loader2,
  Megaphone,
  PauseCircle,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TimerReset,
} from 'lucide-react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';
import { toDisplayErrorMessage } from '../../lib/errorMessages';
import { PageLayout } from '../../components/layout/PageLayout';
import { NewTaskModal } from '../tasks/NewTaskModal';

type EventType = 'DEAL_EVENT' | 'TASK' | 'LISTING_EVENT' | 'MARKETING_BLAST' | 'GOOGLE_CALENDAR';
type EventFilter = 'ALL' | EventType;
type ViewMode = 'month' | 'week';
type TaskCategory = 'GENERAL' | 'CONTRACT' | 'MARKETING' | 'CALL' | 'NOTE' | 'POPBY' | 'EVENT';

interface UnifiedEvent {
  id: string;
  type: EventType;
  title: string;
  description?: string;
  date: string;
  status?: string;
  category?: string;
  priority?: string;
  dealId?: string;
  dealTitle?: string;
  clientId?: string;
  clientName?: string;
  listingId?: string;
  listingAddress?: string;
  marketingBlastId?: string;
  color?: string;
  icon?: string;
}

interface CalendarStatus {
  connected: boolean;
  syncEnabled: boolean;
  lastSyncAt: string | null;
}

interface ClientSearchItem {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface EventTypeMeta {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  dotClass: string;
  chipClass: string;
  buttonClass: string;
}

const eventTypeMeta: Record<EventType, EventTypeMeta> = {
  DEAL_EVENT: {
    label: 'Deal dates',
    shortLabel: 'Deal',
    icon: FileSignature,
    dotClass: 'bg-violet-500',
    chipClass: 'ae-tone-violet',
    buttonClass: 'ae-tone-violet',
  },
  TASK: {
    label: 'Tasks',
    shortLabel: 'Task',
    icon: ClipboardCheck,
    dotClass: 'bg-blue-500',
    chipClass: 'ae-tone-blue',
    buttonClass: 'ae-tone-blue',
  },
  LISTING_EVENT: {
    label: 'Listings',
    shortLabel: 'Listing',
    icon: Home,
    dotClass: 'bg-emerald-500',
    chipClass: 'ae-tone-emerald',
    buttonClass: 'ae-tone-emerald',
  },
  MARKETING_BLAST: {
    label: 'Marketing',
    shortLabel: 'Blast',
    icon: Megaphone,
    dotClass: 'bg-pink-500',
    chipClass: 'ae-tone-rose',
    buttonClass: 'ae-tone-rose',
  },
  GOOGLE_CALENDAR: {
    label: 'Google Calendar',
    shortLabel: 'Google',
    icon: CalendarCheck2,
    dotClass: 'bg-cyan-500',
    chipClass: 'ae-tone-blue',
    buttonClass: 'ae-tone-blue',
  },
};

const filterOptions: Array<{ id: EventFilter; label: string; icon: LucideIcon }> = [
  { id: 'ALL', label: 'All', icon: CalendarDays },
  { id: 'DEAL_EVENT', label: 'Deals', icon: FileSignature },
  { id: 'TASK', label: 'Tasks', icon: ClipboardCheck },
  { id: 'LISTING_EVENT', label: 'Listings', icon: Home },
  { id: 'MARKETING_BLAST', label: 'Marketing', icon: Megaphone },
  { id: 'GOOGLE_CALENDAR', label: 'Google', icon: CalendarCheck2 },
];

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const quickDurations = [15, 30, 45, 60];
const timeOptions = Array.from({ length: 61 }).map((_, index) => {
  const total = 6 * 60 + index * 15;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

function getMonthStart(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() - firstDay.getDay());
}

function getMonthEnd(date: Date) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + (6 - lastDay.getDay()));
}

function getWeekStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
}

function getWeekEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + (6 - date.getDay()));
}

function formatDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTimeLocal(date: Date, hours?: number, minutes = 0) {
  const next = new Date(date);
  if (typeof hours === 'number') {
    next.setHours(hours, minutes, 0, 0);
  } else {
    next.setSeconds(0, 0);
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

function parseTime(value: string) {
  const [hours, minutes] = value.split(':');
  return { hours: Number(hours), minutes: Number(minutes) };
}

function formatTimeLabel(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function parseEventDate(event: UnifiedEvent) {
  const parsed = new Date(event.date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function cleanEventTitle(title: string) {
  return title.replace(/^[^A-Za-z0-9]+/, '').trim() || title.trim() || 'Calendar item';
}

function getEventMeta(event: Pick<UnifiedEvent, 'type'>) {
  const type = String(event.type || '') as EventType;
  return eventTypeMeta[type] || eventTypeMeta.TASK;
}

function normalizeCalendarEvent(raw: any, index: number): UnifiedEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || '') as EventType;
  if (!eventTypeMeta[type]) return null;
  const parsedDate = new Date(raw.date);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return {
    id: String(raw.id || `calendar-${type}-${parsedDate.getTime()}-${index}`),
    type,
    title: String(raw.title || 'Calendar item'),
    description: raw.description ? String(raw.description) : undefined,
    date: parsedDate.toISOString(),
    status: raw.status ? String(raw.status) : undefined,
    category: raw.category ? String(raw.category) : undefined,
    priority: raw.priority ? String(raw.priority) : undefined,
    dealId: raw.dealId ? String(raw.dealId) : undefined,
    dealTitle: raw.dealTitle ? String(raw.dealTitle) : undefined,
    clientId: raw.clientId ? String(raw.clientId) : undefined,
    clientName: raw.clientName ? String(raw.clientName) : undefined,
    listingId: raw.listingId ? String(raw.listingId) : undefined,
    listingAddress: raw.listingAddress ? String(raw.listingAddress) : undefined,
    marketingBlastId: raw.marketingBlastId ? String(raw.marketingBlastId) : undefined,
    color: raw.color ? String(raw.color) : undefined,
    icon: raw.icon ? String(raw.icon) : undefined,
  };
}

function readableStatus(value?: string) {
  return value ? value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase()) : '';
}

function getTaskRecordId(eventId: string) {
  return eventId.startsWith('task-') ? eventId.slice(5) : eventId;
}

function isSameCalendarDate(left: Date, right: Date) {
  return left.toDateString() === right.toDateString();
}

function getEventChipClass(event: UnifiedEvent) {
  if (event.type !== 'TASK') return getEventMeta(event).chipClass;
  if (event.category === 'CONTRACT') return 'ae-tone-amber';
  if (event.category === 'CALL') return 'ae-tone-blue';
  if (event.category === 'NOTE') return 'ae-tone-violet';
  if (event.category === 'POPBY') return 'ae-tone-gold';
  if (event.category === 'EVENT') return 'ae-tone-gold';
  return eventTypeMeta.TASK.chipClass;
}

function getDateRangeLabel(days: Date[], viewMode: ViewMode, currentDate: Date) {
  if (viewMode === 'month') {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  const start = days[0];
  const end = days[6];
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function CalendarPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [activeFilter, setActiveFilter] = useState<EventFilter>('ALL');
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [taskDefaults, setTaskDefaults] = useState<{
    dueAt?: string;
    clientId?: string;
    category?: TaskCategory;
    title?: string;
  } | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [clients, setClients] = useState<ClientSearchItem[]>([]);
  const [clientQuery, setClientQuery] = useState('');
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeDuration, setTimeDuration] = useState(60);
  const [dragStartHour, setDragStartHour] = useState<number | null>(null);
  const [dragEndHour, setDragEndHour] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDay, setDragDay] = useState<Date | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = viewMode === 'month' ? getMonthStart(currentDate) : getWeekStart(currentDate);
    const count = viewMode === 'month' ? 42 : 7;
    return Array.from({ length: count }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [currentDate, viewMode]);

  const visibleEvents = useMemo(
    () => activeFilter === 'ALL' ? events : events.filter((event) => event.type === activeFilter),
    [activeFilter, events],
  );

  const getEventsForDate = (date: Date, sourceEvents = visibleEvents) => {
    const dateStr = formatDate(date);
    return sourceEvents
      .filter((event) => event.date.startsWith(dateStr))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const getEventsForHour = (day: Date, hour: number) => {
    const dayStr = formatDate(day);
    return visibleEvents
      .filter((event) => {
        if (!event.date.startsWith(dayStr)) return false;
        const parsed = parseEventDate(event);
        return parsed ? parsed.getHours() === hour : false;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const selectedDayEvents = selectedDate ? getEventsForDate(selectedDate) : [];
  const todayKey = formatDate(new Date());
  const todayEventsCount = events.filter((event) => event.date.startsWith(todayKey)).length;
  const taskEventsCount = events.filter((event) => event.type === 'TASK').length;
  const deadlineEventsCount = events.filter((event) => event.type === 'DEAL_EVENT' || event.type === 'LISTING_EVENT').length;
  const externalEventsCount = events.filter((event) => event.type === 'GOOGLE_CALENDAR').length;
  const highPriorityCount = events.filter((event) => event.priority === 'HIGH' || event.category === 'CONTRACT' || event.type === 'DEAL_EVENT').length;
  const selectedHighPriorityCount = selectedDayEvents.filter((event) => event.priority === 'HIGH' || event.category === 'CONTRACT' || event.type === 'DEAL_EVENT').length;
  const selectedDayIntensity = Math.min(100, selectedDayEvents.length * 17 + selectedHighPriorityCount * 18);
  const selectedDayLoadLabel = selectedDayEvents.length >= 6 ? 'Heavy day' : selectedDayEvents.length >= 3 ? 'Balanced day' : 'Open capacity';
  const rangeLabel = getDateRangeLabel(days, viewMode, currentDate);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return visibleEvents
      .filter((event) => {
        const date = parseEventDate(event);
        return date ? date >= now && date <= weekOut : false;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 6);
  }, [visibleEvents]);

  const nextPriorityEvent = upcomingEvents.find((event) => event.priority === 'HIGH' || event.category === 'CONTRACT' || event.type === 'DEAL_EVENT') || upcomingEvents[0] || null;
  const filteredClients = clientQuery
    ? clients.filter((client) => `${client.firstName} ${client.lastName} ${client.email || ''}`.toLowerCase().includes(clientQuery.toLowerCase()))
    : [];

  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (!dateParam) return;
    const parsed = new Date(`${dateParam}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return;
    setCurrentDate(parsed);
    setSelectedDate(parsed);
  }, [searchParams]);

  useEffect(() => {
    loadEvents();
  }, [currentDate, viewMode]);

  useEffect(() => {
    loadStatus();
    loadClients();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const start = viewMode === 'month' ? getMonthStart(currentDate) : getWeekStart(currentDate);
      const end = viewMode === 'month' ? getMonthEnd(currentDate) : getWeekEnd(currentDate);
      const res = await api.get(`/calendar/events?from=${formatDate(start)}&to=${formatDate(end)}`);
      const incomingEvents = Array.isArray(res.data?.events) ? res.data.events : [];
      setEvents(
        incomingEvents
          .map((event: any, index: number) => normalizeCalendarEvent(event, index))
          .filter((event: UnifiedEvent | null): event is UnifiedEvent => Boolean(event)),
      );
    } catch (error) {
      console.error('Failed to load events:', error);
      setLoadError(toDisplayErrorMessage(error, 'Calendar events could not be loaded.'));
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    try {
      const res = await api.get('/calendar/status');
      setCalendarStatus(res.data);
    } catch (error) {
      console.error('Failed to load calendar status:', error);
    }
  };

  const loadClients = async () => {
    try {
      const res = await api.get('/clients');
      setClients(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const prevPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
      return;
    }
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
  };

  const nextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
      return;
    }
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
  };

  const jumpToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const isToday = (date: Date) => isSameCalendarDate(date, new Date());
  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();

  const openEvent = (event: UnifiedEvent) => {
    if (event.type === 'DEAL_EVENT' && event.dealId) {
      navigate('/contracts', { state: { dealId: event.dealId } });
      return;
    }
    if (event.type === 'LISTING_EVENT') {
      navigate('/listings');
      return;
    }
    if (event.type === 'MARKETING_BLAST' && event.marketingBlastId) {
      navigate(`/marketing/blasts/${event.marketingBlastId}`);
      return;
    }
    if (event.type === 'TASK') {
      navigate('/tasks');
      return;
    }
    if (event.clientId) {
      navigate(`/clients/${event.clientId}`);
    }
  };

  const openTaskModal = (opts?: { date?: Date; category?: TaskCategory; clientId?: string; title?: string }) => {
    const dueAt = opts?.date ? formatDateTimeLocal(opts.date) : selectedDate ? formatDateTimeLocal(selectedDate) : undefined;
    setTaskDefaults({
      dueAt,
      clientId: opts?.clientId,
      category: opts?.category || 'GENERAL',
      title: opts?.title,
    });
    setShowNewTaskModal(true);
  };

  const getSuggestedHour = (day: Date) => {
    const now = new Date();
    const hour = isSameCalendarDate(now, day) ? now.getHours() : 9;
    return Math.min(20, Math.max(6, hour));
  };

  const createQuickBlock = (day: Date, hour: number, minutes: number) => {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + minutes * 60000);
    openTaskModal({ date: start, category: 'EVENT', title: `Time block ${formatTimeLabel(start)}-${formatTimeLabel(end)}` });
  };

  const createTimeBlock = () => {
    if (!selectedDate) return;
    const { hours, minutes } = parseTime(timeStart);
    const start = new Date(selectedDate);
    start.setHours(hours, minutes, 0, 0);
    const end = new Date(start.getTime() + timeDuration * 60000);
    openTaskModal({ date: start, category: 'EVENT', title: `Time block ${formatTimeLabel(start)}-${formatTimeLabel(end)}` });
  };

  const openCustomBlock = (day: Date, hour: number) => {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    openTaskModal({ date: start, category: 'EVENT', title: 'Custom time block' });
  };

  const getTimeEndLabel = () => {
    const { hours, minutes } = parseTime(timeStart);
    const total = hours * 60 + minutes + timeDuration;
    const end = new Date();
    end.setHours(Math.floor(total / 60), total % 60, 0, 0);
    return formatTimeLabel(end);
  };

  const handleStartDrag = (hour: number, day: Date) => {
    setIsDragging(true);
    setDragStartHour(hour);
    setDragEndHour(hour);
    setDragDay(day);
  };

  const handleDragEnter = (hour: number) => {
    if (!isDragging) return;
    setDragEndHour(hour);
  };

  const finishDrag = () => {
    if (!isDragging || dragStartHour === null || dragEndHour === null || !dragDay) {
      setIsDragging(false);
      return;
    }

    const startHour = Math.min(dragStartHour, dragEndHour);
    const endHour = Math.max(dragStartHour, dragEndHour) + 1;
    const start = new Date(dragDay);
    start.setHours(startHour, 0, 0, 0);
    openTaskModal({ date: start, category: 'EVENT', title: `Time block ${String(startHour).padStart(2, '0')}:00-${String(endHour).padStart(2, '0')}:00` });
    setIsDragging(false);
    setDragStartHour(null);
    setDragEndHour(null);
    setDragDay(null);
  };

  const completeTask = async (event: UnifiedEvent) => {
    const taskId = getTaskRecordId(event.id);
    setCompletingTaskId(taskId);
    try {
      await api.patch(`/tasks/${taskId}`, { status: 'COMPLETED' });
      await loadEvents();
    } catch (error) {
      console.error('Failed to complete task:', error);
    } finally {
      setCompletingTaskId(null);
    }
  };

  const filterCount = (filter: EventFilter) => filter === 'ALL' ? events.length : events.filter((event) => event.type === filter).length;

  return (
    <PageLayout
      title="Calendar"
      subtitle="Unified view of tasks, deadlines, listings, and marketing"
      maxWidth="full"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadEvents}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => openTaskModal({ date: selectedDate || new Date(), category: 'EVENT', title: 'New calendar event' })}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-gradient-to-r from-[#f2d894] to-[#9f7933] px-4 py-2 text-xs font-semibold text-[#171106] shadow-lg shadow-[#d6b56d]/25 transition hover:brightness-105 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New event
          </button>
        </div>
      }
    >
      <div className="calendar-page grid grid-cols-1 gap-4 pt-4 sm:pt-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4 lg:space-y-5">
          <div className="ae-theme-card rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-[#f2d894]/16 dark:bg-gradient-to-br dark:from-[#111827]/88 dark:via-[#0b1220]/86 dark:to-[#171106]/52 dark:shadow-[0_24px_70px_rgba(0,0,0,0.62)] sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="ae-tone-gold inline-flex items-center gap-2 rounded-full border border-[#d6b56d]/45 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] dark:border-[#f2d894]/25">
                  <Target className="h-3.5 w-3.5" aria-hidden="true" />
                  Schedule cockpit
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-950 sm:text-base dark:text-white">
                  {nextPriorityEvent ? `Next priority: ${cleanEventTitle(nextPriorityEvent.title)}` : 'No urgent calendar pressure'}
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {nextPriorityEvent
                    ? new Date(nextPriorityEvent.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : `${selectedDayLoadLabel} for the selected date.`}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
                <div className="ae-theme-inset flex items-center justify-between gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
                  <button
                    type="button"
                    onClick={jumpToday}
                    className="ae-tone-gold inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-[0_12px_28px_-18px_rgba(15,23,42,0.75)] transition hover:brightness-105"
                  >
                    <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={prevPeriod}
                    aria-label="Previous period"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-[#7a5a24] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-[#f2d894]"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <div className="min-w-[152px] text-center text-sm font-bold text-slate-950 sm:min-w-[210px] dark:text-white">
                    {rangeLabel}
                  </div>
                  <button
                    type="button"
                    onClick={nextPeriod}
                    aria-label="Next period"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-[#7a5a24] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-[#f2d894]"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="ae-theme-inset flex items-center justify-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
                  {(['month', 'week'] as ViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      className={cn(
                        'min-h-[34px] flex-1 rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-colors sm:flex-initial',
                        viewMode === mode
                          ? 'ae-tone-gold border shadow-[0_10px_24px_-14px_rgba(159,121,51,0.72)]'
                          : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <MetricCard icon={CalendarDays} label="Visible" value={visibleEvents.length} tone="gold" />
              <MetricCard icon={CircleDot} label="Today" value={todayEventsCount} tone="blue" />
              <MetricCard icon={ClipboardCheck} label="Tasks" value={taskEventsCount} tone="violet" />
              <MetricCard icon={FileSignature} label="Deal/listing dates" value={deadlineEventsCount} tone="amber" />
              <MetricCard icon={CalendarCheck2} label="Google sync" value={externalEventsCount} tone="emerald" />
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <Filter className="h-4 w-4 text-[#9f7933] dark:text-[#f2d894]" aria-hidden="true" />
                Filters
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
                {filterOptions.map((option) => (
                  <FilterButton
                    key={option.id}
                    icon={option.icon}
                    label={option.label}
                    count={filterCount(option.id)}
                    active={activeFilter === option.id}
                    onClick={() => setActiveFilter(option.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {loadError && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-300/80 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{loadError}</span>
            </div>
          )}

          <div className="calendar-shell relative flex min-h-[560px] flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.62)] backdrop-blur-xl dark:border-[#f2d894]/18 dark:bg-[#080d16] dark:shadow-[0_24px_70px_rgba(0,0,0,0.78)] lg:min-h-[700px]">
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/72 backdrop-blur-sm dark:bg-[#070b13]/68">
                <div className="ae-theme-card inline-flex items-center gap-2 rounded-full border border-[#d6b56d]/35 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_18px_44px_-26px_rgba(15,23,42,0.55)] dark:bg-[#0b1220] dark:text-slate-200">
                  <Loader2 className="h-4 w-4 animate-spin text-[#9f7933] dark:text-[#f2d894]" aria-hidden="true" />
                  Loading calendar
                </div>
              </div>
            )}

            {viewMode === 'month' ? (
              <div className="flex h-full flex-col">
                <div className="calendar-grid-head ae-theme-inset grid flex-shrink-0 grid-cols-7 border-b border-slate-200/80 bg-slate-50 dark:border-white/10 dark:bg-[#0b1220]/86">
                  {dayNames.map((day) => (
                    <div key={day} className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 sm:px-3 sm:py-3 sm:text-xs">
                      <span className="hidden sm:inline">{day}</span>
                      <span className="sm:hidden">{day.charAt(0)}</span>
                    </div>
                  ))}
                </div>

                <div className="calendar-month-grid grid flex-1 grid-cols-7 grid-rows-6 divide-x divide-y divide-slate-200/80 overflow-auto dark:divide-[#f2d894]/10">
                  {days.map((day) => {
                    const dayEvents = getEventsForDate(day);
                    const isTodayDate = isToday(day);
                    const isInCurrentMonth = isCurrentMonth(day);
                    const isSelected = selectedDate ? isSameCalendarDate(selectedDate, day) : false;

                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          'calendar-day group relative min-h-[92px] cursor-pointer p-1.5 transition-colors sm:min-h-[120px] sm:p-2.5 lg:min-h-[132px]',
                          isInCurrentMonth ? 'calendar-day-current bg-white hover:bg-[#fffaf0] dark:bg-[#111827]/90 dark:hover:bg-[#172235]' : 'calendar-day-outside bg-slate-50/80 text-slate-400 dark:bg-[#070b13] dark:text-slate-500',
                          isSelected && 'calendar-day-selected bg-[#fff7df] ring-1 ring-[#d6b56d]/55 dark:bg-[#2b2110] dark:ring-[#f2d894]/45',
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between sm:mb-2">
                          <span
                            className={cn(
                              'text-xs font-bold sm:text-sm',
                              isTodayDate
                                ? 'ae-tone-gold inline-flex h-6 w-6 items-center justify-center rounded-full border shadow-sm sm:h-7 sm:w-7'
                                : isInCurrentMonth ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600',
                            )}
                          >
                            {day.getDate()}
                          </span>
                          {dayEvents.length > 0 && (
                            <span className="calendar-count-badge ae-theme-inset hidden rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 sm:inline">
                              {dayEvents.length}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                          {dayEvents.slice(0, 4).map((event) => (
                            <div key={event.id} className={cn('h-1.5 w-1.5 rounded-full', getEventMeta(event).dotClass)} />
                          ))}
                          {dayEvents.length > 4 && <span className="text-[8px] text-slate-500">+{dayEvents.length - 4}</span>}
                        </div>

                        <div className="hidden space-y-1.5 sm:block">
                          {dayEvents.slice(0, 3).map((event) => (
                            <CalendarEventPill key={event.id} event={event} onClick={() => openEvent(event)} />
                          ))}
                          {dayEvents.length > 3 && <div className="px-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">+{dayEvents.length - 3} more</div>}
                        </div>

                        <div className="calendar-popover ae-theme-card-strong absolute right-2 bottom-2 hidden items-center rounded-full border border-slate-200 bg-white/95 p-1 text-slate-700 opacity-0 shadow-[0_12px_28px_-18px_rgba(15,23,42,0.65)] transition-opacity group-hover:opacity-100 dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-200 sm:flex">
                          <button
                            type="button"
                            title="Add event"
                            aria-label="Add event"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedDate(day);
                              openCustomBlock(day, getSuggestedHour(day));
                            }}
                            className="ae-theme-button-muted inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-full overflow-x-auto overflow-y-auto">
                <div className="min-w-[920px]">
                  <div className="calendar-grid-head ae-theme-inset grid grid-cols-[72px_repeat(7,minmax(112px,1fr))] border-b border-slate-200/80 bg-slate-50 text-xs font-bold text-slate-500 dark:border-white/10 dark:bg-[#0b1220]/86 dark:text-slate-400">
                    <div className="px-3 py-3">Time</div>
                    {days.map((day) => (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          'px-2 py-3 text-center transition hover:bg-white dark:hover:bg-white/5',
                          selectedDate && isSameCalendarDate(selectedDate, day) && 'ae-tone-gold',
                        )}
                      >
                        <span className="block text-[10px] uppercase tracking-[0.12em]">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <span className="mt-1 block text-sm text-slate-900 dark:text-white">{day.getDate()}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-[72px_repeat(7,minmax(112px,1fr))]">
                    {Array.from({ length: 14 }).map((_, index) => {
                      const hour = index + 6;
                      return (
                        <div key={hour} className="contents">
                          <div className="calendar-hour-label ae-theme-inset border-b border-slate-200/80 bg-slate-50/80 px-3 py-3 text-[10px] font-semibold text-slate-500 dark:border-white/7 dark:bg-slate-950/30 dark:text-slate-500">
                            {hour}:00
                          </div>
                          {days.map((day) => {
                            const eventsForHour = getEventsForHour(day, hour);
                            const inRange = isDragging && dragDay && dragStartHour !== null && dragEndHour !== null
                              ? isSameCalendarDate(day, dragDay) && hour >= Math.min(dragStartHour, dragEndHour) && hour <= Math.max(dragStartHour, dragEndHour)
                              : false;
                            return (
                              <div
                                key={`${day.toISOString()}-${hour}`}
                                onClick={() => setSelectedDate(day)}
                                onMouseDown={(event) => {
                                  if ((event.target as HTMLElement).closest('button')) return;
                                  handleStartDrag(hour, day);
                                }}
                                onMouseEnter={() => handleDragEnter(hour)}
                                onMouseUp={finishDrag}
                                className={cn(
                                  'calendar-hour-cell group relative min-h-[62px] cursor-pointer border-b border-slate-200/80 px-2 py-2 text-[10px] transition dark:border-white/7',
                                  inRange ? 'bg-[#fff7df] dark:bg-[#d6b56d]/12' : 'hover:bg-[#fffaf0] dark:hover:bg-white/[0.04]',
                                )}
                              >
                                <div className="calendar-popover ae-theme-card-strong absolute right-2 top-2 z-10 hidden items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2 py-1 text-[9px] text-slate-700 shadow-[0_12px_28px_-18px_rgba(15,23,42,0.65)] group-hover:flex dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-200">
                                  {quickDurations.map((minutes) => (
                                    <button
                                      key={minutes}
                                      type="button"
                                      onMouseDown={(event) => event.stopPropagation()}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        createQuickBlock(day, hour, minutes);
                                      }}
                                      className="ae-theme-button-muted rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                                    >
                                      {minutes}m
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openCustomBlock(day, hour);
                                    }}
                                    className="ae-theme-button-muted rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                                  >
                                    Custom
                                  </button>
                                </div>
                                <div className="space-y-1.5">
                                  {eventsForHour.slice(0, 2).map((event) => (
                                    <CalendarEventPill key={event.id} event={event} onClick={() => openEvent(event)} compact />
                                  ))}
                                  {eventsForHour.length > 2 && <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">+{eventsForHour.length - 2} more</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {!loading && visibleEvents.length === 0 && (
              <div className="ae-theme-card pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl border border-slate-200 bg-white/95 p-4 text-sm font-medium text-slate-600 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.62)] dark:border-white/10 dark:bg-[#0b1220]/90 dark:text-slate-300">
                {activeFilter === 'ALL' ? 'No calendar items in this range.' : `No ${filterOptions.find((option) => option.id === activeFilter)?.label.toLowerCase()} items in this range.`}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Panel
            title={selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'Select a date'}
            subtitle={selectedDate ? `${selectedDayEvents.length} visible ${selectedDayEvents.length === 1 ? 'item' : 'items'} - ${selectedDayLoadLabel}` : 'Choose a day from the calendar'}
          >
            {selectedDate && (
              <div className="space-y-4">
                <div className="ae-theme-inset rounded-2xl border border-slate-200 p-3 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Day load</div>
                    <div className="text-xs font-bold text-[#7a5a24] dark:text-[#f2d894]">{selectedDayIntensity}%</div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <div
                      className={cn('h-full rounded-full transition-all', selectedDayIntensity >= 72 ? 'bg-rose-500' : selectedDayIntensity >= 40 ? 'bg-[#d6b56d]' : 'bg-emerald-500')}
                      style={{ width: `${selectedDayIntensity}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <QuickActionButton icon={ClipboardCheck} label="Task" onClick={() => openTaskModal({ date: selectedDate, category: 'GENERAL' })} />
                  <QuickActionButton icon={TimerReset} label="Block" onClick={() => openTaskModal({ date: selectedDate, category: 'EVENT', title: 'Calendar time block' })} />
                  <QuickActionButton icon={PhoneCall} label="Call" onClick={() => openTaskModal({ date: selectedDate, category: 'CALL' })} />
                </div>

                <div className="ae-theme-inset rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Time picker</div>
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-500">Ends {getTimeEndLabel()}</div>
                    </div>
                    <Clock3 className="h-4 w-4 text-[#9f7933] dark:text-[#f2d894]" aria-hidden="true" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Start</span>
                      <select
                        value={timeStart}
                        onChange={(event) => setTimeStart(event.target.value)}
                        className="ae-theme-field mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#d6b56d] focus:ring-2 focus:ring-[#d6b56d]/20 dark:border-white/10 dark:bg-[#0b1220] dark:text-slate-100"
                      >
                        {timeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Duration</span>
                      <div className="mt-1 grid grid-cols-2 gap-1.5">
                        {quickDurations.map((minutes) => (
                          <button
                            key={minutes}
                            type="button"
                            onClick={() => setTimeDuration(minutes)}
                            className={cn(
                              'rounded-lg border px-2 py-1.5 text-[10px] font-bold transition',
                              timeDuration === minutes
                                ? 'ae-tone-gold border'
                                : 'ae-theme-button-muted border-slate-200 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
                            )}
                          >
                            {minutes}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-500">Custom</span>
                    <input
                      type="number"
                      min={5}
                      max={240}
                      step={5}
                      value={Number.isNaN(timeDuration) ? 60 : timeDuration}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next)) return;
                        setTimeDuration(Math.max(5, Math.min(240, next)));
                      }}
                      className="ae-theme-field w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-800 outline-none focus:border-[#d6b56d] focus:ring-2 focus:ring-[#d6b56d]/20 dark:border-white/10 dark:bg-[#0b1220] dark:text-slate-100"
                    />
                    <span className="text-[10px] text-slate-500">min</span>
                  </div>
                  <button
                    type="button"
                    onClick={createTimeBlock}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f2d894] to-[#9f7933] px-3 py-2 text-xs font-bold text-[#171106] shadow-[0_12px_28px_-16px_rgba(159,121,51,0.72)] transition hover:brightness-105"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Book this time
                  </button>
                </div>

                <div className="ae-theme-inset rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
                  <label className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    <Search className="h-3.5 w-3.5" aria-hidden="true" />
                    Client quick add
                  </label>
                  <input
                    value={clientQuery}
                    onChange={(event) => setClientQuery(event.target.value)}
                    placeholder="Search client"
                    className="ae-theme-field w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#d6b56d] focus:ring-2 focus:ring-[#d6b56d]/20 dark:border-white/10 dark:bg-[#0b1220] dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  {clientQuery && (
                    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                      {filteredClients.length === 0 ? (
                        <div className="ae-theme-inset rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">No matching clients.</div>
                      ) : (
                        filteredClients.slice(0, 6).map((client) => (
                          <div key={client.id} className="ae-theme-inset flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                            <div className="min-w-0 truncate font-semibold">{client.firstName} {client.lastName}</div>
                            <div className="flex gap-1.5">
                              <button type="button" onClick={() => openTaskModal({ date: selectedDate, clientId: client.id, category: 'GENERAL' })} className="ae-theme-button-muted rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold dark:border-white/10 dark:bg-white/5">Task</button>
                              <button type="button" onClick={() => openTaskModal({ date: selectedDate, clientId: client.id, category: 'CALL' })} className="rounded-lg border border-blue-300 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-100 dark:hover:bg-blue-500/20">Call</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Selected day" subtitle={selectedDate ? selectedDayLoadLabel : 'No date selected'}>
            <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
              {!selectedDate ? (
                <EmptyPanel icon={CalendarDays} title="Choose a date" />
              ) : selectedDayEvents.length === 0 ? (
                <EmptyPanel icon={Sparkles} title="No visible items" />
              ) : (
                selectedDayEvents.map((event) => (
                  <SelectedEventCard
                    key={event.id}
                    event={event}
                    completing={completingTaskId === getTaskRecordId(event.id)}
                    onOpen={() => openEvent(event)}
                    onComplete={() => completeTask(event)}
                    onClientTask={() => openTaskModal({ date: selectedDate || new Date(event.date), clientId: event.clientId, category: 'CALL' })}
                    navigate={navigate}
                  />
                ))
              )}
            </div>
          </Panel>

          <Panel title="Upcoming" subtitle="Next 7 days">
            <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
              {upcomingEvents.length === 0 ? (
                <EmptyPanel icon={CalendarCheck2} title="Nothing scheduled" />
              ) : (
                upcomingEvents.map((event) => (
                  <UpcomingEvent key={event.id} event={event} onOpen={() => openEvent(event)} />
                ))
              )}
            </div>
          </Panel>

          <CalendarConnectionButton status={calendarStatus} onClick={() => navigate('/settings/integrations')} />

          <div className="ae-tone-gold rounded-2xl border border-[#d6b56d]/30 p-4 text-xs font-medium leading-5 shadow-[0_14px_34px_-24px_rgba(159,121,51,0.55)] dark:border-[#f2d894]/18">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]">
              <Target className="h-3.5 w-3.5" aria-hidden="true" />
              Planning pulse
            </div>
            <div className="mt-2 text-slate-700 dark:text-slate-300">
              {highPriorityCount > 0 ? `${highPriorityCount} priority items are visible in this range.` : 'The visible range is clear of priority pressure.'}
            </div>
          </div>
        </aside>
      </div>

      {showNewTaskModal && (
        <NewTaskModal
          onClose={() => setShowNewTaskModal(false)}
          onComplete={() => {
            loadEvents();
            setShowNewTaskModal(false);
          }}
          defaultClientId={taskDefaults?.clientId}
          defaultDueAt={taskDefaults?.dueAt}
          defaultCategory={taskDefaults?.category}
          defaultTitle={taskDefaults?.title}
        />
      )}
    </PageLayout>
  );
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: 'gold' | 'blue' | 'violet' | 'amber' | 'emerald' }) {
  const toneClass = {
    gold: 'ae-tone-gold',
    blue: 'ae-tone-blue',
    violet: 'ae-tone-violet',
    amber: 'ae-tone-amber',
    emerald: 'ae-tone-emerald',
  }[tone];

  return (
    <div className={cn('rounded-2xl border px-4 py-3.5 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.48)]', toneClass)}>
      <div className="flex items-center gap-2 text-xs font-semibold opacity-90"><Icon className="h-4 w-4" aria-hidden="true" /> {label}</div>
      <div className="mt-1 text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}

function FilterButton({ icon: Icon, label, count, active, onClick }: { icon: LucideIcon; label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-[36px] shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition',
        active
          ? 'ae-tone-gold shadow-[0_10px_24px_-16px_rgba(159,121,51,0.62)]'
          : 'ae-theme-button-muted border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
      <span className="rounded-full bg-slate-900/8 px-1.5 py-0.5 text-[10px] dark:bg-white/10">{count}</span>
    </button>
  );
}

function CalendarEventPill({ event, onClick, compact = false }: { event: UnifiedEvent; onClick: () => void; compact?: boolean }) {
  const meta = getEventMeta(event);
  const Icon = meta.icon;
  const date = parseEventDate(event);
  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick();
      }}
      title={cleanEventTitle(event.title)}
      className={cn('flex w-full items-center gap-1.5 truncate rounded-lg border text-left font-semibold shadow-sm transition hover:-translate-y-px', getEventChipClass(event), compact ? 'px-2 py-1 text-[10px]' : 'px-2 py-1.5 text-[10px]')}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{cleanEventTitle(event.title)}</span>
      {date && !compact && <span className="hidden text-[9px] opacity-70 lg:inline">{formatTimeLabel(date)}</span>}
    </button>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="ae-theme-card overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-[0_22px_54px_-36px_rgba(15,23,42,0.56)] backdrop-blur-xl dark:border-[#f2d894]/14 dark:bg-[#080c14]/82 dark:shadow-[0_24px_68px_rgba(0,0,0,0.74)]">
      <div className="ae-theme-inset border-b border-slate-200/80 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-[#0b1220]/72">
        <h3 className="text-sm font-bold text-slate-950 dark:text-white">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function QuickActionButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ae-theme-inset inline-flex min-h-[66px] flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-[#d6b56d]/55 hover:bg-[#fff7df] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
    >
      <Icon className="h-4 w-4 text-[#9f7933] dark:text-[#f2d894]" aria-hidden="true" />
      {label}
    </button>
  );
}

function EmptyPanel({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="ae-theme-inset rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
      <Icon className="mx-auto mb-2 h-7 w-7 text-slate-400" aria-hidden="true" />
      {title}
    </div>
  );
}

function SelectedEventCard({
  event,
  completing,
  onOpen,
  onComplete,
  onClientTask,
  navigate,
}: {
  event: UnifiedEvent;
  completing: boolean;
  onOpen: () => void;
  onComplete: () => void;
  onClientTask: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const meta = getEventMeta(event);
  const Icon = meta.icon;
  const eventDate = parseEventDate(event);
  const statusLabel = readableStatus(event.status);

  return (
    <article className={cn('rounded-2xl border p-3 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.55)]', getEventChipClass(event))}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold dark:bg-white/10">
              <Icon className="h-3 w-3" aria-hidden="true" />
              {meta.shortLabel}
            </span>
            {event.priority === 'HIGH' && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-200">Urgent</span>}
          </div>
          <h4 className="line-clamp-2 text-sm font-bold">{cleanEventTitle(event.title)}</h4>
          <div className="mt-1 text-[11px] opacity-75">{eventDate ? formatTimeLabel(eventDate) : 'Time not set'}</div>
        </div>
        <button type="button" onClick={onOpen} className="rounded-full border border-current/20 bg-white/45 p-1.5 transition hover:bg-white/75 dark:bg-white/10 dark:hover:bg-white/15" aria-label="Open calendar item">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {event.description && <p className="mt-2 line-clamp-3 text-[11px] leading-5 opacity-75">{event.description}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {event.clientId && <SmallAction onClick={() => navigate(`/clients/${event.clientId}`)}>Client</SmallAction>}
        {event.dealId && <SmallAction onClick={() => navigate('/contracts', { state: { dealId: event.dealId } })}>Deal</SmallAction>}
        {event.listingId && <SmallAction onClick={() => navigate('/listings')}>Listing</SmallAction>}
        {event.marketingBlastId && <SmallAction onClick={() => navigate(`/marketing/blasts/${event.marketingBlastId}`)}>Blast</SmallAction>}
        <SmallAction onClick={onOpen}>Open</SmallAction>
        {event.type === 'TASK' && (
          <SmallAction onClick={onComplete} disabled={completing} tone="success">
            {completing ? 'Completing' : 'Complete'}
          </SmallAction>
        )}
        {event.clientId && <SmallAction onClick={onClientTask}>Call task</SmallAction>}
      </div>

      {(statusLabel || event.clientName || event.listingAddress) && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] opacity-75">
          {statusLabel && <span className="rounded-full bg-white/45 px-2 py-0.5 dark:bg-white/10">{statusLabel}</span>}
          {event.clientName && <span className="rounded-full bg-white/45 px-2 py-0.5 dark:bg-white/10">{event.clientName}</span>}
          {event.listingAddress && <span className="max-w-full truncate rounded-full bg-white/45 px-2 py-0.5 dark:bg-white/10">{event.listingAddress}</span>}
        </div>
      )}
    </article>
  );
}

function UpcomingEvent({ event, onOpen }: { event: UnifiedEvent; onOpen: () => void }) {
  const meta = getEventMeta(event);
  const Icon = meta.icon;
  const date = parseEventDate(event);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-[#d6b56d]/55 hover:bg-[#fff7df] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
    >
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border', meta.chipClass)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
        </span>
        <span className="mt-1 block truncate text-sm font-bold text-slate-900 dark:text-white">{cleanEventTitle(event.title)}</span>
        {(event.clientName || event.dealTitle || event.listingAddress) && (
          <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-slate-400">{event.clientName || event.dealTitle || event.listingAddress}</span>
        )}
      </span>
      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
    </button>
  );
}
function SmallAction({ children, onClick, disabled, tone = 'default' }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: 'default' | 'success' }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'rounded-lg border px-2 py-1 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60',
        tone === 'success'
          ? 'ae-tone-emerald'
          : 'ae-theme-button-muted border-current/20 bg-white/45 dark:bg-white/10',
      )}
    >
      {children}
    </button>
  );
}

function CalendarConnectionButton({ status, onClick }: { status: CalendarStatus | null; onClick: () => void }) {
  if (!status) return null;
  const Icon = status.connected ? (status.syncEnabled ? CheckCircle2 : PauseCircle) : Plus;
  const label = status.connected ? (status.syncEnabled ? 'Google Calendar synced' : 'Google Calendar paused') : 'Connect Google Calendar';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-xs font-semibold shadow-[0_14px_34px_-28px_rgba(15,23,42,0.55)] transition hover:-translate-y-px',
        status.connected
          ? status.syncEnabled
            ? 'ae-tone-emerald'
            : 'ae-tone-amber'
          : 'ae-theme-button-muted border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200',
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      {status.lastSyncAt && <span className="hidden text-[10px] opacity-70 sm:inline">{new Date(status.lastSyncAt).toLocaleDateString()}</span>}
    </button>
  );
}