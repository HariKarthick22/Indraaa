import {
  memo,
  useCallback,
  useState,
  type CSSProperties,
  type FocusEvent,
  type FormEvent,
} from 'react';
import { formatBytes } from './ModelTable';

export interface ModelDownloadProgress {
  percent: number;
  bytesDownloaded: number;
  totalBytes: number;
  speedBps: number | null;
}

export interface ModelInstallRow {
  /** The repo:quantization spec - both a display id and a valid install spec. */
  id: string;
  label: string;
  sizeBytes: number;
  quantization: string;
  visionCapable: boolean;
  recommended: boolean;
  installed: boolean;
  downloading: boolean;
  failed: boolean;
  errorMessage?: string;
  /** Present only while downloading (or just after a failure, for the last-known numbers). */
  progress: ModelDownloadProgress | null;
}

export interface ModelInstallProps {
  models: ModelInstallRow[];
  onInstall: (spec: string) => void | Promise<void>;
  onCancel: (modelId: string) => void | Promise<void>;
  onDelete: (modelId: string) => void | Promise<void>;
  /** Clears a failed download's row client-side; failed downloads never linger server-side to remove. */
  onDismiss: (modelId: string) => void;
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

const mono: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
};

function formatSpeed(bps: number | null): string {
  return bps === null ? '—' : `${formatBytes(bps)}/s`;
}

/**
 * The one part of a row that repaints on every progress tick. Isolated into
 * its own memoized component, keyed only to the plain numbers it needs
 * (never the parent row object), so a tick for one download re-renders
 * nothing else in the list - not sibling rows, not this row's own static
 * fields. tabular-nums plus fixed-width numeric columns keep the digits from
 * reflowing the layout as they change (mandatory - they change constantly).
 */
const DownloadProgressNumbers = memo(function DownloadProgressNumbers({
  percent,
  bytesDownloaded,
  totalBytes,
  speedBps,
}: {
  percent: number;
  bytesDownloaded: number;
  totalBytes: number;
  speedBps: number | null;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%' }}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          width: '100%',
          height: 4,
          borderRadius: 'var(--r-full)',
          background: 'var(--line)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            background: 'var(--text-dim)',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          fontSize: 'var(--t-11)',
          lineHeight: 'var(--t-11--line-height)',
          color: 'var(--text-dim)',
        }}
      >
        <span style={{ ...mono, minWidth: '9ch' }}>
          {formatBytes(bytesDownloaded)} / {formatBytes(totalBytes)}
        </span>
        <span style={{ ...mono, minWidth: '4ch', textAlign: 'right' }}>
          {clamped.toFixed(0)}%
        </span>
        <span style={{ ...mono, minWidth: '8ch', textAlign: 'right' }}>{formatSpeed(speedBps)}</span>
      </div>
    </div>
  );
});

function StatusWord({ row }: { row: ModelInstallRow }) {
  if (row.failed) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          color: 'var(--blocked)',
          fontSize: 'var(--t-12)',
          fontWeight: 500,
        }}
      >
        <span aria-hidden="true">{'▲'}</span>
        Download failed
      </span>
    );
  }
  if (row.installed) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          color: 'var(--sealed)',
          fontSize: 'var(--t-12)',
          fontWeight: 500,
        }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
          <circle cx="4" cy="4" r="4" fill="currentColor" />
        </svg>
        Installed
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        color: 'var(--text-dim)',
        fontSize: 'var(--t-12)',
      }}
    >
      Not installed
    </span>
  );
}

interface ModelRowProps {
  model: ModelInstallRow;
  onCancel: (modelId: string) => void | Promise<void>;
  onDelete: (modelId: string) => void | Promise<void>;
  onDismiss: (modelId: string) => void;
}

const ModelRow = memo(function ModelRow({ model, onCancel, onDelete, onDismiss }: ModelRowProps) {
  const [pending, setPending] = useState(false);
  const actionRing = useFocusRing();

  const handleDelete = useCallback(async () => {
    setPending(true);
    try {
      await onDelete(model.id);
    } finally {
      setPending(false);
    }
  }, [model.id, onDelete]);

  const handleCancel = useCallback(async () => {
    setPending(true);
    try {
      await onCancel(model.id);
    } finally {
      setPending(false);
    }
  }, [model.id, onCancel]);

  const accent = model.failed ? 'var(--blocked)' : model.installed ? 'var(--sealed)' : 'var(--line-strong)';

  return (
    <li
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        background: 'var(--raised)',
        border: '1px solid var(--line)',
        borderLeft: `2px solid ${accent}`,
        borderRadius: 'var(--r-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: '1 1 220px', minWidth: 0 }}>
          <span
            style={{
              ...mono,
              color: 'var(--text-hi)',
              fontWeight: 500,
              fontSize: 'var(--t-13)',
              overflowWrap: 'anywhere',
            }}
          >
            {model.label}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
              color: 'var(--text-dim)',
              fontSize: 'var(--t-11)',
              lineHeight: 'var(--t-11--line-height)',
            }}
          >
            <span style={mono}>{formatBytes(model.sizeBytes)}</span>
            <span aria-hidden="true">·</span>
            <span>{model.quantization}</span>
            {model.visionCapable ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Vision</span>
              </>
            ) : null}
            {model.recommended ? (
              <>
                <span aria-hidden="true">·</span>
                <span style={{ color: 'var(--text)' }}>Recommended for this machine</span>
              </>
            ) : null}
          </span>
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <StatusWord row={model} />
        </div>

        <div style={{ display: 'inline-flex', gap: 'var(--space-2)', flexShrink: 0 }}>
          {model.downloading ? (
            <button
              type="button"
              className="indra-focusable"
              disabled={pending}
              onClick={handleCancel}
              onFocus={actionRing.onFocus}
              onBlur={actionRing.onBlur}
              style={actionButtonStyle(pending, actionRing.ringStyle)}
            >
              Cancel
            </button>
          ) : null}
          {model.failed ? (
            <button
              type="button"
              className="indra-focusable"
              onClick={() => onDismiss(model.id)}
              onFocus={actionRing.onFocus}
              onBlur={actionRing.onBlur}
              style={actionButtonStyle(false, actionRing.ringStyle)}
            >
              Dismiss
            </button>
          ) : null}
          {model.installed ? (
            <button
              type="button"
              className="indra-focusable"
              disabled={pending}
              onClick={handleDelete}
              onFocus={actionRing.onFocus}
              onBlur={actionRing.onBlur}
              style={actionButtonStyle(pending, actionRing.ringStyle)}
            >
              {pending ? 'Deleting…' : 'Delete'}
            </button>
          ) : null}
        </div>
      </div>

      {model.downloading && model.progress ? (
        <DownloadProgressNumbers
          percent={model.progress.percent}
          bytesDownloaded={model.progress.bytesDownloaded}
          totalBytes={model.progress.totalBytes}
          speedBps={model.progress.speedBps}
        />
      ) : null}

      {model.failed && model.errorMessage ? (
        <p
          role="alert"
          style={{
            margin: 0,
            color: 'var(--text-dim)',
            fontSize: 'var(--t-12)',
            lineHeight: 'var(--t-12--line-height)',
            overflowWrap: 'anywhere',
          }}
        >
          {model.errorMessage}
        </p>
      ) : null}
    </li>
  );
});

function actionButtonStyle(pending: boolean, ringStyle: CSSProperties): CSSProperties {
  return {
    height: 26,
    padding: '0 var(--space-4)',
    background: 'transparent',
    border: '1px solid var(--line-strong)',
    borderRadius: 'var(--r-sm)',
    color: 'var(--text-hi)',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--t-12)',
    fontWeight: 500,
    cursor: pending ? 'default' : 'pointer',
    opacity: pending ? 0.6 : 1,
    ...ringStyle,
  };
}

function InstallControl({ onInstall }: { onInstall: (spec: string) => void | Promise<void> }) {
  const [spec, setSpec] = useState('');
  const [pending, setPending] = useState(false);
  const submitRing = useFocusRing();
  const trimmed = spec.trim();

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (trimmed.length === 0 || pending) return;
      setPending(true);
      try {
        await onInstall(trimmed);
        setSpec('');
      } finally {
        setPending(false);
      }
    },
    [onInstall, pending, trimmed]
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
      <input
        type="text"
        className="indra-focusable"
        value={spec}
        onChange={(event) => setSpec(event.target.value)}
        aria-label="Model name or ID"
        placeholder="Qwen/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M"
        spellCheck={false}
        autoComplete="off"
        style={{
          flex: '1 1 320px',
          minWidth: 0,
          padding: 'var(--space-4) var(--space-5)',
          background: 'var(--bg)',
          border: '1px solid var(--line-strong)',
          borderRadius: 'var(--r-sm)',
          outline: 'none',
          color: 'var(--text-hi)',
          caretColor: 'var(--focus)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--t-14)',
          lineHeight: 'var(--t-14--line-height)',
        }}
      />
      <button
        type="submit"
        className="indra-focusable"
        disabled={trimmed.length === 0 || pending}
        onFocus={submitRing.onFocus}
        onBlur={submitRing.onBlur}
        style={{
          flexShrink: 0,
          height: 40,
          padding: '0 var(--space-6)',
          // Prominent through size and weight, not colour - transparent/border
          // matches every other button in this design system (WorkspaceFolders,
          // ApprovalsQueue, SourcesLibrary); there is no solid-fill button
          // convention to match here.
          background: 'transparent',
          border: '1px solid var(--line-strong)',
          borderRadius: 'var(--r-sm)',
          color: 'var(--text-hi)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--t-14)',
          fontWeight: 500,
          cursor: trimmed.length === 0 || pending ? 'default' : 'pointer',
          opacity: trimmed.length === 0 || pending ? 0.5 : 1,
          ...submitRing.ringStyle,
        }}
      >
        {pending ? 'Starting…' : 'Install'}
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
      <span style={{ color: 'var(--text)', fontWeight: 500 }}>No models installed yet</span>
      <span>
        Install one above by name or ID. Models already on this machine - from a previous install,
        or downloaded by another tool - are detected automatically and listed here.
      </span>
    </div>
  );
}

function summarizeModels(models: ModelInstallRow[]): string {
  const installed = models.filter((model) => model.installed).length;
  const downloading = models.filter((model) => model.downloading).length;
  const parts = [models.length === 1 ? '1 model' : `${models.length} models`];
  if (installed > 0) parts.push(`${installed} installed`);
  if (downloading > 0) parts.push(`${downloading} downloading`);
  return parts.join(' · ');
}

/**
 * Install and manage local GGUF models. Models already on disk - found by the
 * existing models/list ACP call, which scans the Hugging Face cache directly
 * rather than a manifest of what this UI downloaded - appear here without the
 * user doing anything; see useLocalModels in ui/desktop/src/indra.
 */
export function ModelInstall({ models, onInstall, onCancel, onDelete, onDismiss }: ModelInstallProps) {
  return (
    <section
      aria-label="Local models"
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
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          paddingBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <InstallControl onInstall={onInstall} />
        <span
          style={{
            color: 'var(--text-dim)',
            fontSize: 'var(--t-12)',
            lineHeight: 'var(--t-12--line-height)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {models.length === 0 ? 'No models installed' : summarizeModels(models)}
        </span>
      </header>

      {models.length === 0 ? (
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
          {models.map((model) => (
            <ModelRow
              key={model.id}
              model={model}
              onCancel={onCancel}
              onDelete={onDelete}
              onDismiss={onDismiss}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
