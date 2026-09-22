import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IndraComposer, type IndraComposerProps, type PermissionMode } from './IndraComposer';

const skills = [
  { name: 'ndt-review', description: 'Review an NDT report against allowables' },
  { name: 'pid-trace', description: 'Trace a line on a P&ID' },
];

const agents = [
  { name: 'rust-systems-engineer', description: 'Agent-loop and extension plumbing' },
  { name: 'pid-drawing-reviewer', description: 'Reviews P&ID tag consistency' },
];

type Overrides = Partial<IndraComposerProps>;

// IndraComposer is fully controlled (value/onChange from the parent), so a
// realistic multi-keystroke userEvent test needs a stateful wrapper that
// actually feeds each keystroke's onChange back in - otherwise every
// keystroke would "reset" against the same fixed `value` prop. Fields are
// picked individually (rather than spreading `overrides` over local state)
// so the precedence between a test's own spy and this wrapper's state is
// never ambiguous.
function ControlledComposer({
  value: initialValue = '',
  onChange,
  onSubmit = vi.fn(),
  permissionMode: initialPermissionMode = 'manual',
  onPermissionModeChange,
  modelName,
  workspaceLabel,
  disabled = false,
}: Overrides = {}) {
  const [value, setValue] = useState(initialValue);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(initialPermissionMode);

  return (
    <IndraComposer
      value={value}
      onChange={onChange ?? setValue}
      onSubmit={onSubmit}
      skills={skills}
      agents={agents}
      modelName={modelName}
      workspaceLabel={workspaceLabel}
      permissionMode={permissionMode}
      onPermissionModeChange={onPermissionModeChange ?? setPermissionMode}
      disabled={disabled}
    />
  );
}

function getComposerTextarea(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: /message indra/i }) as HTMLTextAreaElement;
}

describe('IndraComposer', () => {
  it('opens and filters the skill menu on a single leading slash', async () => {
    const user = userEvent.setup();
    render(<ControlledComposer />);

    await user.type(getComposerTextarea(), '/pid');

    expect(screen.getByRole('listbox', { name: 'Skill commands' })).toBeInTheDocument();
    expect(screen.getByText('/pid-trace')).toBeInTheDocument();
    expect(screen.queryByText('/ndt-review')).not.toBeInTheDocument();
  });

  it('does not trigger the skill menu when the slash is mid-word', async () => {
    const user = userEvent.setup();
    render(<ControlledComposer />);

    await user.type(getComposerTextarea(), 'abc/def');

    expect(screen.queryByRole('listbox', { name: 'Skill commands' })).not.toBeInTheDocument();
  });

  it('opens the skill menu for a slash typed after whitespace, not only at the very start', async () => {
    const user = userEvent.setup();
    render(<ControlledComposer />);

    await user.type(getComposerTextarea(), 'hello /pid');

    expect(screen.getByText('/pid-trace')).toBeInTheDocument();
  });

  it('switches from the skill menu to the agent menu on a second consecutive slash, closing the skill menu', async () => {
    const user = userEvent.setup();
    render(<ControlledComposer />);
    const textarea = getComposerTextarea();

    await user.type(textarea, '/');
    expect(screen.getByRole('listbox', { name: 'Skill commands' })).toBeInTheDocument();

    await user.type(textarea, '/');
    expect(screen.queryByRole('listbox', { name: 'Skill commands' })).not.toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Agents' })).toBeInTheDocument();
  });

  it('filters the agent menu by the text typed after //, with distinct @name labels and no skill menu open', async () => {
    const user = userEvent.setup();
    render(<ControlledComposer />);

    await user.type(getComposerTextarea(), '//rust');

    expect(screen.getByRole('listbox', { name: 'Agents' })).toBeInTheDocument();
    expect(screen.getByText('@rust-systems-engineer')).toBeInTheDocument();
    expect(screen.queryByText('@pid-drawing-reviewer')).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox', { name: 'Skill commands' })).not.toBeInTheDocument();
  });

  it('submits on Enter and does not insert a newline', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ControlledComposer onSubmit={onSubmit} />);
    const textarea = getComposerTextarea();

    await user.type(textarea, 'hello there{Enter}');

    expect(onSubmit).toHaveBeenCalledWith('hello there');
    expect(textarea).toHaveValue('hello there');
  });

  it('does not submit on empty or whitespace-only input', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ControlledComposer onSubmit={onSubmit} />);

    await user.type(getComposerTextarea(), '   {Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('inserts a newline on Shift+Enter instead of submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ControlledComposer onSubmit={onSubmit} />);
    const textarea = getComposerTextarea();

    await user.type(textarea, 'line one');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, 'line two');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('line one\nline two');
  });

  it('moves the highlight through the skill menu with the arrow keys and wraps around', async () => {
    const user = userEvent.setup();
    render(<ControlledComposer />);
    const textarea = getComposerTextarea();

    await user.type(textarea, '/');
    let options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');

    await user.keyboard('{ArrowDown}');
    options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');

    // Wraps back to the first option past the last.
    await user.keyboard('{ArrowDown}');
    options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowUp}');
    options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('picks the highlighted skill on Enter, replacing the /query token with /name and closing the menu', async () => {
    const user = userEvent.setup();
    render(<ControlledComposer />);
    const textarea = getComposerTextarea();

    await user.type(textarea, 'hi /pid');
    await user.keyboard('{Enter}');

    expect(textarea).toHaveValue('hi /pid-trace ');
    expect(screen.queryByRole('listbox', { name: 'Skill commands' })).not.toBeInTheDocument();
  });

  it('picks an agent by click, replacing the //query token with @name', async () => {
    const user = userEvent.setup();
    render(<ControlledComposer />);
    const textarea = getComposerTextarea();

    await user.type(textarea, 'ask //rust');
    await user.click(screen.getByText('@rust-systems-engineer'));

    expect(textarea).toHaveValue('ask @rust-systems-engineer ');
    expect(screen.queryByRole('listbox', { name: 'Agents' })).not.toBeInTheDocument();
  });

  it('closes the menu on Escape without clearing the input, and reopens on the next edit', async () => {
    const user = userEvent.setup();
    render(<ControlledComposer />);
    const textarea = getComposerTextarea();

    await user.type(textarea, '/pid');
    expect(screen.getByRole('listbox', { name: 'Skill commands' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox', { name: 'Skill commands' })).not.toBeInTheDocument();
    expect(textarea).toHaveValue('/pid');

    // A fresh trigger (new token after whitespace) un-dismisses.
    await user.type(textarea, ' /pid');
    expect(screen.getByRole('listbox', { name: 'Skill commands' })).toBeInTheDocument();
  });

  it('shows the active model name and workspace label in the status row', () => {
    render(<ControlledComposer modelName="qwen-coder" workspaceLabel="3 folders · 1 controlled" />);

    expect(screen.getByText('qwen-coder')).toBeInTheDocument();
    expect(screen.getByText('3 folders · 1 controlled')).toBeInTheDocument();
  });

  it('calls onPermissionModeChange with the other mode when the toggle is clicked', async () => {
    const user = userEvent.setup();
    const onPermissionModeChange = vi.fn();
    render(
      <ControlledComposer permissionMode="auto" onPermissionModeChange={onPermissionModeChange} />
    );

    await user.click(screen.getByRole('button', { name: /permission mode: auto/i }));

    expect(onPermissionModeChange).toHaveBeenCalledWith('manual');
  });

  it('flips the other way when starting from manual', async () => {
    const user = userEvent.setup();
    const onPermissionModeChange = vi.fn();
    render(
      <ControlledComposer permissionMode="manual" onPermissionModeChange={onPermissionModeChange} />
    );

    await user.click(screen.getByRole('button', { name: /permission mode: manual/i }));

    expect(onPermissionModeChange).toHaveBeenCalledWith('auto');
  });

  it('uses --r-lg for the composer card, the one place this design system uses that radius', () => {
    render(<ControlledComposer />);
    const textarea = getComposerTextarea();
    const card = textarea.parentElement;
    expect(card).toHaveStyle({ borderRadius: 'var(--r-lg)' });
  });

  it('marks every interactive element indra-focusable and keeps --focus off any fill', () => {
    render(<ControlledComposer modelName="qwen-coder" workspaceLabel="Full access" />);
    const textarea = getComposerTextarea();

    expect(textarea).toHaveClass('indra-focusable');
    expect(textarea).toHaveStyle({ caretColor: 'var(--focus)' });
    expect(textarea.style.background).not.toContain('--focus');

    const toggle = screen.getByRole('button', { name: /permission mode/i });
    expect(toggle).toHaveClass('indra-focusable');
  });

  it('disables the textarea when disabled', () => {
    render(<ControlledComposer disabled />);
    expect(getComposerTextarea()).toBeDisabled();
  });
});
