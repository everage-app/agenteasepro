import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const CHUNK_RELOAD_KEY = 'aep_chunk_reload_attempts';
const MAX_CHUNK_RELOAD_ATTEMPTS = 2;

function isChunkLoadError(message: string) {
  const text = message.toLowerCase();
  return text.includes('failed to fetch dynamically imported module')
    || text.includes('loading chunk')
    || text.includes('chunkloaderror')
    || text.includes('importing a module script failed')
    || text.includes('dynamically imported module');
}

/**
 * Error Boundary component to catch JavaScript errors in child components.
 * Prevents white/black screens on mobile by showing a friendly error message.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Recover from stale chunk/module loads with cache-busting refresh attempts.
    if (typeof window !== 'undefined' && isChunkLoadError(error.message || '')) {
      try {
        const attempts = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
        if (attempts < MAX_CHUNK_RELOAD_ATTEMPTS) {
          window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(attempts + 1));
          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.set('_aep_refresh', String(Date.now()));
          window.location.replace(nextUrl.toString());
          return;
        }
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      } catch {
        // If storage is unavailable, still attempt one recovery reload.
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('_aep_refresh', String(Date.now()));
        window.location.replace(nextUrl.toString());
        return;
      }
    }

    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Could send to error tracking service here
    if (typeof window !== 'undefined' && (window as any).reportClientError) {
      (window as any).reportClientError({
        source: 'error-boundary',
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  private clearRecoverableClientState = (includeAuth: boolean) => {
    try {
      const localKeysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;

        const shouldRemove =
          key.startsWith('aep_') ||
          key.startsWith('agentease_') ||
          key.startsWith('agent_') ||
          key.startsWith('internal.activity.') ||
          key.includes('_settings_cache') ||
          key.includes('_manual_overrides') ||
          (includeAuth && key === 'utahcontracts_token');

        if (shouldRemove) localKeysToRemove.push(key);
      }

      localKeysToRemove.forEach((key) => localStorage.removeItem(key));
      sessionStorage.clear();
    } catch {
      // Ignore storage access errors in private browsing modes.
    }
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.clearRecoverableClientState(false);
    window.location.reload();
  };

  handleReload = () => {
    this.clearRecoverableClientState(false);
    window.location.reload();
  };

  handleFreshSignIn = () => {
    this.clearRecoverableClientState(true);
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
          <div className="w-full max-w-md text-center">
            {/* Error Icon */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h1 className="text-xl font-bold text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-slate-400 text-sm mb-6">
              We're sorry, but something unexpected happened. Please try again.
            </p>

            {/* Error details (only in dev) */}
            {(import.meta as any).env?.DEV && this.state.error && (
              <div className="mb-6 p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-left">
                <p className="text-xs text-red-400 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRetry}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 active:scale-[0.98] transition-all"
              >
                Try Again
              </button>
              <p className="-mt-1 text-[11px] text-slate-400">
                We will safely refresh your workspace automatically.
              </p>
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 text-white font-semibold text-sm hover:bg-slate-700 active:scale-[0.98] transition-all"
              >
                Refresh App
              </button>
              <button
                onClick={this.handleFreshSignIn}
                className="w-full py-2 px-4 text-slate-400 text-sm hover:text-slate-300 transition-colors"
              >
                Sign in again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error handling for functional components
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  if (error) {
    throw error; // Let ErrorBoundary catch it
  }

  return { captureError, resetError };
}
