/**
 * Reusable loading skeleton primitives.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />                     // single bar
 *   <SkeletonCard />                                       // card placeholder
 *   <SkeletonTable rows={5} cols={4} />                    // table placeholder
 *   <SkeletonList count={6} />                             // list placeholder
 */
import { ReactNode } from 'react';

/* ── Base shimmer bar ─────────────────────────────────────────────── */

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded bg-white/[0.06] animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

/* ── Card skeleton ────────────────────────────────────────────────── */

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4 ${className}`}>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/* ── Table skeleton ───────────────────────────────────────────────── */

export function SkeletonTable({
  rows = 5,
  cols = 4,
  className = '',
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex gap-4 px-5 py-3 border-b border-white/5">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-5 py-3 border-b border-white/5 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`r${r}-c${c}`} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── List skeleton ────────────────────────────────────────────────── */

export function SkeletonList({ count = 5, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ── Page-level skeleton (header + content) ───────────────────────── */

export function SkeletonPage() {
  return (
    <div className="min-h-screen bg-transparent pb-20 lg:pb-0">
      {/* Fake header */}
      <div className="border-b border-white/10 bg-slate-950/30 backdrop-blur-sm">
        <div className="mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-7xl space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      {/* Fake content */}
      <div className="mx-auto px-4 sm:px-6 py-6 max-w-7xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonTable rows={6} cols={5} />
      </div>
    </div>
  );
}
