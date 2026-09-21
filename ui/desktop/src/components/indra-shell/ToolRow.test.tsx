import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToolRow } from './ToolRow';

const call = {
  t: 'tool.call' as const,
  call_id: 'c1',
  step_id: 's1',
  name: 'ocr_document',
  args: { path: 'NDT_2026_08.pdf' },
  sandbox_backend: 'docker',
};

const result = {
  t: 'tool.result' as const,
  call_id: 'c1',
  ok: true,
  ms: 4100,
  summary: '38 regions',
  bytes: 8192,
  citations: [],
};

describe('ToolRow', () => {
  it('always states the sandbox and network posture', () => {
    render(<ToolRow call={call} result={result} expanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText(/sandboxed, no network/)).toBeInTheDocument();
  });

  it('shows the tool name and duration', () => {
    render(<ToolRow call={call} result={result} expanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText('ocr_document')).toBeInTheDocument();
    expect(screen.getByText('4.1s')).toBeInTheDocument();
  });

  it('reveals arguments only when expanded', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ToolRow call={call} result={result} expanded={false} onToggle={onToggle} />
    );
    expect(screen.queryByText(/NDT_2026_08\.pdf/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /ocr_document/ }));
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(<ToolRow call={call} result={result} expanded onToggle={onToggle} />);
    expect(screen.getByText(/NDT_2026_08\.pdf/)).toBeInTheDocument();
  });
});
