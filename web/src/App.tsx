import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { isInternalHost } from './features/internal/isInternalHost';
import { HostInternalRedirect } from './features/internal/HostInternalRedirect';
import { OwnerRoute } from './features/internal/OwnerRoute';
import { InternalShell } from './features/internal/InternalShell';
import { useAuthStore } from './features/auth/authStore';
import { reportClientError, trackEvent } from './lib/telemetry';

// All routes loaded eagerly for stability
import { LoginPage } from './features/auth/LoginPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage';
import { DashboardPage } from './features/deals/DashboardPage';
import { DealCreateWizard } from './features/deals/DealCreateWizard';
import { DealsKanban } from './features/deals/DealsKanban';
import { RepcWizard } from './features/repc/RepcWizard';
import { ListingsPage } from './features/listings/ListingsPage';
import { ClientsListPage } from './features/clients/ClientsListPage';
import { ClientDetailPage } from './features/clients/ClientDetailPage';
import { ContractsHub } from './features/contracts/ContractsHub';
import { PdfEditor } from './features/contracts/PdfEditor';
import { DealTemplateFormPage } from './features/contracts/DealTemplateFormPage';
import { TasksPage } from './features/tasks/TasksPage';
import { MarketingPage } from './features/marketing/MarketingPage';
import { BlastDetailPage } from './features/marketing/BlastDetailPage';
import { PublicSignPage } from './features/esign/PublicSignPage';
import LeadsDashboard from './features/leads/LeadsDashboard';
import { CalendarPage } from './features/calendar/CalendarPage';
import { AutomationsPage } from './features/automations/AutomationsPage';
import { SettingsLayout } from './features/settings/SettingsLayout';
import { SettingsIndexPage } from './features/settings/SettingsIndexPage';
import { ProfileSettingsPage } from './features/settings/ProfileSettingsPage';
import { ClientsSettingsPage } from './features/settings/ClientsSettingsPage';
import { LeadsSettingsPage } from './features/settings/LeadsSettingsPage';
import { BrandingSettingsPage } from './features/settings/BrandingSettingsPage';
import { IntegrationsSettingsPage } from './features/settings/IntegrationsSettingsPage';
import { AutomationsSettingsPage } from './features/settings/AutomationsSettingsPage';
import { NotificationsSettingsPage } from './features/settings/NotificationsSettingsPage';
import { BillingSettingsPage } from './features/settings/BillingSettingsPage';
import { DataSettingsPage } from './features/settings/DataSettingsPage';
import { IdxSettingsPage } from './features/settings/IdxSettingsPage';
import { LandingPagesSettingsPage } from './features/settings/LandingPagesSettingsPage';
import { LandingPageEditorPage } from './features/settings/LandingPageEditorPage';
import PropertySearch from './features/properties/PropertySearch';
import { ReportingPage } from './features/reporting/ReportingPage';
import { InternalLoginPage } from './features/internal/InternalLoginPage';
import { InternalOverviewPage } from './features/internal/pages/InternalOverviewPage';
import { InternalAgentsPage } from './features/internal/pages/InternalAgentsPage';
import { InternalAgentDetailPage } from './features/internal/pages/InternalAgentDetailPage';
import { InternalListingsPage } from './features/internal/pages/InternalListingsPage';
import { InternalContractsPage } from './features/internal/pages/InternalContractsPage';
import { InternalSystemPage } from './features/internal/pages/InternalSystemPage';
import { InternalBillingPage } from './features/internal/pages/InternalBillingPage';
import { InternalActivityPage } from './features/internal/pages/InternalActivityPage';
import { InternalUsagePage } from './features/internal/pages/InternalUsagePage';
import { InternalSupportPage } from './features/internal/pages/InternalSupportPage';
import { InternalCalculationsPage } from './features/internal/pages/InternalCalculationsPage';
import { InternalCampaignsPage } from './features/internal/pages/InternalCampaignsPage';
import { BillingAccessGate } from './features/billing/BillingAccessGate';

function isNonActionableRejection(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false;

  const anyReason = reason as any;
  const name = typeof anyReason?.name === 'string' ? anyReason.name.toLowerCase() : '';
  const message = typeof anyReason?.message === 'string' ? anyReason.message.toLowerCase() : '';

  if (anyReason?.isAxiosError) return true;
  if (anyReason?.response && typeof anyReason.response.status === 'number') return true;
  if (name === 'aborterror' || message.includes('aborted')) return true;
  if (message.includes('network error')) return true;

  return false;
}

export default function App() {
  const location = useLocation();
  const internalHost = typeof window !== 'undefined' && isInternalHost(window.location.hostname);
  const token = useAuthStore((s) => s.token);
  const loadAgent = useAuthStore((s) => s.loadAgent);
  const lastTrackedPathRef = useRef<string>('');

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

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
        <Route path="/login" element={internalHost ? <InternalLoginPage /> : <LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
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
          <Route path="search" element={<PropertySearch />} />
          <Route path="deals" element={<DealsKanban />} />
          <Route path="deals/:dealId" element={<DealsKanban />} />
          <Route path="deals/new" element={<DealCreateWizard />} />
          <Route path="deals/:dealId/repc" element={<RepcWizard />} />
          <Route path="clients" element={<ClientsListPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="contracts" element={<ContractsHub />} />
          <Route path="contracts/pdf-editor" element={<PdfEditor />} />
          <Route path="deals/:dealId/forms/:formCode" element={<DealTemplateFormPage />} />
          <Route path="listings" element={<ListingsPage />} />
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
          <Route index element={<InternalOverviewPage />} />
          <Route path="agents" element={<InternalAgentsPage />} />
          <Route path="agents/:id" element={<InternalAgentDetailPage />} />
          <Route path="activity" element={<InternalActivityPage />} />
          <Route path="usage" element={<InternalUsagePage />} />
          <Route path="support" element={<InternalSupportPage />} />
          <Route path="listings" element={<InternalListingsPage />} />
          <Route path="contracts" element={<InternalContractsPage />} />
          <Route path="campaigns" element={<InternalCampaignsPage />} />
          <Route path="calculations" element={<InternalCalculationsPage />} />
          <Route path="system" element={<InternalSystemPage />} />
          <Route path="billing" element={<InternalBillingPage />} />
        </Route>
        <Route path="/esign/:envelopeId/:signerId/:token" element={<PublicSignPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
