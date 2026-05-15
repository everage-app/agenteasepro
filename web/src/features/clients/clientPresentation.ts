import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BadgeDollarSign,
  ClipboardList,
  Flame,
  Home,
  Medal,
  Repeat2,
  Snowflake,
  Star,
  SunMedium,
  Trophy,
} from 'lucide-react';

export type ClientRoleValue = 'BUYER' | 'SELLER' | 'BOTH' | 'OTHER';
export type ClientTemperatureValue = 'HOT' | 'WARM' | 'COLD';
export type ReferralRankValue = 'A' | 'B' | 'C';
export type ClientPresentationTone = 'gold' | 'cyan' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';

interface ClientChoicePresentation<TValue extends string> {
  value: TValue;
  label: string;
  desc: string;
  icon: LucideIcon;
  tone: ClientPresentationTone;
  badgeClass: string;
  selectedClass: string;
}

export const clientRoleOptions: Array<ClientChoicePresentation<ClientRoleValue>> = [
  {
    value: 'BUYER',
    label: 'Buyer',
    desc: 'Purchase side',
    icon: Home,
    tone: 'blue',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-200',
    selectedClass: 'border-blue-300 bg-blue-50/95 text-blue-900 shadow-[0_12px_30px_-18px_rgba(37,99,235,0.65)] dark:border-blue-300/40 dark:bg-blue-500/15 dark:text-blue-100',
  },
  {
    value: 'SELLER',
    label: 'Seller',
    desc: 'Listing side',
    icon: BadgeDollarSign,
    tone: 'emerald',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200',
    selectedClass: 'border-emerald-300 bg-emerald-50/95 text-emerald-900 shadow-[0_12px_30px_-18px_rgba(5,150,105,0.65)] dark:border-emerald-300/40 dark:bg-emerald-500/15 dark:text-emerald-100',
  },
  {
    value: 'BOTH',
    label: 'Both',
    desc: 'Buy + sell',
    icon: Repeat2,
    tone: 'gold',
    badgeClass: 'border-[#d6b56d]/35 bg-[#f8f3e6] text-[#7a5a24] dark:border-[#f2d894]/25 dark:bg-[#d6b56d]/10 dark:text-[#f2d894]',
    selectedClass: 'border-[#d6b56d]/55 bg-[#f8f3e6] text-[#5d4215] shadow-[0_12px_30px_-18px_rgba(159,121,51,0.75)] dark:border-[#f2d894]/40 dark:bg-[#d6b56d]/15 dark:text-[#f7e7b0]',
  },
  {
    value: 'OTHER',
    label: 'Other',
    desc: 'Custom role',
    icon: ClipboardList,
    tone: 'slate',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200',
    selectedClass: 'border-slate-300 bg-slate-100 text-slate-900 shadow-[0_12px_30px_-18px_rgba(15,23,42,0.45)] dark:border-white/20 dark:bg-white/15 dark:text-white',
  },
];

export const clientRankOptions: Array<ClientChoicePresentation<ReferralRankValue>> = [
  {
    value: 'A',
    label: 'A-List',
    desc: 'Top referrer',
    icon: Trophy,
    tone: 'amber',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200',
    selectedClass: 'border-amber-300 bg-amber-50/95 text-amber-900 shadow-[0_12px_30px_-18px_rgba(217,119,6,0.65)] dark:border-amber-300/40 dark:bg-amber-500/15 dark:text-amber-100',
  },
  {
    value: 'B',
    label: 'B-List',
    desc: 'Good referrer',
    icon: Star,
    tone: 'cyan',
    badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-500/10 dark:text-cyan-200',
    selectedClass: 'border-cyan-300 bg-cyan-50/95 text-cyan-900 shadow-[0_12px_30px_-18px_rgba(8,145,178,0.65)] dark:border-cyan-300/40 dark:bg-cyan-500/15 dark:text-cyan-100',
  },
  {
    value: 'C',
    label: 'C-List',
    desc: 'New/minimal',
    icon: Award,
    tone: 'slate',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200',
    selectedClass: 'border-slate-300 bg-slate-100 text-slate-900 shadow-[0_12px_30px_-18px_rgba(15,23,42,0.45)] dark:border-white/20 dark:bg-white/15 dark:text-white',
  },
];

export const clientTemperatureOptions: Array<ClientChoicePresentation<ClientTemperatureValue>> = [
  {
    value: 'HOT',
    label: 'Hot',
    desc: 'Active 1-3 mo',
    icon: Flame,
    tone: 'rose',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200',
    selectedClass: 'border-rose-300 bg-rose-50/95 text-rose-900 shadow-[0_12px_30px_-18px_rgba(225,29,72,0.65)] dark:border-rose-300/40 dark:bg-rose-500/15 dark:text-rose-100',
  },
  {
    value: 'WARM',
    label: 'Warm',
    desc: 'Nurture 3-6 mo',
    icon: SunMedium,
    tone: 'amber',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200',
    selectedClass: 'border-amber-300 bg-amber-50/95 text-amber-900 shadow-[0_12px_30px_-18px_rgba(217,119,6,0.65)] dark:border-amber-300/40 dark:bg-amber-500/15 dark:text-amber-100',
  },
  {
    value: 'COLD',
    label: 'Cold',
    desc: 'Long term 6+ mo',
    icon: Snowflake,
    tone: 'blue',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-200',
    selectedClass: 'border-blue-300 bg-blue-50/95 text-blue-900 shadow-[0_12px_30px_-18px_rgba(37,99,235,0.65)] dark:border-blue-300/40 dark:bg-blue-500/15 dark:text-blue-100',
  },
];

export const clientRoleMeta = Object.fromEntries(clientRoleOptions.map((item) => [item.value, item])) as Record<ClientRoleValue, ClientChoicePresentation<ClientRoleValue>>;
export const clientRankMeta = Object.fromEntries(clientRankOptions.map((item) => [item.value, item])) as Record<ReferralRankValue, ClientChoicePresentation<ReferralRankValue>>;
export const clientTemperatureMeta = Object.fromEntries(clientTemperatureOptions.map((item) => [item.value, item])) as Record<ClientTemperatureValue, ClientChoicePresentation<ClientTemperatureValue>>;

export const referralRankFallbackIcon = Medal;
