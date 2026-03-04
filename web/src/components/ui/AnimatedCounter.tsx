import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number | string;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * Animated count-up component for KPI numbers.
 * Animates from 0 to the target value on mount/change.
 */
export function AnimatedCounter({
  value,
  duration = 1200,
  className = '',
  prefix = '',
  suffix = '',
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState('0');
  const rafRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    // If value is not a number, just display it
    const numVal = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    if (isNaN(numVal)) {
      setDisplay(String(value));
      return;
    }

    const target = numVal;
    const isDecimal = !Number.isInteger(target);
    const decimalPlaces = isDecimal ? (String(target).split('.')[1]?.length || 1) : 0;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);

      // Ease out cubic for satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;

      if (isDecimal) {
        setDisplay(current.toFixed(decimalPlaces));
      } else {
        setDisplay(Math.round(current).toLocaleString());
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    startTimeRef.current = undefined;
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{display}{suffix}
    </span>
  );
}

export default AnimatedCounter;
