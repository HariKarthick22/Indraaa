import type { CSSProperties } from 'react';
import type { Fit } from '../../indra/events';

export interface ModelChipProps {
  /** The model that served the previous turn. `null` on the first turn. */
  previousModelId: string | null;
  modelId: string;
  /** Why the router chose this model, as the backend stated it. */
  reason: string;
  fit: Fit;
}

const monoId: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--t-12)',
  lineHeight: 'var(--t-12--line-height)',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--text)',
  overflowWrap: 'anywhere',
};

/**
 * Spec 6.2: the model switch chip appears **only when the model differs from
 * the previous turn** - `qwen-coder -> llama-3.2-vision . vision required`.
 * A degraded fit renders the registry's warning string verbatim below it on a
 * `--degraded` left rule. Never paraphrased, never truncated, never behind a
 * disclosure.
 */
export function ModelChip({ previousModelId, modelId, reason, fit }: ModelChipProps) {
  if (previousModelId === modelId) {
    return null;
  }

  const hasWarning = Boolean(fit.warning) && fit.kind !== 'comfortable';
  const isDegraded = fit.kind === 'degraded';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-12)',
        lineHeight: 'var(--t-12--line-height)',
        color: 'var(--text-dim)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          alignSelf: 'flex-start',
          maxWidth: '100%',
          padding: 'var(--space-1) var(--space-4)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)',
          background: 'var(--surface)',
        }}
      >
        {previousModelId === null ? null : (
          <>
            <span style={{ ...monoId, color: 'var(--text-dim)' }}>{previousModelId}</span>
            {/* The arrow is its own element - never glued onto adjacent text (spec 3.3). */}
            <span aria-hidden="true" style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
              {'→'}
            </span>
          </>
        )}
        <span style={{ ...monoId, color: 'var(--text-hi)', fontWeight: 500 }}>{modelId}</span>
        <span aria-hidden="true" style={{ color: 'var(--text-faint)' }}>
          {'·'}
        </span>
        <span>{reason}</span>
      </div>

      {hasWarning ? (
        <div
          aria-label={isDegraded ? 'degraded fit' : `${fit.kind} fit`}
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            // 2px left rule: signal colour never fills an area larger than 2px.
            borderLeftWidth: '2px',
            borderLeftStyle: 'solid',
            borderLeftColor: isDegraded ? 'var(--degraded)' : 'var(--line-strong)',
            paddingLeft: 'var(--space-4)',
            marginLeft: 'var(--space-1)',
          }}
        >
          <span
            aria-hidden="true"
            style={{ color: isDegraded ? 'var(--degraded)' : 'var(--text-dim)', flexShrink: 0 }}
          >
            {'▲'}
          </span>
          {/* Verbatim, wrapped across lines, never truncated (spec 2.2, 6.2). */}
          <span
            style={{
              color: 'var(--text)',
              fontSize: 'var(--t-12)',
              lineHeight: 'var(--t-12--line-height)',
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
            }}
          >
            {fit.warning}
          </span>
        </div>
      ) : null}
    </div>
  );
}
