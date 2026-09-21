import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryTimeline, type MemoryTimelineLane } from './MemoryTimeline';

const lanes: MemoryTimelineLane[] = [
  {
    documentId: 'd1',
    documentLabel: 'NDT_2026_08.pdf',
    events: [
      {
        id: 'e1',
        kind: 'version-bump',
        at: '2026-08-01T00:00:00Z',
        version: 'v2',
        label: 'Bumped to v2',
      },
      {
        id: 'e2',
        kind: 'citation',
        at: '2026-09-14T00:00:00Z',
        version: 'v1',
        label: 'Cited in torque calculation',
        supersededAtCitation: true,
        sessionId: 's-42',
      },
    ],
  },
  {
    documentId: 'd2',
    documentLabel: 'Historian_Export.csv',
    events: [
      {
        id: 'e3',
        kind: 'citation',
        at: '2026-09-02T00:00:00Z',
        version: 'v2',
        label: 'Cited in trend review',
        supersededAtCitation: false,
        sessionId: 's-7',
      },
    ],
  },
];

describe('MemoryTimeline', () => {
  it('renders a lane for each document', () => {
    render(<MemoryTimeline lanes={lanes} />);

    expect(screen.getByRole('group', { name: 'NDT_2026_08.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Historian_Export.csv' })).toBeInTheDocument();
  });

  it('marks a citation of a superseded version as degraded and links to its session', async () => {
    const user = userEvent.setup();
    const onCitationClick = vi.fn();
    render(<MemoryTimeline lanes={lanes} onCitationClick={onCitationClick} />);

    const marker = screen.getByRole('button', { name: /superseded/i });
    expect(marker).toBeInTheDocument();
    expect(marker).toHaveTextContent('▲');

    await user.click(marker);
    expect(onCitationClick).toHaveBeenCalledWith('s-42');
  });

  it('does not mark a citation of the current version as degraded', () => {
    render(<MemoryTimeline lanes={lanes} />);

    const marker = screen.getByRole('button', { name: /trend review/i });
    expect(marker).not.toHaveTextContent('▲');
    expect(marker).not.toHaveAccessibleName(/superseded/i);
  });

  it('renders non-citation events as non-interactive markers', () => {
    render(<MemoryTimeline lanes={lanes} />);
    expect(screen.getByTitle(/Bumped to v2/)).toBeInTheDocument();
  });

  it('shows an empty state when there is no activity yet', () => {
    render(<MemoryTimeline lanes={[]} />);
    expect(screen.getByText(/No timeline activity yet/i)).toBeInTheDocument();
  });
});
