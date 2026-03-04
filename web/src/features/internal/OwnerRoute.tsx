import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import api from '../../lib/api';

interface Props {
  children: ReactNode;
}

export function OwnerRoute({ children }: Props) {
  const location = useLocation();
  const [state, setState] = useState<'loading' | 'allowed' | 'denied' | 'misconfigured'>('loading');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await api.get('/internal/access');
        if (cancelled) return;
        const allowed = Boolean(res.data?.allowed);
        const configured = Boolean(res.data?.configured);
        if (!configured) {
          setState('misconfigured');
          return;
        }
        setState(allowed ? 'allowed' : 'denied');
      } catch {
        if (!cancelled) setState('denied');
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 backdrop-blur-xl px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400" />
            <div className="text-sm text-slate-200 font-semibold">Verifying owner access…</div>
          </div>
          <div className="mt-1 text-xs text-slate-400">This portal is private and owner-only.</div>
        </div>
      </div>
    );
  }

  if (state === 'misconfigured') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-[28px] border border-white/10 bg-slate-950/70 backdrop-blur-2xl p-6">
          <div className="text-sm font-bold text-white">Internal portal not configured</div>
          <div className="mt-2 text-sm text-slate-400">
            Set <span className="text-slate-200 font-semibold">AGENTEASE_OWNER_EMAIL</span> (or <span className="text-slate-200 font-semibold">AGENTEASE_OWNER_ID</span>) on the server, then reload.
          </div>
          <div className="mt-4 text-xs text-slate-500">You’re signed in, but owner access can’t be verified yet.</div>
        </div>
      </div>
    );
  }

  if (state === 'denied') {
    return <Navigate to="/dashboard" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
