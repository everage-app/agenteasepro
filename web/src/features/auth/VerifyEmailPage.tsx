import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from './authStore';
import axios from 'axios';

export function VerifyEmailPage() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const agent = useAuthStore((s) => s.agent);
  const token = useAuthStore((s) => s.token);
  const setEmailVerified = useAuthStore((s) => s.setEmailVerified);
  const logout = useAuthStore((s) => s.logout);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newCode = [...code];
    if (value.length > 1) {
      // Handle paste: fill subsequent fields
      const digits = value.slice(0, 6 - index).split('');
      digits.forEach((d, i) => {
        if (index + i < 6) newCode[index + i] = d;
      });
      setCode(newCode);
      const nextIdx = Math.min(index + digits.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newCode = [...code];
    pasted.split('').forEach((d, i) => {
      if (i < 6) newCode[i] = d;
    });
    setCode(newCode);
    const nextIdx = Math.min(pasted.length, 5);
    inputRefs.current[nextIdx]?.focus();
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await axios.post(
        '/api/auth/verify-email',
        { code: fullCode },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSuccess('Email verified! Redirecting...');
      setEmailVerified(true);
      setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Verification failed. Try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || cooldown > 0) return;

    setResending(true);
    setError(null);
    setSuccess(null);

    try {
      await axios.post(
        '/api/auth/resend-verification',
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSuccess('New verification code sent! Check your email.');
      setCooldown(60);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to resend. Try again.';
      setError(msg);
    } finally {
      setResending(false);
    }
  };

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    const fullCode = code.join('');
    if (fullCode.length === 6 && !loading) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

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
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 rounded-[44px] blur-2xl opacity-60 animate-pulse" style={{ animationDuration: '4s' }} />

        <div className="login-card relative rounded-[40px] border border-slate-200/60 dark:border-white/[0.08] bg-gradient-to-b from-white/95 via-slate-50/95 to-white/90 dark:from-slate-900/80 dark:to-slate-950/90 backdrop-blur-2xl px-8 py-10 shadow-[0_25px_80px_rgba(15,23,42,0.15),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_40px_120px_rgba(2,6,23,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="absolute inset-0 rounded-[40px] bg-gradient-to-b from-white/70 via-white/10 to-transparent dark:from-white/[0.03] pointer-events-none" />

          {/* Header */}
          <div className="relative flex items-center justify-center mb-2">
            <img
              src="/logo-dark-mode.svg"
              alt="AgentEase Pro"
              className="h-9 sm:h-10 w-auto select-none"
              draggable={false}
            />
          </div>

          <div className="relative text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 mb-4">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
              Verify Your Email
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              We sent a 6-digit code to<br />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {agent?.email || 'your email'}
              </span>
            </p>
          </div>

          {/* Code Input */}
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex justify-center gap-2 sm:gap-3 mb-6" onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold rounded-xl border-2 transition-all duration-200 outline-none
                    ${digit
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white'
                    }
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                  `}
                  disabled={loading}
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            {/* Error / Success */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-300 text-center">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 text-sm text-emerald-700 dark:text-emerald-300 text-center">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.join('').length !== 6}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all duration-200 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Verify Email'
              )}
            </button>
          </form>

          {/* Resend */}
          <div className="relative mt-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Didn't receive the code?
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : resending
                  ? 'Sending...'
                  : 'Resend Code'
              }
            </button>
          </div>

          {/* Back to login */}
          <div className="relative mt-6 pt-4 border-t border-slate-200/60 dark:border-white/[0.06] text-center">
            <button
              type="button"
              onClick={() => { logout(); navigate('/login', { replace: true }); }}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Sign out &amp; use a different account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
