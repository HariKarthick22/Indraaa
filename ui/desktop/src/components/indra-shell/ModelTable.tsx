import type { CSSProperties } from 'react';
import type { Fit } from '../../indra/events';

/**
 * A model reaches INDRA one of two ways, and they are peers.
 *
 * Spec 5.2 Step 2 shows only a directory scan of local GGUF files. A model
 * served from a company model server on the plant LAN has no file size and no
 * local path - it has an endpoint and a reachability state. This union is the
 * documented, approved deviation from the spec (plan "Documented deviations",
 * item 2), and follows the backend's `Backend::LocalHttp` variant.
 */
export type ModelSource =
  | { kind: 'local'; path: string; bytes: number }
  | { kind: 'served'; endpoint: string; reachable: boolean };

export interface ModelRow {
  id: string;
  source: ModelSource;
  vision: boolean;
  toolCalling: 'reliable' | 'unreliable' | 'none';
  contextTokens: number;
  fit: Fit;
}

export interface ModelTableProps {
  rows: ModelRow[];
}

/** `4_100_000_000` to `4.1 GB`, `274_000_000` to `274 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  }
  if (bytes >= 1_000_000) {
    return `${Math.round(bytes / 1_000_000)} MB`;
  }
  if (bytes >= 1_000) {
    return `${Math.round(bytes / 1_000)} kB`;
  }
  return `${bytes} B`;
}

/** `32768` to `32k`, matching the spec's context column. */
export function formatContextTokens(tokens: number): string {
  const k = tokens / 1024;
  if (k < 1) {
    return `${tokens}`;
  }
  return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
}

const mono: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
};

const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

const headerCell: CSSProperties = {
  textAlign: 'left',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--t-12)',
  lineHeight: 'var(--t-12--line-height)',
  // Sentence case, no tracking: all-caps tracked labels are banned (spec 3.3).
  letterSpacing: 'normal',
  fontWeight: 500,
  color: 'var(--text-dim)',
  padding: 'var(--space-3) var(--space-5) var(--space-3) 0',
  borderBottom: '1px solid var(--line)',
  verticalAlign: 'bottom',
  whiteSpace: 'nowrap',
};

const bodyCell: CSSProperties = {
  fontSize: 'var(--t-13)',
  lineHeight: 'var(--t-13--line-height)',
  fontWeight: 400,
  color: 'var(--text)',
  padding: 'var(--space-4) var(--space-5) var(--space-4) 0',
  borderBottom: '1px solid var(--line)',
  verticalAlign: 'top',
};

function SourceCell({ source }: { source: ModelSource }) {
  if (source.kind === 'local') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <span style={{ ...mono, color: 'var(--text)' }}>{formatBytes(source.bytes)}</span>
        <span
          style={{
            ...mono,
            fontSize: 'var(--t-11)',
            lineHeight: 'var(--t-11--line-height)',
            color: 'var(--text-faint)',
            overflowWrap: 'anywhere',
          }}
        >
          {source.path}
        </span>
      </div>
    );
  }

  const reachWord = source.reachable ? 'reachable' : 'unreachable';
  // Signal colour is never the sole carrier: the dot is always accompanied by
  // the word, and the word is what a screen reader and a colourblind user read.
  const reachColour = source.reachable ? 'var(--sealed)' : 'var(--blocked)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <span style={{ ...mono, color: 'var(--text)', overflowWrap: 'anywhere' }}>
        {source.endpoint}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: 'var(--t-11)',
          lineHeight: 'var(--t-11--line-height)',
          color: 'var(--text-dim)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            flexShrink: 0,
            borderRadius: 'var(--r-full)',
            background: reachColour,
          }}
        />
        <span>{reachWord}</span>
      </span>
    </div>
  );
}

function FitCell({ fit }: { fit: Fit }) {
  if (fit.kind === 'comfortable' && !fit.warning) {
    return (
      <span style={{ color: 'var(--text-dim)' }}>
        <span aria-hidden="true">{'✓ '}</span>
        comfortable
      </span>
    );
  }

  const isDegraded = fit.kind === 'degraded';

  return (
    <div
      aria-label={isDegraded ? 'degraded fit' : `${fit.kind} fit`}
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        // A 2px left rule - signal colour never fills an area larger than 2px.
        borderLeft: isDegraded ? '2px solid var(--degraded)' : '2px solid var(--line-strong)',
        paddingLeft: 'var(--space-4)',
      }}
    >
      <span
        aria-hidden="true"
        style={{ color: isDegraded ? 'var(--degraded)' : 'var(--text-dim)', flexShrink: 0 }}
      >
        {'▲'}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {fit.warning ? (
          // Verbatim. Wrapped across lines, never truncated, never paraphrased,
          // never behind a disclosure (spec 2.2, 6.2).
          <span
            style={{
              color: 'var(--text)',
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
            }}
          >
            {fit.warning}
          </span>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>{fit.kind}</span>
        )}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface)',
        padding: 'var(--space-7)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-13)',
        lineHeight: 'var(--t-13--line-height)',
        color: 'var(--text-dim)',
      }}
    >
      <span style={{ color: 'var(--text)', fontWeight: 500 }}>
        Add a model - point at a directory of GGUF files, or a model server on your network
      </span>
      <span>
        INDRA reads models from disk and from a model server on your network. Both appear here as
        peers, with the fit measured on this machine.
      </span>
    </div>
  );
}

export function ModelTable({ rows }: ModelTableProps) {
  if (rows.length === 0) {
    return <EmptyState />;
  }

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'auto',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-13)',
        lineHeight: 'var(--t-13--line-height)',
        color: 'var(--text)',
        background: 'transparent',
      }}
    >
      <thead>
        <tr>
          <th scope="col" style={headerCell}>
            Model
          </th>
          <th scope="col" style={headerCell}>
            Source
          </th>
          <th scope="col" style={headerCell}>
            Vision
          </th>
          <th scope="col" style={headerCell}>
            Tools
          </th>
          <th scope="col" style={headerCell}>
            Context
          </th>
          <th scope="col" style={{ ...headerCell, paddingRight: 0, width: '34%' }}>
            Fit
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th
              scope="row"
              style={{
                ...bodyCell,
                ...mono,
                fontWeight: 500,
                textAlign: 'left',
                color: 'var(--text-hi)',
                overflowWrap: 'anywhere',
              }}
            >
              {row.id}
            </th>
            <td style={bodyCell}>
              <SourceCell source={row.source} />
            </td>
            <td style={{ ...bodyCell, color: row.vision ? 'var(--text)' : 'var(--text-faint)' }}>
              <span aria-hidden="true">{row.vision ? '✓' : '—'}</span>
              <span style={visuallyHidden}>{row.vision ? 'vision' : 'no vision'}</span>
            </td>
            <td
              style={{
                ...bodyCell,
                color: row.toolCalling === 'none' ? 'var(--text-faint)' : 'var(--text-dim)',
              }}
            >
              {row.toolCalling}
            </td>
            <td style={{ ...bodyCell, ...mono, color: 'var(--text-dim)' }}>
              {formatContextTokens(row.contextTokens)}
            </td>
            <td style={{ ...bodyCell, paddingRight: 0 }}>
              <FitCell fit={row.fit} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
