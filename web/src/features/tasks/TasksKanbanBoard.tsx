import { useState, useRef } from 'react';
import { TaskCard, TaskListItem, TaskBucket } from './TaskCard';
import api from '../../lib/api';

interface TasksKanbanBoardProps {
  tasks: TaskListItem[];
  onMarkDone: (taskId: string) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, targetBucket: TaskBucket) => void;
  draggedTaskId: string | null;
  onTaskCreated?: () => void;
  onOpenTask?: (task: TaskListItem) => void;
}

const columnIcons: Record<TaskBucket, React.ReactNode> = {
  TODAY: (
    <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  THIS_WEEK: (
    <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  LATER: (
    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  DONE: (
    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const emptyHints: Record<TaskBucket, string> = {
  TODAY: 'Add urgent follow-ups, showings, or calls due today',
  THIS_WEEK: 'Plan listing prep, inspections, or client check-ins',
  LATER: 'Queue up long-term items like market reports or renewals',
  DONE: 'Completed tasks will appear here',
};

const columns: { bucket: TaskBucket; title: string; color: string; glow: string }[] = [
  { bucket: 'TODAY',     title: 'Today',     color: 'border-amber-500/50 bg-amber-100/65 dark:border-amber-400/35 dark:bg-amber-500/10',    glow: 'shadow-amber-500/20' },
  { bucket: 'THIS_WEEK', title: 'This Week', color: 'border-cyan-500/50 bg-cyan-100/65 dark:border-cyan-400/35 dark:bg-cyan-500/10',      glow: 'shadow-cyan-500/20' },
  { bucket: 'LATER',     title: 'Later',     color: 'border-slate-500/40 bg-slate-100/70 dark:border-slate-400/30 dark:bg-slate-500/10',    glow: 'shadow-slate-500/15' },
  { bucket: 'DONE',      title: 'Done',      color: 'border-emerald-500/45 bg-emerald-100/65 dark:border-emerald-400/30 dark:bg-emerald-500/10', glow: 'shadow-emerald-500/15' },
];

export function TasksKanbanBoard({
  tasks,
  onMarkDone,
  onDragStart,
  onDragEnd,
  onDrop,
  draggedTaskId,
  onTaskCreated,
  onOpenTask,
}: TasksKanbanBoardProps) {
  const [dragOverBucket, setDragOverBucket] = useState<TaskBucket | null>(null);
  const [quickAddBucket, setQuickAddBucket] = useState<TaskBucket | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const quickAddRef = useRef<HTMLInputElement>(null);

  const handleQuickAdd = async (bucket: TaskBucket) => {
    const title = quickAddTitle.trim();
    if (!title || quickAddLoading) return;
    setQuickAddLoading(true);
    try {
      await api.post('/tasks', { title, bucket, priority: 'NORMAL' });
      setQuickAddTitle('');
      setQuickAddBucket(null);
      onTaskCreated?.();
    } catch (err) {
      console.error('Failed to quick-add task', err);
    } finally {
      setQuickAddLoading(false);
    }
  };

  const tasksByBucket: Record<TaskBucket, TaskListItem[]> = {
    TODAY: tasks.filter((t) => t.bucket === 'TODAY'),
    THIS_WEEK: tasks.filter((t) => t.bucket === 'THIS_WEEK'),
    LATER: tasks.filter((t) => t.bucket === 'LATER'),
    DONE: tasks.filter((t) => t.bucket === 'DONE'),
  };

  const handleDragOver = (e: React.DragEvent, bucket: TaskBucket) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverBucket !== bucket) setDragOverBucket(bucket);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the column (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverBucket(null);
    }
  };

  const handleDrop = (e: React.DragEvent, bucket: TaskBucket) => {
    e.preventDefault();
    setDragOverBucket(null);
    onDrop(e, bucket);
  };

  const handleDragEndWrapped = () => {
    setDragOverBucket(null);
    onDragEnd();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
      {columns.map((col) => {
        const colTasks = tasksByBucket[col.bucket];
        const isDragOver = dragOverBucket === col.bucket;

        return (
          <div
            key={col.bucket}
            onDragOver={(e) => handleDragOver(e, col.bucket)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.bucket)}
            className={`
              flex flex-col rounded-2xl border backdrop-blur-xl transition-all duration-200
              ${col.color} ${col.glow}
              ${isDragOver
                ? 'ring-2 ring-cyan-400/60 border-cyan-400/50 scale-[1.01] shadow-[0_20px_50px_rgba(34,211,238,0.15)]'
                : 'shadow-[0_12px_35px_rgba(0,0,0,0.5)]'
              }
            `}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                {columnIcons[col.bucket]}
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">{col.title}</h3>
              </div>
              <div className="flex items-center gap-1.5">
                {col.bucket !== 'DONE' && (
                  <button
                    onClick={() => {
                      setQuickAddBucket(quickAddBucket === col.bucket ? null : col.bucket);
                      setTimeout(() => quickAddRef.current?.focus(), 50);
                    }}
                    className="p-1 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white/40 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/15 transition-all"
                    title={`Quick add to ${col.title}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                )}
                <span className={`
                  rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums
                  ${colTasks.length > 0 ? 'bg-slate-900/85 dark:bg-white/20 text-white' : 'bg-white/80 dark:bg-white/10 text-slate-700 dark:text-slate-300'}
                `}>
                  {colTasks.length}
                </span>
              </div>
            </div>

            {/* Quick-add inline input */}
            {quickAddBucket === col.bucket && (
              <div className="px-2.5 pb-1">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleQuickAdd(col.bucket); }}
                  className="flex items-center gap-1.5 rounded-xl border border-cyan-500/50 dark:border-cyan-400/35 bg-cyan-100/75 dark:bg-cyan-500/10 px-2.5 py-2"
                >
                  <input
                    ref={quickAddRef}
                    value={quickAddTitle}
                    onChange={(e) => setQuickAddTitle(e.target.value)}
                    placeholder="Task name…"
                    className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-600 dark:placeholder-slate-400 focus:outline-none"
                    disabled={quickAddLoading}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setQuickAddBucket(null); setQuickAddTitle(''); } }}
                  />
                  <button
                    type="submit"
                    disabled={!quickAddTitle.trim() || quickAddLoading}
                    className="rounded-lg bg-cyan-700 dark:bg-cyan-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-cyan-600 dark:hover:bg-cyan-500 disabled:opacity-40 transition-colors"
                  >
                    {quickAddLoading ? '…' : 'Add'}
                  </button>
                </form>
              </div>
            )}

            {/* Drop zone */}
            <div className="flex-1 px-2.5 pb-3 pt-1 space-y-2 overflow-y-auto min-h-[180px] max-h-[calc(100vh-320px)]">
              {colTasks.length === 0 ? (
                <div className={`
                  flex flex-col items-center justify-center rounded-xl border border-dashed py-8 px-4 transition-colors
                  ${isDragOver ? 'border-cyan-500/60 dark:border-cyan-400/45 bg-cyan-100/70 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-200' : 'border-slate-400/45 dark:border-white/15 bg-white/35 dark:bg-transparent text-slate-700 dark:text-slate-300'}
                `}>
                  {isDragOver ? (
                    <span className="text-xs font-semibold">Drop here</span>
                  ) : (
                    <>
                      <svg className="w-6 h-6 text-slate-600 dark:text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="text-[11px] text-center leading-relaxed text-slate-700 dark:text-slate-300">{emptyHints[col.bucket]}</span>
                    </>
                  )}
                </div>
              ) : (
                colTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`transition-opacity duration-150 ${
                      draggedTaskId === task.id ? 'opacity-40' : 'opacity-100'
                    }`}
                  >
                    <TaskCard
                      task={task}
                      bucket={col.bucket}
                      onMarkDone={col.bucket !== 'DONE' ? onMarkDone : undefined}
                      onDragStart={onDragStart}
                      onDragEnd={handleDragEndWrapped}
                      onOpenTask={onOpenTask}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
