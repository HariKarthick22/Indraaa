import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModelChip } from './ModelChip';

describe('ModelChip', () => {
  it('renders nothing when the model has not changed', () => {
    const { container } = render(
      <ModelChip
        previousModelId="qwen"
        modelId="qwen"
        reason="general"
        fit={{ kind: 'comfortable' }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the transition and reason when the model changed', () => {
    render(
      <ModelChip
        previousModelId="qwen-coder"
        modelId="llama-3.2-vision"
        reason="vision required"
        fit={{ kind: 'comfortable' }}
      />
    );
    expect(screen.getByText(/qwen-coder/)).toBeInTheDocument();
    expect(screen.getByText(/llama-3\.2-vision/)).toBeInTheDocument();
    expect(screen.getByText(/vision required/)).toBeInTheDocument();
  });

  it('renders a degraded warning verbatim', () => {
    render(
      <ModelChip
        previousModelId="qwen"
        modelId="llama-vision"
        reason="vision required"
        fit={{ kind: 'degraded', warning: '6800 MB needed, 5200 MB available' }}
      />
    );
    expect(screen.getByText('6800 MB needed, 5200 MB available')).toBeInTheDocument();
  });
});

describe('ModelChip — presentation rules', () => {
  it('renders the arrow as its own element, never glued onto a label', () => {
    render(
      <ModelChip
        previousModelId="qwen-coder"
        modelId="llama-3.2-vision"
        reason="vision required"
        fit={{ kind: 'comfortable' }}
      />
    );
    const arrow = screen.getByText('→');
    expect(arrow).toBeInTheDocument();
    expect(arrow.textContent).toBe('→');
    expect(screen.getByText('qwen-coder').textContent).toBe('qwen-coder');
    expect(screen.getByText('llama-3.2-vision').textContent).toBe('llama-3.2-vision');
  });

  it('sets both model ids in the mono face', () => {
    render(
      <ModelChip
        previousModelId="qwen-coder"
        modelId="llama-3.2-vision"
        reason="vision required"
        fit={{ kind: 'comfortable' }}
      />
    );
    expect(screen.getByText('qwen-coder')).toHaveStyle({ fontFamily: 'var(--font-mono)' });
    expect(screen.getByText('llama-3.2-vision')).toHaveStyle({ fontFamily: 'var(--font-mono)' });
  });

  it('carries the triangle glyph beside a degraded warning so colour is not the sole carrier', () => {
    render(
      <ModelChip
        previousModelId="qwen"
        modelId="llama-vision"
        reason="vision required"
        fit={{ kind: 'degraded', warning: '6800 MB needed, 5200 MB available' }}
      />
    );
    const warningBlock = screen.getByLabelText(/degraded fit/i);
    expect(warningBlock).toHaveTextContent('▲');
    expect(warningBlock).toHaveStyle({
      borderLeftWidth: '2px',
      borderLeftStyle: 'solid',
      borderLeftColor: 'var(--degraded)',
    });
  });

  it('shows no warning block for a comfortable fit', () => {
    render(
      <ModelChip
        previousModelId="qwen"
        modelId="llama-vision"
        reason="vision required"
        fit={{ kind: 'comfortable' }}
      />
    );
    expect(screen.queryByLabelText(/degraded fit/i)).toBeNull();
  });

  it('renders a tight fit warning verbatim too, rather than dropping it', () => {
    render(
      <ModelChip
        previousModelId="qwen"
        modelId="llama-vision"
        reason="vision required"
        fit={{ kind: 'tight', warning: '5200 MB needed, 5400 MB available' }}
      />
    );
    expect(screen.getByText('5200 MB needed, 5400 MB available')).toBeInTheDocument();
  });
});
