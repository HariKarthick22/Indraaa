import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SetupSovereignty } from './SetupSovereignty';

describe('SetupSovereignty', () => {
  it('sends the typed URL to the probe and shows the blocked result', async () => {
    const onProbe = vi.fn().mockResolvedValue({ blocked: true, reason: 'loopback only' });
    render(<SetupSovereignty onProbe={onProbe} onStart={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/test a url/i), 'https://example.com');
    await userEvent.click(screen.getByRole('button', { name: /probe/i }));

    expect(onProbe).toHaveBeenCalledWith('https://example.com');
    expect(await screen.findByText(/blocked/i)).toBeInTheDocument();
    expect(screen.getByText('loopback only')).toBeInTheDocument();
  });

  it('reports an attempt that reached the network honestly, without faking a block', async () => {
    const onProbe = vi.fn().mockResolvedValue({ blocked: false });
    render(<SetupSovereignty onProbe={onProbe} onStart={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/test a url/i), 'https://example.com');
    await userEvent.click(screen.getByRole('button', { name: /probe/i }));

    expect(await screen.findByText(/reached/i)).toBeInTheDocument();
  });

  it('only allows starting after at least one probe has run', () => {
    render(<SetupSovereignty onProbe={vi.fn()} onStart={vi.fn()} />);

    expect(screen.getByRole('button', { name: /start using indra/i })).toBeDisabled();
  });

  it('completes setup once the user has proved sovereignty and clicks start', async () => {
    const onStart = vi.fn();
    const onProbe = vi.fn().mockResolvedValue({ blocked: true });
    render(<SetupSovereignty onProbe={onProbe} onStart={onStart} />);

    await userEvent.type(screen.getByLabelText(/test a url/i), 'https://example.com');
    await userEvent.click(screen.getByRole('button', { name: /probe/i }));
    expect(await screen.findByText(/blocked/i)).toBeInTheDocument();

    const startButton = screen.getByRole('button', { name: /start using indra/i });
    expect(startButton).toBeEnabled();
    await userEvent.click(startButton);

    expect(onStart).toHaveBeenCalledOnce();
  });
});
