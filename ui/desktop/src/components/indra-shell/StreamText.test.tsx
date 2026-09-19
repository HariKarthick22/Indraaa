import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StreamText, announcedText } from './StreamText';

afterEach(() => {
  vi.useRealTimers();
});

describe('announcedText', () => {
  it('announces only whole sentences', () => {
    expect(announcedText('Wall thickness is 6.2 mm. The minimum allo')).toBe(
      'Wall thickness is 6.2 mm.'
    );
  });

  it('announces nothing until the first sentence closes', () => {
    expect(announcedText('Wall thickness is')).toBe('');
  });
});

describe('StreamText', () => {
  it('renders everything at once at instant speed', () => {
    const { container } = render(<StreamText text="6.2 mm at grid E-4" speed="instant" />);
    expect(container.textContent).toContain('6.2 mm at grid E-4');
  });

  it('drains the queue over time at normal speed', () => {
    vi.useFakeTimers();
    const { container } = render(<StreamText text="wall thickness" speed="normal" />);
    expect(container.textContent).not.toContain('wall thickness');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(container.textContent).toContain('wall thickness');
  });

  it('never splits a grapheme cluster', () => {
    const { container } = render(<StreamText text="क्ष 👍" speed="instant" done />);
    expect(container.textContent).toContain('क्ष');
  });

  it('shows the caret while the turn is open and hides it when it ends', () => {
    const { rerender } = render(<StreamText text="ok" speed="instant" />);
    expect(screen.getByTestId('stream-caret')).toBeInTheDocument();

    rerender(<StreamText text="ok" speed="instant" done />);
    expect(screen.queryByTestId('stream-caret')).not.toBeInTheDocument();
  });

  it('swaps the caret for the breathing indicator after a 900ms stall', () => {
    vi.useFakeTimers();
    render(<StreamText text="thinking" speed="instant" />);
    expect(screen.getByTestId('stream-caret')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(950);
    });
    expect(screen.queryByTestId('stream-caret')).not.toBeInTheDocument();
    expect(screen.getByTestId('stream-stalled')).toBeInTheDocument();
  });
});
