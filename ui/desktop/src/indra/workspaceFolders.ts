import { useCallback, useState } from 'react';

export type WorkspaceFolderMode = 'read-only' | 'controlled';

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

function isWorkspaceFolderMode(value: unknown): value is WorkspaceFolderMode {
  return value === 'read-only' || value === 'controlled';
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

// Guarded the same way traceDensity.ts is: read on first render, so it must
// degrade to an empty list rather than throw when localStorage is unavailable
// (e.g. a locked-down webview) or holds something that is no longer valid.
function readStoredWorkspaceFolders(): WorkspaceFolder[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isWorkspaceFolder) : [];
  } catch {
    return [];
  }
}

function writeStoredWorkspaceFolders(folders: WorkspaceFolder[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  } catch {
    // A denied or full localStorage should not break the picker - the
    // folder list simply does not survive the session.
  }
}

export interface UseWorkspaceFoldersResult {
  folders: WorkspaceFolder[];
  addFolder: (path: string, mode?: WorkspaceFolderMode) => void;
  removeFolder: (path: string) => void;
  setFolderMode: (path: string, mode: WorkspaceFolderMode) => void;
}

/**
 * Persists the set of local folders the user has explicitly granted to
 * INDRA's models, and each folder's access mode. This is the UI/persistence
 * contract only - enforcement of `read-only` vs `controlled` at the
 * filesystem boundary is a separate, backend-owned effort.
 */
export function useWorkspaceFolders(): UseWorkspaceFoldersResult {
  const [folders, setFoldersState] = useState<WorkspaceFolder[]>(() =>
    readStoredWorkspaceFolders()
  );

  const addFolder = useCallback((path: string, mode: WorkspaceFolderMode = DEFAULT_MODE) => {
    const trimmed = path.trim();
    if (trimmed.length === 0) return;
    setFoldersState((previous) => {
      if (previous.some((folder) => folder.path === trimmed)) return previous;
      const next = [...previous, { path: trimmed, mode }];
      writeStoredWorkspaceFolders(next);
      return next;
    });
  }, []);

  const removeFolder = useCallback((path: string) => {
    setFoldersState((previous) => {
      const next = previous.filter((folder) => folder.path !== path);
      writeStoredWorkspaceFolders(next);
      return next;
    });
  }, []);

  const setFolderMode = useCallback((path: string, mode: WorkspaceFolderMode) => {
    setFoldersState((previous) => {
      const next = previous.map((folder) => (folder.path === path ? { ...folder, mode } : folder));
      writeStoredWorkspaceFolders(next);
      return next;
    });
  }, []);

  return { folders, addFolder, removeFolder, setFolderMode };
}
