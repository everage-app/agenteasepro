// AgentEasePro Logo Component - Theme-aware version
// Based on brand logo: Two overlapping squares with house icon

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizes = {
    sm: { icon: 28, text: 'text-sm' },
    md: { icon: 36, text: 'text-base' },
    lg: { icon: 44, text: 'text-lg' },
  };

  const s = sizes[size];
  const houseTransform = size === 'sm' ? 'translate(7, 18)' : 'translate(6.5, 18)';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Logo Icon - Two overlapping squares with house */}
      <svg 
        width={s.icon} 
        height={s.icon} 
        viewBox="0 0 50 50" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 ae-logo-icon"
      >
        {/* Back square - purple/violet accent */}
        <rect 
          x="12" 
          y="1" 
          width="36" 
          height="36" 
          rx="6" 
          className="ae-logo-back-square"
          strokeWidth="2"
        />
        {/* Front square - main brand color */}
        <rect 
          x="1" 
          y="12" 
          width="36" 
          height="36" 
          rx="6" 
          className="ae-logo-front-square"
          strokeWidth="2"
        />
        {/* House icon inside front square */}
        <g transform={houseTransform}>
          {/* House body */}
          <path 
            d="M2 11V23H22V11" 
            className="ae-logo-house"
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            fill="none"
          />
          {/* Roof */}
          <path 
            d="M0 11L12 1L24 11" 
            className="ae-logo-house"
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            fill="none"
          />
          {/* Door */}
          <rect 
            x="8.5" 
            y="14" 
            width="7" 
            height="9" 
            className="ae-logo-house"
            strokeWidth="1.5" 
            fill="none"
          />
        </g>
      </svg>

      {/* Text */}
      {showText && (
        <span className={`font-bold tracking-tight ae-logo-text ${s.text}`}>
          Agent<span className="font-normal">Ease</span><span className="ae-logo-badge px-1.5 py-0.5 rounded text-[0.7em] font-semibold ml-1">Pro</span>
        </span>
      )}
    </div>
  );
}

// Simplified icon-only version for favicon/small spaces
export function LogoIcon({ size = 36, className = '' }: { size?: number; className?: string }) {
  const houseTransform = size <= 30 ? 'translate(7, 18)' : 'translate(6.5, 18)';

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 50 50" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`ae-logo-icon ${className}`}
    >
      {/* Back square - purple/violet accent */}
      <rect 
        x="12" 
        y="1" 
        width="36" 
        height="36" 
        rx="6" 
        className="ae-logo-back-square"
        strokeWidth="2"
      />
      {/* Front square - main brand color */}
      <rect 
        x="1" 
        y="12" 
        width="36" 
        height="36" 
        rx="6" 
        className="ae-logo-front-square"
        strokeWidth="2"
      />
      {/* House icon inside front square */}
      <g transform={houseTransform}>
        {/* House body */}
        <path 
          d="M2 11V23H22V11" 
          className="ae-logo-house"
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          fill="none"
        />
        {/* Roof */}
        <path 
          d="M0 11L12 1L24 11" 
          className="ae-logo-house"
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          fill="none"
        />
        {/* Door */}
        <rect 
          x="8.5" 
          y="14" 
          width="7" 
          height="9" 
          className="ae-logo-house"
          strokeWidth="1.5" 
          fill="none"
        />
      </g>
    </svg>
  );
}

export default Logo;
