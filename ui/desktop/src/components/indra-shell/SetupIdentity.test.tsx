import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SetupIdentity } from './SetupIdentity';

describe('SetupIdentity', () => {
  it('calls onChoose with plant when the plant sign-in card is chosen', async () => {
    const onChoose = vi.fn();
    render(<SetupIdentity onChoose={onChoose} />);

    await userEvent.click(screen.getByRole('button', { name: /plant sign-in/i }));

    expect(onChoose).toHaveBeenCalledWith('plant');
  });

  it('calls onChoose with standalone when the standalone profile card is chosen', async () => {
    const onChoose = vi.fn();
    render(<SetupIdentity onChoose={onChoose} />);

    await userEvent.click(screen.getByRole('button', { name: /standalone profile/i }));

    expect(onChoose).toHaveBeenCalledWith('standalone');
  });

  it('states plainly that a forgotten passphrase makes the standalone store unrecoverable', () => {
    render(<SetupIdentity onChoose={vi.fn()} />);

    expect(screen.getByText(/unrecoverable/i)).toBeInTheDocument();
  });
});
