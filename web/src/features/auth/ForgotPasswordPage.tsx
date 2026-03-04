import { useState, FormEvent } from "react";
import { Logo } from "../../components/ui/Logo";
import axios from "axios";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await axios.post('/api/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to send reset email";
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

      {/* Reset Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-[40px] border border-white/10 bg-slate-950/60 backdrop-blur-2xl px-8 py-10 shadow-[0_40px_120px_rgba(2,6,23,0.9)]">
          {/* Header with logo */}
          <div className="flex items-center justify-center mb-6">
            <Logo size="lg" showText={true} />
          </div>

          {success ? (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">Check Your Email</h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                We've sent password reset instructions to <span className="text-white font-medium">{email}</span>
              </p>
              <p className="text-xs text-slate-500 pt-4">
                Didn't receive the email? Check your spam folder or try again in a few minutes.
              </p>
              <a
                href="/login"
                className="inline-block mt-6 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                ← Back to login
              </a>
            </div>
          ) : (
            <>
              {/* Welcome text */}
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-white mb-1">Reset Your Password</h1>
                <p className="text-sm text-slate-400">
                  Enter your email and we'll send you reset instructions
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2"
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl bg-white/10 border border-white/15 px-5 py-3.5 text-sm text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400/60 placeholder:text-slate-500 backdrop-blur-2xl transition-all hover:border-white/30 hover:bg-white/15"
                    placeholder="you@yourbrokerage.com"
                    autoComplete="email"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/40 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send Reset Instructions'
                  )}
                </button>
              </form>

              {/* Back to login */}
              <div className="mt-6 text-center">
                <a
                  href="/login"
                  className="text-sm text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  ← Back to login
                </a>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-slate-500 leading-relaxed">
              Need help? Contact support
              <br />
              <span className="text-slate-600">
                Protected by enterprise-grade security
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
