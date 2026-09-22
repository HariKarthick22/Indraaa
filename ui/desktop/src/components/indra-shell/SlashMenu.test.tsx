import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SlashMenu } from './SlashMenu';

const commands = [
  { name: 'ndt-review', description: 'Review an NDT report against allowables' },
  { name: 'pid-trace', description: 'Trace a line on a P&ID' },
];

describe('SlashMenu', () => {
  it('filters by the typed query', () => {
    render(<SlashMenu query="pid" commands={commands} onPick={vi.fn()} />);
    expect(screen.getByText('/pid-trace')).toBeInTheDocument();
    expect(screen.queryByText('/ndt-review')).not.toBeInTheDocument();
  });

  it('shows each command description', () => {
    render(<SlashMenu query="" commands={commands} onPick={vi.fn()} />);
    expect(screen.getByText('Review an NDT report against allowables')).toBeInTheDocument();
  });

  it('marks the row at highlightedIndex as selected and leaves the rest unselected', () => {
    render(<SlashMenu query="" commands={commands} onPick={vi.fn()} highlightedIndex={1} />);
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('defaults to no row highlighted', () => {
    render(<SlashMenu query="" commands={commands} onPick={vi.fn()} />);
    for (const option of screen.getAllByRole('option')) {
      expect(option).toHaveAttribute('aria-selected', 'false');
    }
  });
});
