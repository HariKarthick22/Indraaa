export interface IndraTopBarProps {
  sessionTitle: string;
  onSessionTitleChange: (title: string) => void;
  sessionBytes: number;
  budgetBytes: number;
  onToggleTheme: () => void;
  onOpenLedger?: () => void;
}

export type ContextGaugeState = 'ok' | 'near-cap' | 'at-cap';

function formatKb(bytes: number): string {
  return `${(bytes / 1000).toFixed(1)} kB`;
}

export function formatContextGauge(sessionBytes: number, budgetBytes: number): string {
  return `${formatKb(sessionBytes)} / ${formatKb(budgetBytes)}`;
}

// Spec §6.3: the gauge takes --degraded past 70% and holds at cap while
// compaction runs, rather than climbing past 100%.
export function contextGaugeState(sessionBytes: number, budgetBytes: number): ContextGaugeState {
  if (budgetBytes <= 0) return 'ok';
  const ratio = sessionBytes / budgetBytes;
  if (ratio >= 1) return 'at-cap';
  if (ratio >= 0.7) return 'near-cap';
  return 'ok';
}

export function IndraTopBar({
  sessionTitle,
  onSessionTitleChange,
  sessionBytes,
  budgetBytes,
  onToggleTheme,
  onOpenLedger,
}: IndraTopBarProps) {
  const gaugeState = contextGaugeState(sessionBytes, budgetBytes);
  const ratio = budgetBytes > 0 ? Math.min(Math.max(sessionBytes / budgetBytes, 0), 1) : 0;

  const gauge = (
    <>
      <span
        aria-label="Context budget"
        style={{
          flexShrink: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--t-11)',
          lineHeight: 'var(--t-11--line-height)',
          color: 'var(--text-dim)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatContextGauge(sessionBytes, budgetBytes)}
      </span>
      {/* 60px hairline bar (spec §6.3); the fill width ticks on context.delta. */}
      <div
        role="progressbar"
        aria-label="Context usage"
        aria-valuemin={0}
        aria-valuenow={sessionBytes}
        aria-valuemax={budgetBytes}
        data-state={gaugeState}
        style={{
          flexShrink: 0,
          width: 60,
          height: 3,
          borderRadius: 'var(--r-full)',
          background: 'var(--line)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${ratio * 100}%`,
            borderRadius: 'var(--r-full)',
            background: gaugeState === 'ok' ? 'var(--text-dim)' : 'var(--degraded)',
            transitionProperty: 'width',
            transitionDuration: 'var(--m-ui)',
            transitionTimingFunction: 'var(--ease-ui)',
          }}
        />
      </div>
    </>
  );

  return (
    <header
      style={{
        height: 36,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-6)',
        padding: `0 ${'var(--space-6)'}`,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
        color: 'var(--text)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-13)',
        lineHeight: 'var(--t-13--line-height)',
      }}
    >
      <input
        type="text"
        value={sessionTitle}
        onChange={(event) => onSessionTitleChange(event.target.value)}
        aria-label="Session title"
        className="indra-focusable"
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-hi)',
          caretColor: 'var(--focus)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--t-13)',
          fontWeight: 500,
        }}
      />
      {onOpenLedger ? (
        <button
          type="button"
          onClick={onOpenLedger}
          aria-label="Open context ledger"
          className="indra-focusable"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          {gauge}
        </button>
      ) : (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          {gauge}
        </div>
      )}
      <button
        type="button"
        onClick={onToggleTheme}
        aria-label="Toggle theme"
        className="indra-focusable"
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          borderRadius: 'var(--r-sm)',
          color: 'var(--text-dim)',
          cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 2 A6 6 0 0 1 8 14 Z" fill="currentColor" />
        </svg>
      </button>
    </header>
  );
}
