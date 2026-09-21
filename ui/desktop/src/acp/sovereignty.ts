import type { EgressAttempt } from '../components/indra-shell/SovereigntyScreen';
import { getAcpClient } from './acpConnection';

export type { EgressAttempt };

const EGRESS_STATUS_METHOD = '_goose/unstable/sovereignty/egress/status';
const EGRESS_PROBE_METHOD = '_goose/unstable/sovereignty/egress/probe';

/**
 * Mirrors `crates/indra-sdk-types/src/custom_requests.rs`'s `EgressAttemptDto`
 * / `EgressStatusRequest` / `EgressStatusResponse` / `EgressProbeRequest` /
 * `EgressProbeResponse` on the wire (`#[serde(rename_all = "camelCase")]`).
 *
 * Called through `ClientContext.request`'s generic-method overload rather
 * than a generated `@aaif/goose-acp-client` wrapper: that package is built
 * from `crates/indra/acp-schema.json`/`acp-meta.json`, which only `just
 * generate-acp-types` (after a successful `cargo build -p indra`) can
 * produce. Once that runs, these two methods can be replaced with the
 * generated `client.goose.sovereigntyEgressStatus_unstable` /
 * `sovereigntyEgressProbe_unstable` wrappers — the wire shape here was
 * written to match those Rust types exactly, so the swap is drop-in.
 */
interface EgressAttemptDto {
  url: string;
  blocked: boolean;
  reason: string;
  at: string;
}

interface EgressStatusResponseDto {
  attempts: EgressAttemptDto[];
  uptimeSeconds: number;
}

interface EgressProbeResponseDto {
  blocked: boolean;
  reason: string;
}

function egressAttemptDtoToAttempt(dto: EgressAttemptDto): EgressAttempt {
  return { url: dto.url, blocked: dto.blocked, at: dto.at, reason: dto.reason };
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
  const response = await client.connection.agent.request<EgressStatusResponseDto>(
    EGRESS_STATUS_METHOD,
    {}
  );
  return {
    attempts: response.attempts.map(egressAttemptDtoToAttempt),
    uptimeSeconds: response.uptimeSeconds,
  };
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
  await client.connection.agent.request<EgressProbeResponseDto>(EGRESS_PROBE_METHOD, { url });
}
