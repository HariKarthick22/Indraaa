import type { CSSProperties } from 'react';

export interface LedgerRow {
  id: string;
  label: string;
  detail: string;
  bytes: number;
  pinned: boolean;
}

export interface LedgerSection {
  name: string;
  bytes: number;
  rows: LedgerRow[];
}

export interface ContextLedgerProps {
  sections: LedgerSection[];
  onPin: (rowId: string) => void;
  onDrop: (rowId: string) => void;
}

function formatBytes(bytes: number): string {
  return `${bytes.toLocaleString()} B`;
}

const byteStyle: CSSProperties = {
  flexShrink: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--t-12)',
  lineHeight: 'var(--t-12--line-height)',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--text-dim)',
};

const rowButtonStyle: CSSProperties = {
  flexShrink: 0,
  height: 24,
  padding: '0 var(--space-3)',
  background: 'transparent',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-sm)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--t-11)',
  lineHeight: 'var(--t-11--line-height)',
  cursor: 'pointer',
};

/**
 * Spec §6.3: compaction is an event in the transcript, not a silent trim -
 * this is the ledger that makes the budget something a person can act on.
 * Every row carries its own byte cost and can be pinned (kept through the
 * next compaction) or dropped (removed now).
 */
export function ContextLedger({ sections, onPin, onDrop }: ContextLedgerProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        padding: 'var(--space-5)',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
      }}
    >
      {sections.map((section) => (
        <section
          key={section.name}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              padding: '0 var(--space-2)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--t-12)',
                lineHeight: 'var(--t-12--line-height)',
                color: 'var(--text-dim)',
              }}
            >
              {section.name}
            </span>
            <span style={byteStyle}>{formatBytes(section.bytes)}</span>
          </header>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {section.rows.map((row) => (
              <li
                key={row.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  minHeight: 32,
                  padding: '0 var(--space-2)',
                  borderRadius: 'var(--r-sm)',
                }}
              >
                <div
                  style={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--t-13)',
                      lineHeight: 'var(--t-13--line-height)',
                      color: 'var(--text-hi)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.label}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--t-11)',
                      lineHeight: 'var(--t-11--line-height)',
                      color: 'var(--text-faint)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.detail}
                  </span>
                </div>
                <span style={byteStyle}>{formatBytes(row.bytes)}</span>
                <button
                  type="button"
                  onClick={() => onPin(row.id)}
                  aria-pressed={row.pinned}
                  aria-label={row.pinned ? `Unpin ${row.label}` : `Pin ${row.label}`}
                  style={{
                    ...rowButtonStyle,
                    color: row.pinned ? 'var(--text-hi)' : 'var(--text-dim)',
                  }}
                >
                  {row.pinned ? 'Pinned' : 'Pin'}
                </button>
                <button
                  type="button"
                  onClick={() => onDrop(row.id)}
                  aria-label={`Drop ${row.label}`}
                  style={{ ...rowButtonStyle, color: 'var(--text-dim)' }}
                >
                  Drop
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
