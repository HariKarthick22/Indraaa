import { describe, expect, it } from 'vitest';
import {
  createLayoutNode,
  hitTest,
  MIN_HIT_RADIUS,
  nodesInLasso,
  radiusForCitations,
  ringWidthForClassification,
  tick,
  type LayoutEdge,
} from './forceLayout';

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('tick', () => {
  it('pulls two connected nodes closer together over one step', () => {
    const nodes = [createLayoutNode('a', 0, 0), createLayoutNode('b', 300, 0)];
    const edges: LayoutEdge[] = [{ source: 'a', target: 'b', strength: 1 }];

    const before = distance(nodes[0], nodes[1]);
    const [a, b] = tick(nodes, edges);
    const after = distance(a, b);

    expect(after).toBeLessThan(before);
  });

  it('preserves node identity and count', () => {
    const nodes = [createLayoutNode('a', 0, 0), createLayoutNode('b', 40, 40)];
    const result = tick(nodes, []);

    expect(result.map((node) => node.id)).toEqual(['a', 'b']);
  });

  it('pushes unconnected overlapping nodes apart via repulsion', () => {
    const nodes = [createLayoutNode('a', 0, 0), createLayoutNode('b', 1, 0)];
    const before = distance(nodes[0], nodes[1]);
    const [a, b] = tick(nodes, []);
    const after = distance(a, b);

    expect(after).toBeGreaterThan(before);
  });

  it('does not mutate the input nodes', () => {
    const nodes = [createLayoutNode('a', 0, 0), createLayoutNode('b', 300, 0)];
    const snapshot = nodes.map((node) => ({ ...node }));
    tick(nodes, [{ source: 'a', target: 'b', strength: 1 }]);

    expect(nodes).toEqual(snapshot);
  });
});

describe('hitTest', () => {
  it('finds a node within the minimum hit radius even when its visual radius is tiny', () => {
    const nodes = [createLayoutNode('a', 0, 0, 2)];
    expect(hitTest(0, MIN_HIT_RADIUS - 1, nodes)?.id).toBe('a');
  });

  it('returns null when no node is within reach', () => {
    const nodes = [createLayoutNode('a', 1000, 1000, 5)];
    expect(hitTest(0, 0, nodes)).toBeNull();
  });

  it('returns null for an empty node list', () => {
    expect(hitTest(0, 0, [])).toBeNull();
  });

  it('prefers the nearer of two candidate nodes', () => {
    const nodes = [createLayoutNode('near', 1, 1, 5), createLayoutNode('far', 3, 3, 5)];
    expect(hitTest(0, 0, nodes)?.id).toBe('near');
  });

  it('respects a large visual radius beyond the minimum', () => {
    const nodes = [createLayoutNode('big', 0, 0, 25)];
    expect(hitTest(20, 0, nodes)?.id).toBe('big');
  });

  it('holds up with a larger, scattered node set', () => {
    const nodes = Array.from({ length: 200 }, (_, i) =>
      createLayoutNode(`n${i}`, (i % 20) * 15, Math.floor(i / 20) * 15, 3)
    );
    expect(hitTest(0, 0, nodes)?.id).toBe('n0');
    expect(hitTest(10_000, 10_000, nodes)).toBeNull();
  });
});

describe('nodesInLasso', () => {
  const square = [
    { x: -10, y: -10 },
    { x: 10, y: -10 },
    { x: 10, y: 10 },
    { x: -10, y: 10 },
  ];

  it('selects nodes inside the polygon and excludes nodes outside it', () => {
    const nodes = [
      { id: 'inside', x: 0, y: 0 },
      { id: 'outside', x: 100, y: 100 },
    ];

    expect(nodesInLasso(nodes, square)).toEqual(['inside']);
  });

  it('returns nothing for a degenerate polygon', () => {
    const nodes = [{ id: 'inside', x: 0, y: 0 }];
    expect(nodesInLasso(nodes, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([]);
  });
});

describe('radiusForCitations', () => {
  it('gives an uncited node the minimum radius', () => {
    expect(radiusForCitations(0)).toBe(4);
  });

  it('grows with citation count without exceeding the cap', () => {
    expect(radiusForCitations(1000)).toBe(28);
    expect(radiusForCitations(50)).toBeGreaterThan(radiusForCitations(5));
  });

  it('never returns a radius below the minimum for negative input', () => {
    expect(radiusForCitations(-5)).toBe(4);
  });
});

describe('ringWidthForClassification', () => {
  it('is deterministic for the same classification string', () => {
    expect(ringWidthForClassification('Inspection')).toBe(ringWidthForClassification('Inspection'));
  });

  it('always returns one of the three defined ring widths', () => {
    for (const acl of ['Inspection', 'Reliability', 'Restricted', 'Public', '']) {
      expect([1, 2, 3]).toContain(ringWidthForClassification(acl));
    }
  });
});
