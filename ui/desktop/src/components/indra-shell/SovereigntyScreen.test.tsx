import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SovereigntyScreen, formatUptime } from './SovereigntyScreen';

const base = {
  attempts: [],
  uptimeSeconds: 1_231_200,
  sandboxBackend: 'docker',
  modelsLoaded: 3,
  degradedCount: 1,
  sealedCount: 12,
};

describe('SovereigntyScreen', () => {
  it('leads with the sealed state and attempt count', () => {
    render(<SovereigntyScreen {...base} onProbe={vi.fn()} />);
    expect(screen.getByText(/SEALED/)).toBeInTheDocument();
    expect(screen.getByText(/0 outbound attempts/)).toBeInTheDocument();
  });

  it('sends the typed URL to the probe', async () => {
    const onProbe = vi.fn().mockResolvedValue(undefined);
    render(<SovereigntyScreen {...base} onProbe={onProbe} />);

    await userEvent.type(screen.getByLabelText(/test a url/i), 'https://example.com');
    await userEvent.click(screen.getByRole('button', { name: /probe/i }));

    expect(onProbe).toHaveBeenCalledWith('https://example.com');
  });

  it('lists a blocked attempt with its destination and time', () => {
    render(
      <SovereigntyScreen
        {...base}
        attempts={[{ url: 'https://example.com', blocked: true, at: '2026-09-16T14:02:31Z' }]}
        onProbe={vi.fn()}
      />
    );
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText(/BLOCKED/)).toBeInTheDocument();
  });
});

describe('SovereigntyScreen — honest rendering', () => {
  it('says REACHED, not BLOCKED, when the probe actually got out', () => {
    render(
      <SovereigntyScreen
        {...base}
        attempts={[
          {
            url: 'https://example.com',
            blocked: false,
            at: '2026-09-16T14:02:31Z',
            reason: 'connection succeeded with status 200 OK',
          },
        ]}
        onProbe={vi.fn()}
      />
    );
    expect(screen.getByText(/REACHED/)).toBeInTheDocument();
    expect(screen.queryByText(/BLOCKED/)).toBeNull();
    expect(screen.getByText(/connection succeeded with status 200 OK/)).toBeInTheDocument();
  });

  it('shows the mechanism and origin of each attempt', () => {
    render(
      <SovereigntyScreen
        {...base}
        attempts={[
          {
            url: 'https://api.openai.com',
            blocked: true,
            at: '2026-09-16T14:02:31Z',
            mechanism: 'socket',
            origin: 'config',
          },
        ]}
        onProbe={vi.fn()}
      />
    );
    expect(screen.getByText('socket')).toBeInTheDocument();
    expect(screen.getByText('config')).toBeInTheDocument();
  });

  it('counts attempts in the header rather than hardcoding zero', () => {
    render(
      <SovereigntyScreen
        {...base}
        attempts={[
          { url: 'https://a.example', blocked: true, at: '2026-09-16T14:02:31Z' },
          { url: 'https://b.example', blocked: true, at: '2026-09-16T14:05:02Z' },
        ]}
        onProbe={vi.fn()}
      />
    );
    expect(screen.getByText(/2 outbound attempts/)).toBeInTheDocument();
  });

  it('marks the degraded model count with the triangle glyph', () => {
    render(<SovereigntyScreen {...base} onProbe={vi.fn()} />);
    expect(screen.getByText(/1 degraded fit/)).toHaveTextContent('▲');
  });

  it('renders the three summary cards', () => {
    render(<SovereigntyScreen {...base} onProbe={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /sandbox/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /models/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^sealed$/i })).toBeInTheDocument();
    expect(screen.getByText(/docker/)).toBeInTheDocument();
    expect(screen.getByText(/3 loaded/)).toBeInTheDocument();
    expect(screen.getByText(/12 resources/)).toBeInTheDocument();
  });

  it('names the next action when nothing has been attempted yet', () => {
    render(<SovereigntyScreen {...base} onProbe={vi.fn()} />);
    expect(screen.getByText(/type any url above/i)).toBeInTheDocument();
  });

  it('does not call the probe with an empty url', async () => {
    const onProbe = vi.fn().mockResolvedValue(undefined);
    render(<SovereigntyScreen {...base} onProbe={onProbe} />);

    await userEvent.click(screen.getByRole('button', { name: /probe/i }));

    expect(onProbe).not.toHaveBeenCalled();
  });

  it('reports a probe failure instead of silently swallowing it', async () => {
    const onProbe = vi.fn().mockRejectedValue(new Error('acp channel closed'));
    render(<SovereigntyScreen {...base} onProbe={onProbe} />);

    await userEvent.type(screen.getByLabelText(/test a url/i), 'https://example.com');
    await userEvent.click(screen.getByRole('button', { name: /probe/i }));

    expect(await screen.findByText(/acp channel closed/)).toBeInTheDocument();
  });
});

describe('formatUptime', () => {
  it('renders days and hours the way the spec header does', () => {
    expect(formatUptime(1_231_200)).toBe('14d 6h uptime');
    expect(formatUptime(3600)).toBe('1h 0m uptime');
    expect(formatUptime(90)).toBe('1m 30s uptime');
  });
});
