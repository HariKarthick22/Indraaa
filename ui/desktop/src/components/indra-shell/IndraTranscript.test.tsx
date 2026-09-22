import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IndraTranscript, type TranscriptTurn } from './IndraTranscript';

const planEvents: TranscriptTurn['events'] = [
  { t: 'plan.proposed', steps: [{ id: 's1', label: 'Read the report', tool: 'read' }] },
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
    ms: 900,
    summary: 'read 4 pages',
    bytes: 1024,
    citations: [],
  },
];

function baseTurns(): TranscriptTurn[] {
  return [
    { id: 't1', role: 'user', text: 'What does the report say?', events: [] },
    { id: 't2', role: 'assistant', text: 'The reading is 6.2mm.', events: planEvents },
  ];
}

describe('IndraTranscript', () => {
  it('names the next action when there is nothing to show yet', () => {
    render(<IndraTranscript turns={[]} />);
    expect(screen.getByText(/send a message to start/i)).toBeInTheDocument();
  });

  it('renders a user turn and an assistant turn', () => {
    render(<IndraTranscript turns={baseTurns()} />);
    expect(screen.getByTestId('indra-turn-t1')).toHaveAttribute('data-turn-role', 'user');
    expect(screen.getByText('What does the report say?')).toBeInTheDocument();
    // StreamText's own reveal timing is covered by its dedicated test suite;
    // here we only confirm the assistant turn mounts with the right role.
    expect(screen.getByTestId('indra-turn-t2')).toHaveAttribute('data-turn-role', 'assistant');
  });

  it("derives the assistant turn's plan card from its raw events", () => {
    render(<IndraTranscript turns={baseTurns()} />);
    expect(screen.getByText('Read the report')).toBeInTheDocument();
  });

  it('shows a tool row collapsed by default and expands it on click', async () => {
    const user = userEvent.setup();
    render(<IndraTranscript turns={baseTurns()} />);

    expect(screen.queryByText(/report\.pdf/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /read_document/ }));
    expect(screen.getByText(/report\.pdf/)).toBeInTheDocument();
  });

  it('stops auto-following the bottom once the user scrolls up, and resumes on Jump to latest', async () => {
    const user = userEvent.setup();
    render(<IndraTranscript turns={baseTurns()} />);
    const scrollEl = screen.getByTestId('indra-transcript-scroll');

    Object.defineProperty(scrollEl, 'scrollHeight', { value: 2000, configurable: true });
    Object.defineProperty(scrollEl, 'clientHeight', { value: 500, configurable: true });
    Object.defineProperty(scrollEl, 'scrollTop', { value: 200, writable: true, configurable: true });

    fireEvent.scroll(scrollEl);
    expect(await screen.findByText(/jump to latest/i)).toBeInTheDocument();

    await user.click(screen.getByText(/jump to latest/i));
    expect(screen.queryByText(/jump to latest/i)).not.toBeInTheDocument();
  });

  it('calls onOpenCitation when an inline citation chip is clicked', async () => {
    const user = userEvent.setup();
    const onOpenCitation = vi.fn();
    const turns: TranscriptTurn[] = [
      {
        id: 't1',
        role: 'assistant',
        text: 'The pressure reading is flagged [1].',
        events: [
          {
            t: 'citation',
            span: [0, 10],
            source: { doc_id: 'd1', version: 'v1', page: 3, bbox: [0, 0, 10, 10], conf: 0.9 },
          },
        ],
      },
    ];
    render(<IndraTranscript turns={turns} onOpenCitation={onOpenCitation} />);

    await user.click(screen.getByRole('button', { name: /citation 1/i }));
    expect(onOpenCitation).toHaveBeenCalledWith(
      expect.objectContaining({ doc_id: 'd1', page: 3 })
    );
  });
});
