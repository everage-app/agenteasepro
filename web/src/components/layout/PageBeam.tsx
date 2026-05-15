export type PageBeamVariant = 'cyan' | 'gold' | 'teal';

interface PageBeamProps {
  variant?: PageBeamVariant;
}

export function PageBeam({ variant = 'gold' }: PageBeamProps) {
  const base =
    'pointer-events-none absolute -top-20 right-0 h-40 w-[28rem] rounded-[4rem] blur-3xl opacity-35 animate-blob';

  const colorClass =
    variant === 'gold'
      ? 'bg-amber-400/40'
      : variant === 'teal'
      ? 'bg-teal-400/40'
      : 'bg-[#d6b56d]/[0.30]';

  return <div className={`${base} ${colorClass}`} />;
}
