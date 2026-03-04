export type PageBeamVariant = 'cyan' | 'gold' | 'teal';

interface PageBeamProps {
  variant?: PageBeamVariant;
}

export function PageBeam({ variant = 'cyan' }: PageBeamProps) {
  const base =
    'pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full blur-3xl opacity-60 animate-blob';

  const colorClass =
    variant === 'gold'
      ? 'bg-amber-400/40'
      : variant === 'teal'
      ? 'bg-teal-400/40'
      : 'bg-cyan-400/40';

  return <div className={`${base} ${colorClass}`} />;
}
