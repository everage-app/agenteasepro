import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Flame,
  Globe2,
  ListChecks,
  PhoneOff,
  Rocket,
  SearchCheck,
  Target,
  TimerReset,
  UserCheck,
} from 'lucide-react';
import api from '../../lib/api';
import { Lead, LeadPriority, LeadSource } from '../../types/leads';
import { cn } from '../../lib/utils';

export type LeadSmartView =
  | 'all'
  | 'hot'
  | 'highIntent'
  | 'needsFollowUp'
  | 'missingPhone'
  | 'noTask'
  | 'landingPage'
  | 'converted'
  | 'archived';

export type SmartListFilters = {
  view?: LeadSmartView;
  priority?: string;
  source?: string;
  archived?: 'active' | 'archived';
};

export interface SmartList {
  id: string;
  name: string;
  icon?: string;
  filters: any;
  isSystem: boolean;
}

interface SmartListsSidebarProps {
  currentFilters: SmartListFilters;
  onSelect: (filters: SmartListFilters) => void;
  leads?: Lead[];
}

const isArchivedLead = (lead: Lead) => (lead.tags || []).includes('ARCHIVED');

const daysSince = (value?: string) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - parsed) / 86400000);
};

const isHighIntent = (lead: Lead) =>
  lead.priority === LeadPriority.HOT || (lead.visitCount || 0) >= 3 || (lead.homesViewed || 0) >= 2;

const needsFollowUp = (lead: Lead) => {
  if (lead.converted || isArchivedLead(lead)) return false;
  const lastTouch = lead.lastContact || lead.updatedAt || lead.createdAt;
  return daysSince(lastTouch) >= 3;
};

const missingPhone = (lead: Lead) => !String(lead.phone || '').trim();
const noNextTask = (lead: Lead) => !String(lead.nextTask || '').trim();

const viewMatchesLead = (view: LeadSmartView | undefined, lead: Lead) => {
  switch (view) {
    case 'hot':
      return lead.priority === LeadPriority.HOT;
    case 'highIntent':
      return isHighIntent(lead);
    case 'needsFollowUp':
      return needsFollowUp(lead);
    case 'missingPhone':
      return missingPhone(lead);
    case 'noTask':
      return noNextTask(lead);
    case 'landingPage':
      return lead.source === LeadSource.LANDING_PAGE || Boolean(lead.landingPageId || lead.landingPage?.id);
    case 'converted':
      return Boolean(lead.converted || lead.clientId || lead.client?.id);
    case 'archived':
      return isArchivedLead(lead);
    case 'all':
    default:
      return !isArchivedLead(lead);
  }
};

const sameFilters = (a: SmartListFilters, b: SmartListFilters) =>
  (a.view || 'all') === (b.view || 'all') &&
  (a.priority || '') === (b.priority || '') &&
  (a.source || '') === (b.source || '') &&
  (a.archived || 'active') === (b.archived || 'active');

export function SmartListsSidebar({ currentFilters, onSelect, leads = [] }: SmartListsSidebarProps) {
  const [lists, setLists] = useState<SmartList[]>([]);

  useEffect(() => {
    api.get('/leads/smart-lists')
       .then(res => setLists(res.data))
       .catch(err => console.error('Failed to load smart lists', err));
  }, []);

  const defaultLists = useMemo(() => [
    { name: 'All active', filters: { view: 'all', archived: 'active' } as SmartListFilters, icon: Rocket, saved: false },
    { name: 'Hot pipeline', filters: { view: 'hot', priority: LeadPriority.HOT, archived: 'active' } as SmartListFilters, icon: Flame, saved: false },
    { name: 'High intent', filters: { view: 'highIntent', archived: 'active' } as SmartListFilters, icon: Target, saved: false },
    { name: 'Needs follow-up', filters: { view: 'needsFollowUp', archived: 'active' } as SmartListFilters, icon: TimerReset, saved: false },
    { name: 'Missing phone', filters: { view: 'missingPhone', archived: 'active' } as SmartListFilters, icon: PhoneOff, saved: false },
    { name: 'No next task', filters: { view: 'noTask', archived: 'active' } as SmartListFilters, icon: ListChecks, saved: false },
    { name: 'Landing page leads', filters: { view: 'landingPage', source: LeadSource.LANDING_PAGE, archived: 'active' } as SmartListFilters, icon: Globe2, saved: false },
    { name: 'Converted', filters: { view: 'converted', archived: 'active' } as SmartListFilters, icon: UserCheck, saved: false },
    { name: 'Archived', filters: { view: 'archived', archived: 'archived' } as SmartListFilters, icon: Archive, saved: false },
  ], []);

  const savedLists = lists.map((list) => ({
    name: list.name,
    filters: list.filters as SmartListFilters,
    icon: SearchCheck,
    saved: true,
  }));

  const allLists = [...defaultLists, ...savedLists];

  return (
    <div className="w-64 bg-slate-950/50 border-r border-slate-800/50 flex flex-col p-4 h-full overflow-y-auto">
      <div className="mb-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Smart Lists</h3>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">Fast triage views for the next lead to work.</p>
      </div>
      <div className="space-y-1.5">
      {allLists.map((list, idx) => {
        const Icon = list.icon;
        const filters = list.filters || {};
        const isActive = sameFilters(currentFilters, filters);
        const count = leads.filter((lead) => viewMatchesLead(filters.view, lead)).length;
        return (
          <button
            key={idx}
            onClick={() => onSelect(filters)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors',
              isActive
                ? 'border border-[#f2d894]/25 bg-[#d6b56d]/15 text-[#f7e7b0]'
                : 'border border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-[#f2d894]' : 'text-slate-500')} />
            <span className="min-w-0 flex-1 truncate">{list.name}</span>
            {!list.saved && (
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold',
                isActive ? 'bg-[#f2d894]/15 text-[#f7e7b0]' : 'bg-slate-800 text-slate-400',
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
      </div>
    </div>
  );
}


