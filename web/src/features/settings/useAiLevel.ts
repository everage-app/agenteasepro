import { useEffect, useState } from 'react';
import api from '../../lib/api';

export type AiLevel = 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH';

let cachedLevel: AiLevel | null = null;
let inFlight: Promise<AiLevel> | null = null;

async function fetchLevel(): Promise<AiLevel> {
  if (cachedLevel) return cachedLevel;
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const res = await api.get<{ aiAssistanceLevel: AiLevel }>('/settings/ai');
        cachedLevel = res.data?.aiAssistanceLevel || 'MEDIUM';
      } catch {
        cachedLevel = 'MEDIUM';
      }
      return cachedLevel;
    })();
  }
  return inFlight;
}

export function useAiLevel(): AiLevel | null {
  const [level, setLevel] = useState<AiLevel | null>(cachedLevel);

  useEffect(() => {
    if (level) return;
    let cancelled = false;
    fetchLevel().then((l) => {
      if (!cancelled) setLevel(l);
    });
    return () => {
      cancelled = true;
    };
  }, [level]);

  return level;
}
