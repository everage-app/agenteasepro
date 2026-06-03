import React, { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "./authStore";
import { Logo } from "../../components/ui/Logo";
import { AnimatedAppBackground } from "../../components/layout/AnimatedAppBackground";
import { toDisplayErrorMessage } from "../../lib/errorMessages";

type AuthMode = 'login' | 'signup';

const HOSTED_DEMO_URL = 'https://app.agenteasepro.com/login?demo=1';
const LOCAL_DEMO_DB_ERROR_PATTERN = /authentication failed against database server/i;
const MARKETING_ATTRIBUTION_KEY = 'aep_marketing_attribution';

const isLocalDemoDatabaseError = (err: any) => {
  if (!import.meta.env.DEV) return false;
  const rawError = err?.response?.data?.error ?? err?.response?.data ?? err;
  const rawText = typeof rawError === 'string' ? rawError : JSON.stringify(rawError || '');
  return LOCAL_DEMO_DB_ERROR_PATTERN.test(rawText);
};

const authErrorMessage = (err: any, fallback: string) => {
  const status = Number(err?.response?.status || 0);
  const rawError = err?.response?.data?.error ?? err?.response?.data ?? err;
  const rawText = typeof rawError === 'string' ? rawError : JSON.stringify(rawError || '');
  if (import.meta.env.DEV && LOCAL_DEMO_DB_ERROR_PATTERN.test(rawText)) {
    return 'Local demo access is blocked because the database credentials in your environment are invalid. Update DATABASE_URL and retry.';
  }
  if (status >= 500) return fallback;
  return toDisplayErrorMessage(rawError, fallback);
};

function persistMarketingAttribution(search: string, entryPath: string) {
  const params = new URLSearchParams(search);
  const hasAttribution =
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'aep_vid', 'aep_sid', 'aep_landing_path']
      .some((key) => params.has(key));

  if (!hasAttribution) return;

  try {
    const existingRaw = window.localStorage.getItem(MARKETING_ATTRIBUTION_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    window.localStorage.setItem(MARKETING_ATTRIBUTION_KEY, JSON.stringify({
      ...(existing && typeof existing === 'object' ? existing : {}),
      visitorId: params.get('aep_vid') || existing?.visitorId,
      sessionId: params.get('aep_sid') || existing?.sessionId,
      landingPath: params.get('aep_landing_path') || existing?.landingPath,
      entryPath,
      referrer: document.referrer || existing?.referrer,
      utmSource: params.get('utm_source') || existing?.utmSource,
      utmMedium: params.get('utm_medium') || existing?.utmMedium,
      utmCampaign: params.get('utm_campaign') || existing?.utmCampaign,
      utmContent: params.get('utm_content') || existing?.utmContent,
      utmTerm: params.get('utm_term') || existing?.utmTerm,
      capturedAt: new Date().toISOString(),
    }));
  } catch {
  }
}

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [legalPolicies, setLegalPolicies] = useState<{
    terms: { url: string; version: string };
    privacy: { url: string; version: string };
  } | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const autoDemoRanRef = useRef(false);
  const login = useAuthStore((state) => state.login);
  const signup = useAuthStore((state) => state.signup);
  const demoLogin = useAuthStore((state) => state.demoLogin);
  const emailVerified = useAuthStore((state) => state.emailVerified);

  useEffect(() => {
    persistMarketingAttribution(location.search, `${location.pathname}${location.search || ''}`);
  }, [location.pathname, location.search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/legal-policies');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setLegalPolicies(data);
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (autoDemoRanRef.current) return;
    const params = new URLSearchParams(location.search);
    if (params.get('demo') !== '1') return;

    autoDemoRanRef.current = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await demoLogin();
        navigate('/');
      } catch (err: any) {
        if (isLocalDemoDatabaseError(err)) {
          window.location.assign(HOSTED_DEMO_URL);
          return;
        }
        const rawMsg = authErrorMessage(err, 'Demo access is temporarily unavailable. Please try again in a moment.');
        const msg = rawMsg.toLowerCase().includes('not found')
          ? 'Demo access is temporarily unavailable. Please try again in a moment.'
          : rawMsg;
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [demoLogin, location.search, navigate]);

  const copyDemoLink = async () => {
    try {
      const demoUrl = import.meta.env.DEV ? HOSTED_DEMO_URL : `${window.location.origin}/login?demo=1`;
      await navigator.clipboard.writeText(demoUrl);
      setError('Demo link copied. Share it to let someone try the app.');
      window.setTimeout(() => setError(null), 1800);
    } catch {
      setError('Could not copy demo link on this device.');
      window.setTimeout(() => setError(null), 1800);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (!acceptLegal) {
        setError('Please accept the Terms and Privacy Policy to create your account');
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords don't match");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await signup({
          name: name.trim() || undefined,
          email,
          password,
          acceptTerms: true,
          acceptPrivacy: true,
        });
        // New signups always need email verification
        navigate("/verify-email");
      } else {
        await login(email, password);
        // Check if returning user still needs verification
        const verified = useAuthStore.getState().emailVerified;
        navigate(verified ? "/" : "/verify-email");
      }
    } catch (err: any) {
      setError(authErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setAcceptLegal(false);
  };

  const termsUrl = legalPolicies?.terms?.url || 'https://app.agenteasepro.com/legal/terms.html';
  const privacyUrl = legalPolicies?.privacy?.url || 'https://app.agenteasepro.com/legal/privacy.html';

  return (
    <div className="ae-bg min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-10">
      <AnimatedAppBackground />

      {/* Auth Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Glow effect behind card */}
        <div className="login-card-glow absolute -inset-1 rounded-[44px] blur-2xl opacity-70 animate-pulse" style={{ animationDuration: '4s' }} />
        
        <div className="login-card relative rounded-[40px] border border-slate-200/60 dark:border-white/[0.08] bg-gradient-to-b from-white/95 via-slate-50/95 to-white/90 dark:from-slate-900/80 dark:to-slate-950/90 backdrop-blur-2xl px-8 py-10 shadow-[0_25px_80px_rgba(15,23,42,0.15),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_40px_120px_rgba(2,6,23,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
          {/* Subtle inner highlight */}
          <div className="absolute inset-0 rounded-[40px] bg-gradient-to-b from-white/70 via-white/10 to-transparent dark:from-white/[0.03] pointer-events-none" />
          
          {/* Header with logo */}
          <div className="relative flex items-center justify-center mb-7">
            <Logo size="lg" showText className="scale-110 sm:scale-125 select-none" />
          </div>

          {/* Mode Toggle */}
          <div className="relative login-toggle-bg flex rounded-2xl bg-white/70 dark:bg-white/5 p-1.5 mb-8 border border-slate-200/70 dark:border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-none">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
                mode === 'login'
                    ? 'login-toggle-active bg-gradient-to-r from-[#d6b56d] via-[#f2d894] to-[#b9bcc4] text-[#07090d] shadow-lg shadow-[#d6b56d]/20'
                    : 'login-toggle-inactive text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
                mode === 'signup'
                    ? 'login-toggle-active bg-gradient-to-r from-[#d6b56d] via-[#f2d894] to-[#b9bcc4] text-[#07090d] shadow-lg shadow-[#d6b56d]/20'
                    : 'login-toggle-inactive text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Welcome text */}
          <div className="relative text-center mb-6">
            <h1 className="login-heading text-2xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent mb-1">
              {mode === 'login' ? 'Welcome back' : 'Get started free'}
            </h1>
            <p className="login-subtext text-sm text-slate-500 dark:text-slate-400">
              {mode === 'login' 
                ? 'Sign in to access your real estate workspace' 
                : 'Create your agent account in seconds'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="login-error mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="relative space-y-4">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="name"
                  className="login-label block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2"
                >
                  Your Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="login-input w-full rounded-2xl bg-white/90 border border-slate-200/80 px-5 py-3.5 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-2 focus:ring-[#d6b56d]/30 focus:border-[#d6b56d]/50 focus:bg-white placeholder:text-slate-400 backdrop-blur-xl transition-all duration-200 hover:border-slate-300/80 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] dark:focus:bg-slate-800/70 dark:placeholder:text-slate-500 dark:hover:border-slate-600/60 dark:hover:bg-slate-800/60"
                  placeholder="Jane Smith"
                  autoComplete="name"
                />
              </div>
            )}

            {mode === 'signup' && (
              <label className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={acceptLegal}
                  onChange={(e) => setAcceptLegal(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900/80 text-[#d6b56d] focus:ring-[#d6b56d]/40"
                />
                <span>
                  I agree to the{' '}
                  <a href={termsUrl} target="_blank" rel="noreferrer" className="text-[#f2d894] hover:text-white underline underline-offset-2">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href={privacyUrl} target="_blank" rel="noreferrer" className="text-[#f2d894] hover:text-white underline underline-offset-2">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            )}

            <div>
              <label
                htmlFor="email"
                className="login-label block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input w-full rounded-2xl bg-white/90 border border-slate-200/80 px-5 py-3.5 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-2 focus:ring-[#d6b56d]/30 focus:border-[#d6b56d]/50 focus:bg-white placeholder:text-slate-400 backdrop-blur-xl transition-all duration-200 hover:border-slate-300/80 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] dark:focus:bg-slate-800/70 dark:placeholder:text-slate-500 dark:hover:border-slate-600/60 dark:hover:bg-slate-800/60"
                placeholder="you@yourbrokerage.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="login-label block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input w-full rounded-2xl bg-white/90 border border-slate-200/80 px-5 py-3.5 pr-12 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-2 focus:ring-[#d6b56d]/30 focus:border-[#d6b56d]/50 focus:bg-white placeholder:text-slate-400 backdrop-blur-xl transition-all duration-200 hover:border-slate-300/80 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] dark:focus:bg-slate-800/70 dark:placeholder:text-slate-500 dark:hover:border-slate-600/60 dark:hover:bg-slate-800/60"
                  placeholder={mode === 'signup' ? 'Min 8 characters' : '••••••••'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="login-label block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="login-input w-full rounded-2xl bg-white/90 border border-slate-200/80 px-5 py-3.5 pr-12 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-2 focus:ring-[#d6b56d]/30 focus:border-[#d6b56d]/50 focus:bg-white placeholder:text-slate-400 backdrop-blur-xl transition-all duration-200 hover:border-slate-300/80 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] dark:focus:bg-slate-800/70 dark:placeholder:text-slate-500 dark:hover:border-slate-600/60 dark:hover:bg-slate-800/60"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-primary-btn w-full rounded-2xl bg-gradient-to-r from-[#d6b56d] via-[#f2d894] to-[#b9bcc4] px-6 py-4 text-sm font-bold text-[#07090d] shadow-[0_8px_30px_rgba(214,181,109,0.24)] transition-all duration-200 hover:shadow-[0_12px_40px_rgba(214,181,109,0.32)] hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-3"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
                </span>
              ) : (
                mode === 'signup' ? 'Create my account' : 'Sign in'
              )}
            </button>
          </form>

          {/* Demo Access Button (Login Mode Only) */}
          {mode === 'login' && (
            <div className="relative mt-5">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="login-divider w-full border-t border-slate-200/70 dark:border-slate-700/50"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="login-divider-text px-4 bg-gradient-to-b from-white/95 to-slate-50/90 dark:from-slate-900/80 dark:to-slate-950/90 text-slate-500 font-medium">or explore as guest</span>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    await demoLogin();
                    navigate('/');
                  } catch (err: any) {
                    if (isLocalDemoDatabaseError(err)) {
                      window.location.assign(HOSTED_DEMO_URL);
                      return;
                    }
                    setError(authErrorMessage(err, 'Demo access is temporarily unavailable. Please try again in a moment.'));
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="login-demo-btn w-full mt-4 rounded-2xl bg-white/90 border border-slate-200/80 px-6 py-3.5 text-sm font-semibold text-slate-700 backdrop-blur-xl shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-all duration-200 hover:bg-white hover:border-slate-300 hover:text-slate-900 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed group dark:bg-slate-800/40 dark:border-slate-700/40 dark:text-slate-300 dark:shadow-lg dark:hover:bg-slate-700/50 dark:hover:border-slate-600/50 dark:hover:text-white"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500 group-hover:text-emerald-600 dark:text-emerald-400 dark:group-hover:text-emerald-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Try Demo Access
                </span>
              </button>
              <p className="login-subtext mt-2 text-center text-xs text-slate-500 dark:text-slate-500">
                Instant access • No registration • Full features
              </p>

              {import.meta.env.DEV && (
                <p className="login-subtext mt-1 text-center text-[11px] text-slate-500 dark:text-slate-500">
                  If local demo access is unavailable, we will open the hosted demo automatically.
                </p>
              )}

              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={copyDemoLink}
                  className="login-link text-xs text-slate-500 hover:text-[#8a6f36] dark:text-slate-400 dark:hover:text-[#f2d894] transition-colors"
                >
                  Copy demo link
                </button>
              </div>
            </div>
          )}

          {/* Forgot Password Link (Login Mode Only) */}
          {mode === 'login' && (
            <div className="mt-4 text-center">
              <a
                href="/forgot-password"
                className="login-link text-sm text-slate-500 hover:text-[#8a6f36] dark:text-slate-400 dark:hover:text-[#f2d894] transition-colors"
              >
                Forgot your password?
              </a>
            </div>
          )}

          {/* Switch Mode Link */}
          <div className="relative mt-6 text-center">
            <button
              type="button"
              onClick={switchMode}
              className="login-link text-sm text-slate-500 hover:text-[#8a6f36] dark:text-slate-400 dark:hover:text-[#f2d894] transition-colors duration-200"
            >
              {mode === 'login' 
                ? "Don't have an account? Sign up free →" 
                : "Already have an account? Sign in →"}
            </button>
          </div>

          {/* Footer */}
          <div className="login-footer relative mt-8 pt-6 border-t border-slate-200/70 dark:border-slate-700/30 text-center">
            <p className="login-footer-text text-xs text-slate-500 leading-relaxed">
              By continuing, you agree to our{' '}
              <a href={termsUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[#8a6f36] dark:hover:text-[#f2d894]">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href={privacyUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[#8a6f36] dark:hover:text-[#f2d894]">
                Privacy Policy
              </a>
              <br />
              <span className="text-slate-600 dark:text-slate-600">
                Protected by enterprise-grade security
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

