import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

// Guarded because this hook is read by every animating surface (boot, stream
// reveal, panels, the constellation). A renderer without matchMedia must
// degrade to "motion allowed", never throw on the way up.
function query(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : null;
}

/**
 * True when the user has asked for reduced motion. Honour it in every animation:
 * boot becomes a static mark with a checklist, stream reveal becomes instant per
 * word, panels cut instead of slide. (Spec §3.5)
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => query()?.matches ?? false);

  useEffect(() => {
    const mq = query();
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
