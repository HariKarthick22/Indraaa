use super::*;
use crate::security::egress_inspector::{trigger_probe, EgressLog};
use std::sync::OnceLock;
use std::time::Instant;

/// First observed at process start (lazily, on the first status request in this
/// process) rather than the OS process start time — close enough for the
/// sovereignty screen's "how long has this been running" display, without
/// wiring a startup hook through the rest of the ACP server.
fn process_start() -> Instant {
    static START: OnceLock<Instant> = OnceLock::new();
    *START.get_or_init(Instant::now)
}

fn egress_attempt_to_dto(
    attempt: crate::security::egress_inspector::EgressAttempt,
) -> EgressAttemptDto {
    EgressAttemptDto {
        url: attempt.target,
        blocked: attempt.blocked,
        reason: attempt.reason,
        at: attempt.timestamp.to_rfc3339(),
    }
}

impl GooseAcpAgent {
    pub(super) async fn on_egress_status(
        &self,
        _req: EgressStatusRequest,
    ) -> Result<EgressStatusResponse, agent_client_protocol::Error> {
        let attempts = EgressLog::current()
            .attempts
            .into_iter()
            .map(egress_attempt_to_dto)
            .collect();

        Ok(EgressStatusResponse {
            attempts,
            uptime_seconds: process_start().elapsed().as_secs(),
        })
    }

    pub(super) async fn on_egress_probe(
        &self,
        req: EgressProbeRequest,
    ) -> Result<EgressProbeResponse, agent_client_protocol::Error> {
        let url = req.url;
        let probe_url = url.clone();
        let probe_result = tokio::task::spawn_blocking(move || trigger_probe(&probe_url))
            .await
            .internal_err_ctx("Egress probe task panicked")?;

        let blocked = probe_result.is_ok();
        // `trigger_probe` only signals block/reach; the honest reason string it
        // recorded lives in the log, so read it back rather than reconstructing
        // a summary that could drift from what actually happened.
        let reason = EgressLog::current()
            .attempts
            .into_iter()
            .rev()
            .find(|attempt| attempt.target == url && attempt.blocked == blocked)
            .map(|attempt| attempt.reason)
            .unwrap_or_else(|| match &probe_result {
                Ok(()) => "connection refused".to_string(),
                Err(error) => error.to_string(),
            });

        Ok(EgressProbeResponse { blocked, reason })
    }
}
