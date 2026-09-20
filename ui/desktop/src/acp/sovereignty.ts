import type {
  EgressAttemptDto,
  EgressStatusResponse_unstable,
} from '@aaif/goose-acp-client';
import type { EgressAttempt } from '../components/indra-shell/SovereigntyScreen';
import { getAcpClient } from './acpConnection';

export type { EgressAttempt };

function egressAttemptDtoToAttempt(dto: EgressAttemptDto): EgressAttempt {
  return {
    url: dto.url,
    blocked: dto.blocked,
    at: dto.at,
    reason: dto.reason,
  };
}

function egressStatusResponseToAttempts(
  response: EgressStatusResponse_unstable
): { attempts: EgressAttempt[]; uptimeSeconds: number } {
  return {
    attempts: response.attempts.map(egressAttemptDtoToAttempt),
    uptimeSeconds: response.uptimeSeconds,
  };
}

/**
 * Read the sovereignty screen's egress log and process uptime.
 *
 * Backed by `EgressLog::current()` (crates/indra/src/security/egress_inspector.rs) —
 * every attempt it lists already happened; this call never triggers one.
 */
export async function acpEgressStatus(): Promise<{
  attempts: EgressAttempt[];
  uptimeSeconds: number;
}> {
  const client = await getAcpClient();
  const response = await client.goose.sovereigntyEgressStatus_unstable({});
  return egressStatusResponseToAttempts(response);
}

/**
 * Deliberately attempt to reach a real URL, for the sovereignty screen's probe box.
 *
 * Backed by `trigger_probe(url)`. Its outcome — blocked or reached — is recorded
 * server-side in the egress log; call `acpEgressStatus` again to see it reflected.
 * This resolves whether the probe was blocked or reached the network — both are
 * honest, non-error outcomes; it only rejects if the request to the backend itself
 * failed.
 */
export async function acpEgressProbe(url: string): Promise<void> {
  const client = await getAcpClient();
  await client.goose.sovereigntyEgressProbe_unstable({ url });
}
