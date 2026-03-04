import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface AgendaDay {
  date: string;
  events: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    dealId: string;
    dealTitle: string;
    propertyAddress?: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    dealId: string | null;
    clientId: string | null;
    status: string;
  }>;
}

const eventTypeLabels: Record<string, string> = {
  SELLER_DISCLOSURE_DEADLINE: 'Seller Disclosure',
  DUE_DILIGENCE_DEADLINE: 'Due Diligence',
  FINANCING_DEADLINE: 'Financing',
  APPRAISAL_DEADLINE: 'Appraisal',
  SETTLEMENT_DEADLINE: 'Settlement',
  POSSESSION: 'Possession',
  OTHER: 'Other',
};

const eventTypeVariants: Record<string, 'info' | 'warning' | 'default' | 'success'> = {
  SELLER_DISCLOSURE_DEADLINE: 'info',
  DUE_DILIGENCE_DEADLINE: 'warning',
  FINANCING_DEADLINE: 'default',
  APPRAISAL_DEADLINE: 'default',
  SETTLEMENT_DEADLINE: 'success',
  POSSESSION: 'success',
  OTHER: 'default',
};

export function TodayAgenda() {
  const [agenda, setAgenda] = useState<AgendaDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchAgenda();
  }, []);

  const fetchAgenda = async () => {
    try {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      const from = today.toISOString().split('T')[0];
      const to = nextWeek.toISOString().split('T')[0];

      const res = await api.get(`/calendar/agenda?from=${from}&to=${to}`);
      setAgenda(res.data.days || []);
    } catch (error) {
      console.error('Error fetching agenda:', error);
    } finally {
      setLoading(false);
    }
  };

  const markTaskDone = async (taskId: string) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: 'DONE' });
      await fetchAgenda();
    } catch (error) {
      console.error('Error marking task done:', error);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await api.post('/tasks', { title: newTaskTitle, dueAt: new Date().toISOString() });
      setNewTaskTitle('');
      await fetchAgenda();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-slate-200 rounded animate-spin"></div>
          <div className="text-sm text-slate-400">Loading this week's deadlines and tasks...</div>
        </div>
      </Card>
    );
  }

  if (agenda.length === 0) {
    return (
      <Card tone="subtle" className="bg-emerald-500/10 border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-white">This week</h3>
              <Badge variant="success" className="rounded-full">All clear</Badge>
            </div>
            <p className="text-sm text-slate-400">No upcoming deadlines or tasks – you're all caught up!</p>
          </div>
        </div>
      </Card>
    );
  }

  const totalItems = agenda.reduce((acc, day) => acc + day.events.length + day.tasks.length, 0);

  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-[0_15px_35px_rgba(14,165,233,0.35)]">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">This Week</h3>
            <p className="text-sm text-slate-400 font-medium">Your upcoming deadlines and tasks</p>
          </div>
        </div>
        <Badge variant="default" className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-white border-white/10">
          {totalItems} {totalItems === 1 ? 'item' : 'items'}
        </Badge>
      </div>

      <form onSubmit={createTask} className="mb-8">
        <div className="relative group">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add a quick task for today..."
            className="w-full pl-5 pr-12 py-3.5 rounded-full bg-white/10 border border-white/15 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/25 transition-all text-sm font-medium text-white placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          />
          <button
            type="submit"
            disabled={!newTaskTitle.trim()}
            className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-md hover:shadow-lg hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </form>

      <div className="space-y-6">
        {agenda.map((day) => {
          const dayDate = new Date(day.date);
          const isToday = dayDate.toDateString() === new Date().toDateString();
          const isTomorrow = dayDate.toDateString() === new Date(Date.now() + 86400000).toDateString();

          return (
            <div key={day.date} className="space-y-3">
              <div className="flex items-center gap-3 px-1">
                <div className={`text-sm font-bold uppercase tracking-wider ${isToday ? 'text-blue-400' : 'text-slate-500'}`}>
                  {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                {isToday && (
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                )}
                <div className="h-px flex-1 bg-white/10"></div>
              </div>

              {/* Events */}
              {day.events.map((event) => (
                <div
                  key={event.id}
                  onClick={() => navigate(`/dashboard`)}
                  className="group relative overflow-hidden p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-blue-400/40 hover:bg-white/10 hover:shadow-[0_20px_50px_rgba(2,6,23,0.65)] hover:-translate-y-1 transition-all cursor-pointer"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex items-start justify-between gap-3 pl-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={eventTypeVariants[event.type]} className="rounded-md text-[10px] py-0.5">
                          {eventTypeLabels[event.type] || event.type}
                        </Badge>
                      </div>
                      <div className="text-sm font-bold text-white line-clamp-2 mb-1 group-hover:text-blue-300 transition-colors">
                        {event.title}
                      </div>
                      {event.propertyAddress && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {event.propertyAddress}
                        </div>
                      )}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                      <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}

              {/* Tasks */}
              {day.tasks.map((task) => (
                <div
                  key={task.id}
                  className="group p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-blue-400/30 hover:shadow-[0_20px_45px_rgba(2,6,23,0.55)] transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Task</span>
                      </div>
                      <div className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors mb-1">
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {task.description}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => markTaskDone(task.id)}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-bold text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
