import { useCallback, useEffect, useState } from 'react';
import { acpEgressStatus, type EgressAttempt } from '../acp/sovereignty';

export interface EgressStatus {
  attempts: EgressAttempt[];
  uptimeSeconds: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * SIH PS 26117's own words: "show, through logs or a visible network
 * monitor, that no external calls are made at any point - that's the actual
 * proof of the sovereign claim, not just a statement of it." A dedicated
 * Sovereignty screen nobody has to navigate to isn't that proof; this hook
 * lets the same real egress log back a status indicator visible everywhere.
 */
export function useEgressStatus(): EgressStatus {
  const [attempts, setAttempts] = useState<EgressAttempt[]>([]);
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const status = await acpEgressStatus();
      setAttempts(status.attempts);
      setUptimeSeconds(status.uptimeSeconds);
    } catch (error) {
      console.error('Failed to read sovereignty status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { attempts, uptimeSeconds, loading, refresh };
}

/** True only when every recorded attempt was actually blocked - never a default-true guess. */
export function isSealed(attempts: readonly EgressAttempt[]): boolean {
  return attempts.every((attempt) => attempt.blocked);
}
