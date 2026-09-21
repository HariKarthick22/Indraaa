//! Confines agent file-tool access to a user-chosen set of local folders.
//!
//! Mirrors `egress_inspector.rs`'s shape: a small process-wide, session-keyed
//! state store (`WORKSPACE_SCOPES`, analogous to that module's `EGRESS_LOG`)
//! fed by an ACP custom request, and a `ToolInspector`
//! (`WorkspaceScopeInspector`) that consults it before a `read`/`write`/`edit`
//! tool call is allowed to run. See `crates/indra-sdk-types/src/custom_requests.rs`'s
//! `SetWorkspaceFoldersRequest`/`GetWorkspaceFoldersRequest` for the wire
//! contract and `crates/indra/src/acp/server/workspace_folders.rs` for the
//! ACP dispatch handlers that translate between the two.
//!
//! # Coverage
//!
//! `WorkspaceScopeInspector` is registered once in
//! `Agent::create_tool_inspection_manager` (`crates/indra/src/agents/agent.rs`),
//! which both the legacy agent loop and the state-machine loop share — so a
//! single registration enforces scoping on both execution paths.
//!
//! It inspects tool calls whose *local* name (after stripping the
//! `extension__` prefix, matching `agent.rs::categorize_tool`'s convention)
//! is `read`, `write`, or `edit` and that carry a string `path` argument —
//! this is the developer/ACP file-tool surface implemented in
//! `crates/indra/src/agents/platform_extensions/developer/edit.rs` and
//! wrapped by `crates/indra/src/acp/fs.rs`. It does **not** inspect:
//!
//! - The `shell`/terminal tool. A shell command can `cat`, `rm`, `mv`, or
//!   otherwise touch files by text, and this inspector does not parse shell
//!   command text (doing so would only ever be a heuristic, advisory check —
//!   the same limitation this codebase already documents for
//!   `EgressInspector`'s shell-command scanning, not a structural boundary).
//!   Whole-file delete/rename in particular goes through the shell today,
//!   since the developer extension has no dedicated delete/rename tool.
//! - The `tree` and `read_image` tools, which also read the filesystem.
//! - Any other extension's own file tools, unless they happen to expose a
//!   tool locally named `read`/`write`/`edit` with a string `path` argument.
//!
//! These are open gaps, not silent assumptions — see this crate's workspace
//! scoping report for the full list of what still needs a guard wired in.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use async_trait::async_trait;

use crate::agents::platform_extensions::developer::edit::resolve_path;
use crate::config::GooseMode;
use crate::conversation::message::{Message, ToolRequest};
use crate::session::SessionManager;
use crate::tool_inspection::{InspectionAction, InspectionResult, ToolInspector};

/// How the agent may use files under a configured workspace folder.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkspaceFolderMode {
    /// The agent can read files under this folder but must never write,
    /// delete, or rename anything there.
    ReadOnly,
    /// The agent can read files under this folder, and may propose
    /// writes/deletes/renames — each such write still needs approval
    /// through the normal tool-confirmation flow before it happens.
    Controlled,
}

#[derive(Debug, Clone)]
struct ConfiguredFolder {
    /// Canonicalized (symlinks resolved, `.`/`..` collapsed) absolute root.
    root: PathBuf,
    mode: WorkspaceFolderMode,
}

/// A folder a client asked to configure, before validation.
#[derive(Debug, Clone)]
pub struct RequestedFolder {
    pub path: PathBuf,
    pub mode: WorkspaceFolderMode,
}

/// A requested folder that could not be configured, with a human-readable reason.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RejectedFolder {
    pub path: PathBuf,
    pub reason: String,
}

/// The set of folders the agent may see for one session, resolved to
/// canonical roots at configuration time so every later check is a plain
/// path comparison rather than a filesystem call.
#[derive(Debug, Clone, Default)]
pub struct WorkspaceScopeConfig {
    folders: Vec<ConfiguredFolder>,
}

/// Outcome of checking one path against a `WorkspaceScopeConfig`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScopeDecision {
    Allowed,
    RequiresApproval(String),
    Denied(String),
}

impl WorkspaceScopeConfig {
    /// Validates and canonicalizes each requested folder. Folders that don't
    /// exist, aren't directories, or can't be resolved are reported in the
    /// second return value and excluded from the resulting config — the
    /// folders that did validate are still applied, so one bad entry in a
    /// multi-folder picker selection doesn't reject the whole batch.
    pub fn build(requested: Vec<RequestedFolder>) -> (Self, Vec<RejectedFolder>) {
        let mut folders = Vec::new();
        let mut rejected = Vec::new();

        for folder in requested {
            match fs::canonicalize(&folder.path) {
                Ok(root) if root.is_dir() => folders.push(ConfiguredFolder {
                    root,
                    mode: folder.mode,
                }),
                Ok(root) => rejected.push(RejectedFolder {
                    path: folder.path,
                    reason: format!("{} is not a directory", root.display()),
                }),
                Err(error) => rejected.push(RejectedFolder {
                    path: folder.path.clone(),
                    reason: format!("cannot access {}: {error}", folder.path.display()),
                }),
            }
        }

        (Self { folders }, rejected)
    }

    /// Whether any folders are configured. Workspace scoping is opt-in per
    /// session: until the client has set at least one folder, callers treat
    /// this config as "not enforced" and fall back to prior, unscoped
    /// behavior rather than denying everything by default.
    pub fn is_configured(&self) -> bool {
        !self.folders.is_empty()
    }

    /// Configured folders as `(canonical root, mode)` pairs, for translating
    /// back to a wire DTO (see `acp/server/workspace_folders.rs`).
    pub fn folders(&self) -> impl Iterator<Item = (&Path, WorkspaceFolderMode)> {
        self.folders.iter().map(|f| (f.root.as_path(), f.mode))
    }

    fn best_match(&self, canonical_target: &Path) -> Option<&ConfiguredFolder> {
        self.folders
            .iter()
            .filter(|folder| canonical_target.starts_with(&folder.root))
            .max_by_key(|folder| folder.root.as_os_str().len())
    }

    /// Whether `path` (absolute, existing or not) may be read.
    pub fn check_read(&self, path: &Path) -> ScopeDecision {
        if !self.is_configured() {
            return ScopeDecision::Allowed;
        }
        match resolve_for_scope_check(path) {
            Ok(canonical) => match self.best_match(&canonical) {
                Some(_) => ScopeDecision::Allowed,
                None => ScopeDecision::Denied(format!(
                    "{} is outside every configured workspace folder",
                    path.display()
                )),
            },
            Err(error) => ScopeDecision::Denied(format!(
                "could not resolve {} to check workspace scope: {error}",
                path.display()
            )),
        }
    }

    /// Whether `path` (absolute, existing or not) may be written, deleted, or renamed.
    pub fn check_write(&self, path: &Path) -> ScopeDecision {
        if !self.is_configured() {
            return ScopeDecision::Allowed;
        }
        match resolve_for_scope_check(path) {
            Ok(canonical) => match self.best_match(&canonical) {
                None => ScopeDecision::Denied(format!(
                    "{} is outside every configured workspace folder",
                    path.display()
                )),
                Some(folder) if folder.mode == WorkspaceFolderMode::ReadOnly => {
                    ScopeDecision::Denied(format!(
                        "{} is under the read-only workspace folder {} — writes, deletes, and renames are not permitted there",
                        path.display(),
                        folder.root.display()
                    ))
                }
                Some(folder) => ScopeDecision::RequiresApproval(format!(
                    "{} is under the controlled workspace folder {} and needs your approval before this write can run",
                    path.display(),
                    folder.root.display()
                )),
            },
            Err(error) => ScopeDecision::Denied(format!(
                "could not resolve {} to check workspace scope: {error}",
                path.display()
            )),
        }
    }
}

/// Resolves `path` to a canonical, symlink-free, `.`/`..`-free absolute path
/// safe to compare against a canonicalized workspace root — even when `path`
/// itself doesn't exist yet (e.g. a file about to be created by `write`).
///
/// `std::fs::canonicalize` alone only works on paths that already fully
/// exist. This walks up to the deepest existing ancestor, canonicalizes
/// *that* (resolving any symlinks in it, including a symlinked directory
/// used to try to walk out of the workspace), and lexically applies the
/// remaining, not-yet-existing path segments on top. Segments that don't
/// exist can't themselves be symlinks, so lexical `.`/`..` handling for them
/// is exact, not an approximation — and an attacker-supplied `..`-heavy tail
/// simply lands wherever plain path algebra says it lands, which the
/// subsequent `starts_with` containment check then correctly rejects if it's
/// outside the workspace root.
fn resolve_for_scope_check(path: &Path) -> io::Result<PathBuf> {
    for ancestor in path.ancestors() {
        if ancestor.exists() {
            let canonical_ancestor = fs::canonicalize(ancestor)?;
            let tail = path.strip_prefix(ancestor).unwrap_or_else(|_| Path::new(""));
            return Ok(apply_lexically(&canonical_ancestor, tail));
        }
    }
    // path.ancestors() always yields the root component last, and the root
    // should always exist — this is an unreachable-in-practice fallback.
    fs::canonicalize(path)
}

fn apply_lexically(base: &Path, tail: &Path) -> PathBuf {
    let mut result = base.to_path_buf();
    for component in tail.components() {
        match component {
            Component::ParentDir => {
                result.pop();
            }
            Component::CurDir => {}
            Component::Normal(part) => result.push(part),
            // `tail` comes from `Path::strip_prefix` against an ancestor of
            // `path`, so it's always relative — these can't appear.
            Component::RootDir | Component::Prefix(_) => {}
        }
    }
    result
}

/// Process-wide, session-keyed store for the last `WorkspaceScopeConfig` an
/// ACP client set, mirroring `egress_inspector::EGRESS_LOG`'s static-store
/// shape so the enforcement point (`WorkspaceScopeInspector`) doesn't need a
/// reference threaded through agent construction, and so `on_set_workspace_folders`
/// works regardless of whether a session's `Agent` has been constructed yet.
static WORKSPACE_SCOPES: OnceLock<Mutex<HashMap<String, WorkspaceScopeConfig>>> = OnceLock::new();

fn store() -> &'static Mutex<HashMap<String, WorkspaceScopeConfig>> {
    WORKSPACE_SCOPES.get_or_init(|| Mutex::new(HashMap::new()))
}

pub struct WorkspaceScopeStore;

impl WorkspaceScopeStore {
    /// Replaces the configured folders for `session_id`.
    pub fn set(session_id: &str, config: WorkspaceScopeConfig) {
        store()
            .lock()
            .unwrap_or_else(|poison| poison.into_inner())
            .insert(session_id.to_string(), config);
    }

    /// Returns a clone of the currently configured folders for `session_id`,
    /// or `None` if the session has never configured any (equivalent to an
    /// unconfigured/not-enforced `WorkspaceScopeConfig`).
    pub fn get(session_id: &str) -> Option<WorkspaceScopeConfig> {
        store()
            .lock()
            .unwrap_or_else(|poison| poison.into_inner())
            .get(session_id)
            .cloned()
    }

    /// Removes any configured folders for `session_id` (e.g. on session close).
    pub fn clear(session_id: &str) {
        store()
            .lock()
            .unwrap_or_else(|poison| poison.into_inner())
            .remove(session_id);
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FileOp {
    Read,
    Write,
}

fn file_op_for_tool(local_name: &str) -> Option<FileOp> {
    match local_name {
        "read" => Some(FileOp::Read),
        "write" | "edit" => Some(FileOp::Write),
        _ => None,
    }
}

fn local_tool_name(name: &str) -> &str {
    name.rsplit("__").next().unwrap_or(name)
}

fn path_argument(tool_call: &rmcp::model::CallToolRequestParams) -> Option<String> {
    tool_call
        .arguments
        .as_ref()?
        .get("path")?
        .as_str()
        .map(str::to_string)
}

/// Enforces per-session workspace-folder scoping on the developer/ACP
/// `read`/`write`/`edit` file tools. See this module's doc comment for
/// exactly what is and isn't covered.
pub struct WorkspaceScopeInspector {
    session_manager: Arc<SessionManager>,
}

impl WorkspaceScopeInspector {
    pub fn new(session_manager: Arc<SessionManager>) -> Self {
        Self { session_manager }
    }
}

#[async_trait]
impl ToolInspector for WorkspaceScopeInspector {
    fn name(&self) -> &'static str {
        "workspace_scope"
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    async fn inspect(
        &self,
        session_id: &str,
        tool_requests: &[ToolRequest],
        _messages: &[Message],
        _goose_mode: GooseMode,
    ) -> anyhow::Result<Vec<InspectionResult>> {
        let mut results = Vec::new();

        let Some(config) = WorkspaceScopeStore::get(session_id) else {
            return Ok(results);
        };
        if !config.is_configured() {
            return Ok(results);
        }

        let mut working_dir: Option<PathBuf> = None;
        let mut working_dir_loaded = false;

        for request in tool_requests {
            let Ok(tool_call) = &request.tool_call else {
                continue;
            };
            let Some(op) = file_op_for_tool(local_tool_name(tool_call.name.as_ref())) else {
                continue;
            };
            let Some(raw_path) = path_argument(tool_call) else {
                continue;
            };

            if !working_dir_loaded {
                // Failure here is not fatal to the check: `resolve_path`
                // falls back to the process cwd when `working_dir` is
                // `None`, which is the same fallback the actual dispatch
                // path (`edit.rs::resolve_path`) uses, so the path we check
                // still matches the path that will actually be touched.
                working_dir = self
                    .session_manager
                    .get_session(session_id, false)
                    .await
                    .map(|session| session.working_dir)
                    .ok();
                working_dir_loaded = true;
            }

            let absolute = resolve_path(&raw_path, working_dir.as_deref());

            let decision = match op {
                FileOp::Read => config.check_read(&absolute),
                FileOp::Write => config.check_write(&absolute),
            };

            let (action, reason) = match decision {
                ScopeDecision::Allowed => (
                    InspectionAction::Allow,
                    "path is within a configured workspace folder".to_string(),
                ),
                ScopeDecision::RequiresApproval(reason) => (
                    InspectionAction::RequireApproval(Some(reason.clone())),
                    reason,
                ),
                ScopeDecision::Denied(reason) => (InspectionAction::Deny, reason),
            };

            results.push(InspectionResult {
                tool_request_id: request.id.clone(),
                action,
                reason,
                confidence: 1.0,
                inspector_name: self.name().to_string(),
                finding_id: None,
            });
        }

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn folder(path: &Path, mode: WorkspaceFolderMode) -> RequestedFolder {
        RequestedFolder {
            path: path.to_path_buf(),
            mode,
        }
    }

    #[test]
    fn unconfigured_config_is_not_enforced() {
        let config = WorkspaceScopeConfig::default();
        assert!(!config.is_configured());
        assert_eq!(
            config.check_read(Path::new("/anything/at/all")),
            ScopeDecision::Allowed
        );
        assert_eq!(
            config.check_write(Path::new("/anything/at/all")),
            ScopeDecision::Allowed
        );
    }

    #[test]
    fn build_reports_nonexistent_folder_but_keeps_valid_ones() {
        let temp = tempfile::tempdir().unwrap();
        let valid = temp.path().join("workspace");
        fs::create_dir_all(&valid).unwrap();
        let missing = temp.path().join("does-not-exist");

        let (config, rejected) = WorkspaceScopeConfig::build(vec![
            folder(&valid, WorkspaceFolderMode::ReadOnly),
            folder(&missing, WorkspaceFolderMode::Controlled),
        ]);

        assert!(config.is_configured());
        assert_eq!(config.folders().count(), 1);
        assert_eq!(rejected.len(), 1);
        assert_eq!(rejected[0].path, missing);
        assert!(rejected[0].reason.contains("cannot access"));
    }

    #[test]
    fn build_rejects_a_file_path_as_not_a_directory() {
        let temp = tempfile::tempdir().unwrap();
        let file_path = temp.path().join("not-a-dir.txt");
        fs::write(&file_path, "hello").unwrap();

        let (config, rejected) =
            WorkspaceScopeConfig::build(vec![folder(&file_path, WorkspaceFolderMode::ReadOnly)]);

        assert!(!config.is_configured());
        assert_eq!(rejected.len(), 1);
        assert!(rejected[0].reason.contains("not a directory"));
    }

    #[test]
    fn read_and_write_allowed_inside_configured_root() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("workspace");
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("notes.txt");
        fs::write(&file_path, "hi").unwrap();

        let (config, rejected) =
            WorkspaceScopeConfig::build(vec![folder(&root, WorkspaceFolderMode::Controlled)]);
        assert!(rejected.is_empty());

        assert_eq!(config.check_read(&file_path), ScopeDecision::Allowed);
        assert!(matches!(
            config.check_write(&file_path),
            ScopeDecision::RequiresApproval(_)
        ));
    }

    #[test]
    fn read_only_folder_denies_write_with_clear_reason() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("workspace");
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("notes.txt");
        fs::write(&file_path, "hi").unwrap();

        let (config, _) =
            WorkspaceScopeConfig::build(vec![folder(&root, WorkspaceFolderMode::ReadOnly)]);

        assert_eq!(config.check_read(&file_path), ScopeDecision::Allowed);
        match config.check_write(&file_path) {
            ScopeDecision::Denied(reason) => assert!(reason.contains("read-only")),
            other => panic!("expected Denied, got {other:?}"),
        }
    }

    #[test]
    fn path_outside_every_root_is_denied_for_read_and_write() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("workspace");
        fs::create_dir_all(&root).unwrap();
        let outside = temp.path().join("elsewhere");
        fs::create_dir_all(&outside).unwrap();
        let file_path = outside.join("secret.txt");
        fs::write(&file_path, "shh").unwrap();

        let (config, _) =
            WorkspaceScopeConfig::build(vec![folder(&root, WorkspaceFolderMode::Controlled)]);

        match config.check_read(&file_path) {
            ScopeDecision::Denied(reason) => assert!(reason.contains("outside")),
            other => panic!("expected Denied, got {other:?}"),
        }
        match config.check_write(&file_path) {
            ScopeDecision::Denied(reason) => assert!(reason.contains("outside")),
            other => panic!("expected Denied, got {other:?}"),
        }
    }

    /// A naive string-prefix check (`path.to_string().starts_with(root_str)`)
    /// would wrongly treat `workspace-evil` as inside `workspace`. This
    /// verifies the real implementation — component-wise `Path::starts_with`
    /// against a canonicalized root — does not make that mistake.
    #[test]
    fn lookalike_sibling_directory_is_not_treated_as_inside_root() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("workspace");
        fs::create_dir_all(&root).unwrap();
        let lookalike = temp.path().join("workspace-evil");
        fs::create_dir_all(&lookalike).unwrap();
        let file_path = lookalike.join("secret.txt");
        fs::write(&file_path, "shh").unwrap();

        let (config, _) =
            WorkspaceScopeConfig::build(vec![folder(&root, WorkspaceFolderMode::ReadOnly)]);

        match config.check_read(&file_path) {
            ScopeDecision::Denied(reason) => assert!(reason.contains("outside")),
            other => panic!("expected Denied, got {other:?}"),
        }
    }

    #[test]
    fn dot_dot_traversal_to_a_sibling_directory_is_denied() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("workspace");
        fs::create_dir_all(&root).unwrap();
        let outside = temp.path().join("outside");
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secret.txt"), "shh").unwrap();

        let (config, _) =
            WorkspaceScopeConfig::build(vec![folder(&root, WorkspaceFolderMode::Controlled)]);

        // Lexically escapes `root` via `..` before landing on a target that
        // does not itself exist yet under the resolved directory's parent —
        // the resolved directory (`outside`) does exist, exercising the
        // ancestor-walk + lexical-tail path.
        let traversal_path = root.join("../outside/newfile.txt");
        match config.check_write(&traversal_path) {
            ScopeDecision::Denied(reason) => assert!(reason.contains("outside")),
            other => panic!("expected Denied, got {other:?}"),
        }
    }

    #[test]
    fn most_specific_nested_folder_wins() {
        let temp = tempfile::tempdir().unwrap();
        let outer = temp.path().join("ws");
        let inner = outer.join("vendor");
        fs::create_dir_all(&inner).unwrap();
        fs::write(outer.join("app.rs"), "fn main() {}").unwrap();
        fs::write(inner.join("lib.rs"), "// vendored").unwrap();

        let (config, rejected) = WorkspaceScopeConfig::build(vec![
            folder(&outer, WorkspaceFolderMode::Controlled),
            folder(&inner, WorkspaceFolderMode::ReadOnly),
        ]);
        assert!(rejected.is_empty());

        // Falls under the outer, controlled root only.
        assert!(matches!(
            config.check_write(&outer.join("app.rs")),
            ScopeDecision::RequiresApproval(_)
        ));

        // Falls under both, but the more specific (inner, read-only) root wins.
        match config.check_write(&inner.join("lib.rs")) {
            ScopeDecision::Denied(reason) => assert!(reason.contains("read-only")),
            other => panic!("expected Denied, got {other:?}"),
        }
    }

    #[test]
    fn write_target_that_does_not_exist_yet_is_still_checked_correctly() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("workspace");
        fs::create_dir_all(&root).unwrap();

        let (config, _) =
            WorkspaceScopeConfig::build(vec![folder(&root, WorkspaceFolderMode::Controlled)]);

        let new_file = root.join("brand-new.txt");
        assert!(!new_file.exists());
        assert!(matches!(
            config.check_write(&new_file),
            ScopeDecision::RequiresApproval(_)
        ));
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_directory_cannot_be_used_to_escape_the_root() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("workspace");
        fs::create_dir_all(&root).unwrap();
        let outside = temp.path().join("outside");
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secret.txt"), "shh").unwrap();

        // A symlink inside the workspace that points outside it.
        symlink(&outside, root.join("link")).unwrap();

        let (config, _) =
            WorkspaceScopeConfig::build(vec![folder(&root, WorkspaceFolderMode::ReadOnly)]);

        // Existing file reached through the symlink.
        match config.check_read(&root.join("link/secret.txt")) {
            ScopeDecision::Denied(reason) => assert!(reason.contains("outside")),
            other => panic!("expected Denied, got {other:?}"),
        }

        // Not-yet-existing write target reached through the symlink —
        // exercises the ancestor-walk (the symlink itself exists, the file
        // under it doesn't).
        match config.check_write(&root.join("link/new-secret.txt")) {
            ScopeDecision::Denied(reason) => assert!(reason.contains("outside")),
            other => panic!("expected Denied, got {other:?}"),
        }
    }

    #[test]
    fn store_set_get_clear_round_trip() {
        let session_id = format!("workspace-scope-test-{}", Uuid::new_v4());
        assert!(WorkspaceScopeStore::get(&session_id).is_none());

        let temp = tempfile::tempdir().unwrap();
        fs::create_dir_all(temp.path().join("workspace")).unwrap();
        let (config, _) = WorkspaceScopeConfig::build(vec![folder(
            &temp.path().join("workspace"),
            WorkspaceFolderMode::Controlled,
        )]);
        WorkspaceScopeStore::set(&session_id, config);

        let fetched = WorkspaceScopeStore::get(&session_id).unwrap();
        assert!(fetched.is_configured());

        WorkspaceScopeStore::clear(&session_id);
        assert!(WorkspaceScopeStore::get(&session_id).is_none());
    }
}
