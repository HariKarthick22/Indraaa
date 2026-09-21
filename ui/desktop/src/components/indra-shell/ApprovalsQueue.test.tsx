import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalsQueue } from './ApprovalsQueue';

const proposals = [
  {
    id: 'p1',
    resource: 'SAP PM order 4500123',
    currentValue: 'TECO',
    proposedValue: 'Reopened',
    requiredRole: 'Maintenance Supervisor',
    evidence: [],
  },
];

describe('ApprovalsQueue', () => {
  it('shows current and proposed values and the role required', () => {
    render(
      <ApprovalsQueue
        proposals={proposals}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onRequestEvidence={vi.fn()}
      />
    );
    expect(screen.getByText('TECO')).toBeInTheDocument();
    expect(screen.getByText('Reopened')).toBeInTheDocument();
    expect(screen.getByText(/Maintenance Supervisor/)).toBeInTheDocument();
  });

  it('names the next action when nothing is pending rather than dead-ending', () => {
    render(
      <ApprovalsQueue proposals={[]} onApprove={vi.fn()} onReject={vi.fn()} onRequestEvidence={vi.fn()} />
    );
    expect(screen.getByText(/nothing is waiting/i)).toBeInTheDocument();
  });

  it('calls onApprove/onReject/onRequestEvidence with the proposal id', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onRequestEvidence = vi.fn();
    render(
      <ApprovalsQueue
        proposals={proposals}
        onApprove={onApprove}
        onReject={onReject}
        onRequestEvidence={onRequestEvidence}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onApprove).toHaveBeenCalledWith('p1');

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onReject).toHaveBeenCalledWith('p1');

    await user.click(screen.getByRole('button', { name: /request more evidence/i }));
    expect(onRequestEvidence).toHaveBeenCalledWith('p1');
  });

  it('shows evidence as citation chips when present', () => {
    render(
      <ApprovalsQueue
        proposals={[
          {
            ...proposals[0],
            evidence: [
              { doc_id: 'd1', version: 'v1', page: 2, bbox: [0, 0, 10, 10], conf: 0.9 },
            ],
          },
        ]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onRequestEvidence={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /citation 1/i })).toBeInTheDocument();
  });
});
