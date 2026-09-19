import { describe, expect, it, vi } from 'vitest';
import {
  buildPaletteIndex,
  fuzzyMatch,
  searchPalette,
  type PaletteEntry,
} from './paletteIndex';

function entry(id: string, label: string, kind: PaletteEntry['kind']): PaletteEntry {
  return { id, label, kind, run: vi.fn() };
}

describe('fuzzyMatch', () => {
  it('matches a subsequence and reports the matched ranges', () => {
    const match = fuzzyMatch('sov', 'Go to Sovereignty');
    expect(match).not.toBeNull();
    expect(match!.ranges).toEqual([[6, 9]]);
  });

  it('ignores case in both directions', () => {
    expect(fuzzyMatch('SOV', 'Go to Sovereignty')).not.toBeNull();
    expect(fuzzyMatch('gtw', 'Go To Work')).not.toBeNull();
  });

  it('returns null when a character is missing', () => {
    expect(fuzzyMatch('sov', 'Go to Work')).toBeNull();
  });

  it('matches a skill past its leading slash', () => {
    expect(fuzzyMatch('ndt', '/ndt-review')).not.toBeNull();
  });

  it('scores a contiguous run above a scattered one', () => {
    const contiguous = fuzzyMatch('ndt', '/ndt-review');
    const scattered = fuzzyMatch('ndt', 'node detach target');
    expect(contiguous!.score).toBeGreaterThan(scattered!.score);
  });

  it('scores a word-start match above a mid-word one', () => {
    const wordStart = fuzzyMatch('rev', 'P-101 review');
    const midWord = fuzzyMatch('rev', 'unreviewed draft');
    expect(wordStart!.score).toBeGreaterThan(midWord!.score);
  });

  it('treats an empty query as a match with no ranges', () => {
    const match = fuzzyMatch('', 'anything');
    expect(match).toEqual({ score: 0, ranges: [] });
  });
});

describe('searchPalette', () => {
  const entries = [
    entry('work', 'Go to Work', 'destination'),
    entry('sov', 'Go to Sovereignty', 'destination'),
    entry('ndt', '/ndt-review', 'skill'),
    entry('doc', 'P-101 inspection report', 'document'),
  ];

  it('returns every entry in index order for an empty query', () => {
    expect(searchPalette(entries, '').map((m) => m.entry.id)).toEqual([
      'work',
      'sov',
      'ndt',
      'doc',
    ]);
  });

  it('drops entries that do not match', () => {
    expect(searchPalette(entries, 'sov').map((m) => m.entry.id)).toEqual(['sov']);
  });

  it('searches one flat index across every kind at once', () => {
    const ids = searchPalette(entries, 'o').map((m) => m.entry.id);
    expect(ids).toContain('work');
    expect(ids).toContain('doc');
  });

  it('also matches against the hint', () => {
    const withHint: PaletteEntry[] = [
      { id: 'r1', label: 'Wall thickness sweep', kind: 'recipe', hint: 'saved recipe', run: vi.fn() },
    ];
    expect(searchPalette(withHint, 'saved')).toHaveLength(1);
  });

  it('ranks the better match first', () => {
    const ranked = searchPalette(entries, 'go');
    expect(ranked[0].entry.id).toBe('work');
  });
});

describe('buildPaletteIndex', () => {
  it('flattens every source kind into one index', () => {
    const go = vi.fn();
    const index = buildPaletteIndex({
      destinations: [{ id: 'work', label: 'Work', go }],
      sessions: [{ id: 's1', title: 'P-101 fit-for-service', open: vi.fn() }],
      documents: [{ id: 'd1', title: 'NDT report', page: 4, open: vi.fn() }],
      skills: [{ name: 'ndt-review', description: 'Review an NDT report', run: vi.fn() }],
      recipes: [{ id: 'r1', title: 'Wall thickness sweep', run: vi.fn() }],
      themes: [{ id: 't1', label: 'Ash Dark', apply: vi.fn() }],
      scopes: [{ id: 'sc1', label: 'Unit 4 subgraph', apply: vi.fn() }],
    });

    expect(index.map((e) => e.kind)).toEqual([
      'destination',
      'session',
      'document',
      'skill',
      'recipe',
      'theme',
      'scope',
    ]);
    expect(index[0].label).toBe('Go to Work');
    expect(index[3].label).toBe('/ndt-review');
    expect(index[2].hint).toBe('page 4');

    index[0].run();
    expect(go).toHaveBeenCalledOnce();
  });

  it('tolerates missing source groups', () => {
    expect(buildPaletteIndex({})).toEqual([]);
  });

  it('gives every entry a unique id', () => {
    const index = buildPaletteIndex({
      destinations: [{ id: 'x', label: 'Work', go: vi.fn() }],
      sessions: [{ id: 'x', title: 'Work', open: vi.fn() }],
    });
    expect(new Set(index.map((e) => e.id)).size).toBe(2);
  });
});
