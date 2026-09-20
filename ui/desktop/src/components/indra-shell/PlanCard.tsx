import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PlanStep } from '../../indra/events';
import { formatDuration } from '../../utils/usageFormatting';

export type StepState = 'queued' | 'running' | 'done' | 'skipped' | 'failed';

export interface StepStateInfo {
  state: StepState;
  ms?: number;
  /** Shown on hover for a skipped step (spec 6.2). */
  reason?: string;
}

export interface PlanCardProps {
  steps: PlanStep[];
  stepStates: Record<string, StepStateInfo>;
  /** Step ids struck through by a later revision rather than removed (spec 6.2). */
  supersededIds?: string[];
  /** Step ids inserted by the most recent `plan.revised` event. */
  insertedIds?: string[];
}

const SR_ONLY: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
};

function effectiveState(stepStates: Record<string, StepStateInfo>, id: string): StepStateInfo {
  return stepStates[id] ?? { state: 'queued' };
}

// The row duration reads "0.3s"; the live-region sentence spells it out in
// words so a screen reader does not have to parse a unit abbreviation.
function formatDurationWords(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} milliseconds`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1).replace(/\.0$/, '')} seconds`;
  const totalSeconds = Math.round(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}

// Announces the step whose effective state changed since the last render as a
// full sentence (spec 8: signal is never colour-only, and a plan revision is
// exactly the kind of change a screen reader user would otherwise miss).
function useStepAnnouncement(
  steps: PlanStep[],
  stepStates: Record<string, StepStateInfo>
): string {
  const previous = useRef<Record<string, StepStateInfo>>({});
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    let changedIndex = -1;
    steps.forEach((step, index) => {
      const prev = previous.current[step.id];
      const next = stepStates[step.id];
      const prevState = prev?.state ?? 'queued';
      const nextState = next?.state ?? 'queued';
      if (prevState !== nextState || prev?.ms !== next?.ms) {
        changedIndex = index;
      }
    });

    if (changedIndex !== -1) {
      const step = steps[changedIndex];
      const info = effectiveState(stepStates, step.id);
      const parts = [`Step ${changedIndex + 1} of ${steps.length}`, step.label, info.state];
      const sentence =
        typeof info.ms === 'number'
          ? `${parts.join(', ')}, ${formatDurationWords(info.ms)}`
          : parts.join(', ');
      setAnnouncement(`${sentence}.`);
    }

    previous.current = stepStates;
  }, [steps, stepStates]);

  return announcement;
}

function StepDot({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <span aria-hidden="true" style={{ color: 'var(--sealed)', flexShrink: 0, width: 12 }}>
        {'✓'}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        flexShrink: 0,
        borderRadius: 'var(--r-full)',
        border: state === 'running' ? 'none' : '1px solid var(--line-strong)',
        background: state === 'running' ? 'var(--text-dim)' : 'transparent',
      }}
    />
  );
}

interface StepRowProps {
  step: PlanStep;
  index: number;
  info: StepStateInfo;
  superseded: boolean;
  inserted: boolean;
}

function StepRow({ step, info, superseded, inserted }: StepRowProps) {
  const isFailed = info.state === 'failed';
  const isStruck = info.state === 'skipped' || superseded;

  return (
    <div
      className={inserted ? 'indra-step--inserted' : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        minHeight: 32,
        padding: '0 var(--space-4)',
        borderLeft: isFailed ? '2px solid var(--blocked)' : '2px solid transparent',
      }}
    >
      {inserted ? (
        // 2px --focus tick marking a step a revision inserted, fading over 2s
        // (keyframes already defined in indra-tokens.css).
        <span
          aria-hidden="true"
          className="indra-tick"
          style={{
            position: 'absolute',
            left: -2,
            top: 0,
            bottom: 0,
            width: 2,
            background: 'var(--focus)',
          }}
        />
      ) : null}
      <StepDot state={info.state} />
      <span
        title={isStruck && info.reason ? info.reason : undefined}
        style={{
          flex: 1,
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--t-14)',
          lineHeight: 'var(--t-14--line-height)',
          color: isStruck ? 'var(--text-faint)' : info.state === 'queued' ? 'var(--text-dim)' : 'var(--text)',
          textDecoration: isStruck ? 'line-through' : 'none',
          overflowWrap: 'anywhere',
        }}
      >
        {step.label}
      </span>
      {isFailed ? (
        <span style={{ color: 'var(--blocked)', fontSize: 'var(--t-12)', fontWeight: 500 }}>
          failed
        </span>
      ) : null}
      {info.state === 'done' && typeof info.ms === 'number' ? (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--t-11)',
            lineHeight: 'var(--t-11--line-height)',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--text-faint)',
            flexShrink: 0,
          }}
        >
          {formatDuration(info.ms)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Spec 6.2. Replanning is shown, not hidden: a superseded step stays visible,
 * struck through, and a step a revision inserted grows into place with a
 * fading `--focus` tick — nothing simply vanishes and reappears.
 */
export function PlanCard({ steps, stepStates, supersededIds = [], insertedIds = [] }: PlanCardProps) {
  const [expanded, setExpanded] = useState(true);
  const announcement = useStepAnnouncement(steps, stepStates);
  const supersededSet = new Set(supersededIds);
  const insertedSet = new Set(insertedIds);

  return (
    <section
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="indra-focusable"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4)',
          background: 'transparent',
          border: 'none',
          borderBottom: expanded ? '1px solid var(--line)' : 'none',
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            fontSize: 'var(--t-13)',
            fontWeight: 500,
            color: 'var(--text-hi)',
          }}
        >
          <span aria-hidden="true">{'▣'}</span>
          <span>Plan</span>
          <span aria-hidden="true" style={{ color: 'var(--text-faint)' }}>
            {'·'}
          </span>
          <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>
            {`${steps.length} step${steps.length === 1 ? '' : 's'}`}
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            color: 'var(--text-faint)',
            transition: 'transform var(--m-ui) var(--ease-ui)',
            transform: expanded ? 'rotate(180deg)' : 'none',
          }}
        >
          {'⌄'}
        </span>
      </button>

      {expanded ? (
        <div style={{ padding: 'var(--space-2) 0' }}>
          {steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              index={index}
              info={effectiveState(stepStates, step.id)}
              superseded={supersededSet.has(step.id)}
              inserted={insertedSet.has(step.id)}
            />
          ))}
        </div>
      ) : null}

      <div role="status" aria-live="polite" style={SR_ONLY}>
        {announcement}
      </div>
    </section>
  );
}
