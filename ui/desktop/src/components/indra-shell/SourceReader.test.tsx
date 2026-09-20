import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SourceReader } from './SourceReader';

const boxes = [
  {
    doc_id: 'd1',
    version: 'v3',
    page: 4,
    bbox: [10, 20, 100, 24] as [number, number, number, number],
    conf: 0.94,
  },
  {
    doc_id: 'd1',
    version: 'v3',
    page: 4,
    bbox: [10, 60, 100, 24] as [number, number, number, number],
    conf: 0.41,
  },
];

describe('SourceReader', () => {
  it('hides the overlay when toggled off', () => {
    render(
      <SourceReader
        pageImageUrl="/p4.png"
        boxes={boxes}
        showOverlay={false}
        onToggleOverlay={vi.fn()}
        onBoxClick={vi.fn()}
      />
    );
    expect(screen.queryAllByTestId('ocr-box')).toHaveLength(0);
  });

  it('marks a low-confidence box as uncertain in text, not only colour', () => {
    render(
      <SourceReader
        pageImageUrl="/p4.png"
        boxes={boxes}
        showOverlay
        onToggleOverlay={vi.fn()}
        onBoxClick={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/low confidence/i)).toBeInTheDocument();
  });
});
