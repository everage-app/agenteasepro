import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
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

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleClearAndReload = () => {
    // Clear local storage and reload
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // Ignore storage errors
    }
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
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 text-white font-semibold text-sm hover:bg-slate-700 active:scale-[0.98] transition-all"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleClearAndReload}
                className="w-full py-2 px-4 text-slate-400 text-sm hover:text-slate-300 transition-colors"
              >
                Clear Data & Sign Out
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
