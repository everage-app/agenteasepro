import { useState, useEffect, useCallback } from 'react';
import { ClipboardList } from 'lucide-react';
import api from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { TaskColumn } from './TaskColumn';
import { TaskListItem, TaskBucket } from './TaskCard';
import { NewTaskModal } from './NewTaskModal';
import { PageLayout } from '../../components/layout/PageLayout';
import { PageBeam } from '../../components/layout/PageBeam';
import { TasksKanbanBoard } from './TasksKanbanBoard';
import ClientStatusDashboard from './ClientStatusDashboard';
import MarketingActivityTracker from './MarketingActivityTracker';
import { TaskEditModal } from './TaskEditModal';

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'COMPLETED'>('OPEN');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_TODAY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [agenda, setAgenda] = useState<{ date: string; events: any[]; tasks: any[] }[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<TaskListItem | null>(null);
  const [view, setView] = useState<'board' | 'planner'>(() => {
    try { return (localStorage.getItem('aep_tasks_view') as 'board' | 'planner') || 'board'; } catch { return 'board'; }
  });

  // Auto-refresh tasks every 30 seconds
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      fetchTasks();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, filter]);

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  useEffect(() => {
    const fetchAgenda = async () => {
      try {
        setAgendaLoading(true);
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        const from = today.toISOString().split('T')[0];
        const to = nextWeek.toISOString().split('T')[0];
        const res = await api.get(`/calendar/agenda?from=${from}&to=${to}`);
        setAgenda(res.data.days || []);
      } catch (error) {
        console.error('Failed to fetch agenda', error);
      } finally {
        setAgendaLoading(false);
      }
    };
    fetchAgenda();
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== 'ALL' ? { status: filter } : {};
      const res = await api.get('/tasks', { params });
      setTasks(res.data);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const handleMarkDone = async (taskId: string) => {
    try {
      // Optimistically update UI
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: 'COMPLETED' as const, bucket: 'DONE' as TaskBucket }
            : t
        )
      );

      await api.patch(`/tasks/${taskId}`, {
        status: 'COMPLETED',
        bucket: 'DONE',
      });
    } catch (error) {
      console.error('Failed to mark task as done', error);
      fetchTasks(); // Revert on error
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  const handleOpenTask = (task: TaskListItem) => {
    setActiveTask(task);
  };

  const handleSaveTask = async (payload: {
    title: string;
    description: string;
    dueAt: string | null;
    priority: TaskListItem['priority'];
    bucket: TaskBucket;
    status: TaskListItem['status'];
    dealId?: string;
    clientId?: string;
  }) => {
    if (!activeTask) return;

    const taskId = activeTask.id;
    const previous = tasks;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...payload } : t)));

    try {
      await api.patch(`/tasks/${taskId}`, payload);
      await fetchTasks();
    } catch (error) {
      console.error('Failed to save task', error);
      setTasks(previous);
      throw error;
    }
  };

  const handleDeleteTask = async () => {
    if (!activeTask) return;
    const taskId = activeTask.id;
    const previous = tasks;

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setActiveTask(null);

    try {
      await api.delete(`/tasks/${taskId}`);
      await fetchTasks();
    } catch (error) {
      console.error('Failed to delete task', error);
      setTasks(previous);
      throw error;
    }
  };

  const switchView = (v: 'board' | 'planner') => {
    setView(v);
    try { localStorage.setItem('aep_tasks_view', v); } catch { /* noop */ }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetBucket: TaskBucket) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    const task = tasks.find((t) => t.id === draggedTaskId);
    if (!task || task.bucket === targetBucket) {
      setDraggedTaskId(null);
      return;
    }

    try {
      // Optimistically update UI
      setTasks((prev) =>
        prev.map((t) =>
          t.id === draggedTaskId ? { ...t, bucket: targetBucket } : t
        )
      );

      await api.patch(`/tasks/${draggedTaskId}`, { bucket: targetBucket });
    } catch (error) {
      console.error('Failed to update task bucket', error);
      fetchTasks(); // Revert on error
    } finally {
      setDraggedTaskId(null);
    }
  };

  const applyQuickFilters = (list: TaskListItem[]) => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const matchesSearch = (t: TaskListItem) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.client?.name || '').toLowerCase().includes(q) ||
        (t.deal?.title || '').toLowerCase().includes(q)
      );
    };

    const matchesQuick = (t: TaskListItem) => {
      if (quickFilter === 'ALL') return true;
      if (!t.dueAt) return false;
      const due = new Date(t.dueAt);
      const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      if (quickFilter === 'OVERDUE') return dueDate < todayStart && t.status === 'OPEN';
      return dueDate.getTime() === todayStart.getTime();
    };

    return list.filter((t) => matchesSearch(t) && matchesQuick(t));
  };

  // Group tasks by bucket
  const filteredTasks = applyQuickFilters(tasks);

  const tasksByBucket = {
    TODAY: filteredTasks.filter((t) => t.bucket === 'TODAY'),
    THIS_WEEK: filteredTasks.filter((t) => t.bucket === 'THIS_WEEK'),
    LATER: filteredTasks.filter((t) => t.bucket === 'LATER'),
    DONE: filteredTasks.filter((t) => t.bucket === 'DONE'),
  };

  const totalTasks = tasks.length;
  const hasNoTasks = totalTasks === 0 && !loading;
  const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const openTasksCount = tasks.filter((task) => task.status === 'OPEN').length;
  const completedTasksCount = tasks.filter((task) => task.status === 'COMPLETED').length;
  const dueTodayCount = tasks.filter((task) => {
    if (task.status !== 'OPEN' || !task.dueAt) return false;
    const due = new Date(task.dueAt);
    const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    return dueDate.getTime() === todayStart.getTime();
  }).length;
  const overdueCount = tasks.filter((task) => {
    if (task.status !== 'OPEN' || !task.dueAt) return false;
    const due = new Date(task.dueAt);
    const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    return dueDate < todayStart;
  }).length;
  const upcomingWeekItems = agenda.reduce((total, day) => total + day.events.length + day.tasks.length, 0);

  return (
    <PageLayout
      title="Tasks"
      subtitle="Your mission control board for follow-ups, deadlines, and reminders."
      actions={
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="hidden sm:flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5">
            <button
              onClick={() => switchView('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === 'board'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Board
            </button>
            <button
              onClick={() => switchView('planner')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === 'planner'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Planner
            </button>
          </div>
          <Button
            onClick={() => setShowNewTaskModal(true)}
            className="inline-flex items-center rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-400 px-3 sm:px-4 py-2 text-sm font-medium text-white transition-colors shadow-lg shadow-cyan-500/30"
          >
            <svg className="w-4 h-4 sm:mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">New Task</span>
          </Button>
        </div>
      }
    >
      <div className="relative ae-content">
      <PageBeam variant="cyan" />
      {/* Mobile view toggle */}
      <div className="sm:hidden mb-4 flex items-center rounded-xl border border-slate-300/70 dark:border-white/15 bg-white/70 dark:bg-white/5 p-0.5 w-fit">
        <button
          onClick={() => switchView('board')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            view === 'board'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
              : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Board
        </button>
        <button
          onClick={() => switchView('planner')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            view === 'planner'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
              : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Planner
        </button>
      </div>



      <div className="mb-5 sm:mb-7 rounded-3xl border border-slate-300/70 dark:border-white/12 bg-white/75 dark:bg-slate-950/50 backdrop-blur-xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-cyan-700 dark:text-cyan-200 uppercase tracking-wider">Task guidance</div>
            <div className="text-sm text-slate-700 dark:text-slate-300 mt-1">Work top-down: overdue first, due today second, then this week planning.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowNewTaskModal(true)} className="bg-white/85 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-white/10 border-slate-300/70 dark:border-white/10">
              Add task
            </Button>
            <Button size="sm" variant="secondary" onClick={() => window.location.assign('/calendar')} className="bg-white/85 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-white/10 border-slate-300/70 dark:border-white/10">
              Open calendar
            </Button>
          </div>
        </div>
      </div>

      {/* ── BOARD VIEW ── */}
      {view === 'board' && (
        <>
          {/* Compact filter bar for board view */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <nav className="flex gap-1 rounded-xl border border-slate-300/70 dark:border-white/15 bg-white/70 dark:bg-white/5 p-0.5">
                {(['OPEN', 'COMPLETED', 'ALL'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filter === f
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/25'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f === 'ALL' ? 'All' : f === 'OPEN' ? 'Open' : 'Done'}
                  </button>
                ))}
              </nav>
              <div className="flex gap-1">
                {(['ALL', 'DUE_TODAY', 'OVERDUE'] as const).map((qf) => (
                  <button
                    key={qf}
                    onClick={() => setQuickFilter(qf)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                      quickFilter === qf
                        ? qf === 'OVERDUE' ? 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                          : qf === 'DUE_TODAY' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300/40 dark:border-transparent'
                    }`}
                  >
                    {qf === 'ALL' ? 'All' : qf === 'DUE_TODAY' ? 'Due today' : 'Overdue'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks…"
                className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-white/5 border border-slate-300/70 dark:border-white/15 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 w-44"
              />
              <button
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                className={`p-1.5 rounded-lg border transition-all ${
                  autoRefreshEnabled
                    ? 'text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-100/80 dark:bg-emerald-500/10'
                    : 'text-slate-700 dark:text-slate-400 border-slate-300/70 dark:border-white/10 bg-white/70 dark:bg-white/5'
                }`}
                title={autoRefreshEnabled ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* The Kanban Board */}
          {loading ? (
            <div className="text-center py-16 text-slate-500">Loading tasks...</div>
          ) : filteredTasks.length === 0 && !hasNoTasks ? (
            <div className="text-center py-16 text-slate-500">No tasks match your filters.</div>
          ) : hasNoTasks ? (
            <div className="space-y-6">
              {/* Welcome message */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Your task board is ready</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">Organize follow-ups, showings, deadlines, and client check-ins. Drag tasks between columns to stay on track.</p>
              </div>
              {/* Preview board columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
                {[
                  { title: 'Today', hint: 'Urgent calls, showings, offer deadlines', iconColor: 'text-amber-400', borderColor: 'border-amber-400/20 bg-amber-500/5', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
                  { title: 'This Week', hint: 'Listing prep, inspections, walk-throughs', iconColor: 'text-cyan-400', borderColor: 'border-cyan-400/20 bg-cyan-500/5', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
                  { title: 'Later', hint: 'Market reports, renewals, long-term plans', iconColor: 'text-slate-400', borderColor: 'border-slate-400/15 bg-slate-500/5', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                  { title: 'Done', hint: 'Completed tasks land here', iconColor: 'text-emerald-400', borderColor: 'border-emerald-400/15 bg-emerald-500/5', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                ].map((col) => (
                  <div key={col.title} className={`flex flex-col rounded-2xl border backdrop-blur-xl ${col.borderColor} shadow-[0_12px_35px_rgba(0,0,0,0.5)]`}>
                    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                      <span className={col.iconColor}>{col.icon}</span>
                      <h3 className="text-sm font-bold text-white tracking-wide">{col.title}</h3>
                    </div>
                    <div className="flex-1 px-2.5 pb-3 pt-1 min-h-[120px]">
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/8 py-6 px-4">
                        <svg className="w-5 h-5 text-slate-600 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span className="text-[11px] text-center text-slate-500 leading-relaxed">{col.hint}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* CTA */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add your first task
                </button>
              </div>
            </div>
          ) : (
            <TasksKanbanBoard
              tasks={filteredTasks}
              onMarkDone={handleMarkDone}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              draggedTaskId={draggedTaskId}
              onTaskCreated={fetchTasks}
              onOpenTask={handleOpenTask}
            />
          )}
        </>
      )}

      {/* ── PLANNER VIEW (original layout) ── */}
      {view === 'planner' && (
        <>

      <div className="mb-5 sm:mb-7 rounded-3xl border border-cyan-400/20 bg-slate-950/50 backdrop-blur-xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
        <div className="mb-3 sm:mb-4">
          <div className="text-xs font-semibold text-cyan-200 uppercase tracking-wider">Task overview</div>
          <div className="text-sm text-slate-300 mt-1">A quick snapshot of what needs attention right now.</div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3.5">
            <div className="text-2xl font-bold text-cyan-200">{openTasksCount}</div>
            <div className="text-xs text-cyan-100/90 mt-1">Open tasks</div>
          </div>
          <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3.5">
            <div className="text-2xl font-bold text-amber-200">{dueTodayCount}</div>
            <div className="text-xs text-amber-100/90 mt-1">Due today</div>
          </div>
          <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3.5">
            <div className="text-2xl font-bold text-rose-200">{overdueCount}</div>
            <div className="text-xs text-rose-100/90 mt-1">Overdue</div>
          </div>
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3.5">
            <div className="text-2xl font-bold text-emerald-200">{completedTasksCount}</div>
            <div className="text-xs text-emerald-100/90 mt-1">Completed</div>
          </div>
          <div className="rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-3.5 col-span-2 lg:col-span-1">
            <div className="text-2xl font-bold text-violet-200">{upcomingWeekItems}</div>
            <div className="text-xs text-violet-100/90 mt-1">Next 7 days</div>
          </div>
        </div>
      </div>

      {/* Upcoming week */}
      <div className="mb-5 sm:mb-7 rounded-3xl border border-cyan-400/20 bg-slate-950/50 backdrop-blur-xl p-6 sm:p-7 shadow-[0_22px_50px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-semibold text-cyan-200 uppercase tracking-wider">Upcoming week</div>
            <div className="text-sm text-slate-300">Deadlines and follow-ups from your calendar</div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.assign('/calendar')}
            className="bg-white/5 text-white hover:bg-white/10 border-white/10"
          >
            Open calendar
          </Button>
        </div>

        {agendaLoading ? (
          <div className="text-xs text-slate-400">Loading upcoming items…</div>
        ) : agenda.length === 0 ? (
          <div className="text-xs text-slate-400">You’re clear for the next 7 days.</div>
        ) : (
          <div className="space-y-3">
            {agenda.slice(0, 4).map((day) => (
              <div key={day.date} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-200">
                    {new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <button
                    onClick={() => window.location.assign(`/calendar?date=${day.date}`)}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-slate-200 hover:bg-white/10"
                  >
                    Open day
                  </button>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-300">
                  {day.events.slice(0, 2).map((evt) => (
                    <div key={evt.id} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                      <span className="truncate">{evt.title}</span>
                    </div>
                  ))}
                  {day.tasks.slice(0, 2).map((task) => (
                    <div key={task.id} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="mb-5 sm:mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <nav className="flex gap-4 sm:gap-6 text-xs font-semibold text-slate-300 border-b border-white/10 pb-3 overflow-x-auto">
          {(['OPEN', 'COMPLETED', 'ALL'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`relative pb-3 transition whitespace-nowrap min-w-fit ${
                filter === f ? 'text-white' : 'hover:text-slate-200 active:text-slate-100'
              }`}
            >
              {f === 'ALL' ? 'All Tasks' : f === 'OPEN' ? 'Open' : 'Completed'}
              {filter === f && (
                <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-blue-500" />
              )}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks…"
            className="hidden sm:block px-3 py-2 sm:py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
          <button
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-medium transition-all ${
              autoRefreshEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                : 'bg-white/5 text-slate-400 border border-white/10 active:bg-white/15 sm:hover:bg-white/10 sm:hover:border-cyan-400/30'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">{autoRefreshEnabled ? 'Auto-refresh ON' : 'Auto-refresh OFF'}</span>
            <span className="sm:hidden">{autoRefreshEnabled ? 'Auto' : 'Manual'}</span>
          </button>
        </div>
      </div>

      <div className="mb-5 sm:mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setQuickFilter('ALL')}
          className={`px-3 py-2 rounded-full text-xs font-semibold border ${
            quickFilter === 'ALL' ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200' : 'bg-white/5 border-white/10 text-slate-300'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setQuickFilter('DUE_TODAY')}
          className={`px-3 py-2 rounded-full text-xs font-semibold border ${
            quickFilter === 'DUE_TODAY' ? 'bg-amber-500/20 border-amber-400/40 text-amber-200' : 'bg-white/5 border-white/10 text-slate-300'
          }`}
        >
          Due today
        </button>
        <button
          onClick={() => setQuickFilter('OVERDUE')}
          className={`px-3 py-2 rounded-full text-xs font-semibold border ${
            quickFilter === 'OVERDUE' ? 'bg-rose-500/20 border-rose-400/40 text-rose-200' : 'bg-white/5 border-white/10 text-slate-300'
          }`}
        >
          Overdue
        </button>
      </div>

      <div className="mb-5 sm:mb-7 space-y-5 sm:space-y-6">
        {/* Client Status Dashboard */}
        <ClientStatusDashboard />

        {/* Marketing Activity Tracker */}
        <MarketingActivityTracker />
      </div>

      {/* Empty State / Board */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading tasks...</div>
      ) : hasNoTasks ? (
        <section>
          <div className="bg-slate-950/60 backdrop-blur-xl border-dashed border-2 border-white/14 rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.9)] p-12">
            <div className="text-center">
              <ClipboardList className="mx-auto mb-4 h-10 w-10 text-blue-300" />
              <h3 className="text-xl font-bold text-white mb-2">No tasks yet</h3>
              <p className="text-slate-400 mb-6">Start by adding a task or launching a listing blast — we'll keep your follow-ups here.</p>
              <button
                type="button"
                onClick={() => setShowNewTaskModal(true)}
                className="inline-flex items-center rounded-full bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/40 hover:bg-blue-500 transition-colors"
              >
                Add first task
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section>
          <div className="rounded-3xl border border-white/14 bg-slate-950/60 backdrop-blur-xl shadow-[0_22px_60px_rgba(0,0,0,0.85)] overflow-hidden">
            {/* Desktop: Horizontal Kanban */}
            <div className="px-6 py-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-300">
                  Organize tasks by when you plan to work them. Drag cards between columns as things move.
                </p>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                <TaskColumn
                  bucket="TODAY"
                  title="Today"
                  subtitle="Do now"
                  tasks={tasksByBucket.TODAY}
                  onMarkDone={handleMarkDone}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onOpenTask={handleOpenTask}
                />
                <TaskColumn
                  bucket="THIS_WEEK"
                  title="This Week"
                  subtitle="Coming up"
                  tasks={tasksByBucket.THIS_WEEK}
                  onMarkDone={handleMarkDone}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onOpenTask={handleOpenTask}
                />
                <TaskColumn
                  bucket="LATER"
                  title="Later"
                  subtitle="Backlog"
                  tasks={tasksByBucket.LATER}
                  onMarkDone={handleMarkDone}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onOpenTask={handleOpenTask}
                />
                <TaskColumn
                  bucket="DONE"
                  title="Done"
                  subtitle="Completed"
                  tasks={tasksByBucket.DONE}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onOpenTask={handleOpenTask}
                />
              </div>
            </div>
          </div>
        </section>
      )}

        </>
      )}

      {/* New Task Modal */}
      {showNewTaskModal && (
        <NewTaskModal
          onClose={() => setShowNewTaskModal(false)}
          onComplete={() => {
            fetchTasks();
          }}
        />
      )}

      {activeTask && (
        <TaskEditModal
          task={activeTask}
          onClose={() => setActiveTask(null)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}
      </div>
    </PageLayout>
  );
}
