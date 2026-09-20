import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SetupModels } from './SetupModels';
import type { ModelRow } from './ModelTable';

const rows: ModelRow[] = [
  {
    id: 'qwen2.5-coder-7b-q4',
    source: { kind: 'local', path: '/models/qwen.gguf', bytes: 4_100_000_000 },
    vision: false,
    toolCalling: 'reliable',
    contextTokens: 32768,
    fit: { kind: 'comfortable' },
  },
];

describe('SetupModels', () => {
  it('scans a directory and advances to the next step', async () => {
    const onAddDirectory = vi.fn();
    const onNext = vi.fn();
    render(
      <SetupModels rows={rows} onAddDirectory={onAddDirectory} onAddServer={vi.fn()} onNext={onNext} />
    );

    await userEvent.type(screen.getByLabelText(/model directory path/i), '/models');
    await userEvent.click(screen.getByRole('button', { name: /scan directory/i }));
    expect(onAddDirectory).toHaveBeenCalledWith('/models');

    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('adds a model server endpoint', async () => {
    const onAddServer = vi.fn();
    render(<SetupModels rows={[]} onAddDirectory={vi.fn()} onAddServer={onAddServer} onNext={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/model server endpoint/i), 'http://10.4.2.15:8000/v1');
    await userEvent.click(screen.getByRole('button', { name: /add server/i }));

    expect(onAddServer).toHaveBeenCalledWith('http://10.4.2.15:8000/v1');
  });

  it('names the files needed and an offline path when a directory scan finds nothing', async () => {
    const { container } = render(
      <SetupModels rows={[]} onAddDirectory={vi.fn()} onAddServer={vi.fn()} onNext={vi.fn()} />
    );

    await userEvent.type(screen.getByLabelText(/model directory path/i), '/empty');
    await userEvent.click(screen.getByRole('button', { name: /scan directory/i }));

    expect(screen.getByText(/no models found/i)).toBeInTheDocument();
    expect(container.textContent).toMatch(/\.gguf/i);
    expect(container.textContent).toMatch(/mmproj/i);
    expect(container.textContent).toMatch(/distribution share|usb/i);
  });

  it('never dead-ends before a scan — ModelTable names the next action instead', () => {
    render(<SetupModels rows={[]} onAddDirectory={vi.fn()} onAddServer={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText(/add a model/i)).toBeInTheDocument();
  });
});
