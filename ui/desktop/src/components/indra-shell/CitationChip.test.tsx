import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CitationChip } from './CitationChip';

const source = {
  doc_id: 'NDT_2026_08.pdf',
  version: 'v3',
  page: 4,
  bbox: [100, 220, 400, 24] as [number, number, number, number],
  conf: 0.91,
};

describe('CitationChip', () => {
  it('renders the bracketed index', () => {
    render(<CitationChip index={1} source={source} onOpen={vi.fn()} />);
    expect(screen.getByRole('button', { name: /citation 1/i })).toHaveTextContent('⟦1⟧');
  });

  it('marks a low-confidence citation', () => {
    render(<CitationChip index={2} source={{ ...source, conf: 0.42 }} onOpen={vi.fn()} />);
    expect(screen.getByLabelText(/low confidence/i)).toBeInTheDocument();
  });

  it('does not mark a confident citation', () => {
    render(<CitationChip index={3} source={source} onOpen={vi.fn()} />);
    expect(screen.queryByLabelText(/low confidence/i)).not.toBeInTheDocument();
  });
});
