import { useCallback, useState } from 'react';

export type TraceDensity = 'quiet' | 'normal' | 'trace';

const STORAGE_KEY = 'indra.traceDensity';
const DEFAULT_TRACE_DENSITY: TraceDensity = 'normal';

function isTraceDensity(value: unknown): value is TraceDensity {
  return value === 'quiet' || value === 'normal' || value === 'trace';
}

// Guarded the same way useReducedMotion.ts is: this is read on first render by
// every screen with a trace surface, so it must degrade to the default rather
// than throw when localStorage is unavailable (e.g. a locked-down webview).
function readStoredTraceDensity(): TraceDensity {
  if (typeof window === 'undefined') return DEFAULT_TRACE_DENSITY;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTraceDensity(stored) ? stored : DEFAULT_TRACE_DENSITY;
  } catch {
    return DEFAULT_TRACE_DENSITY;
  }
}

function writeStoredTraceDensity(density: TraceDensity): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, density);
  } catch {
    // A denied or full localStorage should not break the trace surface —
    // the choice simply does not survive the session.
  }
}

/** Remembered per user, default Normal (spec §6.2). */
export function useTraceDensity(): [TraceDensity, (density: TraceDensity) => void] {
  const [density, setDensityState] = useState<TraceDensity>(() => readStoredTraceDensity());

  const setDensity = useCallback((next: TraceDensity) => {
    writeStoredTraceDensity(next);
    setDensityState(next);
  }, []);

  return [density, setDensity];
}
