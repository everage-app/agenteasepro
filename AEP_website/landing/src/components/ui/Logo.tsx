import appLogoDarkMode from '../../assets/app-logo-dark-mode.svg';
import appLogoIconDark from '../../assets/app-logo-icon-dark.svg';

// AgentEasePro Logo Component - Uses canonical app dark-mode logo assets

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  animated?: boolean;
}

export function Logo({ size = 'md', showText = true, className = '', animated = true }: LogoProps) {
  const sizes = {
    sm: { logoHeight: 'h-8', iconSize: 30 },
    md: { logoHeight: 'h-10', iconSize: 36 },
    lg: { logoHeight: 'h-12', iconSize: 42 },
    xl: { logoHeight: 'h-14', iconSize: 50 },
  };

  const s = sizes[size];

  return (
    <div className={`flex items-center group whitespace-nowrap ${className}`}>
      {showText ? (
        <img
          src={appLogoDarkMode}
          alt="AgentEasePro"
          className={`${s.logoHeight} w-auto select-none ${animated ? 'transition-transform duration-300 group-hover:scale-[1.02]' : ''}`}
          draggable={false}
        />
      ) : (
        <img
          src={appLogoIconDark}
          alt="AgentEasePro icon"
          width={s.iconSize}
          height={s.iconSize}
          className={`select-none ${animated ? 'transition-transform duration-300 group-hover:scale-105' : ''}`}
          draggable={false}
        />
      )}
    </div>
  );
}

// Simplified icon-only version for favicons and small spaces
export function LogoIcon({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={appLogoIconDark}
      alt="AgentEasePro icon"
      width={size}
      height={size}
      className={`select-none ${className}`}
      draggable={false}
    />
  );
}

export default Logo;
