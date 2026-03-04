import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../auth/authStore';

type BillingSubscription = {
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | string;
  accessBlocked?: boolean;
};

const ALLOWED_PATHS_WHEN_BLOCKED = ['/settings/billing', '/verify-email'];

export function BillingAccessGate() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const [blocked, setBlocked] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [portalLoading, setPortalLoading] = useState(false);

  const bypassGate = useMemo(() => {
    return ALLOWED_PATHS_WHEN_BLOCKED.some((path) => location.pathname.startsWith(path));
  }, [location.pathname]);

  useEffect(() => {
    if (!token) {
      setBlocked(false);
      return;
    }

    if (location.pathname.startsWith('/internal')) {
      setBlocked(false);
      return;
    }

    let cancelled = false;

    const checkBillingAccess = async () => {
      try {
        const res = await api.get<BillingSubscription>('/billing/subscription');
        const nextStatus = String(res.data?.status || '').toLowerCase();
        const nextBlocked =
          typeof res.data?.accessBlocked === 'boolean'
            ? res.data.accessBlocked
            : nextStatus !== 'active' && nextStatus !== 'trialing';

        if (!cancelled) {
          setStatus(nextStatus);
          setBlocked(nextBlocked);
        }
      } catch {
        if (!cancelled) {
          setBlocked(false);
        }
      }
    };

    checkBillingAccess();
    const intervalId = window.setInterval(checkBillingAccess, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [token, location.pathname]);

  const openPortal = async () => {
    try {
      setPortalLoading(true);
      const res = await api.post('/billing/create-portal-session', {});
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      navigate('/settings/billing');
    } catch {
      navigate('/settings/billing');
    } finally {
      setPortalLoading(false);
    }
  };

  if (!token || !blocked || bypassGate) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gradient-to-br dark:from-[#030b1a]/90 dark:via-[#041128]/85 dark:to-[#010712]/90 p-6 shadow-xl dark:shadow-[0_25px_80px_rgba(1,8,20,0.65)]">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Billing action required</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Your 7-day trial has ended or your subscription is not active. To restore full access, update billing and complete payment.
        </p>
        {status ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Current status: <span className="font-semibold uppercase tracking-wide">{status}</span>
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/settings/billing')}
            className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            Go to billing
          </button>
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="rounded-lg border border-slate-300 dark:border-white/20 bg-white/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-60"
          >
            {portalLoading ? 'Opening portal...' : 'Open Stripe portal'}
          </button>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-300 dark:border-white/20 bg-white/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
