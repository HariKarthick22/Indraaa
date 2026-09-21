import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LockOverlay } from './LockOverlay';

describe('LockOverlay', () => {
  it('renders nothing when unlocked', () => {
    const { container } = render(
      <LockOverlay open={false} mode="passphrase" attemptsRemaining={3} onUnlock={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('states attempts remaining after a failure', () => {
    render(<LockOverlay open mode="passphrase" attemptsRemaining={2} onUnlock={vi.fn()} />);
    expect(screen.getByText(/2 attempts remaining/i)).toBeInTheDocument();
  });

  it('keeps the workspace behind it rather than unmounting it', () => {
    render(
      <LockOverlay open mode="passphrase" attemptsRemaining={3} onUnlock={vi.fn()}>
        <p>work in progress</p>
      </LockOverlay>
    );
    expect(screen.getByText('work in progress')).toBeInTheDocument();
  });
});
