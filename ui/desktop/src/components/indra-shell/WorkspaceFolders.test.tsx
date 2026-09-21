import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceFolders, type WorkspaceFolderEntry } from './WorkspaceFolders';

const folders: WorkspaceFolderEntry[] = [
  { path: '/data/inspection-reports', mode: 'read-only' },
  { path: '/data/work-orders', mode: 'controlled' },
];

function renderFolders(overrides: Partial<React.ComponentProps<typeof WorkspaceFolders>> = {}) {
  const onAdd = vi.fn();
  const onRemove = vi.fn();
  const onModeChange = vi.fn();
  const utils = render(
    <WorkspaceFolders
      folders={folders}
      onAdd={onAdd}
      onRemove={onRemove}
      onModeChange={onModeChange}
      {...overrides}
    />
  );
  return { ...utils, onAdd, onRemove, onModeChange };
}

// window.electron is globally mocked in test/setup.ts without
// selectWorkspaceFolder, so by default every test below exercises the
// fallback typed-path form. Tests that need the native picker attach it
// themselves and clean it up afterwards.
afterEach(() => {
  delete (window.electron as { selectWorkspaceFolder?: unknown }).selectWorkspaceFolder;
});

describe('WorkspaceFolders', () => {
  it('lists each folder path', () => {
    renderFolders();
    expect(screen.getByText('/data/inspection-reports')).toBeInTheDocument();
    expect(screen.getByText('/data/work-orders')).toBeInTheDocument();
  });

  it('summarizes the count and the split between read-only and controlled', () => {
    renderFolders();
    expect(screen.getByText('2 folders · 1 read-only · 1 controlled')).toBeInTheDocument();
  });

  it('names the next action when no folders are added, never a dead end', () => {
    renderFolders({ folders: [] });
    expect(screen.getByText(/no workspace folders added yet/i)).toBeInTheDocument();
    expect(screen.getByText(/add a folder above/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add a folder/i })).toBeInTheDocument();
  });

  it('removes a folder by path', async () => {
    const user = userEvent.setup();
    const { onRemove } = renderFolders();

    await user.click(screen.getByRole('button', { name: 'Remove /data/inspection-reports' }));

    expect(onRemove).toHaveBeenCalledWith('/data/inspection-reports');
  });

  it('changes a folder from read-only to controlled', async () => {
    const user = userEvent.setup();
    const { onModeChange } = renderFolders();

    const group = screen.getByRole('group', {
      name: /access mode for \/data\/inspection-reports/i,
    });
    await user.click(within(group).getByRole('button', { name: /controlled/i }));

    expect(onModeChange).toHaveBeenCalledWith('/data/inspection-reports', 'controlled');
  });

  it('changes a folder from controlled to read-only', async () => {
    const user = userEvent.setup();
    const { onModeChange } = renderFolders();

    const group = screen.getByRole('group', { name: /access mode for \/data\/work-orders/i });
    await user.click(within(group).getByRole('button', { name: /read-only/i }));

    expect(onModeChange).toHaveBeenCalledWith('/data/work-orders', 'read-only');
  });

  it('marks the active mode with aria-pressed, distinctly per folder', () => {
    renderFolders();

    const readOnlyGroup = screen.getByRole('group', {
      name: /access mode for \/data\/inspection-reports/i,
    });
    expect(within(readOnlyGroup).getByRole('button', { name: /read-only/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(within(readOnlyGroup).getByRole('button', { name: /controlled/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    const controlledGroup = screen.getByRole('group', {
      name: /access mode for \/data\/work-orders/i,
    });
    expect(within(controlledGroup).getByRole('button', { name: /controlled/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(within(controlledGroup).getByRole('button', { name: /read-only/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('always labels the mode in words, never colour alone', () => {
    renderFolders();
    // Both words appear twice each (once per folder row's toggle pair).
    expect(screen.getAllByText('Read-only')).toHaveLength(2);
    expect(screen.getAllByText('Controlled')).toHaveLength(2);
  });

  it('adds a folder from the typed-path fallback when no native picker is wired', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderFolders();

    expect(screen.getByLabelText(/workspace folder path/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/workspace folder path/i), '/data/new-folder');
    await user.click(screen.getByRole('button', { name: /add a folder/i }));

    expect(onAdd).toHaveBeenCalledWith('/data/new-folder');
  });

  it('does not add an empty or whitespace-only path from the fallback form', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderFolders();

    await user.type(screen.getByLabelText(/workspace folder path/i), '   ');
    await user.click(screen.getByRole('button', { name: /add a folder/i }));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('uses the real native picker over IPC when window.electron exposes it', async () => {
    const user = userEvent.setup();
    const selectWorkspaceFolder = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ['/data/picked-folder'],
    });
    (window.electron as { selectWorkspaceFolder?: unknown }).selectWorkspaceFolder =
      selectWorkspaceFolder;

    const { onAdd } = renderFolders();

    // No typed-path input should render once the native picker is available.
    expect(screen.queryByLabelText(/workspace folder path/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add a folder/i }));

    expect(selectWorkspaceFolder).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('/data/picked-folder');
  });

  it('does not call onAdd when the native picker is cancelled', async () => {
    const user = userEvent.setup();
    const selectWorkspaceFolder = vi.fn().mockResolvedValue({ canceled: true, filePaths: [] });
    (window.electron as { selectWorkspaceFolder?: unknown }).selectWorkspaceFolder =
      selectWorkspaceFolder;

    const { onAdd } = renderFolders();
    await user.click(screen.getByRole('button', { name: /add a folder/i }));

    expect(selectWorkspaceFolder).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
