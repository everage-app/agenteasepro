import { TaskCard, TaskListItem, TaskBucket } from './TaskCard';

interface TaskColumnProps {
  bucket: TaskBucket;
  title: string;
  subtitle: string;
  tasks: TaskListItem[];
  onMarkDone?: (taskId: string) => void;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, targetBucket: TaskBucket) => void;
}

export function TaskColumn({
  bucket,
  title,
  subtitle,
  tasks,
  onMarkDone,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: TaskColumnProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (onDragOver) {
      onDragOver(e);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (onDrop) {
      onDrop(e, bucket);
    }
  };

  return (
    <div
      className="flex w-full md:w-[280px] lg:w-[320px] flex-shrink-0 flex-col rounded-2xl md:rounded-[28px] border border-white/8 bg-slate-900/85 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.65)]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-3 md:px-4 pt-3 pb-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-bold">
            {title}
          </p>
          <p className="text-[11px] text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-100">
          {tasks.length}
        </span>
      </header>

      {/* Task list */}
      <div className="flex-1 space-y-2 px-2 md:px-3 pb-3 pt-1 overflow-y-auto max-h-[calc(100vh-400px)] md:max-h-[calc(100vh-300px)]">
        {tasks.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/5 px-3 py-4 text-center text-[11px] text-slate-400">
            No tasks in this bucket.
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              bucket={bucket}
              onMarkDone={onMarkDone}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </div>
  );
}
