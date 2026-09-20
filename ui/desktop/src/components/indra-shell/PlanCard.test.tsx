import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlanCard } from './PlanCard';

const steps = [
  { id: 's1', label: 'Locate August NDT report', tool: 'read' },
  { id: 's2', label: 'Extract wall-thickness readings', tool: 'ocr' },
];

describe('PlanCard', () => {
  it('shows each step and the step count', () => {
    render(<PlanCard steps={steps} stepStates={{}} />);
    expect(screen.getByText('Locate August NDT report')).toBeInTheDocument();
    expect(screen.getByText(/2 steps/)).toBeInTheDocument();
  });

  it('shows a duration in monospace for a completed step', () => {
    render(<PlanCard steps={steps} stepStates={{ s1: { state: 'done', ms: 300 } }} />);
    expect(screen.getByText('0.3s')).toBeInTheDocument();
  });

  it('keeps a superseded step visible rather than removing it', () => {
    render(
      <PlanCard steps={steps} stepStates={{ s1: { state: 'skipped' } }} supersededIds={['s1']} />
    );
    const step = screen.getByText('Locate August NDT report');
    expect(step).toBeInTheDocument();
    expect(step).toHaveStyle({ textDecoration: 'line-through' });
  });

  it('names a failed step in words, not only in colour', () => {
    render(<PlanCard steps={steps} stepStates={{ s2: { state: 'failed' } }} />);
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('marks a step inserted by a revision so the change is legible', () => {
    const { container } = render(
      <PlanCard
        steps={[...steps, { id: 's3', label: 'Recompute remaining life', tool: null }]}
        stepStates={{}}
        insertedIds={['s3']}
      />
    );
    expect(container.querySelector('.indra-step--inserted')).toBeInTheDocument();
    expect(container.querySelector('.indra-tick')).toBeInTheDocument();
  });

  it('announces a step state change as a full sentence', () => {
    render(<PlanCard steps={steps} stepStates={{ s2: { state: 'done', ms: 4100 } }} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Step 2 of 2, Extract wall-thickness readings, done, 4.1 seconds.'
    );
  });
});
