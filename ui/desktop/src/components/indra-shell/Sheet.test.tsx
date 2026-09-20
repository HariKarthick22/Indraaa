import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Sheet open={false} width={480} onClose={vi.fn()}>
        <p>content</p>
      </Sheet>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open width={480} onClose={onClose}>
        <p>content</p>
      </Sheet>
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
