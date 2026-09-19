import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { IndraWorkspace } from './IndraWorkspace';

describe('IndraWorkspace', () => {
  it('starts on Work and switches destination when a rail item is clicked', async () => {
    const user = userEvent.setup();
    render(<IndraWorkspace />);

    expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Sovereignty' }));

    expect(screen.getByRole('button', { name: 'Sovereignty' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Work' })).not.toHaveAttribute('aria-current');
  });
});
