import { useState, type CSSProperties } from 'react';
import type { IndraEvent, PlanStep } from '../../indra/events';
import { PlanCard, type StepState, type StepStateInfo } from './PlanCard';
import { ToolRow, type ToolCallEvent, type ToolResultEvent } from './ToolRow';

export interface TraceRun {
  id: string;
  title: string;
  /** ISO-8601 timestamp. */
  startedAt: string;
  durationMs: number;
  /** The same events the Work screen rendered live, in order. */
  events: IndraEvent[];
}

export interface TraceScreenProps {
  runs: TraceRun[];
  onExport: (runId: string) => void;
}

const STEP_STATES: readonly StepState[] = ['queued', 'running', 'done', 'skipped', 'failed'];

function isStepState(value: string): value is StepState {
  return (STEP_STATES as readonly string[]).includes(value);
}

/**
 * Replays a run's `plan.proposed`/`plan.revised`/`step.state` events into the
 * exact props `PlanCard` takes live on the Work screen — a trace replay reuses
 * the same component rather than a second read-only rendering of a plan.
 */
export function planFromEvents(events: readonly IndraEvent[]): {
  steps: PlanStep[];
  stepStates: Record<string, StepStateInfo>;
  supersededIds: string[];
  insertedIds: string[];
} {
  let steps: PlanStep[] = [];
  const stepStates: Record<string, StepStateInfo> = {};
  const supersededIds = new Set<string>();
  const insertedIds = new Set<string>();

  for (const event of events) {
    if (event.t === 'plan.proposed') {
      steps = event.steps;
    } else if (event.t === 'plan.revised') {
      const nextIds = new Set(event.steps.map((step) => step.id));
      const previousIds = new Set(steps.map((step) => step.id));
      for (const step of event.steps) {
        if (!previousIds.has(step.id)) insertedIds.add(step.id);
      }
      // A superseded step stays visible (struck through), never removed.
      const superseded = steps.filter((step) => !nextIds.has(step.id));
      for (const step of superseded) supersededIds.add(step.id);
      steps = [...superseded, ...event.steps];
    } else if (event.t === 'step.state' && isStepState(event.state)) {
      stepStates[event.step_id] = { state: event.state, ms: event.ms };
    }
  }

  return {
    steps,
    stepStates,
    supersededIds: Array.from(supersededIds),
    insertedIds: Array.from(insertedIds),
  };
}

export interface TracedToolCall {
  call: ToolCallEvent;
  result: ToolResultEvent | null;
}

/** Pairs each `tool.call` with its matching `tool.result` by `call_id`, in call order. */
export function toolCallsFromEvents(events: readonly IndraEvent[]): TracedToolCall[] {
  const calls: TracedToolCall[] = [];
  const indexByCallId = new Map<string, number>();

  for (const event of events) {
    if (event.t === 'tool.call') {
      indexByCallId.set(event.call_id, calls.length);
      calls.push({ call: event, result: null });
    } else if (event.t === 'tool.result') {
      const index = indexByCallId.get(event.call_id);
      if (index !== undefined) calls[index].result = event;
    }
  }

  return calls;
}

function formatRunTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function formatRunDuration(ms: number): string {
  return ms < 60_000
    ? `${(ms / 1000).toFixed(1).replace(/\.0$/, '')}s`
    : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

const runHeader: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-4) var(--space-5)',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--line)',
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
};

function RunRow({
  run,
  expanded,
  onToggle,
  onExport,
}: {
  run: TraceRun;
  expanded: boolean;
  onToggle: () => void;
  onExport: (runId: string) => void;
}) {
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const { steps, stepStates, supersededIds, insertedIds } = planFromEvents(run.events);
  const toolCalls = toolCallsFromEvents(run.events);

  return (
    <section
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      <button type="button" onClick={onToggle} style={runHeader} className="indra-focusable">
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          <span style={{ fontSize: 'var(--t-13)', color: 'var(--text-hi)', fontWeight: 500 }}>
            {run.title}
          </span>
          <span style={{ fontSize: 'var(--t-11)', color: 'var(--text-faint)' }}>
            {formatRunTimestamp(run.startedAt)}
          </span>
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--t-11)',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--text-dim)',
          }}
        >
          {`${steps.length} steps · ${toolCalls.length} tools · ${formatRunDuration(run.durationMs)}`}
          <span aria-hidden="true">{expanded ? '⌄' : '›'}</span>
        </span>
      </button>

      {expanded ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            padding: 'var(--space-5)',
          }}
        >
          {steps.length > 0 ? (
            <PlanCard
              steps={steps}
              stepStates={stepStates}
              supersededIds={supersededIds}
              insertedIds={insertedIds}
            />
          ) : null}

          {toolCalls.map(({ call, result }) => (
            <ToolRow
              key={call.call_id}
              call={call}
              result={result}
              expanded={expandedCallId === call.call_id}
              onToggle={() =>
                setExpandedCallId((current) => (current === call.call_id ? null : call.call_id))
              }
            />
          ))}

          <button
            type="button"
            onClick={() => onExport(run.id)}
            className="indra-focusable"
            style={{
              alignSelf: 'flex-start',
              height: 28,
              padding: '0 var(--space-5)',
              background: 'var(--raised)',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text-hi)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--t-12)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Export run
          </button>
        </div>
      ) : null}
    </section>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface)',
        padding: 'var(--space-7)',
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-13)',
        lineHeight: 'var(--t-13--line-height)',
      }}
    >
      No runs yet — trace fills in as sessions complete.
    </div>
  );
}

/**
 * Spec §5.7. A run expands into its full event stream, replayed through the
 * same `PlanCard`/`ToolRow` the Work screen renders live — trace is a replay,
 * not a second read-only presentation of the same facts.
 */
export function TraceScreen({ runs, onExport }: TraceScreenProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  if (runs.length === 0) {
    return <EmptyState />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {runs.map((run) => (
        <RunRow
          key={run.id}
          run={run}
          expanded={expandedRunId === run.id}
          onToggle={() => setExpandedRunId((current) => (current === run.id ? null : run.id))}
          onExport={onExport}
        />
      ))}
    </div>
  );
}
