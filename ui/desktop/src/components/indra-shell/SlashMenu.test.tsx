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
});
