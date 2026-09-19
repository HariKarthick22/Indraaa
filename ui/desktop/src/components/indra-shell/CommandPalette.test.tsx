import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';
import type { PaletteEntry } from '../../indra/paletteIndex';

function makeEntries(): PaletteEntry[] {
  return [
    { id: 'work', label: 'Go to Work', kind: 'destination', run: vi.fn() },
    { id: 'sov', label: 'Go to Sovereignty', kind: 'destination', run: vi.fn() },
    { id: 'skill-ndt', label: '/ndt-review', kind: 'skill', hint: 'Review an NDT report', run: vi.fn() },
  ];
}

describe('CommandPalette', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <CommandPalette open={false} entries={makeEntries()} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('filters entries as you type', async () => {
    render(<CommandPalette open entries={makeEntries()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('combobox'), 'sov');
    expect(screen.getByText('Go to Sovereignty')).toBeInTheDocument();
    expect(screen.queryByText('Go to Work')).not.toBeInTheDocument();
  });

  it('finds skills by their slash name', async () => {
    render(<CommandPalette open entries={makeEntries()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('combobox'), 'ndt');
    expect(screen.getByText('/ndt-review')).toBeInTheDocument();
  });

  it('names the next action when nothing matches', async () => {
    render(<CommandPalette open entries={makeEntries()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('combobox'), 'zzzz');
    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear the search/i })).toBeInTheDocument();
  });

  it('focuses the search field on open so typing goes straight to it', () => {
    render(<CommandPalette open entries={makeEntries()} onClose={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('highlights the first match and moves the highlight with the arrow keys', async () => {
    render(<CommandPalette open entries={makeEntries()} onClose={vi.fn()} />);
    const input = screen.getByRole('combobox');

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('wraps the highlight at both ends of the list', async () => {
    render(<CommandPalette open entries={makeEntries()} onClose={vi.fn()} />);
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('runs the highlighted entry on Enter and closes', async () => {
    const entries = makeEntries();
    const onClose = vi.fn();
    render(<CommandPalette open entries={entries} onClose={onClose} />);

    await userEvent.type(screen.getByRole('combobox'), 'sov');
    await userEvent.keyboard('{Enter}');

    expect(entries[1].run).toHaveBeenCalledOnce();
    expect(entries[0].run).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('runs an entry when it is clicked', async () => {
    const entries = makeEntries();
    const onClose = vi.fn();
    render(<CommandPalette open entries={entries} onClose={onClose} />);

    await userEvent.click(screen.getByText('/ndt-review'));

    expect(entries[2].run).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does nothing on Enter when nothing matches', async () => {
    const entries = makeEntries();
    const onClose = vi.fn();
    render(<CommandPalette open entries={entries} onClose={onClose} />);

    await userEvent.type(screen.getByRole('combobox'), 'zzzz');
    await userEvent.keyboard('{Enter}');

    for (const e of entries) expect(e.run).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<CommandPalette open entries={makeEntries()} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<CommandPalette open entries={makeEntries()} onClose={onClose} />);
    await userEvent.click(screen.getByTestId('indra-palette-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('resets the query each time it opens', async () => {
    const { rerender } = render(
      <CommandPalette open entries={makeEntries()} onClose={vi.fn()} />
    );
    await userEvent.type(screen.getByRole('combobox'), 'sov');
    rerender(<CommandPalette open={false} entries={makeEntries()} onClose={vi.fn()} />);
    rerender(<CommandPalette open entries={makeEntries()} onClose={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('labels each entry with its kind so the flat index stays readable', async () => {
    render(<CommandPalette open entries={makeEntries()} onClose={vi.fn()} />);
    expect(screen.getAllByText('destination')).toHaveLength(2);
    expect(screen.getByText('skill')).toBeInTheDocument();
  });

  it('carries the one permitted pop shadow and no backdrop animation', () => {
    render(<CommandPalette open entries={makeEntries()} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveStyle({ boxShadow: 'var(--shadow-pop)' });
    expect(dialog).toHaveStyle({ borderRadius: 'var(--r-md)' });

    const backdrop = screen.getByTestId('indra-palette-backdrop');
    expect(backdrop).toHaveStyle({ transition: 'none', animation: 'none' });
  });

  it('opens in 120ms', () => {
    render(<CommandPalette open entries={makeEntries()} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog').style.transitionDuration).toBe('120ms');
  });

  it('paints the caret with --focus and never fills with it', () => {
    render(<CommandPalette open entries={makeEntries()} onClose={vi.fn()} />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveStyle({ caretColor: 'var(--focus)' });
    expect(input.style.background).not.toContain('--focus');
    for (const option of screen.getAllByRole('option')) {
      expect(option.style.background).not.toContain('--focus');
    }
  });
});
