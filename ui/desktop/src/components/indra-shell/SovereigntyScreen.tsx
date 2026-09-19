import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';

/**
 * One observed outbound-network attempt, as the egress inspector recorded it.
 *
 * `blocked` carries the backend's honest semantics: `trigger_probe` returning
 * `Ok` means the connection was refused (blocked); `Err` means it genuinely
 * reached the network. On an air-gapped plant machine every attempt is
 * blocked; on a networked dev laptop a reached attempt is the correct answer
 * for that machine, and this screen says so rather than faking a block.
 */
export interface EgressAttempt {
  url: string;
  blocked: boolean;
  /** ISO-8601 timestamp. */
  at: string;
  /** Where the denial happened, e.g. `socket`. */
  mechanism?: string;
  /** What caused the attempt, e.g. `user` or `config`. */
  origin?: string;
  /** The reason string the inspector returned, rendered verbatim. */
  reason?: string;
}

export interface SovereigntyScreenProps {
  attempts: EgressAttempt[];
  uptimeSeconds: number;
  sandboxBackend: string;
  modelsLoaded: number;
  degradedCount: number;
  sealedCount: number;
  onProbe: (url: string) => Promise<void>;
}

/** `1_231_200` to `14d 6h uptime`, matching the spec 5.8 header. */
export function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;

  if (days > 0) {
    return `${days}d ${hours}h uptime`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m uptime`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s uptime`;
  }
  return `${secs}s uptime`;
}

/** ISO-8601 to `09-16 14:02` in the machine's own local time. */
export function formatAttemptTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
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

const panel: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-md)',
  background: 'var(--surface)',
  // Cards do not float - the border does the work a shadow would do elsewhere.
};

const panelTitle: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--t-12)',
  lineHeight: 'var(--t-12--line-height)',
  fontWeight: 500,
  letterSpacing: 'normal',
  color: 'var(--text-dim)',
};

function focusRing(focused: boolean): CSSProperties {
  // 2px --focus at 2px offset, on keyboard and mouse focus alike.
  return focused
    ? { outline: '2px solid var(--focus)', outlineOffset: '2px' }
    : { outline: 'none' };
}

function SummaryCard({ title, lines }: { title: string; lines: ReactNode[] }) {
  return (
    <section
      style={{
        ...panel,
        flex: '1 1 0',
        minWidth: 180,
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <h2 style={panelTitle}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>{lines}</div>
    </section>
  );
}

function AttemptRow({ attempt }: { attempt: EgressAttempt }) {
  // The word is the carrier; the colour only reinforces it.
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
      <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
        {formatAttemptTime(attempt.at)}
      </span>
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
        <span aria-hidden="true">{attempt.blocked ? '⛨' : '▲'}</span>
        {verdict}
      </span>
      {attempt.mechanism ? <span style={{ flexShrink: 0 }}>{attempt.mechanism}</span> : null}
      {attempt.origin ? <span style={{ flexShrink: 0 }}>{attempt.origin}</span> : null}
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

export function SovereigntyScreen({
  attempts,
  uptimeSeconds,
  sandboxBackend,
  modelsLoaded,
  degradedCount,
  sealedCount,
  onProbe,
}: SovereigntyScreenProps) {
  const [url, setUrl] = useState('');
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [buttonFocused, setButtonFocused] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = url.trim();
    if (target.length === 0 || probing) {
      return;
    }
    setError(null);
    setProbing(true);
    try {
      await onProbe(target);
    } catch (probeError) {
      setError(probeError instanceof Error ? probeError.message : String(probeError));
    } finally {
      setProbing(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-7)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-14)',
        lineHeight: 'var(--t-14--line-height)',
        color: 'var(--text)',
      }}
    >
      <h1 style={visuallyHidden}>Sovereignty</h1>

      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-5)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            color: 'var(--sealed)',
            fontWeight: 600,
            fontSize: 'var(--t-16)',
            lineHeight: 'var(--t-16--line-height)',
          }}
        >
          {/* The shield glyph carries the meaning alongside the word - colour is
              never the sole carrier (spec 8). */}
          <span aria-hidden="true">{'⛨'}</span>
          SEALED
        </span>
        <span
          style={{
            ...mono,
            fontSize: 'var(--t-12)',
            lineHeight: 'var(--t-12--line-height)',
            color: 'var(--text-dim)',
            textAlign: 'right',
          }}
        >
          {`${attempts.length} outbound attempts · ${formatUptime(uptimeSeconds)}`}
        </span>
      </header>

      <section style={{ ...panel, padding: 'var(--space-6)' }}>
        <h2 style={panelTitle}>Egress</h2>
        <p
          style={{
            margin: 'var(--space-4) 0 0 0',
            fontSize: 'var(--t-13)',
            lineHeight: 'var(--t-13--line-height)',
            color: 'var(--text-dim)',
            maxWidth: '68ch',
          }}
        >
          Every socket is inspected. Loopback to 127.0.0.1:11434 is the only permitted destination,
          validated at config time. Do not take that on trust - test it.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            margin: 'var(--space-5) 0 0 0',
            flexWrap: 'wrap',
          }}
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
              flexShrink: 0,
              padding: 'var(--space-3) var(--space-5)',
              background: 'var(--raised)',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text-hi)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--t-13)',
              lineHeight: 'var(--t-13--line-height)',
              fontWeight: 500,
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
              margin: 'var(--space-4) 0 0 0',
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
              margin: 'var(--space-5) 0 0 0',
              fontSize: 'var(--t-12)',
              lineHeight: 'var(--t-12--line-height)',
              color: 'var(--text-dim)',
            }}
          >
            No attempt recorded yet. Type any URL above and watch it get blocked and logged - the
            record is permanent and you can revisit it here.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 'var(--space-5) 0 0 0',
              padding: 0,
            }}
          >
            {attempts.map((attempt, index) => (
              <AttemptRow key={`${attempt.at}-${attempt.url}-${index}`} attempt={attempt} />
            ))}
          </ul>
        )}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
        <SummaryCard
          title="Sandbox"
          lines={[
            <span key="backend" style={{ ...mono, fontSize: 'var(--t-13)', color: 'var(--text)' }}>
              {`${sandboxBackend} · net none`}
            </span>,
            <span
              key="net"
              style={{
                fontSize: 'var(--t-12)',
                lineHeight: 'var(--t-12--line-height)',
                color: 'var(--text-dim)',
              }}
            >
              Tools run with no network interface at all.
            </span>,
          ]}
        />
        <SummaryCard
          title="Models"
          lines={[
            <span key="loaded" style={{ ...mono, fontSize: 'var(--t-13)', color: 'var(--text)' }}>
              {`${modelsLoaded} loaded`}
            </span>,
            <span
              key="degraded"
              style={{
                ...mono,
                fontSize: 'var(--t-12)',
                lineHeight: 'var(--t-12--line-height)',
                // The triangle carries the meaning; the colour only reinforces it.
                color: degradedCount > 0 ? 'var(--degraded)' : 'var(--text-dim)',
              }}
            >
              {`${degradedCount} degraded fit ▲`}
            </span>,
          ]}
        />
        <SummaryCard
          title="Sealed"
          lines={[
            <span key="count" style={{ ...mono, fontSize: 'var(--t-13)', color: 'var(--text)' }}>
              {`${sealedCount} resources`}
            </span>,
            <span
              key="writes"
              style={{
                ...mono,
                fontSize: 'var(--t-12)',
                lineHeight: 'var(--t-12--line-height)',
                color: 'var(--text-dim)',
              }}
            >
              0 writes ever
            </span>,
          ]}
        />
      </div>
    </div>
  );
}
