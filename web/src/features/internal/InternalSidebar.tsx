import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../auth/authStore';
import { Logo } from '../../components/ui/Logo';

interface Props {
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

const nav = [
  { name: 'Overview', href: '/internal', icon: HomeIcon },
  { name: 'Agents', href: '/internal/agents', icon: UsersIcon },
  { name: 'Activity', href: '/internal/activity', icon: ActivityIcon },
  { name: 'Usage', href: '/internal/usage', icon: UsageIcon },
  { name: 'Listings', href: '/internal/listings', icon: ListingsIcon },
  { name: 'Contracts', href: '/internal/contracts', icon: ContractsIcon },
  { name: 'Campaigns', href: '/internal/campaigns', icon: CampaignsIcon },
  { name: 'Support', href: '/internal/support', icon: SupportIcon },
  { name: 'Billing', href: '/internal/billing', icon: BillingIcon },
  { name: 'Calculations', href: '/internal/calculations', icon: CalculationsIcon },
  { name: 'System', href: '/internal/system', icon: SystemIcon },
];

export function InternalSidebar({ isMobile = false, isOpen = true, onClose }: Props) {
  const navigate = useNavigate();
  const agent = useAuthStore((s) => s.agent);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate('/login');
    onClose?.();
  };

  const shell = (
    <div className="flex h-full flex-col border-r border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 border-b border-white/10 px-4">
        <Logo size="md" showText />
        <span className="hidden lg:inline-flex text-[9px] font-bold tracking-[0.2em] text-cyan-200/60 border border-cyan-500/20 bg-cyan-500/5 rounded px-1.5 py-0.5">INTERNAL</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3 overflow-y-auto">
        {nav.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={() => {
              if (isMobile) onClose?.();
            }}
            end={item.href === '/internal'}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-white border border-cyan-400/20 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => {
              const Icon = item.icon;
              return (
                <>
                  <span className={isActive ? 'text-cyan-300' : 'text-slate-500 group-hover:text-slate-300'}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="flex-1">{item.name}</span>
                </>
              );
            }}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-2">
        <button
          onClick={() => {
            navigate('/internal/billing');
            onClose?.();
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Billing
        </button>

        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
          <div className="text-xs font-semibold text-slate-300 truncate">{agent?.name || 'Owner'}</div>
          <div className="mt-0.5 text-[11px] text-slate-500 truncate">{agent?.email || ''}</div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs font-semibold py-2 hover:bg-red-500/15 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  if (!isMobile) {
    return <div className="hidden lg:flex h-screen w-64 flex-col">{shell}</div>;
  }

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {shell}
      </div>
    </>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ListingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ContractsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function SystemIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function BillingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19V5m0 14h16M8 17V9m4 8V7m4 10v-4" />
    </svg>
  );
}

function UsageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 15l4-4 3 3 5-6" />
    </svg>
  );
}

function SupportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 10c0-3.314-2.686-6-6-6s-6 2.686-6 6v5a2 2 0 002 2h1v-7H8a4 4 0 018 0h-1v7h1a2 2 0 002-2v-5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h2" />
    </svg>
  );
}

function CampaignsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l9 5 9-5M3 16l9 5 9-5M3 8l9-5 9 5" />
    </svg>
  );
}

function CalculationsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 15l4-4 3 3 4-6" />
    </svg>
  );
}
