import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { PageLayout } from '../../components/layout/PageLayout';
import { NewTaskModal } from '../tasks/NewTaskModal';

// Calendar v2 unified event types
type EventType = 'DEAL_EVENT' | 'TASK' | 'LISTING_EVENT' | 'MARKETING_BLAST' | 'GOOGLE_CALENDAR';

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

type ViewMode = 'month' | 'week';

export function CalendarPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [taskDefaults, setTaskDefaults] = useState<{
    dueAt?: string;
    clientId?: string;
    category?: 'GENERAL' | 'CONTRACT' | 'MARKETING' | 'CALL' | 'NOTE' | 'POPBY' | 'EVENT';
    title?: string;
  } | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [clients, setClients] = useState<ClientSearchItem[]>([]);
  const [clientQuery, setClientQuery] = useState('');
  const [dragStartHour, setDragStartHour] = useState<number | null>(null);
  const [dragEndHour, setDragEndHour] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDay, setDragDay] = useState<Date | null>(null);

  const upcomingEvents = events
    .filter((evt) => {
      const date = new Date(evt.date);
      if (Number.isNaN(date.getTime())) return false;
      const now = new Date();
      const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return date >= now && date <= weekOut;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (!dateParam) return;
    // Expect YYYY-MM-DD
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
    try {
      const start = viewMode === 'month' ? getMonthStart(currentDate) : getWeekStart(currentDate);
      const end = viewMode === 'month' ? getMonthEnd(currentDate) : getWeekEnd(currentDate);

      const from = formatDate(start);
      const to = formatDate(end);

      // Calendar v2 unified events API
      const res = await api.get(`/calendar/events?from=${from}&to=${to}`);
      setEvents(res.data.events || []);
    } catch (error) {
      console.error('Failed to load events:', error);
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
      setClients(res.data || []);
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const getMonthStart = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = firstDay.getDay();
    return new Date(firstDay.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
  };

  const getMonthEnd = (date: Date) => {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const dayOfWeek = lastDay.getDay();
    return new Date(lastDay.getTime() + (6 - dayOfWeek) * 24 * 60 * 60 * 1000);
  };

  const getWeekStart = (date: Date) => {
    const dayOfWeek = date.getDay();
    return new Date(date.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
  };

  const getWeekEnd = (date: Date) => {
    const dayOfWeek = date.getDay();
    return new Date(date.getTime() + (6 - dayOfWeek) * 24 * 60 * 60 * 1000);
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const prevPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000));
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000));
    }
  };

  const today = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

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

  const getEventColor = (event: UnifiedEvent) => {
    switch (event.type) {
      case 'DEAL_EVENT':
        return 'bg-violet-500/20 border-violet-400/40 text-violet-200';
      case 'TASK':
        if (event.category === 'CONTRACT') return 'bg-amber-500/20 border-amber-400/40 text-amber-200';
        if (event.category === 'CALL') return 'bg-blue-500/20 border-blue-400/40 text-blue-200';
        if (event.category === 'NOTE') return 'bg-purple-500/20 border-purple-400/40 text-purple-200';
        if (event.category === 'POPBY') return 'bg-orange-500/20 border-orange-400/40 text-orange-200';
        return 'bg-slate-500/20 border-slate-400/40 text-slate-200';
      case 'LISTING_EVENT':
        return 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200';
      case 'MARKETING_BLAST':
        return 'bg-pink-500/20 border-pink-400/40 text-pink-200';
      case 'GOOGLE_CALENDAR':
        return 'bg-blue-500/20 border-blue-400/40 text-blue-200';
      default:
        return 'bg-slate-500/20 border-slate-400/40 text-slate-200';
    }
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = formatDate(date);
    return events.filter(e => e.date.startsWith(dateStr));
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const generateMonthDays = () => {
    const start = getMonthStart(currentDate);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(start.getTime() + i * 24 * 60 * 60 * 1000));
    }
    return days;
  };

  const generateWeekDays = () => {
    const start = getWeekStart(currentDate);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(start.getTime() + i * 24 * 60 * 60 * 1000));
    }
    return days;
  };

  const days = viewMode === 'month' ? generateMonthDays() : generateWeekDays();
  const selectedDayEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const filteredClients = clientQuery
    ? clients.filter((c) =>
        `${c.firstName} ${c.lastName} ${c.email || ''}`
          .toLowerCase()
          .includes(clientQuery.toLowerCase()),
      )
    : [];

  const formatDateTimeLocal = (date: Date, hours?: number, minutes = 0) => {
    const d = new Date(date);
    if (typeof hours === 'number') {
      d.setHours(hours, minutes, 0, 0);
    } else {
      d.setSeconds(0, 0);
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [timeStart, setTimeStart] = useState('09:00');
  const [timeDuration, setTimeDuration] = useState(60);

  const parseTime = (value: string) => {
    const [h, m] = value.split(':');
    return { hours: Number(h), minutes: Number(m) };
  };

  const formatTimeLabel = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const timeOptions = Array.from({ length: 61 }).map((_, idx) => {
    const total = 6 * 60 + idx * 15;
    const h = Math.floor(total / 60);
    const m = total % 60;
    const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return label;
  });

  const getTimeEndLabel = () => {
    const { hours, minutes } = parseTime(timeStart);
    const total = hours * 60 + minutes + timeDuration;
    const end = new Date();
    end.setHours(Math.floor(total / 60), total % 60, 0, 0);
    return formatTimeLabel(end);
  };

  const createTimeBlock = () => {
    if (!selectedDate) return;
    const { hours, minutes } = parseTime(timeStart);
    const start = new Date(selectedDate);
    start.setHours(hours, minutes, 0, 0);
    const end = new Date(start.getTime() + timeDuration * 60000);
    const title = `Time block ${formatTimeLabel(start)}-${formatTimeLabel(end)}`;
    openTaskModal({ date: start, category: 'EVENT', title });
  };

  const createQuickBlock = (day: Date, hour: number, minutes: number) => {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + minutes * 60000);
    const title = `Time block ${formatTimeLabel(start)}-${formatTimeLabel(end)}`;
    openTaskModal({ date: start, category: 'EVENT', title });
  };

  const getSuggestedHour = (day: Date) => {
    const now = new Date();
    const isSameDay = now.toDateString() === day.toDateString();
    const hour = isSameDay ? now.getHours() : 9;
    return Math.min(20, Math.max(6, hour));
  };

  const openCustomBlock = (day: Date, hour: number) => {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    openTaskModal({ date: start, category: 'EVENT', title: 'Custom time block' });
  };

  const openTaskModal = (opts?: { date?: Date; category?: 'CALL' | 'EVENT' | 'GENERAL'; clientId?: string; title?: string }) => {
    const dueAt = opts?.date ? formatDateTimeLocal(opts.date) : selectedDate ? formatDateTimeLocal(selectedDate) : undefined;
    setTaskDefaults({
      dueAt,
      clientId: opts?.clientId,
      category: opts?.category || 'GENERAL',
      title: opts?.title,
    });
    setShowNewTaskModal(true);
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
    const title = `Time block ${startHour.toString().padStart(2, '0')}:00-${endHour
      .toString()
      .padStart(2, '0')}:00`;
    openTaskModal({ date: start, category: 'EVENT', title });
    setIsDragging(false);
    setDragStartHour(null);
    setDragEndHour(null);
    setDragDay(null);
  };

  const getEventsForHour = (day: Date, hour: number) => {
    const dayStr = formatDate(day);
    return events.filter((e) => {
      if (!e.date.startsWith(dayStr)) return false;
      const parsed = new Date(e.date);
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed.getHours() === hour;
    });
  };

  return (
    <PageLayout
      title="Calendar"
      subtitle="Unified view of tasks, deadlines, listings, and marketing"
      maxWidth="full"
    >
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 lg:gap-6 min-h-0 pt-3 sm:pt-4">
        {/* Main Calendar */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
              <button
                onClick={today}
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full shadow-[0_12px_30px_rgba(14,165,233,0.35)] hover:from-cyan-500 hover:to-blue-500 transition-all active:scale-[0.98]"
              >
                Today
              </button>

              <div className="flex items-center gap-1 sm:gap-2 rounded-full bg-slate-900/70 border border-white/12 px-2 py-1 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
                <button
                  onClick={prevPeriod}
                  className="p-2 text-slate-300 hover:text-cyan-200 hover:bg-white/10 rounded-full transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <h2 className="text-base sm:text-xl font-semibold text-slate-50 min-w-[140px] sm:min-w-[200px] text-center">
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>

                <button
                  onClick={nextPeriod}
                  className="p-2 text-slate-300 hover:text-cyan-200 hover:bg-white/10 rounded-full transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {calendarStatus && (
              <button
                onClick={() => navigate('/settings/integrations')}
                title={calendarStatus.connected ? 'Manage Google Calendar sync' : 'Connect Google Calendar'}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border cursor-pointer transition-all hover:scale-105 ${
                  calendarStatus.connected
                    ? calendarStatus.syncEnabled
                      ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/25'
                      : 'bg-amber-500/15 border-amber-400/30 text-amber-200 hover:bg-amber-500/25'
                    : 'bg-slate-500/15 border-slate-400/30 text-slate-300 hover:bg-slate-500/25'
                }`}
              >
                <span>
                  {calendarStatus.connected
                    ? calendarStatus.syncEnabled
                      ? '✓ Google Calendar synced'
                      : '⏸ Google Calendar paused'
                    : '+ Connect Google Calendar'}
                </span>
                {calendarStatus.lastSyncAt && (
                  <span className="hidden sm:inline text-[10px] text-slate-400">
                    • Last sync {new Date(calendarStatus.lastSyncAt).toLocaleDateString()}
                  </span>
                )}
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center justify-center gap-1 bg-slate-900/70 border border-white/12 rounded-full p-1 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
              <button
                onClick={() => setViewMode('month')}
                className={`flex-1 sm:flex-initial px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                  viewMode === 'month'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_10px_24px_rgba(14,165,233,0.35)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`flex-1 sm:flex-initial px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                  viewMode === 'week'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_10px_24px_rgba(14,165,233,0.35)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                Week
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 rounded-2xl border border-white/14 bg-slate-950/60 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col min-h-[560px] lg:min-h-[700px]">
            {viewMode === 'month' ? (
              <div className="flex flex-col h-full">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-white/10 bg-slate-900/50 flex-shrink-0">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="px-1 sm:px-3 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-slate-400 uppercase">
                      <span className="hidden sm:inline">{day}</span>
                      <span className="sm:hidden">{day.charAt(0)}</span>
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 grid-rows-6 flex-1 divide-x divide-y divide-white/5 overflow-auto">
                  {days.map((day, idx) => {
                    const dayEvents = getEventsForDate(day);
                    const isTodayDate = isToday(day);
                    const isInCurrentMonth = isCurrentMonth(day);

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedDate(day)}
                        className={`group relative p-1.5 sm:p-2.5 min-h-[90px] sm:min-h-[120px] lg:min-h-[132px] hover:bg-white/5 active:bg-white/10 cursor-pointer transition-colors ${
                          !isInCurrentMonth ? 'bg-slate-900/30' : ''
                        } ${selectedDate?.toDateString() === day.toDateString() ? 'bg-cyan-500/10 ring-1 ring-cyan-400/30' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1 sm:mb-2">
                          <span
                            className={`text-xs sm:text-sm font-medium ${
                              isTodayDate
                                ? 'inline-flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                                : isInCurrentMonth
                                ? 'text-slate-200'
                                : 'text-slate-500'
                            }`}
                          >
                            {day.getDate()}
                          </span>
                          {dayEvents.length > 0 && (
                            <span className="hidden sm:inline text-[10px] text-slate-400">{dayEvents.length}</span>
                          )}
                        </div>

                        {/* Show dot indicators on mobile, full events on desktop */}
                        <div className="sm:hidden flex flex-wrap gap-0.5 mt-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className={`w-1.5 h-1.5 rounded-full ${
                                event.type === 'DEAL_EVENT' ? 'bg-violet-400' :
                                event.type === 'TASK' ? 'bg-blue-400' :
                                event.type === 'LISTING_EVENT' ? 'bg-emerald-400' :
                                event.type === 'GOOGLE_CALENDAR' ? 'bg-blue-300' :
                                'bg-pink-400'
                              }`}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[8px] text-slate-500">+{dayEvents.length - 3}</span>
                          )}
                        </div>

                        <div className="hidden sm:block space-y-1.5">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className={`text-[10px] px-2 py-1.5 rounded border truncate ${getEventColor(event)}`}
                              title={event.title}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-[10px] text-slate-400 px-2">
                              +{dayEvents.length - 3} more
                            </div>
                          )}
                        </div>

                        <div className="absolute inset-x-2 bottom-2 hidden sm:flex items-center gap-1 rounded-full border border-white/10 bg-slate-900/80 px-2 py-1 text-[9px] text-slate-200 shadow-[0_10px_24px_rgba(0,0,0,0.35)] opacity-0 transition-opacity group-hover:opacity-100">
                          {[15, 30, 45, 60].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(day);
                                createQuickBlock(day, getSuggestedHour(day), mins);
                              }}
                              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-100 hover:bg-white/10"
                            >
                              {mins}m
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-full overflow-auto">
                <div className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-white/10 bg-slate-900/50 text-xs text-slate-400">
                  <div className="px-2 py-2">Time</div>
                  {days.map((day) => (
                    <div key={day.toISOString()} className="px-2 py-2 text-center">
                      {day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-[72px_repeat(7,1fr)]">
                  {Array.from({ length: 14 }).map((_, idx) => {
                    const hour = idx + 6;
                    return (
                      <div key={hour} className="contents">
                        <div className="border-b border-white/5 px-2 py-3 text-[10px] text-slate-500">{hour}:00</div>
                        {days.map((day) => {
                          const eventsForHour = getEventsForHour(day, hour);
                          const inRange =
                            isDragging && dragDay && dragStartHour !== null && dragEndHour !== null
                              ? day.toDateString() === dragDay.toDateString() &&
                                hour >= Math.min(dragStartHour, dragEndHour) &&
                                hour <= Math.max(dragStartHour, dragEndHour)
                              : false;
                          return (
                            <div
                              key={`${day.toISOString()}-${hour}`}
                              onClick={() => setSelectedDate(day)}
                              onMouseDown={() => handleStartDrag(hour, day)}
                              onMouseEnter={() => handleDragEnter(hour)}
                              onMouseUp={finishDrag}
                              className={`group relative border-b border-white/5 px-2 py-3 text-[10px] cursor-pointer min-h-[56px] ${
                                inRange ? 'bg-cyan-500/15' : 'hover:bg-white/5'
                              }`}
                            >
                              <div className="absolute right-2 top-2 hidden items-center gap-1 rounded-full border border-white/10 bg-slate-900/80 px-2 py-1 text-[9px] text-slate-200 shadow-[0_10px_24px_rgba(0,0,0,0.35)] group-hover:flex">
                                {[15, 30, 45, 60].map((mins) => (
                                  <button
                                    key={mins}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      createQuickBlock(day, hour, mins);
                                    }}
                                    className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-100 hover:bg-white/10"
                                  >
                                    {mins}m
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCustomBlock(day, hour);
                                  }}
                                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-100 hover:bg-white/10"
                                >
                                  Custom
                                </button>
                              </div>
                              <div className="space-y-1">
                                {eventsForHour.slice(0, 2).map((event) => (
                                  <div
                                    key={event.id}
                                    className={`px-2 py-1 rounded border truncate ${getEventColor(event)}`}
                                    title={event.title}
                                  >
                                    {event.title}
                                  </div>
                                ))}
                                {eventsForHour.length > 2 && (
                                  <div className="text-[9px] text-slate-400">+{eventsForHour.length - 2} more</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Agenda Sidebar - Collapsible on mobile */}
        <div className="w-full xl:w-[340px] flex flex-col gap-4 xl:sticky xl:top-24 self-start">


          <div className="mt-2 sm:mt-3 lg:mt-4 rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-slate-950/70 via-slate-950/60 to-slate-900/60 backdrop-blur-xl shadow-[0_26px_70px_rgba(0,0,0,0.85)] overflow-hidden">
            <div className="border-b border-white/10 px-4 py-4 bg-slate-900/50">
              <h3 className="text-sm font-semibold text-slate-50">Upcoming (7 days)</h3>
              <p className="text-xs text-slate-400 mt-1">Deadlines and tasks you should watch</p>
            </div>
            <div className="p-4 pb-5 space-y-3 max-h-[290px] overflow-y-auto">
              {upcomingEvents.length === 0 ? (
                <div className="text-xs text-slate-400">Nothing scheduled yet.</div>
              ) : (
                upcomingEvents.map((evt) => (
                  <div key={evt.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-[11px] text-slate-400">
                      {new Date(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-sm text-slate-100 truncate">{evt.title}</div>
                    {evt.dealTitle && (
                      <div className="text-[10px] text-slate-500 truncate">{evt.dealTitle}</div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {evt.clientId && (
                        <button
                          onClick={() => navigate(`/clients/${evt.clientId}`)}
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10"
                        >
                          Client
                        </button>
                      )}
                      {evt.dealId && (
                        <button
                          onClick={() => navigate('/contracts', { state: { dealId: evt.dealId } })}
                          className="rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] text-indigo-200 hover:bg-indigo-500/20"
                        >
                          Deal
                        </button>
                      )}
                      {evt.listingId && (
                        <button
                          onClick={() => navigate('/listings')}
                          className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200 hover:bg-emerald-500/20"
                        >
                          Listing
                        </button>
                      )}
                      {evt.marketingBlastId && (
                        <button
                          onClick={() => navigate(`/marketing/blasts/${evt.marketingBlastId}`)}
                          className="rounded-md border border-pink-400/30 bg-pink-500/10 px-2 py-1 text-[10px] text-pink-200 hover:bg-pink-500/20"
                        >
                          Blast
                        </button>
                      )}
                      <button
                        onClick={() => openEvent(evt)}
                        className="rounded-md border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-[10px] text-blue-200 hover:bg-blue-500/20"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/14 bg-slate-950/60 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col min-h-[420px] xl:min-h-[460px]">
            <div className="border-b border-white/10 px-4 py-4 bg-slate-900/50">
              <h3 className="text-sm font-semibold text-slate-50">
                {selectedDate
                  ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                  : 'Select a date'}
              </h3>
              {selectedDate && selectedDayEvents.length > 0 && (
                <p className="text-xs text-slate-400 mt-1">{selectedDayEvents.length} events</p>
              )}
            </div>

            {selectedDate && (
              <div className="px-4 py-4 border-b border-white/10 bg-slate-900/40">
                <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3">Quick add</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openTaskModal({ date: selectedDate, category: 'GENERAL' })}
                    className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200"
                  >
                    + Task
                  </button>
                  <button
                    onClick={() => openTaskModal({ date: selectedDate, category: 'EVENT' })}
                    className="rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 px-3 py-2 text-xs font-semibold text-cyan-200"
                  >
                    + Event
                  </button>
                  <button
                    onClick={() => openTaskModal({ date: selectedDate, category: 'CALL' })}
                    className="rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-400/30 px-3 py-2 text-xs font-semibold text-blue-200 col-span-2"
                  >
                    + Call follow‑up
                  </button>
                </div>
              </div>
            )}

            {selectedDate && (
              <div className="px-4 py-4 border-b border-white/10 bg-slate-900/40">
                <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3">Client quick add</div>
                <input
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  placeholder="Search client"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100"
                />
                {clientQuery && (
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {filteredClients.slice(0, 6).map((client) => (
                      <div key={client.id} className="flex items-center justify-between gap-2 text-xs text-slate-200">
                        <div className="truncate">
                          {client.firstName} {client.lastName}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openTaskModal({ date: selectedDate, clientId: client.id, category: 'GENERAL' })}
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] hover:bg-white/10"
                          >
                            Task
                          </button>
                          <button
                            onClick={() => openTaskModal({ date: selectedDate, clientId: client.id, category: 'CALL' })}
                            className="rounded-md border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-[10px] text-blue-200 hover:bg-blue-500/20"
                          >
                            Call
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedDate && viewMode === 'month' && (
              <div className="px-4 py-4 border-b border-white/10 bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Time picker</div>
                    <div className="text-[11px] text-slate-400">Pick a start time and duration.</div>
                  </div>
                  <div className="text-xs text-slate-500">Ends {getTimeEndLabel()}</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500">Start</label>
                    <select
                      value={timeStart}
                      onChange={(e) => setTimeStart(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100"
                    >
                      {timeOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500">Duration</label>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {[15, 30, 45, 60].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setTimeDuration(mins)}
                          className={`rounded-xl border px-2 py-2 text-[10px] font-semibold transition ${
                            timeDuration === mins
                              ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">Custom</span>
                      <input
                        type="number"
                        min={5}
                        max={240}
                        step={5}
                        value={Number.isNaN(timeDuration) ? 60 : timeDuration}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (!Number.isFinite(next)) return;
                          setTimeDuration(Math.max(5, Math.min(240, next)));
                        }}
                        className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-100"
                      />
                      <span className="text-[10px] text-slate-500">min</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={createTimeBlock}
                  className="mt-3 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(14,165,233,0.35)] hover:from-cyan-500 hover:to-blue-500"
                >
                  Book this time
                </button>
              </div>
            )}

            {selectedDate && viewMode === 'week' && (
              <div className="px-4 py-3 border-b border-white/10 bg-slate-900/40">
                <div className="text-[11px] text-slate-400">
                  Tip: hover a time slot for 15/30/45/60m quick actions, or drag on the week grid to block multiple hours.
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[420px] xl:max-h-[480px]">
              {!selectedDate ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">📅</div>
                  <p className="text-xs text-slate-400">Click a day to see events</p>
                </div>
              ) : selectedDayEvents.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">✨</div>
                  <p className="text-xs text-slate-400">No events scheduled</p>
                </div>
              ) : (
                selectedDayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`p-3 rounded-lg border ${getEventColor(event)} hover:bg-white/5 transition-colors cursor-pointer`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium flex-1">{event.title}</p>
                      {event.priority === 'HIGH' && (
                        <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-semibold text-red-200 border border-red-400/30">
                          URGENT
                        </span>
                      )}
                    </div>

                    {event.description && (
                      <p className="text-[11px] text-slate-400 mb-2">{event.description}</p>
                    )}

                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      {event.type === 'DEAL_EVENT' && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Contract
                        </span>
                      )}
                      {event.type === 'TASK' && event.category && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          {event.category}
                        </span>
                      )}
                      {event.type === 'LISTING_EVENT' && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                          Listing
                        </span>
                      )}
                      {event.type === 'MARKETING_BLAST' && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                          </svg>
                          Marketing
                        </span>
                      )}
                      {event.type === 'GOOGLE_CALENDAR' && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Appointment
                        </span>
                      )}
                      {event.clientName && <span>• {event.clientName}</span>}
                      {event.listingAddress && <span className="truncate">• {event.listingAddress}</span>}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {event.clientId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/clients/${event.clientId}`);
                          }}
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10"
                        >
                          Open client
                        </button>
                      )}
                      {event.dealId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/contracts', { state: { dealId: event.dealId } });
                          }}
                          className="rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] text-indigo-200 hover:bg-indigo-500/20"
                        >
                          Open deal
                        </button>
                      )}
                      {event.listingId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/listings');
                          }}
                          className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200 hover:bg-emerald-500/20"
                        >
                          Open listing
                        </button>
                      )}
                      {event.marketingBlastId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/marketing/blasts/${event.marketingBlastId}`);
                          }}
                          className="rounded-md border border-pink-400/30 bg-pink-500/10 px-2 py-1 text-[10px] text-pink-200 hover:bg-pink-500/20"
                        >
                          Open blast
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEvent(event);
                        }}
                        className="rounded-md border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-[10px] text-blue-200 hover:bg-blue-500/20"
                      >
                        Open
                      </button>
                    </div>

                    {event.clientId && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openTaskModal({ date: selectedDate || new Date(event.date), clientId: event.clientId, category: 'CALL' });
                          }}
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10"
                        >
                          Add task for client
                        </button>
                        {event.type === 'TASK' && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await api.patch(`/tasks/${event.id}`, { status: 'COMPLETED' });
                                loadEvents();
                              } catch (error) {
                                console.error('Failed to complete task:', error);
                              }
                            }}
                            className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200 hover:bg-emerald-500/20"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    )}

                    {event.status && (
                      <div className="mt-2">
                        <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-medium text-slate-300 border border-white/10">
                          {event.status}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-xs text-slate-300">
            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300">Planning guidance</div>
            <div className="mt-2">Block your must-do tasks first, then add client follow-ups and marketing events in open slots.</div>
          </div>
        </div>
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
