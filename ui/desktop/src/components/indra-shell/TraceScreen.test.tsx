import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TraceScreen, planFromEvents, toolCallsFromEvents } from './TraceScreen';
import type { IndraEvent } from '../../indra/events';

const events: IndraEvent[] = [
  { t: 'plan.proposed', steps: [{ id: 's1', label: 'Locate report', tool: 'read' }] },
  { t: 'step.state', step_id: 's1', state: 'done', ms: 300 },
  {
    t: 'tool.call',
    call_id: 'c1',
    step_id: 's1',
    name: 'read_document',
    args: { path: 'report.pdf' },
    sandbox_backend: 'docker',
  },
  {
    t: 'tool.result',
    call_id: 'c1',
    ok: true,
    ms: 1200,
    summary: 'read 4 pages',
    bytes: 2048,
    citations: [],
  },
];

const runs = [
  { id: 'r1', title: 'Session: wall-thickness check', startedAt: '2026-09-16T14:00:00Z', durationMs: 4400, events },
];

describe('planFromEvents', () => {
  it('reconstructs steps and step states from the event stream', () => {
    const { steps, stepStates } = planFromEvents(events);
    expect(steps).toEqual([{ id: 's1', label: 'Locate report', tool: 'read' }]);
    expect(stepStates.s1).toEqual({ state: 'done', ms: 300 });
  });

  it('keeps a superseded step visible and marks the inserted one', () => {
    const revised: IndraEvent[] = [
      { t: 'plan.proposed', steps: [{ id: 's1', label: 'Locate report', tool: 'read' }] },
      {
        t: 'plan.revised',
        after_step: 's1',
        reason: 'need OCR',
        steps: [{ id: 's2', label: 'OCR the pages', tool: 'ocr' }],
      },
    ];
    const { steps, supersededIds, insertedIds } = planFromEvents(revised);
    expect(steps.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(supersededIds).toEqual(['s1']);
    expect(insertedIds).toEqual(['s2']);
  });
});

describe('toolCallsFromEvents', () => {
  it('pairs a tool.call with its tool.result by call_id', () => {
    const calls = toolCallsFromEvents(events);
    expect(calls).toHaveLength(1);
    expect(calls[0].call.call_id).toBe('c1');
    expect(calls[0].result?.summary).toBe('read 4 pages');
  });

  it('leaves result null for a call still in flight', () => {
    const calls = toolCallsFromEvents([events[2]]);
    expect(calls[0].result).toBeNull();
  });
});

describe('TraceScreen', () => {
  it('names the next action when there are no runs yet', () => {
    render(<TraceScreen runs={[]} onExport={vi.fn()} />);
    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument();
  });

  it('expands a run into its plan and tool rows on click', async () => {
    const user = userEvent.setup();
    render(<TraceScreen runs={runs} onExport={vi.fn()} />);

    expect(screen.queryByText('Locate report')).not.toBeInTheDocument();
    await user.click(screen.getByText('Session: wall-thickness check'));

    expect(screen.getByText('Locate report')).toBeInTheDocument();
    expect(screen.getByText('read_document')).toBeInTheDocument();
  });

  it('calls onExport with the run id', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<TraceScreen runs={runs} onExport={onExport} />);

    await user.click(screen.getByText('Session: wall-thickness check'));
    await user.click(screen.getByRole('button', { name: /export run/i }));

    expect(onExport).toHaveBeenCalledWith('r1');
  });
});
