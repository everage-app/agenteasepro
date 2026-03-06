/**
 * Route prefetching — triggers lazy chunk downloads before navigation.
 * Hover/focus on sidebar links calls prefetchRoute() to start loading
 * the chunk so it's ready by the time the user clicks.
 */

const routePrefetchMap: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../features/deals/DashboardPage'),
  '/deals': () => import('../features/deals/DealsKanban'),
  '/deals/new': () => import('../features/deals/DealCreateWizard'),
  '/clients': () => import('../features/clients/ClientsListPage'),
  '/leads': () => import('../features/leads/LeadsDashboard'),
  '/contracts': () => import('../features/contracts/ContractsHub'),
  '/listings': () => import('../features/listings/ListingsPage'),
  '/marketing': () => import('../features/marketing/MarketingPage'),
  '/calendar': () => import('../features/calendar/CalendarPage'),
  '/tasks': () => import('../features/tasks/TasksPage'),
  '/automations': () => import('../features/automations/AutomationsPage'),
  '/reporting': () => import('../features/reporting/ReportingPage'),
  '/search': () => import('../features/properties/PropertySearch'),
  '/settings': () => import('../features/settings/SettingsLayout'),
};

const prefetched = new Set<string>();

export function prefetchRoute(href: string) {
  const key = Object.keys(routePrefetchMap).find(k => href === k || href.startsWith(k + '/'));
  if (!key || prefetched.has(key)) return;
  prefetched.add(key);
  routePrefetchMap[key]();
}

/** Prefetch an array of routes (call once on idle after login). */
export function prefetchTopRoutes() {
  const topRoutes = ['/dashboard', '/deals', '/clients', '/contracts', '/tasks', '/calendar'];
  topRoutes.forEach(r => prefetchRoute(r));
}
