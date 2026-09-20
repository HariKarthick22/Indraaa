import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from '../../indra/useReducedMotion';
import { IndraMark } from './IndraMark';

export type BootStepState = 'pending' | 'running' | 'ok' | 'warn' | 'fail';

export interface BootStep {
  id: string;
  label: string;
  state: BootStepState;
  detail?: string;
}

export interface BootSequenceProps {
  steps: BootStep[];
  onComplete: () => void;
  /** Re-runs the checks. Falls back to replaying the local animation when omitted. */
  onRetry?: () => void;
}

// Spec §5.1: five beats over 2200ms each, but every beat is tied to a real
// check rather than a timer alone — see the fast-forward effect below.
const BEAT_MS = 2200;

function isTerminal(state: BootStepState): boolean {
  return state === 'ok' || state === 'warn' || state === 'fail';
}

function markColorFor(steps: BootStep[]): string {
  if (steps.some((step) => step.state === 'fail')) return 'var(--blocked)';
  if (steps.some((step) => step.state === 'warn')) return 'var(--degraded)';
  return 'var(--text-hi)';
}

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  width: '100%',
  maxWidth: '46ch',
};

function rowStyle(state: BootStepState): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'baseline',
    gap: 'var(--space-4)',
    padding: 'var(--space-2) var(--space-3)',
    borderLeft: state === 'fail' ? '2px solid var(--blocked)' : '2px solid transparent',
    fontSize: 'var(--t-13)',
    lineHeight: 'var(--t-13--line-height)',
    color: state === 'pending' ? 'var(--text-faint)' : 'var(--text)',
  };
}

const buttonStyle: CSSProperties = {
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

function StepIcon({ state, reducedMotion }: { state: BootStepState; reducedMotion: boolean }) {
  // Signal colour never carries meaning alone — every non-neutral state also
  // carries a glyph (spec §8), and "ok" stays achromatic like the rest of the
  // product's completed states (PlanCard's "done" is the same choice).
  if (state === 'pending') {
    return (
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          flexShrink: 0,
          borderRadius: 'var(--r-full)',
          border: '1.5px solid var(--text-faint)',
        }}
      />
    );
  }
  if (state === 'running') {
    return (
      <span
        aria-hidden="true"
        className={reducedMotion ? undefined : 'indra-stall-dot'}
        style={{
          width: 6,
          height: 6,
          flexShrink: 0,
          borderRadius: 'var(--r-full)',
          background: 'var(--text-dim)',
        }}
      />
    );
  }
  if (state === 'warn') {
    return (
      <span aria-hidden="true" style={{ color: 'var(--degraded)', flexShrink: 0 }}>
        {'▲'}
      </span>
    );
  }
  if (state === 'fail') {
    return (
      <span aria-hidden="true" style={{ color: 'var(--blocked)', flexShrink: 0 }}>
        {'✕'}
      </span>
    );
  }
  return (
    <span aria-hidden="true" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
      {'✓'}
    </span>
  );
}

export function BootSequence({ steps, onComplete, onRetry }: BootSequenceProps) {
  const reducedMotion = useReducedMotion();
  const allSettled = steps.length > 0 && steps.every((step) => isTerminal(step.state));
  const [revealed, setRevealed] = useState(() => (reducedMotion || allSettled ? steps.length : 0));
  const completedRef = useRef(false);

  useEffect(() => {
    // A boot animation that outlasts the boot is theatre this audience will
    // notice — fast-forward to the end the moment every check has resolved,
    // rather than stalling through beats nobody is waiting on.
    if (reducedMotion || allSettled) {
      setRevealed(steps.length);
    }
  }, [reducedMotion, allSettled, steps.length]);

  useEffect(() => {
    if (reducedMotion) return undefined;
    if (revealed >= steps.length) return undefined;

    const failIndex = steps.findIndex((step) => step.state === 'fail');
    if (failIndex !== -1 && revealed > failIndex) return undefined;

    const timer = setTimeout(() => {
      setRevealed((count) => Math.min(count + 1, steps.length));
    }, BEAT_MS);
    return () => clearTimeout(timer);
  }, [reducedMotion, revealed, steps]);

  const visibleSteps = steps.slice(0, revealed);
  const failedStep = visibleSteps.find((step) => step.state === 'fail');

  useEffect(() => {
    if (completedRef.current) return;
    if (failedStep) return;
    if (steps.length === 0 || revealed !== steps.length) return;
    completedRef.current = true;
    onComplete();
  }, [revealed, steps.length, failedStep, onComplete]);

  function handleRetry() {
    if (onRetry) {
      onRetry();
      return;
    }
    completedRef.current = false;
    setRevealed(0);
  }

  function handleContinueAnyway() {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-7)',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
      }}
    >
      <IndraMark size={40} color={markColorFor(visibleSteps)} />
      <ul style={listStyle} aria-label="Startup checks">
        {visibleSteps.map((step) => (
          <li key={step.id} style={rowStyle(step.state)}>
            <StepIcon state={step.state} reducedMotion={reducedMotion} />
            <span style={{ flex: '1 1 auto', minWidth: 0 }}>
              <span style={{ display: 'block' }}>{step.label}</span>
              {step.detail ? (
                // Rendered verbatim, never paraphrased — the same rule the fit
                // warning follows elsewhere in the product (spec §2.2, §6.2).
                <span
                  style={{
                    display: 'block',
                    marginTop: 'var(--space-1)',
                    fontSize: 'var(--t-12)',
                    lineHeight: 'var(--t-12--line-height)',
                    color: step.state === 'fail' ? 'var(--blocked)' : 'var(--text-dim)',
                  }}
                >
                  {step.detail}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {failedStep ? (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            width: '100%',
            maxWidth: '46ch',
            padding: 'var(--space-5)',
            border: '1px solid var(--line)',
            borderLeft: '2px solid var(--blocked)',
            borderRadius: 'var(--r-md)',
            background: 'var(--surface)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--t-13)',
              lineHeight: 'var(--t-13--line-height)',
              color: 'var(--text)',
            }}
          >
            {failedStep.detail ?? `${failedStep.label} failed.`}
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <button
              type="button"
              className="indra-focusable"
              onClick={handleRetry}
              style={buttonStyle}
            >
              Retry
            </button>
            <button
              type="button"
              className="indra-focusable"
              onClick={handleContinueAnyway}
              style={buttonStyle}
            >
              Continue anyway
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
