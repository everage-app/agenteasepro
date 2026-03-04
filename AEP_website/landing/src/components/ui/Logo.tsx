// AgentEasePro Logo Component - Clean white version

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  animated?: boolean;
}

export function Logo({ size = 'md', showText = true, className = '', animated = true }: LogoProps) {
  const sizes = {
    sm: { icon: 32, text: 'text-base', pro: 'text-[0.6em]' },
    md: { icon: 40, text: 'text-xl', pro: 'text-[0.55em]' },
    lg: { icon: 48, text: 'text-2xl', pro: 'text-[0.5em]' },
    xl: { icon: 56, text: 'text-3xl', pro: 'text-[0.45em]' },
  };

  const s = sizes[size];

  return (
    <div className={`flex items-center gap-3 group ${className}`}>
      {/* Logo Icon - Two overlapping squares with house */}
      <div className={`relative ${animated ? 'transition-transform duration-300 group-hover:scale-110' : ''}`}>
        <svg 
          width={s.icon} 
          height={s.icon} 
          viewBox="0 0 50 50" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="flex-shrink-0"
        >
          {/* Back square (behind, offset to upper-right) */}
          <rect 
            x="14" 
            y="3" 
            width="32" 
            height="32" 
            rx="5" 
            stroke="white" 
            strokeWidth="2" 
            fill="transparent"
            className={animated ? 'transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1' : ''}
          />
          
          {/* Front square with solid fill to cover back square */}
          <rect 
            x="3" 
            y="14" 
            width="32" 
            height="32" 
            rx="5" 
            stroke="white" 
            strokeWidth="2" 
            fill="#0f172a"
          />
          
          {/* House icon inside front square */}
          <g transform="translate(7, 19)">
            {/* House roof */}
            <path 
              d="M12 2L2 10V22H22V10L12 2Z" 
              stroke="white" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              fill="none"
            />
            {/* Door */}
            <rect 
              x="9" 
              y="13" 
              width="6" 
              height="9" 
              rx="0.5"
              stroke="white" 
              strokeWidth="1.5" 
              fill="none"
            />
            {/* Door handle */}
            <circle cx="13" cy="17" r="1" fill="white"/>
          </g>
        </svg>
        
        {/* Glow effect behind logo */}
        {animated && (
          <div className="absolute -inset-2 bg-white/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
        )}
      </div>

      {/* Text */}
      {showText && (
        <span className={`font-bold tracking-tight ${s.text} ${animated ? 'transition-all duration-300 group-hover:tracking-normal' : ''}`}>
          <span className="text-white">Agent</span>
          <span className="font-normal text-white">Ease</span>
          <span className="bg-white text-slate-900 px-1.5 py-0.5 rounded text-[0.7em] font-semibold ml-1">
            Pro
          </span>
        </span>
      )}
    </div>
  );
}

// Simplified icon-only version for favicons and small spaces
export function LogoIcon({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 50 50" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="14" y="3" width="32" height="32" rx="5" stroke="white" strokeWidth="2" fill="transparent"/>
      <rect x="3" y="14" width="32" height="32" rx="5" stroke="white" strokeWidth="2" fill="#0f172a"/>
      
      <g transform="translate(7, 19)">
        <path d="M12 2L2 10V22H22V10L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <rect x="9" y="13" width="6" height="9" rx="0.5" stroke="white" strokeWidth="1.5" fill="none"/>
        <circle cx="13" cy="17" r="1" fill="white"/>
      </g>
    </svg>
  );
}

export default Logo;
