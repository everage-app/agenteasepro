import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface PageLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  headerActions?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  maxWidth?: 'xl' | '2xl' | '4xl' | '6xl' | '7xl' | 'full';
}

export function PageLayout({
  children,
  title,
  subtitle,
  actions,
  headerActions,
  breadcrumbs,
  maxWidth = '7xl',
}: PageLayoutProps) {
  const maxWidthClasses = {
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  };

  return (
    <div className="min-h-screen bg-transparent pb-20 lg:pb-0">
      {/* Page Header - Stunning gradient in light mode */}
      <div className="border-b border-white/10 bg-slate-950/30 backdrop-blur-sm ae-page-header">
        <div className={`mx-auto px-4 sm:px-6 py-4 sm:py-6 ${maxWidthClasses[maxWidth]}`}>
          {/* Breadcrumbs - hidden on mobile */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="hidden sm:flex mb-4 items-center gap-2 text-sm">
              {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex items-center gap-2">
                  {index > 0 && (
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                  {crumb.href ? (
                    <Link to={crumb.href} className="text-slate-400 hover:text-white transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-medium ae-text">{crumb.label}</span>
                  )}
                </div>
              ))}
            </nav>
          )}

          {/* Title and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate ae-text">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 sm:mt-2 text-sm leading-relaxed line-clamp-2 sm:line-clamp-none sm:max-w-3xl ae-muted">
                  {subtitle}
                </p>
              )}
            </div>
            {(actions || headerActions) && (
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {actions || headerActions}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className={`mx-auto px-4 sm:px-6 py-4 sm:py-8 ${maxWidthClasses[maxWidth]}`}>
        {children}
      </div>
    </div>
  );
}
