import type { CSSProperties } from 'react';

export interface CompactionDividerProps {
  fromTurns: number;
  toBytes: number;
  keptCount: number;
  droppedCount: number;
  onShow: () => void;
}

function formatBytes(bytes: number): string {
  return bytes >= 1000 ? `${(bytes / 1000).toFixed(1)} kB` : `${bytes} B`;
}

const labelStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--t-11)',
  lineHeight: 'var(--t-11--line-height)',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--text-dim)',
  whiteSpace: 'nowrap',
};

/**
 * Spec §6.3: compaction is a visible event in the transcript, not a silent
 * trim. It sits inline where the compaction happened, so scrolling back
 * through a session shows exactly when and how much context was condensed
 * rather than a system that quietly forgets.
 */
export function CompactionDivider({
  fromTurns,
  toBytes,
  keptCount,
  droppedCount,
  onShow,
}: CompactionDividerProps) {
  return (
    <div
      role="separator"
      aria-label={`Context compacted: ${fromTurns} turns condensed to ${formatBytes(toBytes)}, ${keptCount} kept, ${droppedCount} dropped`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-3) 0',
      }}
    >
      <span aria-hidden="true" style={{ flex: '1 1 auto', height: 1, background: 'var(--line)' }} />
      <span style={labelStyle}>{`Compacted ${fromTurns} turns → ${formatBytes(toBytes)}`}</span>
      <span style={labelStyle}>{`${keptCount} kept`}</span>
      <span style={labelStyle}>{`${droppedCount} dropped`}</span>
      <button
        type="button"
        onClick={onShow}
        className="indra-focusable"
        style={{
          flexShrink: 0,
          height: 22,
          padding: '0 var(--space-3)',
          background: 'transparent',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--t-11)',
          cursor: 'pointer',
        }}
      >
        Show what changed
      </button>
      <span aria-hidden="true" style={{ flex: '1 1 auto', height: 1, background: 'var(--line)' }} />
    </div>
  );
}
