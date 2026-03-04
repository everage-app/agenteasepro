import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';
import { useAuthStore } from '../auth/authStore';

const DEFAULT_OWNER_EMAIL = 'brysenp@gmail.com';

function getOwnerEmail() {
  // Optional override later without code changes.
  // Example: VITE_INTERNAL_OWNER_EMAIL=brysen@agenteasepro.com
  const fromEnv = (import.meta as any)?.env?.VITE_INTERNAL_OWNER_EMAIL as string | undefined;
  return (fromEnv || DEFAULT_OWNER_EMAIL).trim().toLowerCase();
}

export function InternalLoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const devLogin = useAuthStore((s) => s.devLogin);

  const email = useMemo(() => getOwnerEmail(), []);
  const isDev = Boolean((import.meta as any)?.env?.DEV);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate('/internal');
    } catch (err: any) {
      console.error('Login error:', err);
      let msg = err?.response?.data?.error || err?.message || 'Something went wrong';
      if (msg === 'Network Error') {
        msg = 'Connection failed. Server may be offline.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      await devLogin(email);
      navigate('/internal');
    } catch (err: any) {
      console.error('Dev login error:', err);
      let msg = err?.response?.data?.error || err?.message || 'Something went wrong';
      if (msg === 'Network Error') {
        msg = 'Connection failed. Server may be offline.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ae-bg min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-10">
      <div className="ae-bg-image" />
      <div className="ae-bg-gradient" />
      <div className="ae-bg-colorwash" />
      <div className="ae-bg-wave" />
      <div className="ae-bg-wave-2" />
      <div className="ae-bg-wave-3" />
      <div className="ae-bg-aurora" />
      <div className="ae-bg-trails" />
      <div className="ae-bg-stars" />
      <div className="ae-bg-wave-grid" />
      <div className="ae-bg-noise" />
      <div className="ae-bg-vignette" />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-[40px] border border-white/10 bg-slate-950/60 backdrop-blur-2xl px-8 py-10 shadow-[0_40px_120px_rgba(2,6,23,0.9)]">
          <div className="flex items-center justify-center mb-5">
            <Logo size="lg" showText={true} />
          </div>

          <div className="flex items-center justify-center mb-8">
            <span className="inline-flex text-[10px] font-bold tracking-[0.2em] text-cyan-200/80 border border-cyan-400/20 bg-cyan-500/10 rounded-full px-3 py-1.5">
              INTERNAL OWNER ACCESS
            </span>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">Founder sign in</h1>
            <p className="text-sm text-slate-400">Private portal for internal.agenteasepro.com</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                disabled
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-5 py-3.5 text-sm text-slate-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] focus:outline-none placeholder:text-slate-500 backdrop-blur-2xl"
              />
              <div className="mt-2 text-[11px] text-slate-500">
                System locked to authorized founder email.
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl bg-white/10 border border-white/15 px-5 py-3.5 pr-12 text-sm text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400/60 placeholder:text-slate-500 backdrop-blur-2xl transition-all hover:border-white/30 hover:bg-white/15"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/40 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </button>

            {isDev && (
              <button
                type="button"
                disabled={loading}
                onClick={handleDevLogin}
                className="w-full rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-cyan-100 transition-all hover:bg-cyan-500/15 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Local owner access (dev)
              </button>
            )}

            <div className="text-center pt-2">
              <div className="text-xs text-slate-500">Not for customers. Owner-only portal.</div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
