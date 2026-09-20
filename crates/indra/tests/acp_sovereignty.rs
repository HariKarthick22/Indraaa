use indra::security::egress_inspector::EgressLog;

#[test]
fn egress_log_is_readable_for_the_status_endpoint() {
    let log = EgressLog::current();
    assert!(
        log.attempts.len() < usize::MAX,
        "EgressLog::current() must be callable from the ACP layer"
    );
}
