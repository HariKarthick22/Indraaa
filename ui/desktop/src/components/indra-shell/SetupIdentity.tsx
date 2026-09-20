import type { CSSProperties } from 'react';

export type IdentityMode = 'plant' | 'standalone';

export interface SetupIdentityProps {
  onChoose: (mode: IdentityMode) => void;
}

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

const card: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  padding: 'var(--space-6)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-md)',
  background: 'var(--surface)',
  textAlign: 'left',
};

const cardTitle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--t-16)',
  lineHeight: 'var(--t-16--line-height)',
  fontWeight: 600,
  color: 'var(--text-hi)',
};

const cardBody: CSSProperties = {
  margin: 0,
  fontSize: 'var(--t-13)',
  lineHeight: 'var(--t-13--line-height)',
  color: 'var(--text-dim)',
};

const actionButton: CSSProperties = {
  alignSelf: 'flex-start',
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

function IdentityCard({
  title,
  description,
  warning,
  actionLabel,
  onChoose,
}: {
  title: string;
  description: string;
  warning?: string;
  actionLabel: string;
  onChoose: () => void;
}) {
  return (
    <section style={card}>
      <h2 style={cardTitle}>{title}</h2>
      <p style={cardBody}>{description}</p>
      {warning ? (
        <p
          style={{
            margin: 0,
            display: 'flex',
            gap: 'var(--space-3)',
            borderLeft: '2px solid var(--degraded)',
            paddingLeft: 'var(--space-4)',
            fontSize: 'var(--t-12)',
            lineHeight: 'var(--t-12--line-height)',
            color: 'var(--text)',
          }}
        >
          {/* The triangle carries the meaning; colour alone never does (spec §8). */}
          <span aria-hidden="true" style={{ color: 'var(--degraded)', flexShrink: 0 }}>
            {'▲'}
          </span>
          <span>{warning}</span>
        </p>
      ) : null}
      <button type="button" className="indra-focusable" onClick={onChoose} style={actionButton}>
        {actionLabel}
      </button>
    </section>
  );
}

export function SetupIdentity({ onChoose }: SetupIdentityProps) {
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
        <h1 style={heading}>Who is using this</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <IdentityCard
            title="Plant sign-in"
            description="Uses your plant's identity server. Your role and department decide what INDRA can read."
            actionLabel="Continue with plant sign-in"
            onChoose={() => onChoose('plant')}
          />
          <IdentityCard
            title="Standalone profile"
            description="One machine, one passphrase. No identity server. You get full access to whatever is on this disk."
            warning="If you forget this passphrase, the sealed store is unrecoverable — there is no reset and no backdoor, because that is what sealed means."
            actionLabel="Create a standalone profile"
            onChoose={() => onChoose('standalone')}
          />
        </div>
      </div>
    </div>
  );
}
