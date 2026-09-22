import { useCallback, useState } from 'react';

export type WorkspaceFolderMode = 'read-only' | 'controlled';

/**
 * Top-level filesystem access mode, independent of any single folder's mode:
 * `selected` confines the agent to the explicit folder list below (each
 * still governed by its own `WorkspaceFolderMode`); `full` lifts that
 * confinement entirely and lets the agent reach the whole machine.
 */
export type WorkspaceScopeMode = 'selected' | 'full';

export interface WorkspaceFolder {
  path: string;
  mode: WorkspaceFolderMode;
}

const STORAGE_KEY = 'indra.workspaceFolders';

/**
 * The safe default for a newly added folder. A refinery deployment must never
 * assume write access is wanted; the user opts into `controlled` per folder.
 */
const DEFAULT_MODE: WorkspaceFolderMode = 'read-only';

/**
 * The safe default scope. A refinery deployment must never assume the agent
 * should reach the whole machine; the user opts into `full` explicitly.
 */
const DEFAULT_SCOPE: WorkspaceScopeMode = 'selected';

interface PersistedWorkspaceFolders {
  scope: WorkspaceScopeMode;
  folders: WorkspaceFolder[];
}

function defaultPersistedState(): PersistedWorkspaceFolders {
  return { scope: DEFAULT_SCOPE, folders: [] };
}

function isWorkspaceFolderMode(value: unknown): value is WorkspaceFolderMode {
  return value === 'read-only' || value === 'controlled';
}

function isWorkspaceScopeMode(value: unknown): value is WorkspaceScopeMode {
  return value === 'selected' || value === 'full';
}

function isWorkspaceFolder(value: unknown): value is WorkspaceFolder {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.path === 'string' &&
    candidate.path.length > 0 &&
    isWorkspaceFolderMode(candidate.mode)
  );
}

/**
 * Guarded the same way traceDensity.ts is: read on first render, so it must
 * degrade to a safe default rather than throw when localStorage is
 * unavailable (e.g. a locked-down webview) or holds something that is no
 * longer valid.
 *
 * Also migrates the pre-scope-mode persisted shape: earlier versions of this
 * hook wrote a bare `WorkspaceFolder[]` array under this key. That shape
 * still loads correctly here - it becomes `{ scope: 'selected', folders }` -
 * so upgrading the app never drops a user's saved folders or throws on their
 * old data.
 */
function readStoredWorkspaceFolders(): PersistedWorkspaceFolders {
  if (typeof window === 'undefined') return defaultPersistedState();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultPersistedState();
    const parsed: unknown = JSON.parse(stored);

    // Pre-scope-mode shape: a bare folder array.
    if (Array.isArray(parsed)) {
      return { scope: DEFAULT_SCOPE, folders: parsed.filter(isWorkspaceFolder) };
    }

    if (typeof parsed === 'object' && parsed !== null) {
      const candidate = parsed as Record<string, unknown>;
      const folders = Array.isArray(candidate.folders)
        ? candidate.folders.filter(isWorkspaceFolder)
        : [];
      const scope = isWorkspaceScopeMode(candidate.scope) ? candidate.scope : DEFAULT_SCOPE;
      return { scope, folders };
    }

    return defaultPersistedState();
  } catch {
    return defaultPersistedState();
  }
}

function writeStoredWorkspaceFolders(state: PersistedWorkspaceFolders): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A denied or full localStorage should not break the picker - the
    // folder list simply does not survive the session.
  }
}

export interface UseWorkspaceFoldersResult {
  folders: WorkspaceFolder[];
  scope: WorkspaceScopeMode;
  addFolder: (path: string, mode?: WorkspaceFolderMode) => void;
  removeFolder: (path: string) => void;
  setFolderMode: (path: string, mode: WorkspaceFolderMode) => void;
  setScope: (scope: WorkspaceScopeMode) => void;
}

/**
 * Persists the top-level scope mode (`selected` folders vs `full` machine
 * access), the set of local folders the user has explicitly granted to
 * INDRA's models, and each folder's access mode. This is the UI/persistence
 * contract only - enforcement at the filesystem boundary is a separate,
 * backend-owned effort.
 */
export function useWorkspaceFolders(): UseWorkspaceFoldersResult {
  const [state, setState] = useState<PersistedWorkspaceFolders>(() => readStoredWorkspaceFolders());

  const addFolder = useCallback((path: string, mode: WorkspaceFolderMode = DEFAULT_MODE) => {
    const trimmed = path.trim();
    if (trimmed.length === 0) return;
    setState((previous) => {
      if (previous.folders.some((folder) => folder.path === trimmed)) return previous;
      const next: PersistedWorkspaceFolders = {
        ...previous,
        folders: [...previous.folders, { path: trimmed, mode }],
      };
      writeStoredWorkspaceFolders(next);
      return next;
    });
  }, []);

  const removeFolder = useCallback((path: string) => {
    setState((previous) => {
      const next: PersistedWorkspaceFolders = {
        ...previous,
        folders: previous.folders.filter((folder) => folder.path !== path),
      };
      writeStoredWorkspaceFolders(next);
      return next;
    });
  }, []);

  const setFolderMode = useCallback((path: string, mode: WorkspaceFolderMode) => {
    setState((previous) => {
      const next: PersistedWorkspaceFolders = {
        ...previous,
        folders: previous.folders.map((folder) =>
          folder.path === path ? { ...folder, mode } : folder
        ),
      };
      writeStoredWorkspaceFolders(next);
      return next;
    });
  }, []);

  const setScope = useCallback((scope: WorkspaceScopeMode) => {
    setState((previous) => {
      const next: PersistedWorkspaceFolders = { ...previous, scope };
      writeStoredWorkspaceFolders(next);
      return next;
    });
  }, []);

  return {
    folders: state.folders,
    scope: state.scope,
    addFolder,
    removeFolder,
    setFolderMode,
    setScope,
  };
}
