import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BootSequence } from './BootSequence';

const steps = [
  { id: 'config', label: 'Reading configuration', state: 'ok' as const },
  { id: 'hardware', label: 'Probing hardware', state: 'ok' as const },
  { id: 'models', label: 'Scanning model registry', state: 'warn' as const, detail: '1 model degraded' },
];

describe('BootSequence', () => {
  it('shows the detail text for a warning step rather than hiding it', () => {
    render(<BootSequence steps={steps} onComplete={vi.fn()} />);
    expect(screen.getByText('1 model degraded')).toBeInTheDocument();
  });

  it('offers retry and continue when a step fails', () => {
    render(
      <BootSequence
        steps={[{ id: 'sealed', label: 'Mounting sealed store', state: 'fail', detail: 'keychain locked' }]}
        onComplete={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue anyway/i })).toBeInTheDocument();
  });
});
