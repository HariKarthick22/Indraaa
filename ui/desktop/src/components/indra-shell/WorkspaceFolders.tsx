import {
  useCallback,
  useState,
  type CSSProperties,
  type FocusEvent,
  type FormEvent,
  type ReactNode,
} from 'react';

export type WorkspaceFolderMode = 'read-only' | 'controlled';

/**
 * Top-level filesystem access mode. `selected` is the safe default: the
 * agent is confined to the explicit folder list below. `full` lifts that
 * confinement entirely - the agent may reach the whole machine - and is
 * never the default; the user opts into it explicitly.
 */
export type WorkspaceScopeMode = 'selected' | 'full';

export interface WorkspaceFolderEntry {
  path: string;
  mode: WorkspaceFolderMode;
}

export interface WorkspaceFoldersProps {
  folders: WorkspaceFolderEntry[];
  scope: WorkspaceScopeMode;
  onAdd: (path: string) => void;
  onRemove: (path: string) => void;
  onModeChange: (path: string, mode: WorkspaceFolderMode) => void;
  onScopeChange: (scope: WorkspaceScopeMode) => void;
}

/**
 * Focus ring, per section 8: 2px var(--focus) at 2px offset, on every
 * interactive element, never removed for mouse users. Inline styles cannot
 * express :focus-visible, so focus is tracked in state and the ring is always
 * drawn on focus - stricter than the spec, never laxer. (Matches
 * SourcesLibrary.tsx's local copy of this hook.)
 */
function useFocusRing() {
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback((_event: FocusEvent<HTMLElement>) => setFocused(true), []);
  const onBlur = useCallback((_event: FocusEvent<HTMLElement>) => setFocused(false), []);
  const ringStyle: CSSProperties = focused
    ? { outline: '2px solid var(--focus)', outlineOffset: '2px' }
    : { outline: 'none' };
  return { onFocus, onBlur, ringStyle };
}

const READ_ONLY_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <rect x="2" y="5" width="8" height="6" rx="1" fill="currentColor" />
    <path d="M4 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

/** A pencil, deliberately unlike the padlock above - shape carries meaning, not only colour. */
const CONTROLLED_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path
      d="M2.3 9.7 2 10.7l1-.3 6-6a0.9 0.9 0 0 0 0-1.3L8.3 2.4a0.9 0.9 0 0 0-1.3 0l-4.7 4.7Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
  </svg>
);

const MODE_LABEL: Record<WorkspaceFolderMode, string> = {
  'read-only': 'Read-only',
  controlled: 'Controlled',
};

const MODE_GLYPH: Record<WorkspaceFolderMode, ReactNode> = {
  'read-only': READ_ONLY_GLYPH,
  controlled: CONTROLLED_GLYPH,
};

/**
 * Signal colour per the achromatic rule (spec 3.2/8): sealed green for the
 * mode that guarantees no write ever happens, degraded amber for the mode
 * that permits a write only after the user explicitly approves it. Colour is
 * always paired with MODE_LABEL/MODE_GLYPH above - never the sole carrier.
 */
const MODE_COLOR: Record<WorkspaceFolderMode, string> = {
  'read-only': 'var(--sealed)',
  controlled: 'var(--degraded)',
};

const MODE_DESCRIPTION: Record<WorkspaceFolderMode, string> = {
  'read-only': 'INDRA can read files here. Nothing is ever written, moved, or deleted.',
  controlled:
    'INDRA can propose a change here. Every write, move, or delete needs your explicit approval first.',
};

interface ModeToggleButtonProps {
  mode: WorkspaceFolderMode;
  pressed: boolean;
  onPress: () => void;
}

function ModeToggleButton({ mode, pressed, onPress }: ModeToggleButtonProps) {
  const { onFocus, onBlur, ringStyle } = useFocusRing();
  const color = pressed ? MODE_COLOR[mode] : 'var(--text-dim)';
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={MODE_DESCRIPTION[mode]}
      onClick={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        height: 26,
        padding: '0 var(--space-4)',
        background: pressed ? 'var(--raised)' : 'transparent',
        border: `1px solid ${pressed ? color : 'var(--line)'}`,
        borderRadius: 'var(--r-sm)',
        color,
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-12)',
        lineHeight: 'var(--t-12--line-height)',
        fontWeight: 500,
        cursor: 'pointer',
        ...ringStyle,
      }}
    >
      {MODE_GLYPH[mode]}
      {MODE_LABEL[mode]}
    </button>
  );
}

const SCOPE_LABEL: Record<WorkspaceScopeMode, string> = {
  selected: 'Selected folders',
  full: 'Full access',
};

const SELECTED_SCOPE_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path
      d="M1.5 3.4h3.1l1 1.1h5v5.6h-9.1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
  </svg>
);

/** An open ring with a break, deliberately unlike the closed folder above - shape signals "no boundary", not only colour. */
const FULL_ACCESS_SCOPE_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path
      d="M6 1.6a4.4 4.4 0 1 1-3.1 1.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
    />
    <path d="M6 1.6v2.6M6 1.6H3.6" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
);

const SCOPE_GLYPH: Record<WorkspaceScopeMode, ReactNode> = {
  selected: SELECTED_SCOPE_GLYPH,
  full: FULL_ACCESS_SCOPE_GLYPH,
};

/**
 * Signal colour per the achromatic rule (spec 3.2/8): sealed green for the
 * confined, safe-default scope; blocked red for the scope that removes every
 * boundary. Colour is always paired with SCOPE_LABEL/SCOPE_GLYPH and the
 * explicit sentence in SCOPE_DESCRIPTION - never the sole carrier.
 */
const SCOPE_COLOR: Record<WorkspaceScopeMode, string> = {
  selected: 'var(--sealed)',
  full: 'var(--blocked)',
};

const SCOPE_DESCRIPTION: Record<WorkspaceScopeMode, string> = {
  selected:
    'INDRA can only reach the folders you add below. Each one is governed by its own read-only or controlled mode.',
  full: 'INDRA can read and write anywhere on this machine, with no folder boundary. This is unrestricted access.',
};

interface ScopeToggleButtonProps {
  mode: WorkspaceScopeMode;
  pressed: boolean;
  onPress: () => void;
}

function ScopeToggleButton({ mode, pressed, onPress }: ScopeToggleButtonProps) {
  const { onFocus, onBlur, ringStyle } = useFocusRing();
  const color = pressed ? SCOPE_COLOR[mode] : 'var(--text-dim)';
  return (
    <button
      type="button"
      className="indra-focusable"
      aria-pressed={pressed}
      title={SCOPE_DESCRIPTION[mode]}
      onClick={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        height: 28,
        padding: '0 var(--space-5)',
        background: pressed ? 'var(--raised)' : 'transparent',
        border: `1px solid ${pressed ? color : 'var(--line-strong)'}`,
        borderRadius: 'var(--r-sm)',
        color,
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-13)',
        lineHeight: 'var(--t-13--line-height)',
        fontWeight: 500,
        cursor: 'pointer',
        ...ringStyle,
      }}
    >
      {SCOPE_GLYPH[mode]}
      {SCOPE_LABEL[mode]}
    </button>
  );
}

/**
 * The dangerous-option affordance (spec §8): a 2px --blocked left rule, a ▲
 * glyph, and a plain sentence stating what full access means - never a bare
 * label, never colour alone. Mirrors the role="alert" pattern used for the
 * sovereignty probe's failure state (SovereigntyScreen.tsx) and the setup
 * flow's degraded warning (SetupIdentity.tsx).
 */
function FullAccessNotice() {
  return (
    <p
      role="alert"
      style={{
        margin: 0,
        display: 'flex',
        gap: 'var(--space-3)',
        borderLeftWidth: '2px',
        borderLeftStyle: 'solid',
        borderLeftColor: 'var(--blocked)',
        paddingLeft: 'var(--space-4)',
        paddingTop: 'var(--space-2)',
        paddingBottom: 'var(--space-2)',
        fontSize: 'var(--t-12)',
        lineHeight: 'var(--t-12--line-height)',
        color: 'var(--text)',
      }}
    >
      <span aria-hidden="true" style={{ color: 'var(--blocked)', flexShrink: 0 }}>
        {'▲'}
      </span>
      <span>
        Full access is on. INDRA can read, write, move, and delete files anywhere on this
        machine - not just in the folders listed below. The list below has no effect while this
        is selected.
      </span>
    </p>
  );
}

function ScopeControl({
  scope,
  onScopeChange,
}: {
  scope: WorkspaceScopeMode;
  onScopeChange: (scope: WorkspaceScopeMode) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <span
        id="workspace-scope-label"
        style={{
          color: 'var(--text-dim)',
          fontSize: 'var(--t-12)',
          lineHeight: 'var(--t-12--line-height)',
          fontWeight: 500,
        }}
      >
        Filesystem access
      </span>
      <span
        role="group"
        aria-labelledby="workspace-scope-label"
        style={{ display: 'inline-flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}
      >
        <ScopeToggleButton
          mode="selected"
          pressed={scope === 'selected'}
          onPress={() => onScopeChange('selected')}
        />
        <ScopeToggleButton
          mode="full"
          pressed={scope === 'full'}
          onPress={() => onScopeChange('full')}
        />
      </span>
      <span
        style={{
          color: 'var(--text-dim)',
          fontSize: 'var(--t-12)',
          lineHeight: 'var(--t-12--line-height)',
        }}
      >
        {SCOPE_DESCRIPTION[scope]}
      </span>
      {scope === 'full' ? <FullAccessNotice /> : null}
    </div>
  );
}

interface FolderRowProps {
  folder: WorkspaceFolderEntry;
  hovered: boolean;
  onHoverChange: (path: string | null) => void;
  onRemove: (path: string) => void;
  onModeChange: (path: string, mode: WorkspaceFolderMode) => void;
}

function FolderRow({ folder, hovered, onHoverChange, onRemove, onModeChange }: FolderRowProps) {
  const { onFocus, onBlur, ringStyle } = useFocusRing();
  const edge = hovered ? 'var(--line-strong)' : 'var(--line)';
  const accent = MODE_COLOR[folder.mode];

  return (
    <li
      onMouseEnter={() => onHoverChange(folder.path)}
      onMouseLeave={() => onHoverChange(null)}
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        minHeight: 44,
        padding: 'var(--space-3) var(--space-4)',
        background: hovered ? 'var(--hover)' : 'var(--raised)',
        border: `1px solid ${edge}`,
        // Signal colour as a 2px left rule only - never a panel fill (spec 3.2).
        borderLeft: `2px solid ${accent}`,
        borderRadius: 'var(--r-sm)',
      }}
    >
      <span
        title={folder.path}
        style={{
          flex: '1 1 220px',
          minWidth: 0,
          overflowWrap: 'anywhere',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--t-13)',
          lineHeight: 'var(--t-13--line-height)',
          color: 'var(--text-hi)',
        }}
      >
        {folder.path}
      </span>

      <span
        role="group"
        aria-label={`Access mode for ${folder.path}`}
        style={{ display: 'inline-flex', gap: 'var(--space-2)', flexShrink: 0 }}
      >
        <ModeToggleButton
          mode="read-only"
          pressed={folder.mode === 'read-only'}
          onPress={() => onModeChange(folder.path, 'read-only')}
        />
        <ModeToggleButton
          mode="controlled"
          pressed={folder.mode === 'controlled'}
          onPress={() => onModeChange(folder.path, 'controlled')}
        />
      </span>

      <button
        type="button"
        aria-label={`Remove ${folder.path}`}
        title="Remove"
        onClick={() => onRemove(folder.path)}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{
          flexShrink: 0,
          width: 26,
          height: 26,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)',
          color: 'var(--text-dim)',
          cursor: 'pointer',
          ...ringStyle,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>
    </li>
  );
}

/**
 * Whether the real native OS folder picker (wired over IPC in main.ts /
 * preload.ts as `select-workspace-folder`) is available in this renderer.
 * False in a non-Electron preview or a test that does not mock it - the form
 * fallback below covers that case rather than leaving the control dead.
 */
function hasNativeFolderPicker(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.electron?.selectWorkspaceFolder === 'function'
  );
}

function AddFolderControl({ onAdd }: { onAdd: (path: string) => void }) {
  const [manualPath, setManualPath] = useState('');
  const [pending, setPending] = useState(false);
  const { onFocus, onBlur, ringStyle } = useFocusRing();

  const handlePick = useCallback(async () => {
    const picker = window.electron?.selectWorkspaceFolder;
    if (typeof picker !== 'function') return;
    setPending(true);
    try {
      const result = await picker();
      if (!result.canceled && result.filePaths.length > 0) {
        onAdd(result.filePaths[0]);
      }
    } finally {
      setPending(false);
    }
  }, [onAdd]);

  const handleManualSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = manualPath.trim();
      if (trimmed.length === 0) return;
      onAdd(trimmed);
      setManualPath('');
    },
    [manualPath, onAdd]
  );

  const buttonStyle: CSSProperties = {
    flexShrink: 0,
    height: 28,
    padding: '0 var(--space-5)',
    background: 'transparent',
    border: '1px solid var(--line-strong)',
    borderRadius: 'var(--r-sm)',
    color: 'var(--text-hi)',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--t-13)',
    fontWeight: 500,
    cursor: 'pointer',
  };

  if (hasNativeFolderPicker()) {
    return (
      <button
        type="button"
        onClick={handlePick}
        disabled={pending}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{ ...buttonStyle, ...ringStyle, opacity: pending ? 0.7 : 1 }}
      >
        {pending ? 'Choosing…' : 'Add a folder'}
      </button>
    );
  }

  // TODO(workspace-folders): window.electron.selectWorkspaceFolder is not
  // available in this runtime (e.g. a non-Electron preview, or a test host
  // that does not mock it). Falls back to a typed path so the control is
  // never a dead end; remove this branch once every renderer target the app
  // ships to exposes the native picker.
  return (
    <form
      onSubmit={handleManualSubmit}
      style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}
    >
      <input
        type="text"
        className="indra-focusable"
        value={manualPath}
        onChange={(event) => setManualPath(event.target.value)}
        aria-label="Workspace folder path"
        placeholder="/data/plant-a"
        spellCheck={false}
        autoComplete="off"
        style={{
          flex: '1 1 200px',
          minWidth: 0,
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--bg)',
          border: '1px solid var(--line-strong)',
          borderRadius: 'var(--r-sm)',
          outline: 'none',
          color: 'var(--text-hi)',
          caretColor: 'var(--focus)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--t-13)',
          lineHeight: 'var(--t-13--line-height)',
        }}
      />
      <button type="submit" className="indra-focusable" style={buttonStyle}>
        Add a folder
      </button>
    </form>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        padding: 'var(--space-7)',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        fontSize: 'var(--t-13)',
        lineHeight: 'var(--t-13--line-height)',
        color: 'var(--text-dim)',
      }}
    >
      <span style={{ color: 'var(--text)', fontWeight: 500 }}>No workspace folders added yet</span>
      <span>
        Add a folder above to let INDRA&apos;s models read files there. Nothing outside the folders
        you add is ever visible to a model - not even to list a directory.
      </span>
    </div>
  );
}

function summarizeFolders(folders: WorkspaceFolderEntry[]): string {
  const readOnly = folders.filter((folder) => folder.mode === 'read-only').length;
  const controlled = folders.length - readOnly;
  const parts = [folders.length === 1 ? '1 folder' : `${folders.length} folders`];
  if (readOnly > 0) parts.push(`${readOnly} read-only`);
  if (controlled > 0) parts.push(`${controlled} controlled`);
  return parts.join(' · ');
}

export function WorkspaceFolders({
  folders,
  scope,
  onAdd,
  onRemove,
  onModeChange,
  onScopeChange,
}: WorkspaceFoldersProps) {
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const scopeIsFull = scope === 'full';

  return (
    <section
      aria-label="Workspace folders"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
        width: '100%',
        color: 'var(--text)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-14)',
        lineHeight: 'var(--t-14--line-height)',
      }}
    >
      <ScopeControl scope={scope} onScopeChange={onScopeChange} />

      <div
        // The per-folder list is inert while scope is 'full' - dimmed and
        // labelled below so that fact is legible, not just implied by the
        // toggle above (spec 8: never make the user infer state from colour
        // or absence alone).
        aria-label={
          scopeIsFull ? 'Selected folders (not currently enforced)' : 'Selected folders'
        }
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)',
          opacity: scopeIsFull ? 0.55 : 1,
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--line)',
        }}
      >
        {scopeIsFull ? (
          <span
            style={{
              color: 'var(--text-dim)',
              fontSize: 'var(--t-12)',
              lineHeight: 'var(--t-12--line-height)',
            }}
          >
            Not enforced while full access is on - the per-folder modes below do nothing until
            you switch back to Selected folders.
          </span>
        ) : null}

        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
            paddingBottom: 'var(--space-3)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <span
            style={{
              color: 'var(--text-dim)',
              fontSize: 'var(--t-12)',
              lineHeight: 'var(--t-12--line-height)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {folders.length === 0 ? 'No folders added' : summarizeFolders(folders)}
          </span>
          <AddFolderControl onAdd={onAdd} />
        </header>

        {folders.length === 0 ? (
          <EmptyState />
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            {folders.map((folder) => (
              <FolderRow
                key={folder.path}
                folder={folder}
                hovered={hoveredPath === folder.path}
                onHoverChange={setHoveredPath}
                onRemove={onRemove}
                onModeChange={onModeChange}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
