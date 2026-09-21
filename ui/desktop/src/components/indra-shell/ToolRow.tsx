import type { CSSProperties } from 'react';
import type { IndraEvent } from '../../indra/events';

export type ToolCallEvent = Extract<IndraEvent, { t: 'tool.call' }>;
export type ToolResultEvent = Extract<IndraEvent, { t: 'tool.result' }>;

export interface ToolRowProps {
  call: ToolCallEvent;
  /** `null` while the call is still in flight — no duration or summary yet. */
  result: ToolResultEvent | null;
  expanded: boolean;
  onToggle: () => void;
}

const mono: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
};

// The row always reads as seconds ("4.1s"), matching PlanCard's step duration.
function formatDurationShort(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(/\.0$/, '')}s`;
}

function sandboxBadge(sandboxBackend: string): { word: string; dotColor: string } {
  return sandboxBackend === 'none'
    ? { word: 'not sandboxed', dotColor: 'var(--degraded)' }
    : { word: 'sandboxed, no network', dotColor: 'var(--sealed)' };
}

async function copyArgs(args: unknown) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(args, null, 2));
  } catch {
    // Clipboard access can be denied by the OS sandbox; nothing to recover here.
  }
}

/**
 * Spec §6.2. The sandbox/egress badge on every tool row is the INDRA-specific
 * move — it repeats the sovereignty claim on every action rather than a page
 * visited once. Never cut (plan "Cut order if you slip").
 */
export function ToolRow({ call, result, expanded, onToggle }: ToolRowProps) {
  const badge = sandboxBadge(call.sandbox_backend);
  const failed = result !== null && !result.ok;

  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-sm)',
        background: 'var(--raised)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="indra-focusable"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          minHeight: 32,
          padding: '0 var(--space-4)',
          background: 'transparent',
          border: 'none',
          borderLeft: failed ? '2px solid var(--blocked)' : '2px solid transparent',
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
          textAlign: 'left',
        }}
      >
        <span aria-hidden="true" style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
          {'⟶'}
        </span>
        <span
          style={{
            ...mono,
            fontSize: 'var(--t-13)',
            lineHeight: 'var(--t-13--line-height)',
            color: 'var(--text-hi)',
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {call.name}
        </span>
        {result ? (
          <span
            style={{
              fontSize: 'var(--t-12)',
              lineHeight: 'var(--t-12--line-height)',
              color: 'var(--text-dim)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {result.summary}
          </span>
        ) : (
          <span style={{ flex: 1 }} />
        )}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--t-12)',
            lineHeight: 'var(--t-12--line-height)',
            color: 'var(--text-dim)',
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              flexShrink: 0,
              borderRadius: 'var(--r-full)',
              background: badge.dotColor,
            }}
          />
          <span>{badge.word}</span>
        </span>
        {failed ? (
          <span
            style={{
              color: 'var(--blocked)',
              fontSize: 'var(--t-12)',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            failed
          </span>
        ) : null}
        {result ? (
          <span
            style={{
              ...mono,
              fontSize: 'var(--t-11)',
              lineHeight: 'var(--t-11--line-height)',
              color: 'var(--text-faint)',
              flexShrink: 0,
            }}
          >
            {formatDurationShort(result.ms)}
          </span>
        ) : null}
        <span
          aria-hidden="true"
          style={{
            color: 'var(--text-faint)',
            transition: 'transform var(--m-ui) var(--ease-ui)',
            transform: expanded ? 'rotate(180deg)' : 'none',
            flexShrink: 0,
          }}
        >
          {'⌄'}
        </span>
      </button>

      {expanded ? (
        <div
          style={{
            padding: 'var(--space-4)',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 'var(--t-11)', color: 'var(--text-dim)' }}>Arguments</span>
              <button
                type="button"
                onClick={() => copyArgs(call.args)}
                className="indra-focusable"
                style={{
                  fontSize: 'var(--t-11)',
                  color: 'var(--text-dim)',
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)',
                  padding: 'var(--space-1) var(--space-3)',
                  cursor: 'pointer',
                }}
              >
                Copy
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--t-12)',
                lineHeight: 'var(--t-12--line-height)',
                color: 'var(--text)',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                background: 'var(--surface)',
                borderRadius: 'var(--r-sm)',
                padding: 'var(--space-3)',
              }}
            >
              {JSON.stringify(call.args, null, 2)}
            </pre>
          </div>

          {result ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-5)',
                fontSize: 'var(--t-12)',
                lineHeight: 'var(--t-12--line-height)',
                color: 'var(--text-dim)',
              }}
            >
              <span>{result.summary}</span>
              <span style={mono}>{`${result.bytes} bytes`}</span>
              <span style={mono}>{call.sandbox_backend}</span>
              <span>{badge.word}</span>
              {result.citations.length > 0 ? (
                <span>
                  {`${result.citations.length} citation${result.citations.length === 1 ? '' : 's'}`}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
