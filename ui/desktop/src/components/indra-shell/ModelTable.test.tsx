import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModelTable, type ModelRow } from './ModelTable';

const localRow: ModelRow = {
  id: 'qwen2.5-coder-7b-q4',
  source: { kind: 'local', path: '/models/qwen.gguf', bytes: 4_100_000_000 },
  vision: false,
  toolCalling: 'reliable',
  contextTokens: 32768,
  fit: { kind: 'comfortable' },
};

const servedRow: ModelRow = {
  id: 'plant-llama-70b',
  source: { kind: 'served', endpoint: 'http://10.4.2.15:8000/v1', reachable: true },
  vision: true,
  toolCalling: 'unreliable',
  contextTokens: 16384,
  fit: {
    kind: 'degraded',
    warning:
      '6800 MB needed, 5200 MB available — offloading to CPU, expect substantially slower generation',
  },
};

describe('ModelTable', () => {
  it('shows a size for a local model', () => {
    render(<ModelTable rows={[localRow]} />);
    expect(screen.getByText('4.1 GB')).toBeInTheDocument();
  });

  it('shows the endpoint for a served model instead of a size', () => {
    render(<ModelTable rows={[servedRow]} />);
    expect(screen.getByText('http://10.4.2.15:8000/v1')).toBeInTheDocument();
  });

  it('renders the fit warning verbatim and in full', () => {
    render(<ModelTable rows={[servedRow]} />);
    expect(
      screen.getByText(
        '6800 MB needed, 5200 MB available — offloading to CPU, expect substantially slower generation'
      )
    ).toBeInTheDocument();
  });

  it('states reachability in words, not only colour', () => {
    render(
      <ModelTable
        rows={[
          {
            ...servedRow,
            source: { kind: 'served', endpoint: 'http://10.4.2.16:8000/v1', reachable: false },
          },
        ]}
      />
    );
    expect(screen.getByText(/unreachable/i)).toBeInTheDocument();
  });

  it('names the next action when empty rather than dead-ending', () => {
    render(<ModelTable rows={[]} />);
    expect(screen.getByText(/add a model/i)).toBeInTheDocument();
  });
});

describe('ModelTable — accessibility and honesty rules', () => {
  it('pairs the degraded warning with the triangle glyph so colour is not the sole carrier', () => {
    render(<ModelTable rows={[servedRow]} />);
    expect(screen.getByLabelText(/degraded fit/i)).toHaveTextContent('▲');
  });

  it('never hides the warning behind a disclosure', () => {
    const { container } = render(<ModelTable rows={[servedRow]} />);
    expect(container.querySelector('details')).toBeNull();
    const warning = screen.getByText(/offloading to CPU/);
    expect(warning).not.toHaveStyle({ textOverflow: 'ellipsis' });
    expect(warning).not.toHaveStyle({ whiteSpace: 'nowrap' });
  });

  it('renders local and served rows as peers in one table', () => {
    render(<ModelTable rows={[localRow, servedRow]} />);
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + two models
    expect(screen.getByText('reachable')).toBeInTheDocument();
    expect(screen.getByText('4.1 GB')).toBeInTheDocument();
  });

  it('renders context sizes with tabular numerals', () => {
    render(<ModelTable rows={[localRow]} />);
    expect(screen.getByText('32k')).toHaveStyle({ fontVariantNumeric: 'tabular-nums' });
  });
});
