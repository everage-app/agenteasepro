import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  GripVertical,
  Home,
  LayoutDashboard,
  Megaphone,
  PanelTop,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Target,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import api from '../../lib/api';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { PageLayout } from '../../components/layout/PageLayout';
import { useAuthStore } from '../auth/authStore';
import type { Lead, LeadAnalytics, LandingPage } from '../../types/leads';
import { WinTheDayWidget } from './WinTheDayWidget';

type DashboardOverview = {
  deals?: {
    activeDeals?: number;
    underContract?: number;
    closedThisMonth?: number;
  };
  appointments?: {
    upcoming?: number;
  };
};

type DashboardDeal = {
  id: string;
  title: string;
  status: string;
  price?: number;
  closingDate?: string;
  updatedAt?: string;
};

type DashboardTask = {
  id: string;
  title: string;
  dueAt?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
};

type DashboardClient = {
  id: string;
  name: string;
  email?: string;
  stage?: string;
  temperature?: 'HOT' | 'WARM' | 'COLD' | null;
  openTasksCount?: number;
  nextDeadline?: string | null;
  lastContactAt?: string | null;
  primaryProperty?: string;
};

type ClientStats = {
  totalClients?: number;
  activeOrUnderContract?: number;
  openTaskClients?: number;
  upcomingDeadlineClients?: number;
};

type DashboardBlast = {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  sentAt?: string | null;
  scheduledAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

type DashboardWidgetId =
  | 'quickActions'
  | 'scorecard'
  | 'activeDeals'
  | 'todayTasks'
  | 'winTheDay'
  | 'pipelinePulse'
  | 'leadEngine'
  | 'clientFocus'
  | 'marketingLaunchpad';

type DashboardWidgetSize = 'compact' | 'wide' | 'full';

type DashboardLayoutItem = {
  id: DashboardWidgetId;
  visible: boolean;
  size: DashboardWidgetSize;
};

type DashboardWidgetMeta = {
  id: DashboardWidgetId;
  title: string;
  shortTitle: string;
  icon: LucideIcon;
};

const ACTIVE_STATUSES = new Set([
  'LEAD',
  'ACTIVE',
  'OFFER_SENT',
  'UNDER_CONTRACT',
  'DUE_DILIGENCE',
  'FINANCING',
  'SETTLEMENT_SCHEDULED',
]);

const CONTRACT_STATUSES = new Set(['UNDER_CONTRACT', 'DUE_DILIGENCE', 'FINANCING', 'SETTLEMENT_SCHEDULED']);

const STATUS_LABELS: Record<string, string> = {
  LEAD: 'Lead',
  ACTIVE: 'Active',
  OFFER_SENT: 'Offer sent',
  UNDER_CONTRACT: 'Under contract',
  DUE_DILIGENCE: 'Due diligence',
  FINANCING: 'Financing',
  SETTLEMENT_SCHEDULED: 'Settlement',
};

const DASHBOARD_LAYOUT_VERSION = 2;
const DASHBOARD_WIDGET_IDS: DashboardWidgetId[] = [
  'quickActions',
  'scorecard',
  'activeDeals',
  'todayTasks',
  'winTheDay',
  'pipelinePulse',
  'leadEngine',
  'clientFocus',
  'marketingLaunchpad',
];

const DEFAULT_DASHBOARD_LAYOUT: DashboardLayoutItem[] = [
  { id: 'quickActions', visible: true, size: 'full' },
  { id: 'scorecard', visible: true, size: 'full' },
  { id: 'activeDeals', visible: true, size: 'wide' },
  { id: 'todayTasks', visible: true, size: 'compact' },
  { id: 'winTheDay', visible: true, size: 'wide' },
  { id: 'pipelinePulse', visible: true, size: 'compact' },
  { id: 'leadEngine', visible: true, size: 'compact' },
  { id: 'clientFocus', visible: true, size: 'wide' },
  { id: 'marketingLaunchpad', visible: true, size: 'compact' },
];

const WIDGET_META: Record<DashboardWidgetId, DashboardWidgetMeta> = {
  quickActions: { id: 'quickActions', title: 'Quick actions', shortTitle: 'Actions', icon: LayoutDashboard },
  scorecard: { id: 'scorecard', title: 'Business scorecard', shortTitle: 'Scorecard', icon: BarChart3 },
  activeDeals: { id: 'activeDeals', title: 'Active deals', shortTitle: 'Deals', icon: BriefcaseBusiness },
  todayTasks: { id: 'todayTasks', title: 'Today tasks', shortTitle: 'Tasks', icon: CheckCircle2 },
  winTheDay: { id: 'winTheDay', title: 'Win the day', shortTitle: 'Goals', icon: Target },
  pipelinePulse: { id: 'pipelinePulse', title: 'Pipeline pulse', shortTitle: 'Pipeline', icon: CalendarDays },
  leadEngine: { id: 'leadEngine', title: 'Lead engine', shortTitle: 'Leads', icon: Search },
  clientFocus: { id: 'clientFocus', title: 'Client focus', shortTitle: 'Clients', icon: Users },
  marketingLaunchpad: { id: 'marketingLaunchpad', title: 'Marketing launchpad', shortTitle: 'Marketing', icon: Megaphone },
};

const WIDGET_SIZE_CLASSES: Record<DashboardWidgetSize, string> = {
  compact: 'xl:col-span-4',
  wide: 'xl:col-span-8',
  full: 'xl:col-span-12',
};

const WIDGET_SIZE_LABELS: Record<DashboardWidgetSize, string> = {
  compact: 'Compact',
  wide: 'Wide',
  full: 'Full',
};

const WIDGET_SIZE_ORDER: DashboardWidgetSize[] = ['compact', 'wide', 'full'];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatMoney(value?: number) {
  if (!value || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value?: number) {
  if (value == null || Number.isNaN(Number(value))) return '0%';
  return `${Math.round(Number(value))}%`;
}

function formatShortDate(value?: string | null) {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No date';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStatusLabel(status: string) {
  return STATUS_LABELS[status] || formatEnumLabel(status);
}

function cleanDisplayText(value: unknown) {
  const text = String(value ?? '')
    .trim()
    .replace(/^(null|undefined)\s*[-:]\s*/i, '')
    .replace(/\s*[-:]\s*(null|undefined)$/i, '')
    .trim();
  if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return '';
  return text;
}

function joinDisplayParts(...values: unknown[]) {
  return values.map(cleanDisplayText).filter(Boolean).join(' ');
}

function getRawDealTitle(deal: any) {
  return cleanDisplayText(deal?.property?.street) || cleanDisplayText(deal?.title) || 'Untitled deal';
}

function getRawPersonName(person: any) {
  return joinDisplayParts(person?.firstName, person?.lastName);
}

function formatEnumLabel(value?: string | null) {
  if (!value) return 'Unknown';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function priorityRank(priority: DashboardTask['priority']) {
  if (priority === 'HIGH') return 0;
  if (priority === 'NORMAL') return 1;
  return 2;
}

function getDashboardStorageKey(agentId?: string | null) {
  return `aep_dashboard_layout_v${DASHBOARD_LAYOUT_VERSION}_${agentId || 'guest'}`;
}

function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === 'string' && DASHBOARD_WIDGET_IDS.includes(value as DashboardWidgetId);
}

function isDashboardWidgetSize(value: unknown): value is DashboardWidgetSize {
  return value === 'compact' || value === 'wide' || value === 'full';
}

function normalizeDashboardLayout(value: unknown): DashboardLayoutItem[] {
  const incoming = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { layout?: unknown }).layout)
      ? (value as { layout: unknown[] }).layout
      : [];

  const seen = new Set<DashboardWidgetId>();
  const normalized: DashboardLayoutItem[] = [];

  incoming.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const candidate = item as Partial<DashboardLayoutItem>;
    if (!isDashboardWidgetId(candidate.id) || seen.has(candidate.id)) return;
    const fallback = DEFAULT_DASHBOARD_LAYOUT.find((defaultItem) => defaultItem.id === candidate.id);
    normalized.push({
      id: candidate.id,
      visible: typeof candidate.visible === 'boolean' ? candidate.visible : fallback?.visible ?? true,
      size: isDashboardWidgetSize(candidate.size) ? candidate.size : fallback?.size ?? 'wide',
    });
    seen.add(candidate.id);
  });

  DEFAULT_DASHBOARD_LAYOUT.forEach((item) => {
    if (!seen.has(item.id)) normalized.push(item);
  });

  return normalized;
}

function readDashboardLayout(storageKey: string) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return DEFAULT_DASHBOARD_LAYOUT;
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_DASHBOARD_LAYOUT;
    return normalizeDashboardLayout(JSON.parse(raw));
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT;
  }
}

function writeDashboardLayout(storageKey: string, layout: DashboardLayoutItem[]) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: DASHBOARD_LAYOUT_VERSION,
        savedAt: new Date().toISOString(),
        layout,
      }),
    );
  } catch {
    // Storage can fail in privacy-restricted contexts; the dashboard still works for the session.
  }
}

function reorderLayout(layout: DashboardLayoutItem[], sourceId: DashboardWidgetId, targetId: DashboardWidgetId) {
  if (sourceId === targetId) return layout;
  const sourceIndex = layout.findIndex((item) => item.id === sourceId);
  const targetIndex = layout.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return layout;
  const next = [...layout];
  const [source] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source);
  return next;
}

function getNextWidgetSize(size: DashboardWidgetSize) {
  const currentIndex = WIDGET_SIZE_ORDER.indexOf(size);
  return WIDGET_SIZE_ORDER[(currentIndex + 1) % WIDGET_SIZE_ORDER.length];
}

function getLeadName(lead: Lead) {
  return joinDisplayParts(lead.firstName, lead.lastName) || cleanDisplayText(lead.email) || 'New lead';
}

function DashboardCard({
  title,
  icon: Icon,
  action,
  className,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'ae-theme-card h-full rounded-2xl border p-4',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#d6b56d]/35 bg-[#fff8e8] text-[#7a5a24] dark:border-[#f2d894]/20 dark:bg-[#d6b56d]/10 dark:text-[#f2d894]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatusPill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'gold' | 'blue' | 'rose' | 'green' }) {
  const toneClass = {
    slate: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300',
    gold: 'border-[#d6b56d]/45 bg-[#fff8e8] text-[#7a5a24] dark:border-[#f2d894]/20 dark:bg-[#d6b56d]/10 dark:text-[#f2d894]',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300',
    rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  }[tone];

  return <span className={cn('rounded-full border px-2 py-1 text-[10px] font-bold uppercase', toneClass)}>{children}</span>;
}

function EmptyWidgetState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
      {label}
    </div>
  );
}

function WidgetChrome({
  item,
  visibleIndex,
  visibleCount,
  customizing,
  draggedWidgetId,
  dropTargetWidgetId,
  children,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
  onMove,
  onResize,
  onHide,
}: {
  item: DashboardLayoutItem;
  visibleIndex: number;
  visibleCount: number;
  customizing: boolean;
  draggedWidgetId: DashboardWidgetId | null;
  dropTargetWidgetId: DashboardWidgetId | null;
  children: ReactNode;
  onDragStart: (event: DragEvent<HTMLButtonElement>, id: DashboardWidgetId) => void;
  onDragOver: (id: DashboardWidgetId) => void;
  onDragLeave: (id: DashboardWidgetId) => void;
  onDragEnd: () => void;
  onDrop: (event: DragEvent<HTMLElement>, id: DashboardWidgetId) => void;
  onMove: (id: DashboardWidgetId, direction: -1 | 1) => void;
  onResize: (id: DashboardWidgetId) => void;
  onHide: (id: DashboardWidgetId) => void;
}) {
  const meta = WIDGET_META[item.id];
  const isDragging = draggedWidgetId === item.id;
  const isDropTarget = dropTargetWidgetId === item.id && draggedWidgetId !== item.id;

  return (
    <section
      onDragOver={(event) => {
        if (!customizing) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDragOver(item.id);
      }}
      onDragLeave={(event) => {
        if (!customizing) return;
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDragLeave(item.id);
      }}
      onDrop={(event) => onDrop(event, item.id)}
      className={cn(
        'min-w-0 transition-all duration-200',
        WIDGET_SIZE_CLASSES[item.size],
        customizing && 'rounded-[22px] p-1.5 ring-1 ring-slate-300/80 dark:ring-white/10',
        isDragging && 'scale-[0.99] opacity-55',
        isDropTarget && 'ring-2 ring-[#d6b56d] dark:ring-[#f2d894]',
      )}
    >
      {customizing && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, item.id)}
              onDragEnd={() => {
                onDragLeave(item.id);
                onDragEnd();
              }}
              className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm active:cursor-grabbing dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              title={`Drag ${meta.title}`}
              aria-label={`Drag ${meta.title}`}
              aria-grabbed={isDragging}
            >
              <GripVertical className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="truncate text-xs font-bold uppercase text-slate-600 dark:text-slate-400">{meta.shortTitle}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onMove(item.id, -1)}
              disabled={visibleIndex === 0}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-[#d6b56d] hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              title="Move up"
              aria-label={`Move ${meta.title} up`}
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onMove(item.id, 1)}
              disabled={visibleIndex === visibleCount - 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-[#d6b56d] hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              title="Move down"
              aria-label={`Move ${meta.title} down`}
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onResize(item.id)}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:border-[#d6b56d] hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              title="Change size"
            >
              {WIDGET_SIZE_LABELS[item.size]}
            </button>
            <button
              type="button"
              onClick={() => onHide(item.id)}
              disabled={visibleCount <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              title="Hide"
              aria-label={`Hide ${meta.title}`}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

function DashboardWidgetSettingsModal({
  open,
  layout,
  visibleCount,
  hiddenCount,
  agentEmail,
  draggedWidgetId,
  dropTargetWidgetId,
  onClose,
  onReset,
  onToggle,
  onResize,
  onMove,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
}: {
  open: boolean;
  layout: DashboardLayoutItem[];
  visibleCount: number;
  hiddenCount: number;
  agentEmail?: string | null;
  draggedWidgetId: DashboardWidgetId | null;
  dropTargetWidgetId: DashboardWidgetId | null;
  onClose: () => void;
  onReset: () => void;
  onToggle: (id: DashboardWidgetId, visible: boolean) => void;
  onResize: (id: DashboardWidgetId) => void;
  onMove: (id: DashboardWidgetId, direction: -1 | 1) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, id: DashboardWidgetId) => void;
  onDragOver: (id: DashboardWidgetId) => void;
  onDragLeave: (id: DashboardWidgetId) => void;
  onDragEnd: () => void;
  onDrop: (event: DragEvent<HTMLElement>, id: DashboardWidgetId) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/45 px-3 py-5 backdrop-blur-md sm:px-6 sm:py-8" role="dialog" aria-modal="true" aria-labelledby="dashboard-widget-settings-title">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-300/90 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.28),0_0_0_1px_rgba(214,181,109,0.14)_inset] dark:border-[#f2d894]/15 dark:bg-[#0b1220] dark:shadow-[0_34px_110px_rgba(0,0,0,0.72)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d6b56d]/45 bg-[#fff8e8] text-[#7a5a24] dark:border-[#f2d894]/20 dark:bg-[#d6b56d]/10 dark:text-[#f2d894]">
              <Settings2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="dashboard-widget-settings-title" className="text-base font-bold text-slate-950 dark:text-white">Dashboard widgets</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Saved for {agentEmail || 'this browser'}{hiddenCount > 0 ? ` - ${hiddenCount} hidden` : ''}
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Close dashboard widget settings" title="Close">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="grid gap-3 border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:grid-cols-3 sm:px-5">
          <div className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-white/5">
            <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Visible</div>
            <div className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{visibleCount}</div>
          </div>
          <div className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-white/5">
            <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Hidden</div>
            <div className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{hiddenCount}</div>
          </div>
          <div className="rounded-xl border border-[#d6b56d]/45 bg-[#fff8e8] px-3 py-3 dark:border-[#f2d894]/20 dark:bg-[#d6b56d]/10">
            <div className="text-[10px] font-bold uppercase text-[#7a5a24] dark:text-[#f2d894]">Layout</div>
            <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Drag rows to reorder</div>
          </div>
        </div>

        <div className="max-h-[58vh] space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
          {layout.map((item, index) => {
            const meta = WIDGET_META[item.id];
            const Icon = meta.icon;
            const isDragging = draggedWidgetId === item.id;
            const isDropTarget = dropTargetWidgetId === item.id && draggedWidgetId !== item.id;

            return (
              <section
                key={item.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  onDragOver(item.id);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDragLeave(item.id);
                }}
                onDrop={(event) => onDrop(event, item.id)}
                className={cn(
                  'rounded-xl border bg-white px-3 py-3 transition-all dark:bg-white/5',
                  item.visible ? 'border-slate-300 dark:border-white/10' : 'border-dashed border-slate-300 opacity-70 dark:border-white/10',
                  isDragging && 'scale-[0.99] opacity-50',
                  isDropTarget && 'border-[#d6b56d] ring-2 ring-[#d6b56d]/30 dark:border-[#f2d894] dark:ring-[#f2d894]/25',
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => onDragStart(event, item.id)}
                      onDragEnd={() => {
                        onDragLeave(item.id);
                        onDragEnd();
                      }}
                      className="inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm active:cursor-grabbing dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                      title={`Drag ${meta.title}`}
                      aria-label={`Drag ${meta.title}`}
                      aria-grabbed={isDragging}
                    >
                      <GripVertical className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#d6b56d]/35 bg-[#fff8e8] text-[#7a5a24] dark:border-[#f2d894]/20 dark:bg-[#d6b56d]/10 dark:text-[#f2d894]">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-950 dark:text-white">{meta.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.visible ? WIDGET_SIZE_LABELS[item.size] : 'Hidden'}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                    <Button type="button" variant="secondary" size="xs" iconOnly onClick={() => onMove(item.id, -1)} disabled={index === 0} aria-label={`Move ${meta.title} up`} title="Move up">
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="secondary" size="xs" iconOnly onClick={() => onMove(item.id, 1)} disabled={index === layout.length - 1} aria-label={`Move ${meta.title} down`} title="Move down">
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="outline" size="xs" onClick={() => onResize(item.id)}>
                      {WIDGET_SIZE_LABELS[item.size]}
                    </Button>
                    <Button
                      type="button"
                      variant={item.visible ? 'subtle' : 'secondary'}
                      size="xs"
                      onClick={() => onToggle(item.id, !item.visible)}
                      disabled={item.visible && visibleCount <= 1}
                    >
                      {item.visible ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                      {item.visible ? 'Shown' : 'Add'}
                    </Button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset default
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onClose}>
            <Check className="h-4 w-4" aria-hidden="true" />
            Save layout
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const agent = useAuthStore((state) => state.agent);
  const firstName = agent?.name?.split(' ')[0] || 'Agent';
  const dashboardStorageKey = useMemo(() => getDashboardStorageKey(agent?.id), [agent?.id]);
  const skipNextPersistRef = useRef(true);
  const draggedWidgetRef = useRef<DashboardWidgetId | null>(null);

  const [stats, setStats] = useState<DashboardOverview | null>(null);
  const [activeDeals, setActiveDeals] = useState<DashboardDeal[]>([]);
  const [todayTasks, setTodayTasks] = useState<DashboardTask[]>([]);
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [clientStats, setClientStats] = useState<ClientStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadAnalytics, setLeadAnalytics] = useState<LeadAnalytics | null>(null);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [marketingBlasts, setMarketingBlasts] = useState<DashboardBlast[]>([]);
  const [layout, setLayout] = useState<DashboardLayoutItem[]>(DEFAULT_DASHBOARD_LAYOUT);
  const [customizing, setCustomizing] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<DashboardWidgetId | null>(null);
  const [dropTargetWidgetId, setDropTargetWidgetId] = useState<DashboardWidgetId | null>(null);
  const [loading, setLoading] = useState(true);
  const greeting = getGreeting();

  useEffect(() => {
    skipNextPersistRef.current = true;
    setLayout(readDashboardLayout(dashboardStorageKey));
  }, [dashboardStorageKey]);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    writeDashboardLayout(dashboardStorageKey, layout);
  }, [dashboardStorageKey, layout]);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [overviewData, dealsData, tasksData, clientsData, clientStatsData, leadsData, leadAnalyticsData, pagesData, blastsData] =
          await Promise.all([
            api.get('/reporting/overview', { params: { timeRange: 'month' } }).then((response) => response.data).catch(() => null),
            api.get('/deals').then((response) => response.data).catch(() => []),
            api.get('/tasks', { params: { status: 'OPEN' } }).then((response) => response.data).catch(() => []),
            api.get('/clients').then((response) => response.data).catch(() => []),
            api.get('/clients/stats').then((response) => response.data).catch(() => null),
            api.get('/leads', { params: { archived: 'false' } }).then((response) => response.data).catch(() => []),
            api.get('/leads/analytics/summary', { params: { archived: 'false' } }).then((response) => response.data).catch(() => null),
            api.get('/landing-pages').then((response) => response.data).catch(() => []),
            api.get('/marketing/blasts').then((response) => response.data).catch(() => []),
          ]);

        if (!mounted) return;

        setStats((overviewData || null) as DashboardOverview | null);

        const mappedDeals = (Array.isArray(dealsData) ? dealsData : [])
          .filter((deal: any) => ACTIVE_STATUSES.has(String(deal.status || '').toUpperCase()))
          .map((deal: any) => ({
            id: String(deal.id),
            title: getRawDealTitle(deal),
            status: String(deal.status || 'ACTIVE').toUpperCase(),
            price: deal.repc?.purchasePrice != null ? Number(deal.repc.purchasePrice) : undefined,
            closingDate: deal.repc?.settlementDeadline || undefined,
            updatedAt: deal.updatedAt || deal.createdAt || undefined,
          }))
          .sort((left: DashboardDeal, right: DashboardDeal) => {
            const leftDate = new Date(left.updatedAt || left.closingDate || 0).getTime();
            const rightDate = new Date(right.updatedAt || right.closingDate || 0).getTime();
            return rightDate - leftDate;
          });

        setActiveDeals(mappedDeals);

        const todayKey = new Date().toDateString();
        const mappedTasks = (Array.isArray(tasksData) ? tasksData : [])
          .filter((task: any) => {
            if (String(task.status || '').toUpperCase() !== 'OPEN') return false;
            if (!task.dueAt) return false;
            return new Date(task.dueAt).toDateString() === todayKey;
          })
          .map((task: any) => ({
            id: String(task.id),
            title: cleanDisplayText(task.title) || 'Untitled task',
            dueAt: task.dueAt || undefined,
            priority: (String(task.priority || 'NORMAL').toUpperCase() as DashboardTask['priority']) || 'NORMAL',
          }))
          .sort((left: DashboardTask, right: DashboardTask) => {
            const priorityDiff = priorityRank(left.priority) - priorityRank(right.priority);
            if (priorityDiff !== 0) return priorityDiff;
            return new Date(left.dueAt || 0).getTime() - new Date(right.dueAt || 0).getTime();
          });

        setTodayTasks(mappedTasks);

        setClients(
          (Array.isArray(clientsData) ? clientsData : []).map((client: any) => ({
            id: String(client.id),
            name: cleanDisplayText(client.name) || getRawPersonName(client) || 'Client',
            email: cleanDisplayText(client.email) || undefined,
            stage: client.stage || undefined,
            temperature: client.temperature || null,
            openTasksCount: Number(client.openTasksCount || 0),
            nextDeadline: client.nextDeadline || null,
            lastContactAt: client.lastContactAt || null,
            primaryProperty: cleanDisplayText(client.primaryProperty) || undefined,
          })),
        );

        setClientStats((clientStatsData || null) as ClientStats | null);
        setLeads(Array.isArray(leadsData) ? (leadsData as Lead[]) : []);
        setLeadAnalytics((leadAnalyticsData || null) as LeadAnalytics | null);
        setLandingPages(Array.isArray(pagesData) ? (pagesData as LandingPage[]) : []);
        setMarketingBlasts(Array.isArray(blastsData) ? (blastsData as DashboardBlast[]) : []);
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleLayout = useMemo(() => layout.filter((item) => item.visible), [layout]);
  const hiddenCount = layout.length - visibleLayout.length;

  const hotLeads = leadAnalytics?.summary.hotLeads ?? leads.filter((lead) => lead.priority === 'HOT' && !lead.converted).length;
  const warmLeads = leadAnalytics?.summary.warmLeads ?? leads.filter((lead) => lead.priority === 'WARM' && !lead.converted).length;
  const convertedLeads = leadAnalytics?.summary.convertedLeads ?? leads.filter((lead) => lead.converted).length;
  const conversionRate = leadAnalytics?.summary.conversionRate ?? (leads.length ? (convertedLeads / leads.length) * 100 : 0);
  const totalClients = clientStats?.totalClients ?? clients.length;
  const openTaskClients = clientStats?.openTaskClients ?? clients.filter((client) => Number(client.openTasksCount || 0) > 0).length;
  const upcomingDeadlineClients = clientStats?.upcomingDeadlineClients ?? clients.filter((client) => Boolean(client.nextDeadline)).length;
  const underContractCount = stats?.deals?.underContract ?? activeDeals.filter((deal) => CONTRACT_STATUSES.has(deal.status)).length;
  const activeDealCount = stats?.deals?.activeDeals ?? activeDeals.length;
  const closedThisMonth = stats?.deals?.closedThisMonth ?? 0;

  const nextClosingDeal = useMemo(() => {
    return [...activeDeals]
      .filter((deal) => deal.closingDate && Number.isFinite(new Date(deal.closingDate).getTime()))
      .sort((left, right) => new Date(left.closingDate || 0).getTime() - new Date(right.closingDate || 0).getTime())[0];
  }, [activeDeals]);

  const recentLeads = useMemo(() => {
    return [...leads]
      .filter((lead) => !lead.converted)
      .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime())
      .slice(0, 4);
  }, [leads]);

  const focusClients = useMemo(() => {
    return [...clients]
      .sort((left, right) => {
        const leftTaskScore = Number(left.openTasksCount || 0) * 10;
        const rightTaskScore = Number(right.openTasksCount || 0) * 10;
        const leftDeadline = left.nextDeadline ? new Date(left.nextDeadline).getTime() : Number.POSITIVE_INFINITY;
        const rightDeadline = right.nextDeadline ? new Date(right.nextDeadline).getTime() : Number.POSITIVE_INFINITY;
        const leftContact = left.lastContactAt ? new Date(left.lastContactAt).getTime() : 0;
        const rightContact = right.lastContactAt ? new Date(right.lastContactAt).getTime() : 0;
        return rightTaskScore - leftTaskScore || leftDeadline - rightDeadline || leftContact - rightContact;
      })
      .slice(0, 5);
  }, [clients]);

  const liveLandingPages = landingPages.filter((page) => page.isActive).length;
  const landingPageViews = landingPages.reduce((sum, page) => sum + Number(page.totalViews || 0), 0);
  const landingPageLeads = landingPages.reduce((sum, page) => sum + Number(page.leadsGenerated || 0), 0);
  const topLandingPage = [...landingPages].sort((left, right) => Number(right.leadsGenerated || 0) - Number(left.leadsGenerated || 0))[0];
  const latestBlast = [...marketingBlasts].sort((left, right) => {
    const rightDate = new Date(right.sentAt || right.scheduledAt || right.updatedAt || right.createdAt || 0).getTime();
    const leftDate = new Date(left.sentAt || left.scheduledAt || left.updatedAt || left.createdAt || 0).getTime();
    return rightDate - leftDate;
  })[0];

  const quickActions = [
    { label: 'New Deal', path: '/deals/new', icon: BriefcaseBusiness },
    { label: 'Clients', path: '/clients', icon: Users },
    { label: 'Tasks', path: '/tasks', icon: CheckCircle2 },
    { label: 'Property Search', path: '/search', icon: Search },
    { label: 'Contracts', path: '/contracts', icon: FileText },
    { label: 'Landing Pages', path: '/landing-pages', icon: PanelTop },
    { label: 'Marketing', path: '/marketing', icon: Megaphone },
    { label: 'Reporting', path: '/reporting', icon: BarChart3 },
  ];

  const scorecards = [
    { label: 'Tasks today', value: todayTasks.length, detail: `${todayTasks.filter((task) => task.priority === 'HIGH').length} high`, icon: CheckCircle2 },
    { label: 'Hot leads', value: hotLeads, detail: `${warmLeads} warm`, icon: Target },
    { label: 'Under contract', value: underContractCount, detail: `${activeDealCount} active`, icon: BriefcaseBusiness },
    { label: 'Clients', value: totalClients, detail: `${openTaskClients} need action`, icon: Users },
    { label: 'Closed month', value: closedThisMonth, detail: 'Transactions', icon: CircleDollarSign },
  ];

  const markTaskDone = async (taskId: string) => {
    const previousTasks = todayTasks;
    setTodayTasks((prev) => prev.filter((task) => task.id !== taskId));

    try {
      await api.patch(`/tasks/${taskId}`, {
        status: 'COMPLETED',
        bucket: 'DONE',
      });
    } catch (error) {
      console.error('Failed to mark dashboard task done:', error);
      setTodayTasks(previousTasks);
    }
  };

  const setWidgetVisible = (id: DashboardWidgetId, visible: boolean) => {
    setLayout((current) => current.map((item) => (item.id === id ? { ...item, visible } : item)));
  };

  const moveWidget = (id: DashboardWidgetId, direction: -1 | 1) => {
    const currentVisible = layout.filter((item) => item.visible);
    const sourceVisibleIndex = currentVisible.findIndex((item) => item.id === id);
    const target = currentVisible[sourceVisibleIndex + direction];
    if (!target) return;
    setLayout((current) => reorderLayout(current, id, target.id));
  };

  const moveWidgetInLayout = (id: DashboardWidgetId, direction: -1 | 1) => {
    setLayout((current) => {
      const sourceIndex = current.findIndex((item) => item.id === id);
      const targetIndex = sourceIndex + direction;
      if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      const [source] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, source);
      return next;
    });
  };

  const resizeWidget = (id: DashboardWidgetId) => {
    setLayout((current) => current.map((item) => (item.id === id ? { ...item, size: getNextWidgetSize(item.size) } : item)));
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, id: DashboardWidgetId) => {
    draggedWidgetRef.current = id;
    setDraggedWidgetId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (id: DashboardWidgetId) => {
    const sourceId = draggedWidgetId || draggedWidgetRef.current;
    if (!sourceId || sourceId === id) return;
    setDropTargetWidgetId(id);
  };

  const handleDragLeave = (id: DashboardWidgetId) => {
    setDropTargetWidgetId((current) => (current === id ? null : current));
  };

  const handleDrop = (event: DragEvent<HTMLElement>, targetId: DashboardWidgetId) => {
    event.preventDefault();
    const sourceId = (draggedWidgetRef.current || draggedWidgetId || event.dataTransfer.getData('text/plain')) as DashboardWidgetId;
    if (isDashboardWidgetId(sourceId)) {
      setLayout((current) => reorderLayout(current, sourceId, targetId));
    }
    draggedWidgetRef.current = null;
    setDraggedWidgetId(null);
    setDropTargetWidgetId(null);
  };

  const finishDrag = () => {
    draggedWidgetRef.current = null;
    setDraggedWidgetId(null);
    setDropTargetWidgetId(null);
  };

  const resetLayout = () => {
    setLayout(DEFAULT_DASHBOARD_LAYOUT);
  };

  const linkButton = (label: string, path: string) => (
    <button
      type="button"
      onClick={() => navigate(path)}
      className="inline-flex items-center gap-1 text-sm font-semibold text-[#7a5a24] hover:text-slate-950 dark:text-blue-300 dark:hover:text-blue-200"
    >
      {label}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );

  const renderQuickActions = () => (
    <DashboardCard title="Quick actions" icon={LayoutDashboard}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.path}
              type="button"
              onClick={() => navigate(action.path)}
              className="group flex min-h-[78px] items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-3 text-left shadow-[0_8px_20px_-14px_rgba(15,23,42,0.38)] hover:border-[#d6b56d] hover:bg-[#fff8e8] hover:shadow-[0_14px_30px_-16px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-[#f1e3bd] group-hover:text-[#7a5a24] dark:bg-white/10 dark:text-slate-300 dark:group-hover:bg-[#d6b56d]/15 dark:group-hover:text-[#f2d894]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-200">{action.label}</span>
            </button>
          );
        })}
      </div>
    </DashboardCard>
  );

  const renderScorecard = () => (
    <DashboardCard title="Business scorecard" icon={BarChart3}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {scorecards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-slate-300 bg-slate-50/85 p-3 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400">{card.label}</div>
                <Icon className="h-4 w-4 text-[#7a5a24] dark:text-[#f2d894]" aria-hidden="true" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{loading ? '--' : card.value}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.detail}</div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );

  const renderActiveDeals = () => (
    <DashboardCard title="Active deals" icon={BriefcaseBusiness} action={linkButton('View all', '/deals')}>
      {activeDeals.length === 0 ? (
        <EmptyWidgetState label="No active deals right now." />
      ) : (
        <div className="space-y-2">
          {activeDeals.slice(0, 6).map((deal) => (
            <button
              key={deal.id}
              type="button"
              onClick={() => navigate(`/deals/${deal.id}`)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left shadow-[0_6px_18px_-14px_rgba(15,23,42,0.36)] hover:border-[#d6b56d] hover:bg-[#fff8e8] hover:shadow-[0_12px_28px_-16px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{deal.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusPill tone={CONTRACT_STATUSES.has(deal.status) ? 'gold' : 'slate'}>{getStatusLabel(deal.status)}</StatusPill>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{deal.closingDate ? formatShortDate(deal.closingDate) : 'No close date'}</span>
                </div>
              </div>
              <div className="shrink-0 text-right text-sm font-semibold text-slate-900 dark:text-white">{formatMoney(deal.price)}</div>
            </button>
          ))}
        </div>
      )}
    </DashboardCard>
  );

  const renderTodayTasks = () => (
    <DashboardCard title="Today tasks" icon={CheckCircle2} action={linkButton('Open', '/tasks')}>
      {todayTasks.length === 0 ? (
        <EmptyWidgetState label="No tasks due today." />
      ) : (
        <div className="space-y-2">
          {todayTasks.slice(0, 5).map((task) => (
            <div key={task.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => void markTaskDone(task.id)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10"
                title="Mark done"
                aria-label={`Mark ${task.title} done`}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{task.title}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {task.dueAt ? new Date(task.dueAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Today'}
                </div>
              </div>
              <StatusPill tone={task.priority === 'HIGH' ? 'rose' : task.priority === 'NORMAL' ? 'blue' : 'slate'}>{task.priority}</StatusPill>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );

  const renderPipelinePulse = () => {
    const stageRows = [
      { label: 'Lead', count: activeDeals.filter((deal) => deal.status === 'LEAD').length },
      { label: 'Active', count: activeDeals.filter((deal) => deal.status === 'ACTIVE' || deal.status === 'OFFER_SENT').length },
      { label: 'Contract', count: activeDeals.filter((deal) => CONTRACT_STATUSES.has(deal.status)).length },
    ];

    return (
      <DashboardCard title="Pipeline pulse" icon={CalendarDays} action={linkButton('Deals', '/deals')}>
        <div className="space-y-3">
          <div className="rounded-xl border border-[#d6b56d]/35 bg-[#fff8e8] p-3 dark:border-[#f2d894]/15 dark:bg-[#d6b56d]/10">
            <div className="text-[11px] font-bold uppercase text-[#7a5a24] dark:text-[#f2d894]">Next closing</div>
            <div className="mt-2 truncate text-sm font-semibold text-slate-950 dark:text-white">{nextClosingDeal?.title || 'No close date yet'}</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{nextClosingDeal ? formatShortDate(nextClosingDeal.closingDate) : `${underContractCount} under contract`}</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stageRows.map((row) => (
              <div key={row.label} className="rounded-xl border border-slate-300 bg-white p-3 text-center dark:border-white/10 dark:bg-white/5">
                <div className="text-xl font-bold text-slate-950 dark:text-white">{row.count}</div>
                <div className="mt-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">{row.label}</div>
              </div>
            ))}
          </div>
        </div>
      </DashboardCard>
    );
  };

  const renderLeadEngine = () => (
    <DashboardCard title="Lead engine" icon={Search} action={linkButton('Leads', '/leads')}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center dark:border-rose-400/20 dark:bg-rose-500/10">
            <div className="text-xl font-bold text-rose-700 dark:text-rose-300">{hotLeads}</div>
            <div className="mt-1 text-[10px] font-bold uppercase text-rose-600 dark:text-rose-300">Hot</div>
          </div>
          <div className="rounded-xl border border-[#d6b56d]/45 bg-[#fff8e8] p-3 text-center dark:border-[#f2d894]/20 dark:bg-[#d6b56d]/10">
            <div className="text-xl font-bold text-[#7a5a24] dark:text-[#f2d894]">{warmLeads}</div>
            <div className="mt-1 text-[10px] font-bold uppercase text-[#7a5a24] dark:text-[#f2d894]">Warm</div>
          </div>
          <div className="rounded-xl border border-slate-300 bg-white p-3 text-center dark:border-white/10 dark:bg-white/5">
            <div className="text-xl font-bold text-slate-950 dark:text-white">{formatPercent(conversionRate)}</div>
            <div className="mt-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Convert</div>
          </div>
        </div>

        {recentLeads.length === 0 ? (
          <EmptyWidgetState label="No active leads yet." />
        ) : (
          <div className="space-y-2">
            {recentLeads.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => navigate(`/leads/${lead.id}`)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left hover:border-[#d6b56d] hover:bg-[#fff8e8] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{getLeadName(lead)}</div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatEnumLabel(lead.source)}</div>
                </div>
                <StatusPill tone={lead.priority === 'HOT' ? 'rose' : lead.priority === 'WARM' ? 'gold' : 'slate'}>{lead.priority}</StatusPill>
              </button>
            ))}
          </div>
        )}
      </div>
    </DashboardCard>
  );

  const renderClientFocus = () => (
    <DashboardCard title="Client focus" icon={Users} action={linkButton('Clients', '/clients')}>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-300 bg-white p-3 text-center dark:border-white/10 dark:bg-white/5">
          <div className="text-xl font-bold text-slate-950 dark:text-white">{totalClients}</div>
          <div className="mt-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Total</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center dark:border-blue-400/20 dark:bg-blue-500/10">
          <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{openTaskClients}</div>
          <div className="mt-1 text-[10px] font-bold uppercase text-blue-600 dark:text-blue-300">Tasks</div>
        </div>
        <div className="rounded-xl border border-[#d6b56d]/45 bg-[#fff8e8] p-3 text-center dark:border-[#f2d894]/20 dark:bg-[#d6b56d]/10">
          <div className="text-xl font-bold text-[#7a5a24] dark:text-[#f2d894]">{upcomingDeadlineClients}</div>
          <div className="mt-1 text-[10px] font-bold uppercase text-[#7a5a24] dark:text-[#f2d894]">Due</div>
        </div>
      </div>

      {focusClients.length === 0 ? (
        <EmptyWidgetState label="No client focus items yet." />
      ) : (
        <div className="space-y-2">
          {focusClients.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => navigate(`/clients/${client.id}`)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left hover:border-[#d6b56d] hover:bg-[#fff8e8] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{client.name}</div>
                <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {client.primaryProperty || formatEnumLabel(client.stage)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <StatusPill tone={client.temperature === 'HOT' ? 'rose' : client.temperature === 'WARM' ? 'gold' : 'slate'}>{client.temperature || 'Client'}</StatusPill>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{client.nextDeadline ? formatShortDate(client.nextDeadline) : `${client.openTasksCount || 0} tasks`}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </DashboardCard>
  );

  const renderMarketingLaunchpad = () => (
    <DashboardCard title="Marketing launchpad" icon={Megaphone} action={linkButton('Open', '/marketing')}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-300 bg-white p-3 text-center dark:border-white/10 dark:bg-white/5">
            <div className="text-xl font-bold text-slate-950 dark:text-white">{liveLandingPages}</div>
            <div className="mt-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Live</div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center dark:border-blue-400/20 dark:bg-blue-500/10">
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{landingPageViews}</div>
            <div className="mt-1 text-[10px] font-bold uppercase text-blue-600 dark:text-blue-300">Views</div>
          </div>
          <div className="rounded-xl border border-[#d6b56d]/45 bg-[#fff8e8] p-3 text-center dark:border-[#f2d894]/20 dark:bg-[#d6b56d]/10">
            <div className="text-xl font-bold text-[#7a5a24] dark:text-[#f2d894]">{landingPageLeads}</div>
            <div className="mt-1 text-[10px] font-bold uppercase text-[#7a5a24] dark:text-[#f2d894]">Leads</div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-300 bg-white p-3 dark:border-white/10 dark:bg-white/5">
          <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Top page</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-white">{topLandingPage?.title || 'No page launched yet'}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{topLandingPage ? `${topLandingPage.leadsGenerated || 0} leads` : 'Launch a listing page'}</div>
        </div>
        <div className="rounded-xl border border-slate-300 bg-white p-3 dark:border-white/10 dark:bg-white/5">
          <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Latest blast</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-white">{latestBlast?.title || latestBlast?.name || 'No blast yet'}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{latestBlast?.status ? formatEnumLabel(latestBlast.status) : 'Ready when you are'}</div>
        </div>
      </div>
    </DashboardCard>
  );

  const renderWidget = (id: DashboardWidgetId) => {
    switch (id) {
      case 'quickActions':
        return renderQuickActions();
      case 'scorecard':
        return renderScorecard();
      case 'activeDeals':
        return renderActiveDeals();
      case 'todayTasks':
        return renderTodayTasks();
      case 'winTheDay':
        return <WinTheDayWidget />;
      case 'pipelinePulse':
        return renderPipelinePulse();
      case 'leadEngine':
        return renderLeadEngine();
      case 'clientFocus':
        return renderClientFocus();
      case 'marketingLaunchpad':
        return renderMarketingLaunchpad();
      default:
        return null;
    }
  };

  return (
    <PageLayout
      title={`${greeting}, ${firstName}`}
      subtitle="Your saved command center for deals, leads, clients, tasks, marketing, and daily momentum."
      maxWidth="full"
      actions={(
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" iconOnly onClick={() => setCustomizing(true)} aria-label="Customize dashboard widgets" title="Customize dashboard widgets">
            <Settings2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    >
      <div className="space-y-5 pb-8">
        <DashboardWidgetSettingsModal
          open={customizing}
          layout={layout}
          visibleCount={visibleLayout.length}
          hiddenCount={hiddenCount}
          agentEmail={agent?.email}
          draggedWidgetId={draggedWidgetId}
          dropTargetWidgetId={dropTargetWidgetId}
          onClose={() => {
            setCustomizing(false);
            finishDrag();
          }}
          onReset={resetLayout}
          onToggle={setWidgetVisible}
          onResize={resizeWidget}
          onMove={moveWidgetInLayout}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDragEnd={finishDrag}
          onDrop={handleDrop}
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {visibleLayout.map((item, index) => (
            <WidgetChrome
              key={item.id}
              item={item}
              visibleIndex={index}
              visibleCount={visibleLayout.length}
              customizing={false}
              draggedWidgetId={draggedWidgetId}
              dropTargetWidgetId={dropTargetWidgetId}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDragEnd={finishDrag}
              onDrop={handleDrop}
              onMove={moveWidget}
              onResize={resizeWidget}
              onHide={(id) => setWidgetVisible(id, false)}
            >
              {renderWidget(item.id)}
            </WidgetChrome>
          ))}
        </div>

        <button
          type="button"
          onClick={() => navigate('/search')}
          className="flex w-full items-center justify-between rounded-2xl border border-slate-300/80 bg-white/70 px-4 py-3 text-left shadow-[0_12px_30px_-20px_rgba(15,23,42,0.35)] hover:border-[#d6b56d] hover:bg-[#fff8e8] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff8e8] text-[#7a5a24] dark:bg-[#d6b56d]/10 dark:text-[#f2d894]">
              <Home className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">Property workspace</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">Search, save, compare, and launch deal work from one place.</span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
      </div>
    </PageLayout>
  );
}