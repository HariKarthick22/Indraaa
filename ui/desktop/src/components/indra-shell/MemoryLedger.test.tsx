import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryLedger, formatLedgerBytes, type MemoryNode } from './MemoryLedger';

const nodes: MemoryNode[] = [
  {
    id: 'n1',
    label: 'NDT_2026_08.pdf',
    version: 'v3',
    hashPrefix: '7f3a',
    bytes: 412,
    acl: 'Inspection',
    lastCited: '2026-09-14',
    citingSessions: 3,
    state: 'cached',
  },
  {
    id: 'n2',
    label: 'P-101_datasheet.pdf',
    version: 'v1',
    hashPrefix: '91bd',
    bytes: 8192,
    acl: 'Reliability',
    lastCited: '2026-09-02',
    citingSessions: 11,
    state: 'stale',
  },
  {
    id: 'n3',
    label: 'Historian_Export.csv',
    version: 'v2',
    hashPrefix: 'c04e',
    bytes: 1200,
    acl: 'Inspection',
    lastCited: '2026-08-21',
    citingSessions: 0,
    state: 'evicted',
  },
];

function renderLedger(overrides: Partial<React.ComponentProps<typeof MemoryLedger>> = {}) {
  const onSelectionChange = vi.fn();
  const utils = render(
    <MemoryLedger nodes={nodes} selectedIds={[]} onSelectionChange={onSelectionChange} {...overrides} />
  );
  return { ...utils, onSelectionChange };
}

function rowLabels(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent ?? '');
}

describe('MemoryLedger', () => {
  it('shows hash prefix and citing session count', () => {
    renderLedger();

    expect(screen.getByText('7f3a')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders every ledger column the spec names', () => {
    renderLedger();

    for (const header of [
      'Node',
      'Version',
      'Hash',
      'Bytes',
      'ACL',
      'Last cited',
      'Sessions',
      'State',
    ]) {
      expect(screen.getByRole('columnheader', { name: new RegExp(header) })).toBeInTheDocument();
    }
  });

  it('carries the state as a word, never colour alone', () => {
    renderLedger();
    expect(screen.getByText('Stale')).toBeInTheDocument();
    expect(screen.getByText('Evicted')).toBeInTheDocument();
  });

  it('sorts by a numeric column and reverses on a second click', async () => {
    const user = userEvent.setup();
    renderLedger();

    const bytesHeader = screen.getByRole('columnheader', { name: /Bytes/ });
    await user.click(within(bytesHeader).getByRole('button'));
    expect(bytesHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(rowLabels()).toEqual([
      'NDT_2026_08.pdf',
      'Historian_Export.csv',
      'P-101_datasheet.pdf',
    ]);

    await user.click(within(bytesHeader).getByRole('button'));
    expect(bytesHeader).toHaveAttribute('aria-sort', 'descending');
    expect(rowLabels()).toEqual([
      'P-101_datasheet.pdf',
      'Historian_Export.csv',
      'NDT_2026_08.pdf',
    ]);
  });

  it('filters on every column independently', async () => {
    const user = userEvent.setup();
    renderLedger();

    await user.type(screen.getByLabelText('Filter ACL'), 'reliab');
    expect(rowLabels()).toEqual(['P-101_datasheet.pdf']);

    await user.clear(screen.getByLabelText('Filter ACL'));
    await user.type(screen.getByLabelText('Filter State'), 'evicted');
    expect(rowLabels()).toEqual(['Historian_Export.csv']);
  });

  it('shift-clicking a row extends the selection across the range', () => {
    const { onSelectionChange } = renderLedger({ selectedIds: ['n1'] });

    const rows = screen.getAllByRole('row').slice(1);
    fireEvent.click(rows[2], { shiftKey: true });

    expect(onSelectionChange).toHaveBeenCalledWith(['n1', 'n2', 'n3']);
  });

  it('raises the floating action bar for the current selection', () => {
    renderLedger({ selectedIds: ['n1', 'n2'] });

    const bar = screen.getByRole('toolbar', { name: 'Selection actions' });
    expect(within(bar).getByText('2 nodes selected')).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Ask about this scope' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Save as view' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Export refs' })).toBeInTheDocument();
  });

  it('hides the action bar when nothing is selected', () => {
    renderLedger();
    expect(screen.queryByRole('toolbar', { name: 'Selection actions' })).not.toBeInTheDocument();
  });

  it('moves the selection with the arrow keys, so the ledger is a peer of the constellation', () => {
    const { onSelectionChange } = renderLedger({ selectedIds: ['n1'] });

    fireEvent.keyDown(screen.getAllByRole('row')[1], { key: 'ArrowDown' });
    expect(onSelectionChange).toHaveBeenCalledWith(['n2']);
  });

  it('extends the selection with shift-arrow, the keyboard equivalent of the lasso', () => {
    const { onSelectionChange } = renderLedger({ selectedIds: ['n1'] });

    fireEvent.keyDown(screen.getAllByRole('row')[1], { key: 'ArrowDown', shiftKey: true });
    expect(onSelectionChange).toHaveBeenCalledWith(['n1', 'n2']);
  });

  it('toggles a row with the space key', () => {
    const { onSelectionChange } = renderLedger({ selectedIds: ['n1'] });

    fireEvent.keyDown(screen.getAllByRole('row')[2], { key: ' ' });
    expect(onSelectionChange).toHaveBeenCalledWith(['n1', 'n2']);
  });

  it('virtualises long lists instead of rendering every row', () => {
    const many: MemoryNode[] = Array.from({ length: 500 }, (_, i) => ({
      ...nodes[0],
      id: `m${i}`,
      label: `node_${i}.pdf`,
    }));
    renderLedger({ nodes: many });

    const rendered = screen.getAllByRole('row').length - 1;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(many.length);
  });

  it('names the next action when the ledger is empty', () => {
    renderLedger({ nodes: [] });
    expect(screen.getByText(/No memory nodes yet/i)).toBeInTheDocument();
  });
});

describe('formatLedgerBytes', () => {
  it('keeps small counts in bytes and large ones in kB', () => {
    expect(formatLedgerBytes(412)).toBe('412 B');
    expect(formatLedgerBytes(8192)).toBe('8.2 kB');
  });
});
