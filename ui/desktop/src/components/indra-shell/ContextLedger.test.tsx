import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContextLedger } from './ContextLedger';
import { CompactionDivider } from './CompactionDivider';

const sections = [
  {
    name: 'Scope',
    bytes: 1204,
    rows: [
      { id: 'r1', label: 'NDT_2026_08.pdf', detail: 'v3 pages 1,4,7', bytes: 412, pinned: true },
      { id: 'r2', label: 'Pump_Inspection_SOP.pdf', detail: 'v1 §4.2', bytes: 398, pinned: false },
    ],
  },
];

describe('ContextLedger', () => {
  it('shows a byte count on every row', () => {
    render(<ContextLedger sections={sections} onPin={vi.fn()} onDrop={vi.fn()} />);
    expect(screen.getByText('412 B')).toBeInTheDocument();
    expect(screen.getByText('398 B')).toBeInTheDocument();
  });

  it('shows the section total', () => {
    render(<ContextLedger sections={sections} onPin={vi.fn()} onDrop={vi.fn()} />);
    expect(screen.getByText('1,204 B')).toBeInTheDocument();
  });

  it('pins and drops a row by id', async () => {
    const user = userEvent.setup();
    const onPin = vi.fn();
    const onDrop = vi.fn();
    render(<ContextLedger sections={sections} onPin={onPin} onDrop={onDrop} />);

    await user.click(screen.getByRole('button', { name: /pin NDT_2026_08\.pdf/i }));
    expect(onPin).toHaveBeenCalledWith('r1');

    await user.click(screen.getByRole('button', { name: /drop Pump_Inspection_SOP\.pdf/i }));
    expect(onDrop).toHaveBeenCalledWith('r2');
  });
});

describe('CompactionDivider', () => {
  it('renders the turn, byte, and dropped counts and triggers onShow', async () => {
    const user = userEvent.setup();
    const onShow = vi.fn();
    render(
      <CompactionDivider fromTurns={12} toBytes={4200} keptCount={8} droppedCount={3} onShow={onShow} />
    );

    expect(screen.getByText(/12 turns/)).toBeInTheDocument();
    expect(screen.getByText(/4\.2 kB/)).toBeInTheDocument();
    expect(screen.getByText(/8 kept/)).toBeInTheDocument();
    expect(screen.getByText(/3 dropped/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show what changed/i }));
    expect(onShow).toHaveBeenCalledOnce();
  });
});
