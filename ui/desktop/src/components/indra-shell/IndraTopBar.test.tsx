import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IndraTopBar } from './IndraTopBar';

const base = {
  sessionTitle: 'P-101 fit-for-service',
  onSessionTitleChange: vi.fn(),
  onToggleTheme: vi.fn(),
};

describe('IndraTopBar gauge', () => {
  it('shows used and budget bytes in kB', () => {
    render(<IndraTopBar {...base} sessionBytes={4118} budgetBytes={32768} />);
    expect(screen.getByText(/4\.1 kB/)).toBeInTheDocument();
    expect(screen.getByText(/32\.8 kB/)).toBeInTheDocument();
  });

  it('marks the gauge degraded past 70 percent', () => {
    render(<IndraTopBar {...base} sessionBytes={30000} budgetBytes={32768} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-state', 'near-cap');
  });

  it('uses tabular numerals so the number does not jitter', () => {
    render(<IndraTopBar {...base} sessionBytes={4118} budgetBytes={32768} />);
    expect(screen.getByText(/4\.1 kB/)).toHaveStyle({ fontVariantNumeric: 'tabular-nums' });
  });
});
