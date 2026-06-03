import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { isInternalHost } from './features/internal/isInternalHost';
import { HostInternalRedirect } from './features/internal/HostInternalRedirect';
import { OwnerRoute } from './features/internal/OwnerRoute';
import { InternalShell } from './features/internal/InternalShell';
import { useAuthStore } from './features/auth/authStore';
import { reportClientError, trackEvent } from './lib/telemetry';
import { prefetchRoute, prefetchTopRoutes } from './lib/prefetch';

// ─── Critical path: eager imports (auth, billing gate) ───────────────
import { LoginPage } from './features/auth/LoginPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage';
import { PublicSignPage } from './features/esign/PublicSignPage';
import { BillingAccessGate } from './features/billing/BillingAccessGate';
import { InternalLoginPage } from './features/internal/InternalLoginPage';
import { PublicLandingPage } from './features/public/PublicLandingPage';
import PropertyWorkspace from './features/properties/PropertyWorkspace';

// ─── Lazy-loaded feature pages (code-split per route) ────────────────
const DashboardPage = lazy(() => import('./features/deals/DashboardPage').then(m => ({ default: m.DashboardPage })));
const DealCreateWizard = lazy(() => import('./features/deals/DealCreateWizard').then(m => ({ default: m.DealCreateWizard })));
const DealsKanban = lazy(() => import('./features/deals/DealsKanban').then(m => ({ default: m.DealsKanban })));
const DealDetailPage = lazy(() => import('./features/deals/DealDetailPage').then(m => ({ default: m.DealDetailPage })));
const DealExecutionCockpitPage = lazy(() => import('./features/deals/DealExecutionCockpitPage').then(m => ({ default: m.DealExecutionCockpitPage })));
const DealMobileView = lazy(() => import('./components/deals/DealMobileView').then(m => ({ default: m.DealMobileView })));
const RepcWizard = lazy(() => import('./features/repc/RepcWizard').then(m => ({ default: m.RepcWizard })));
const ListingsPage = lazy(() => import('./features/listings/ListingsPage').then(m => ({ default: m.ListingsPage })));
const ClientsListPage = lazy(() => import('./features/clients/ClientsListPage').then(m => ({ default: m.ClientsListPage })));
const ClientDetailPage = lazy(() => import('./features/clients/ClientDetailPage').then(m => ({ default: m.ClientDetailPage })));
const ContractsHub = lazy(() => import('./features/contracts/ContractsHub').then(m => ({ default: m.ContractsHub })));
const PdfEditor = lazy(() => import('./features/contracts/PdfEditor').then(m => ({ default: m.PdfEditor })));
const DealTemplateFormPage = lazy(() => import('./features/contracts/DealTemplateFormPage').then(m => ({ default: m.DealTemplateFormPage })));
const TasksPage = lazy(() => import('./features/tasks/TasksPage').then(m => ({ default: m.TasksPage })));
const MarketingPage = lazy(() => import('./features/marketing/MarketingPage').then(m => ({ default: m.MarketingPage })));
const BlastDetailPage = lazy(() => import('./features/marketing/BlastDetailPage').then(m => ({ default: m.BlastDetailPage })));
const LeadsDashboard = lazy(() => import('./features/leads/LeadsDashboard'));
const LeadDetailPage = lazy(() => import('./features/leads/LeadDetailPage').then(m => ({ default: m.LeadDetailPage })));
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage').then(m => ({ default: m.CalendarPage })));
const AutomationsPage = lazy(() => import('./features/automations/AutomationsPage').then(m => ({ default: m.AutomationsPage })));
const SettingsLayout = lazy(() => import('./features/settings/SettingsLayout').then(m => ({ default: m.SettingsLayout })));
const SettingsIndexPage = lazy(() => import('./features/settings/SettingsIndexPage').then(m => ({ default: m.SettingsIndexPage })));
const ProfileSettingsPage = lazy(() => import('./features/settings/ProfileSettingsPage').then(m => ({ default: m.ProfileSettingsPage })));
const ClientsSettingsPage = lazy(() => import('./features/settings/ClientsSettingsPage').then(m => ({ default: m.ClientsSettingsPage })));
const LeadsSettingsPage = lazy(() => import('./features/settings/LeadsSettingsPage').then(m => ({ default: m.LeadsSettingsPage })));
const BrandingSettingsPage = lazy(() => import('./features/settings/BrandingSettingsPage').then(m => ({ default: m.BrandingSettingsPage })));
const IntegrationsSettingsPage = lazy(() => import('./features/settings/IntegrationsSettingsPage').then(m => ({ default: m.IntegrationsSettingsPage })));
const AutomationsSettingsPage = lazy(() => import('./features/settings/AutomationsSettingsPage').then(m => ({ default: m.AutomationsSettingsPage })));
const NotificationsSettingsPage = lazy(() => import('./features/settings/NotificationsSettingsPage').then(m => ({ default: m.NotificationsSettingsPage })));
const BillingSettingsPage = lazy(() => import('./features/settings/BillingSettingsPage').then(m => ({ default: m.BillingSettingsPage })));
const DataSettingsPage = lazy(() => import('./features/settings/DataSettingsPage').then(m => ({ default: m.DataSettingsPage })));
const IdxSettingsPage = lazy(() => import('./features/settings/IdxSettingsPage').then(m => ({ default: m.IdxSettingsPage })));
const LandingPagesSettingsPage = lazy(() => import('./features/settings/LandingPagesSettingsPage').then(m => ({ default: m.LandingPagesSettingsPage })));
const LandingPageEditorPage = lazy(() => import('./features/settings/LandingPageEditorPage').then(m => ({ default: m.LandingPageEditorPage })));
const ReportingPage = lazy(() => import('./features/reporting/ReportingPage').then(m => ({ default: m.ReportingPage })));

// Internal admin pages (lazy — rarely visited)
const InternalOverviewPage = lazy(() => import('./features/internal/pages/InternalOverviewPage').then(m => ({ default: m.InternalOverviewPage })));
const InternalAgentsPage = lazy(() => import('./features/internal/pages/InternalAgentsPage').then(m => ({ default: m.InternalAgentsPage })));
const InternalAgentDetailPage = lazy(() => import('./features/internal/pages/InternalAgentDetailPage').then(m => ({ default: m.InternalAgentDetailPage })));
const InternalListingsPage = lazy(() => import('./features/internal/pages/InternalListingsPage').then(m => ({ default: m.InternalListingsPage })));
const InternalContractsPage = lazy(() => import('./features/internal/pages/InternalContractsPage').then(m => ({ default: m.InternalContractsPage })));
const InternalSystemPage = lazy(() => import('./features/internal/pages/InternalSystemPage').then(m => ({ default: m.InternalSystemPage })));
const InternalBillingPage = lazy(() => import('./features/internal/pages/InternalBillingPage').then(m => ({ default: m.InternalBillingPage })));
const InternalActivityPage = lazy(() => import('./features/internal/pages/InternalActivityPage').then(m => ({ default: m.InternalActivityPage })));
const InternalUsagePage = lazy(() => import('./features/internal/pages/InternalUsagePage').then(m => ({ default: m.InternalUsagePage })));

function DealContractRedirect() {
  const { dealId } = useParams<{ dealId: string }>();
  const location = useLocation();
  return <Navigate to={dealId ? `/contracts/${dealId}` : '/contracts'} replace state={location.state} />;
}
const InternalSupportPage = lazy(() => import('./features/internal/pages/InternalSupportPage').then(m => ({ default: m.InternalSupportPage })));
const InternalCalculationsPage = lazy(() => import('./features/internal/pages/InternalCalculationsPage').then(m => ({ default: m.InternalCalculationsPage })));
const InternalCampaignsPage = lazy(() => import('./features/internal/pages/InternalCampaignsPage').then(m => ({ default: m.InternalCampaignsPage })));

// ─── Lightweight auth/public page loader ─────────────────────────────
function MinimalLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#020617]">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function isNonActionableRejection(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false;

  const anyReason = reason as any;
  const name = typeof anyReason?.name === 'string' ? anyReason.name.toLowerCase() : '';
  const message = typeof anyReason?.message === 'string' ? anyReason.message.toLowerCase() : '';

  if (anyReason?.isAxiosError) return true;
  if (anyReason?.response && typeof anyReason.response.status === 'number') return true;
  if (name === 'aborterror' || message.includes('aborted')) return true;
  if (message.includes('network error')) return true;
  if (message.includes('failed to fetch dynamically imported module')) return true;
  if (message.includes('loading chunk') || message.includes('chunkloaderror')) return true;

  return false;
}

const CHUNK_RELOAD_KEY = 'aep_chunk_reload_attempts';
const MAX_CHUNK_RELOAD_ATTEMPTS = 2;

function tryReloadForChunkError(rawMessage: unknown): boolean {
  const message = String(rawMessage || '').toLowerCase();
  const isChunkError =
    message.includes('failed to fetch dynamically imported module')
    || message.includes('loading chunk')
    || message.includes('chunkloaderror');

  if (!isChunkError) return false;

  let attempts = 0;
  try {
    attempts = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
    if (attempts >= MAX_CHUNK_RELOAD_ATTEMPTS) {
      window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return false;
    }
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(attempts + 1));
  } catch {
    // Continue when sessionStorage is unavailable.
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('_aep_refresh', String(Date.now()));
  window.location.replace(nextUrl.toString());
  return true;
}

export default function App() {
  const location = useLocation();
  const internalHost = typeof window !== 'undefined' && isInternalHost(window.location.hostname);
  const token = useAuthStore((s) => s.token);
  const loadAgent = useAuthStore((s) => s.loadAgent);
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const lastTrackedPathRef = useRef<string>('');
  const lastActivityRef = useRef<number>(Date.now());
  const lastKeepaliveRef = useRef<number>(0);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  // Prefetch top routes after idle
  useEffect(() => {
    if (!token) return;
    const id = window.requestIdleCallback?.(() => {
      prefetchTopRoutes();
    }) ?? window.setTimeout(() => {
      prefetchTopRoutes();
    }, 2000);
    return () => {
      if (typeof id === 'number' && window.cancelIdleCallback) window.cancelIdleCallback(id);
      else clearTimeout(id as number);
    };
  }, [token]);

  useEffect(() => {
    if (!token || !internalHost) return;

    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events: Array<keyof WindowEventMap> = [
      'click',
      'keydown',
      'mousemove',
      'scroll',
      'touchstart',
      'focus',
    ];

    events.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
    document.addEventListener('visibilitychange', markActivity);

    const KEEPALIVE_MS = 25 * 60 * 1000;
    const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

    const id = window.setInterval(async () => {
      const now = Date.now();
      const recentlyActive = now - lastActivityRef.current <= ACTIVE_WINDOW_MS;
      const shouldPing = (document.visibilityState === 'visible' || recentlyActive)
        && (now - lastKeepaliveRef.current >= KEEPALIVE_MS);

      if (!shouldPing) return;

      const ok = await refreshSession();
      if (ok) {
        lastKeepaliveRef.current = now;
      }
    }, 60 * 1000);

    return () => {
      window.clearInterval(id);
      events.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      document.removeEventListener('visibilitychange', markActivity);
    };
  }, [token, internalHost, refreshSession]);

  useEffect(() => {
    if (!token) return;
    const path = `${location.pathname}${location.search || ''}`;
    if (lastTrackedPathRef.current === path) return;
    lastTrackedPathRef.current = path;

    // Avoid logging login/reset pages.
    if (location.pathname.startsWith('/login') || location.pathname.startsWith('/forgot-password') || location.pathname.startsWith('/reset-password')) {
      return;
    }

    trackEvent({
      kind: 'page_view',
      path,
      meta: {
        internalHost,
      },
    });
  }, [token, location.pathname, location.search, internalHost]);

  useEffect(() => {
    if (!token) return;

    const onError = (event: ErrorEvent) => {
      const message = event?.message || 'Unknown error';
      if (tryReloadForChunkError(message) || tryReloadForChunkError(event?.error?.message)) {
        return;
      }
      reportClientError({
        source: 'client',
        message,
        stack: event?.error?.stack,
        path: window.location.pathname + window.location.search,
      });
    };

    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      if (isNonActionableRejection(reason)) {
        tryReloadForChunkError((reason as any)?.message || reason);
        return;
      }
      const message =
        (reason && typeof reason === 'object' && 'message' in reason && typeof (reason as any).message === 'string')
          ? (reason as any).message
          : typeof reason === 'string'
            ? reason
            : 'Unhandled promise rejection';
      const stack = reason && typeof reason === 'object' && 'stack' in reason ? String((reason as any).stack) : undefined;
      reportClientError({
        source: 'client',
        message,
        stack,
        path: window.location.pathname + window.location.search,
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, [token]);

  return (
    <>
      <HostInternalRedirect />
      <BillingAccessGate />
      <Routes location={location}>
        <Route path="/demo" element={<Navigate to="/login?demo=1" replace />} />
        <Route path="/login" element={internalHost ? <InternalLoginPage /> : <LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/sites/:slug" element={<PublicLandingPage />} />
        <Route path="/verify-email" element={
          <ProtectedRoute>
            <VerifyEmailPage />
          </ProtectedRoute>
        } />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="reporting" element={<ReportingPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="leads" element={<LeadsDashboard />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="search" element={<PropertyWorkspace />} />
          <Route path="deals" element={<DealsKanban />} />
          <Route path="deals/new" element={<DealCreateWizard />} />
          <Route path="deals/:dealId" element={<DealsKanban />} />
          <Route path="deals/command-center" element={<Navigate to="/dashboard" replace />} />
          <Route path="deals/world-class-preview" element={<Navigate to="/deals/command-center" replace />} />
          <Route path="deals/:dealId/cockpit" element={<DealExecutionCockpitPage />} />
          <Route path="deals/:dealId/detail" element={<DealDetailPage />} />
          <Route path="deals/:dealId/repc" element={<DealContractRedirect />} />
          <Route path="clients" element={<ClientsListPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="contracts" element={<ContractsHub />} />
          <Route path="contracts/pdf-editor" element={<PdfEditor />} />
          <Route path="contracts/:dealId" element={<RepcWizard />} />
          <Route path="contracts/:dealId/forms/:formCode" element={<DealTemplateFormPage />} />
          <Route path="deals/:dealId/forms/:formCode" element={<DealTemplateFormPage />} />
          <Route path="listings" element={<ListingsPage />} />
          <Route path="landing-pages" element={<LandingPagesSettingsPage />} />
          <Route path="landing-pages/:id/edit" element={<LandingPageEditorPage />} />
          <Route path="marketing" element={<MarketingPage />} />
          <Route path="marketing/blasts/:id" element={<BlastDetailPage />} />
          <Route path="automations" element={<AutomationsPage />} />
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<SettingsIndexPage />} />
            <Route path="profile" element={<ProfileSettingsPage />} />
            <Route path="clients" element={<ClientsSettingsPage />} />
            <Route path="leads" element={<LeadsSettingsPage />} />
            <Route path="branding" element={<BrandingSettingsPage />} />
            <Route path="integrations" element={<IntegrationsSettingsPage />} />
            <Route path="idx" element={<IdxSettingsPage />} />
            <Route path="landing-pages" element={<LandingPagesSettingsPage />} />
            <Route path="landing-pages/:id/edit" element={<LandingPageEditorPage />} />
            <Route path="automations" element={<AutomationsSettingsPage />} />
            <Route path="notifications" element={<NotificationsSettingsPage />} />
            <Route path="billing" element={<BillingSettingsPage />} />
            <Route path="data" element={<DataSettingsPage />} />
            <Route path="ai" element={<Navigate to="/settings" replace />} />
          </Route>
        </Route>

        <Route
          path="/internal"
          element={
            <ProtectedRoute>
              <OwnerRoute>
                <InternalShell />
              </OwnerRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Suspense fallback={<MinimalLoader />}><InternalOverviewPage /></Suspense>} />
          <Route path="agents" element={<Suspense fallback={<MinimalLoader />}><InternalAgentsPage /></Suspense>} />
          <Route path="agents/:id" element={<Suspense fallback={<MinimalLoader />}><InternalAgentDetailPage /></Suspense>} />
          <Route path="activity" element={<Suspense fallback={<MinimalLoader />}><InternalActivityPage /></Suspense>} />
          <Route path="usage" element={<Suspense fallback={<MinimalLoader />}><InternalUsagePage /></Suspense>} />
          <Route path="support" element={<Suspense fallback={<MinimalLoader />}><InternalSupportPage /></Suspense>} />
          <Route path="listings" element={<Suspense fallback={<MinimalLoader />}><InternalListingsPage /></Suspense>} />
          <Route path="contracts" element={<Suspense fallback={<MinimalLoader />}><InternalContractsPage /></Suspense>} />
          <Route path="campaigns" element={<Suspense fallback={<MinimalLoader />}><InternalCampaignsPage /></Suspense>} />
          <Route path="calculations" element={<Suspense fallback={<MinimalLoader />}><InternalCalculationsPage /></Suspense>} />
          <Route path="system" element={<Suspense fallback={<MinimalLoader />}><InternalSystemPage /></Suspense>} />
          <Route path="billing" element={<Suspense fallback={<MinimalLoader />}><InternalBillingPage /></Suspense>} />
        </Route>
        <Route path="/esign/:envelopeId/:signerId/:token" element={<PublicSignPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
