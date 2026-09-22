import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatProvider } from '../../contexts/ChatContext';
import { IntlTestWrapper } from '../../i18n/test-utils';
import type { ChatType } from '../../types/chat';
import { IndraWorkspace } from './IndraWorkspace';

// Real usage always sits inside App.tsx's IntlProvider + ChatProvider (the
// index route wraps IndraWorkspace exactly like this); WorkDestination's
// useChatSession call needs both, matching how the app actually mounts it.
function renderWorkspace() {
  const chat: ChatType = {
    sessionId: '',
    name: 'Test',
    messages: [],
    recipe: null,
    recipeParameterValues: null,
  };
  return render(
    <IntlTestWrapper>
      <ChatProvider chat={chat} setChat={vi.fn()}>
        <IndraWorkspace />
      </ChatProvider>
    </IntlTestWrapper>
  );
}

describe('IndraWorkspace', () => {
  it('starts on Work and switches destination when a rail item is clicked', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Sovereignty' }));

    expect(screen.getByRole('button', { name: 'Sovereignty' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Work' })).not.toHaveAttribute('aria-current');
  });
});
