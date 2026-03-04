import { useState, useEffect, FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "../../components/ui/Logo";
import axios from "axios";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to reset password";
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">Password Reset!</h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your password has been successfully reset.
              </p>
              <p className="text-xs text-slate-500 pt-4">
                Redirecting you to login...
              </p>
            </div>
          ) : (
            <>
              {/* Welcome text */}
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-white mb-1">Set New Password</h1>
                <p className="text-sm text-slate-400">
                  Choose a strong password for your account
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
                    htmlFor="password"
                    className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl bg-white/10 border border-white/15 px-5 py-3.5 pr-12 text-sm text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400/60 placeholder:text-slate-500 backdrop-blur-2xl transition-all hover:border-white/30 hover:bg-white/15"
                      placeholder="Min 8 characters"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      tabIndex={-1}
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

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-2xl bg-white/10 border border-white/15 px-5 py-3.5 pr-12 text-sm text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400/60 placeholder:text-slate-500 backdrop-blur-2xl transition-all hover:border-white/30 hover:bg-white/15"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      tabIndex={-1}
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

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/40 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Resetting...
                    </span>
                  ) : (
                    'Reset Password'
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
        </div>
      </div>
    </div>
  );
}
