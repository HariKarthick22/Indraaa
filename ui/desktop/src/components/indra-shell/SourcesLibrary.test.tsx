import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SourcesLibrary, type DocumentSummary } from './SourcesLibrary';

const documents: DocumentSummary[] = [
  {
    id: 'd1',
    title: 'NDT_2026_08.pdf',
    kind: 'pdf',
    version: 'v3',
    indexed: true,
    classification: 'Internal',
    pages: 12,
    sealed: false,
  },
  {
    id: 'd2',
    title: 'Historian_Export.csv',
    kind: 'csv',
    version: 'v1',
    indexed: true,
    classification: 'Restricted',
    pages: 1,
    sealed: true,
    sealedPolicy: 'OT boundary — Purdue L3',
  },
];

function renderLibrary(overrides: Partial<React.ComponentProps<typeof SourcesLibrary>> = {}) {
  const onOpen = vi.fn();
  const onViewChange = vi.fn();
  const utils = render(
    <SourcesLibrary
      documents={documents}
      view="list"
      onOpen={onOpen}
      onViewChange={onViewChange}
      {...overrides}
    />
  );
  return { ...utils, onOpen, onViewChange };
}

describe('SourcesLibrary', () => {
  it('lists documents with version and page count', () => {
    renderLibrary();

    expect(screen.getByText('NDT_2026_08.pdf')).toBeInTheDocument();
    expect(screen.getByText(/12 pages/)).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();
  });

  it('names the policy on a sealed document rather than saying no permission', () => {
    renderLibrary();

    expect(screen.getByLabelText(/OT boundary — Purdue L3/)).toBeInTheDocument();
    expect(screen.queryByText(/no permission/i)).not.toBeInTheDocument();
  });

  it('carries the word "Sealed" beside the lock so colour is never the only signal', () => {
    renderLibrary();

    const seal = screen.getByLabelText(/OT boundary — Purdue L3/);
    expect(seal).toHaveTextContent('Sealed');
    expect(seal).toHaveAttribute('title', expect.stringContaining('OT boundary — Purdue L3'));
  });

  it('uses the singular for a one-page document', () => {
    renderLibrary();
    expect(screen.getByText(/1 page$/)).toBeInTheDocument();
  });

  it('marks the current view and requests the other one', async () => {
    const user = userEvent.setup();
    const { onViewChange } = renderLibrary();

    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    await user.click(screen.getByRole('button', { name: 'Grid view' }));
    expect(onViewChange).toHaveBeenCalledWith('grid');
  });

  it('renders documents in grid view too', () => {
    renderLibrary({ view: 'grid' });
    expect(screen.getByText('NDT_2026_08.pdf')).toBeInTheDocument();
    expect(screen.getByLabelText(/OT boundary — Purdue L3/)).toBeInTheDocument();
  });

  it('opens a document by id, sealed ones included, because a named policy is actionable', async () => {
    const user = userEvent.setup();
    const { onOpen } = renderLibrary();

    await user.click(screen.getByRole('button', { name: /Historian_Export\.csv/ }));
    expect(onOpen).toHaveBeenCalledWith('d2');
  });

  it('names the next action when the library is empty', () => {
    renderLibrary({ documents: [], onAddSource: vi.fn() });

    expect(screen.getByText(/No documents indexed yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a source' })).toBeInTheDocument();
  });
});
