import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ClientStage =
  | 'NEW_LEAD'
  | 'NURTURE'
  | 'ACTIVE'
  | 'UNDER_CONTRACT'
  | 'CLOSED'
  | 'PAST_CLIENT'
  | 'DEAD';

type MenuItem =
  | { type: 'item'; label: string; onClick: () => void; destructive?: boolean; disabled?: boolean }
  | { type: 'divider' };

export function ClientActionsMenu({
  clientName,
  currentStage,
  onOpen,
  onStartDeal,
  onAddToDeal,
  onMerge,
  onAddTask,
  onAddToMarketing,
  onEdit,
  onMoveStage,
  onArchive,
  onDelete,
}: {
  clientName?: string;
  currentStage?: string;
  onOpen: () => void | Promise<void>;
  onStartDeal?: () => void | Promise<void>;
  onAddToDeal?: () => void | Promise<void>;
  onMerge?: () => void | Promise<void>;
  onAddTask?: () => void | Promise<void>;
  onAddToMarketing?: () => void | Promise<void>;
  onEdit: () => void | Promise<void>;
  onMoveStage: (stage: ClientStage) => void | Promise<void>;
  onArchive: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inButton = Boolean(wrapperRef.current?.contains(target));
      const inMenu = Boolean(menuRef.current?.contains(target));
      if (!inButton && !inMenu) setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setMenuPos(null);
      return;
    }
    const margin = 8;

    const compute = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportW = document.documentElement.clientWidth;
      const viewportH = document.documentElement.clientHeight;

      const measuredWidth = menuRef.current?.offsetWidth || 256;
      const measuredHeight = menuRef.current?.offsetHeight || 320;

      const leftIdeal = rect.right - measuredWidth;
      const left = Math.max(margin, Math.min(leftIdeal, viewportW - measuredWidth - margin));

      const spaceBelow = viewportH - rect.bottom;
      const spaceAbove = rect.top;

      const preferUp = spaceBelow < Math.min(measuredHeight + 16, viewportH * 0.4) && spaceAbove > spaceBelow;

      let top = rect.bottom + 8;
      if (preferUp) {
        top = rect.top - 8 - measuredHeight;
      }

      top = Math.max(margin, Math.min(top, viewportH - measuredHeight - margin));
      setMenuPos({ top, left, width: measuredWidth });
    };

    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    const raf = window.requestAnimationFrame(compute);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
      window.cancelAnimationFrame(raf);
    };
  }, [isOpen]);

  const run = async (key: string, fn: () => void | Promise<void>) => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      await fn();
      setIsOpen(false);
    } finally {
      setBusyKey(null);
    }
  };

  const stages: Array<{ value: ClientStage; label: string }> = useMemo(
    () => [
      { value: 'NEW_LEAD', label: 'New Lead' },
      { value: 'NURTURE', label: 'Nurture' },
      { value: 'ACTIVE', label: 'Active' },
      { value: 'UNDER_CONTRACT', label: 'Under Contract' },
      { value: 'CLOSED', label: 'Closed' },
      { value: 'PAST_CLIENT', label: 'Past Client (Follow-up)' },
      { value: 'DEAD', label: 'Dead' },
    ],
    [],
  );

  const items: MenuItem[] = useMemo(() => {
    const keyForStage = (s: string) => `stage:${s}`;
    return [
      { type: 'item', label: 'Open client', onClick: () => run('open', onOpen), disabled: busyKey !== null },
      ...(onStartDeal
        ? ([
            {
              type: 'item' as const,
              label: 'Start deal',
              onClick: () => run('start-deal', onStartDeal),
              disabled: busyKey !== null,
            },
          ] as MenuItem[])
        : []),
      ...(onAddTask
        ? ([
            {
              type: 'item' as const,
              label: 'Add task',
              onClick: () => run('add-task', onAddTask),
              disabled: busyKey !== null,
            },
          ] as MenuItem[])
        : []),
      ...(onAddToMarketing
        ? ([
            {
              type: 'item' as const,
              label: 'Add to marketing campaign',
              onClick: () => run('add-to-marketing', onAddToMarketing),
              disabled: busyKey !== null,
            },
          ] as MenuItem[])
        : []),
      ...(onAddToDeal
        ? ([
            {
              type: 'item' as const,
              label: 'Add to deal',
              onClick: () => run('add-to-deal', onAddToDeal),
              disabled: busyKey !== null,
            },
          ] as MenuItem[])
        : []),
      ...(onMerge
        ? ([
            {
              type: 'item' as const,
              label: 'Merge client',
              onClick: () => run('merge', onMerge),
              disabled: busyKey !== null,
            },
          ] as MenuItem[])
        : []),
      { type: 'item', label: 'Edit', onClick: () => run('edit', onEdit), disabled: busyKey !== null },
      { type: 'divider' },
      ...stages.map((s) => ({
        type: 'item' as const,
        label: `Move to: ${s.label}`,
        onClick: () => run(keyForStage(s.value), () => onMoveStage(s.value)),
        disabled: busyKey !== null || currentStage === s.value,
      })),
      { type: 'divider' },
      {
        type: 'item',
        label: 'Archive (Past Client / Follow-up)',
        onClick: () => run('archive', onArchive),
        disabled: busyKey !== null || currentStage === 'PAST_CLIENT',
      },
      {
        type: 'item',
        label: 'Delete',
        onClick: () => run('delete', async () => {
          const label = clientName ? `\"${clientName}\"` : 'this client';
          const ok = window.confirm(`Delete ${label}? This cannot be undone.`);
          if (!ok) return;
          await onDelete();
        }),
        destructive: true,
        disabled: busyKey !== null,
      },
    ];
  }, [busyKey, clientName, currentStage, onAddToMarketing, onArchive, onDelete, onEdit, onMoveStage, onOpen, stages]);

  return (
    <div ref={wrapperRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Client actions"
        ref={buttonRef}
        onClick={() => setIsOpen((v) => !v)}
        className="text-slate-500 hover:text-white p-1 rounded hover:bg-white/10 disabled:opacity-60"
        disabled={busyKey !== null}
      >
        ⋯
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={
              menuPos
                ? { position: 'fixed', top: menuPos.top, left: menuPos.left, width: menuPos.width }
                : { position: 'fixed', top: 0, left: 0 }
            }
            className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[9999]"
          >
            <div className="py-2 max-h-[70vh] overflow-y-auto overflow-x-hidden">
              {items.map((item, index) => {
                if (item.type === 'divider') {
                  return <div key={`div-${index}`} className="my-2 border-t border-white/10" />;
                }
                return (
                  <button
                    key={`${item.label}-${index}`}
                    type="button"
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed ${
                      item.destructive
                        ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
