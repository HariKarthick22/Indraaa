import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppearancePanel } from './AppearancePanel';
import { DEFAULT_THEME } from '../../indra/theme';

describe('AppearancePanel', () => {
  it('calls onChange with an updated theme when a control changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AppearancePanel theme={DEFAULT_THEME} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('Base'), 'oled');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ base: 'oled' }));
  });

  it('applies instantly, with no separate restart step', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AppearancePanel theme={DEFAULT_THEME} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('Base'), 'oled');

    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#000000');
  });

  it('applies a theme text blob pasted into the field', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AppearancePanel theme={DEFAULT_THEME} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Theme text'), {
      target: { value: '{"base":"high-contrast"}' },
    });
    await user.click(screen.getByRole('button', { name: /apply theme text/i }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ base: 'high-contrast' }));
  });

  it('shows the parser error rather than applying an invalid blob', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AppearancePanel theme={DEFAULT_THEME} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Theme text'), { target: { value: 'not json' } });
    await user.click(screen.getByRole('button', { name: /apply theme text/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/valid json/i);
    expect(onChange).not.toHaveBeenCalled();
  });
});
