import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';

/**
 * Get initial viewport check - handles SSR safely
 * Returns true for mobile to avoid layout shifts on small screens
 */
function getIsMobile(breakpoint: number): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < breakpoint;
}

function getIsTablet(breakpoint: number): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < breakpoint;
}

/**
 * Modern mobile detection hook using useSyncExternalStore
 * Provides hydration-safe viewport detection
 */
export function useMobile(breakpoint: number = 768) {
  const subscribe = useCallback(
    (callback: () => void) => {
      window.addEventListener('resize', callback);
      window.addEventListener('orientationchange', callback);
      return () => {
        window.removeEventListener('resize', callback);
        window.removeEventListener('orientationchange', callback);
      };
    },
    []
  );

  const getSnapshot = useCallback(() => {
    return window.innerWidth < breakpoint;
  }, [breakpoint]);

  const getServerSnapshot = useCallback(() => {
    return false; // Server assumes desktop
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Tablet detection hook
 */
export function useTablet(breakpoint: number = 1024) {
  const subscribe = useCallback(
    (callback: () => void) => {
      window.addEventListener('resize', callback);
      window.addEventListener('orientationchange', callback);
      return () => {
        window.removeEventListener('resize', callback);
        window.removeEventListener('orientationchange', callback);
      };
    },
    []
  );

  const getSnapshot = useCallback(() => {
    return window.innerWidth < breakpoint;
  }, [breakpoint]);

  const getServerSnapshot = useCallback(() => {
    return false;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Detect if user prefers reduced motion
 */
export function usePrefersReducedMotion() {
  const subscribe = useCallback((callback: () => void) => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', callback);
    return () => mq.removeEventListener('change', callback);
  }, []);

  const getSnapshot = useCallback(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Detect touch device capability
 */
export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore - for older browsers
        navigator.msMaxTouchPoints > 0
      );
    };
    checkTouch();
  }, []);

  return isTouch;
}
