import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModelInstall, type ModelInstallRow } from './ModelInstall';

const installedModel: ModelInstallRow = {
  id: 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M',
  label: 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M',
  sizeBytes: 4_400_000_000,
  quantization: 'Q4_K_M',
  visionCapable: false,
  recommended: true,
  installed: true,
  downloading: false,
  failed: false,
  progress: null,
};

const downloadingModel: ModelInstallRow = {
  id: 'plant-llama-70b:Q4_K_M',
  label: 'plant-llama-70b:Q4_K_M',
  sizeBytes: 40_000_000_000,
  quantization: 'Q4_K_M',
  visionCapable: true,
  recommended: false,
  installed: false,
  downloading: true,
  failed: false,
  progress: {
    percent: 42,
    bytesDownloaded: 16_800_000_000,
    totalBytes: 40_000_000_000,
    speedBps: 52_000_000,
  },
};

const failedModel: ModelInstallRow = {
  id: 'broken-repo:Q4_K_M',
  label: 'broken-repo:Q4_K_M',
  sizeBytes: 0,
  quantization: '',
  visionCapable: false,
  recommended: false,
  installed: false,
  downloading: false,
  failed: true,
  errorMessage: 'connection reset while downloading',
  progress: null,
};

function renderInstall(overrides: Partial<React.ComponentProps<typeof ModelInstall>> = {}) {
  const onInstall = vi.fn();
  const onCancel = vi.fn();
  const onDelete = vi.fn();
  const onDismiss = vi.fn();
  const utils = render(
    <ModelInstall
      models={[installedModel, downloadingModel]}
      onInstall={onInstall}
      onCancel={onCancel}
      onDelete={onDelete}
      onDismiss={onDismiss}
      {...overrides}
    />
  );
  return { ...utils, onInstall, onCancel, onDelete, onDismiss };
}

describe('ModelInstall', () => {
  it('shows an installed model as Installed with its size and quantization', () => {
    renderInstall();
    expect(screen.getByText('Installed')).toBeInTheDocument();
    expect(screen.getByText('4.4 GB')).toBeInTheDocument();
    expect(screen.getAllByText('Q4_K_M').length).toBeGreaterThan(0);
  });

  it('marks the recommended model in words, not colour alone', () => {
    renderInstall();
    expect(screen.getByText('Recommended for this machine')).toBeInTheDocument();
  });

  it('shows live download progress with percent, bytes, and speed', () => {
    renderInstall();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('16.8 GB / 40.0 GB')).toBeInTheDocument();
    expect(screen.getByText('52 MB/s')).toBeInTheDocument();
  });

  it('renders the progress numbers with tabular numerals so digits do not reflow', () => {
    renderInstall();
    expect(screen.getByText('42%')).toHaveStyle({ fontVariantNumeric: 'tabular-nums' });
  });

  it('names the next action when no models are installed, never a dead end', () => {
    renderInstall({ models: [] });
    expect(screen.getByText(/no models installed yet/i)).toBeInTheDocument();
    expect(screen.getByText(/install one above by name or id/i)).toBeInTheDocument();
    expect(screen.getByText(/detected automatically/i)).toBeInTheDocument();
  });

  it('summarizes total, installed, and downloading counts', () => {
    renderInstall();
    expect(screen.getByText('2 models · 1 installed · 1 downloading')).toBeInTheDocument();
  });

  it('installs a model by typed name/ID with one action', async () => {
    const user = userEvent.setup();
    const { onInstall } = renderInstall();

    await user.type(
      screen.getByLabelText('Model name or ID'),
      'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M'
    );
    await user.click(screen.getByRole('button', { name: 'Install' }));

    expect(onInstall).toHaveBeenCalledWith('Qwen/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M');
  });

  it('keeps the install button disabled until something is typed', () => {
    renderInstall();
    expect(screen.getByRole('button', { name: 'Install' })).toBeDisabled();
  });

  it('cancels an in-flight download', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderInstall();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledWith('plant-llama-70b:Q4_K_M');
  });

  it('deletes an installed model', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderInstall();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('Qwen/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M');
  });

  it('shows a failed download with its real error message and a Dismiss action, not Cancel or Delete', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderInstall({ models: [failedModel] });

    expect(screen.getByText('Download failed')).toBeInTheDocument();
    expect(screen.getByText('connection reset while downloading')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledWith('broken-repo:Q4_K_M');
  });

  it('auto-detected models appear without any explicit install action - installed is just a prop', () => {
    // The component never distinguishes "installed by this UI" from "found on
    // disk" - useLocalModels resolves that distinction before the row ever
    // reaches this component, so a purely disk-discovered model renders
    // identically to one downloaded through the Install control above.
    renderInstall({ models: [installedModel] });
    expect(screen.getByText('Installed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install' })).toBeInTheDocument();
  });

  it('marks every interactive element focusable per the design system', () => {
    renderInstall();
    const interactive = [...screen.getAllByRole('button'), ...screen.getAllByRole('textbox')];
    expect(interactive.length).toBeGreaterThan(0);
    interactive.forEach((element) => {
      expect(element).toHaveClass('indra-focusable');
    });
  });
});
