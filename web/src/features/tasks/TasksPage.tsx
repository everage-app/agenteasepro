import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { TaskColumn } from './TaskColumn';
import { TaskListItem, TaskBucket } from './TaskCard';
import { NewTaskModal } from './NewTaskModal';
import { PageLayout } from '../../components/layout/PageLayout';
import { PageBeam } from '../../components/layout/PageBeam';
import ClientStatusDashboard from './ClientStatusDashboard';
import MarketingActivityTracker from './MarketingActivityTracker';

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

  return (
    <PageLayout
      title="Tasks"
      subtitle="Your mission control board for follow-ups, deadlines, and reminders."
      actions={
        <Button
          onClick={() => setShowNewTaskModal(true)}
          className="inline-flex items-center rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-400 px-3 sm:px-4 py-2 text-sm font-medium text-white transition-colors shadow-lg shadow-cyan-500/30"
        >
          <svg className="w-4 h-4 sm:mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">New Task</span>
        </Button>
      }
    >
      <div className="relative ae-content">
      <PageBeam variant="cyan" />



      <div className="mb-4 sm:mb-6 rounded-3xl border border-white/10 bg-slate-950/50 backdrop-blur-xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-cyan-200 uppercase tracking-wider">Task guidance</div>
            <div className="text-sm text-slate-300 mt-1">Work top-down: overdue first, due today second, then this week planning.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowNewTaskModal(true)} className="bg-white/5 text-white hover:bg-white/10 border-white/10">
              Add task
            </Button>
            <Button size="sm" variant="secondary" onClick={() => window.location.assign('/calendar')} className="bg-white/5 text-white hover:bg-white/10 border-white/10">
              Open calendar
            </Button>
          </div>
        </div>
      </div>

      {/* Upcoming week */}
      <div className="mb-4 sm:mb-6 rounded-3xl border border-cyan-400/20 bg-slate-950/50 backdrop-blur-xl p-5 shadow-[0_22px_50px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between mb-3">
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
              <div key={day.date} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-200">
                    {new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <button
                    onClick={() => window.location.assign(`/calendar?date=${day.date}`)}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10"
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
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setQuickFilter('ALL')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
            quickFilter === 'ALL' ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200' : 'bg-white/5 border-white/10 text-slate-300'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setQuickFilter('DUE_TODAY')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
            quickFilter === 'DUE_TODAY' ? 'bg-amber-500/20 border-amber-400/40 text-amber-200' : 'bg-white/5 border-white/10 text-slate-300'
          }`}
        >
          Due today
        </button>
        <button
          onClick={() => setQuickFilter('OVERDUE')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
            quickFilter === 'OVERDUE' ? 'bg-rose-500/20 border-rose-400/40 text-rose-200' : 'bg-white/5 border-white/10 text-slate-300'
          }`}
        >
          Overdue
        </button>
      </div>

      {/* Client Status Dashboard */}
      <ClientStatusDashboard />

      {/* Marketing Activity Tracker */}
      <MarketingActivityTracker />

      {/* Empty State / Board */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading tasks...</div>
      ) : hasNoTasks ? (
        <section>
          <div className="bg-slate-950/60 backdrop-blur-xl border-dashed border-2 border-white/14 rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.9)] p-12">
            <div className="text-center">
              <div className="text-5xl mb-4">📝</div>
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
            <div className="px-6 py-6">
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
                />
              </div>
            </div>
          </div>
        </section>
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
      </div>
    </PageLayout>
  );
}
