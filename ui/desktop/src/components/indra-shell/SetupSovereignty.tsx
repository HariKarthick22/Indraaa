import { useState, type CSSProperties, type FormEvent } from 'react';

/**
 * The result of one probe, mirroring the honest semantics of
 * `crates/indra/src/security/egress_inspector.rs::trigger_probe`: `blocked`
 * true means the connection was refused; false means it genuinely reached
 * the network (the correct answer on a networked dev machine).
 */
export interface SovereigntyProbeResult {
  blocked: boolean;
  reason?: string;
}

interface LoggedAttempt extends SovereigntyProbeResult {
  url: string;
}

export interface SetupSovereigntyProps {
  onProbe: (url: string) => Promise<SovereigntyProbeResult>;
  onStart: () => void;
}

const mono: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
};

const column: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100%',
};

const heading: CSSProperties = {
  margin: 0,
  fontSize: 'var(--t-28)',
  lineHeight: 'var(--t-28--line-height)',
  fontWeight: 600,
  color: 'var(--text-hi)',
};

const panel: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-md)',
  background: 'var(--surface)',
  padding: 'var(--space-6)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
};

const actionButton: CSSProperties = {
  flexShrink: 0,
  padding: 'var(--space-3) var(--space-5)',
  background: 'var(--raised)',
  border: '1px solid var(--line-strong)',
  borderRadius: 'var(--r-sm)',
  outline: 'none',
  color: 'var(--text-hi)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--t-13)',
  lineHeight: 'var(--t-13--line-height)',
  fontWeight: 500,
  cursor: 'pointer',
};

function focusRing(focused: boolean): CSSProperties {
  // 2px --focus at 2px offset, on keyboard and mouse focus alike (spec §8).
  return focused ? { outline: '2px solid var(--focus)', outlineOffset: '2px' } : { outline: 'none' };
}

function AttemptRow({ attempt }: { attempt: LoggedAttempt }) {
  const verdict = attempt.blocked ? 'BLOCKED' : 'REACHED';
  const verdictColour = attempt.blocked ? 'var(--sealed)' : 'var(--blocked)';

  return (
    <li
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: 'var(--space-4)',
        padding: 'var(--space-3) 0',
        borderTop: '1px solid var(--line)',
        ...mono,
        fontSize: 'var(--t-12)',
        lineHeight: 'var(--t-12--line-height)',
        color: 'var(--text-dim)',
      }}
    >
      <span style={{ color: 'var(--text)', flex: '1 1 220px', overflowWrap: 'anywhere' }}>
        {attempt.url}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          color: verdictColour,
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {/* The word is the carrier; colour only reinforces it (spec §8). */}
        <span aria-hidden="true">{attempt.blocked ? '⛨' : '▲'}</span>
        {verdict}
      </span>
      {attempt.reason ? (
        <span
          style={{
            flex: '1 1 100%',
            color: 'var(--text-faint)',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
          }}
        >
          {attempt.reason}
        </span>
      ) : null}
    </li>
  );
}

export function SetupSovereignty({ onProbe, onStart }: SetupSovereigntyProps) {
  const [url, setUrl] = useState('');
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<LoggedAttempt[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [buttonFocused, setButtonFocused] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = url.trim();
    if (target.length === 0 || probing) return;
    setError(null);
    setProbing(true);
    try {
      const result = await onProbe(target);
      setAttempts((prev) => [{ url: target, ...result }, ...prev]);
    } catch (probeError) {
      setError(probeError instanceof Error ? probeError.message : String(probeError));
    } finally {
      setProbing(false);
    }
  }

  const canStart = attempts.length > 0;

  return (
    <div style={column}>
      <div
        style={{
          width: 520,
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-7)',
        }}
      >
        <h1 style={heading}>Prove it is sealed</h1>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--t-13)',
            lineHeight: 'var(--t-13--line-height)',
            color: 'var(--text-dim)',
          }}
        >
          INDRA cannot reach the network. Do not take that on trust — test it yourself before you
          start.
        </p>

        <section style={panel}>
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}
          >
            <input
              type="text"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              aria-label="Test a URL"
              placeholder="https://..."
              spellCheck={false}
              autoComplete="off"
              style={{
                flex: '1 1 320px',
                minWidth: 0,
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--bg)',
                border: '1px solid var(--line-strong)',
                borderRadius: 'var(--r-sm)',
                color: 'var(--text-hi)',
                caretColor: 'var(--focus)',
                ...mono,
                fontSize: 'var(--t-13)',
                lineHeight: 'var(--t-13--line-height)',
                ...focusRing(inputFocused),
              }}
            />
            <button
              type="submit"
              onFocus={() => setButtonFocused(true)}
              onBlur={() => setButtonFocused(false)}
              disabled={probing}
              style={{
                ...actionButton,
                cursor: probing ? 'default' : 'pointer',
                ...focusRing(buttonFocused),
              }}
            >
              {probing ? 'Probing' : 'Probe'}
            </button>
          </form>

          {error ? (
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
                fontSize: 'var(--t-12)',
                lineHeight: 'var(--t-12--line-height)',
                color: 'var(--text)',
              }}
            >
              <span aria-hidden="true" style={{ color: 'var(--blocked)' }}>
                {'▲'}
              </span>
              <span style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                {`Probe could not run: ${error}`}
              </span>
            </p>
          ) : null}

          {attempts.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--t-12)',
                lineHeight: 'var(--t-12--line-height)',
                color: 'var(--text-dim)',
              }}
            >
              No attempt yet. Type any URL above and watch it get blocked and logged — the record
              persists to the Sovereignty page you can revisit at any time.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {attempts.map((attempt, index) => (
                <AttemptRow key={`${attempt.url}-${index}`} attempt={attempt} />
              ))}
            </ul>
          )}
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="indra-focusable"
            onClick={onStart}
            disabled={!canStart}
            title={canStart ? undefined : 'Probe a URL first — prove it, don’t just claim it'}
            style={{
              ...actionButton,
              cursor: canStart ? 'pointer' : 'not-allowed',
              opacity: canStart ? 1 : 0.5,
            }}
          >
            Start using INDRA
          </button>
        </div>
      </div>
    </div>
  );
}
