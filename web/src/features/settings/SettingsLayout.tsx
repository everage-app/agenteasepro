import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { PageLayout } from '../../components/layout/PageLayout';

const settingsNav = [
  {
    name: 'Profile',
    href: '/settings/profile',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    name: 'Clients',
    href: '/settings/clients',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    name: 'Leads',
    href: '/settings/leads',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    ),
  },
  {
    name: 'Brokerage & Branding',
    href: '/settings/branding',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
  {
    name: 'Integrations & Sync',
    href: '/settings/integrations',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    name: 'IDX & Website',
    href: '/settings/idx',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: 'Landing Pages',
    href: '/settings/landing-pages',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    name: 'Automations & Workflows',
    href: '/settings/automations',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    name: 'Notifications',
    href: '/settings/notifications',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    name: 'Billing & Plan',
    href: '/settings/billing',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    name: 'Data & Import',
    href: '/settings/data',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
];

export function SettingsLayout() {
  const location = useLocation();
  const currentSection = settingsNav.find(item => location.pathname.startsWith(item.href));

  return (
    <PageLayout
      title="Settings"
      subtitle="Set up AgentEasePro for your business"
      maxWidth="7xl"
    >
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Mobile horizontal scroll nav */}
        <div className="lg:hidden">
          <nav className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {settingsNav.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex-shrink-0 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600/20 to-blue-500/10 text-white border border-blue-500/30'
                      : 'text-slate-400 bg-slate-950/60 border border-white/10 active:bg-white/10'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={isActive ? 'text-blue-400' : 'text-slate-500'}>
                      {item.icon}
                    </span>
                    <span>{item.name.split(' ')[0]}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Desktop sidebar nav */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <nav className="sticky top-6 space-y-1 rounded-2xl border border-white/10 bg-slate-950/60 backdrop-blur-xl p-3">
            {settingsNav.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600/20 to-blue-500/10 text-white border border-blue-500/30 shadow-lg shadow-blue-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.name}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl p-4 lg:p-6">
            <Outlet />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
