import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type WheelEvent,
} from 'react';
import type { IndraEvent } from '../../indra/events';
import { useReducedMotion } from '../../indra/useReducedMotion';
import {
  createLayoutNode,
  hitTest,
  nodesInLasso,
  radiusForCitations,
  ringWidthForClassification,
  tick,
  type LayoutNode,
  type Point,
} from '../../indra/memory/forceLayout';
import type { MemoryNode } from './MemoryLedger';

export type MemoryEdgeKind = 'derived-from' | 'references' | 'superseded-by';

export interface MemoryEdge {
  source: string;
  target: string;
  /** Relationship strength, 0..1 — drawn as edge weight (line thickness). */
  strength: number;
  kind: MemoryEdgeKind;
}

export interface ConstellationProps {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  /** Recent `memory.touch` events; the touched node(s) get a brief activity ring. */
  events?: IndraEvent[];
  onLassoSelect?: (ids: string[]) => void;
  onAskScope?: (ids: string[]) => void;
  onSaveView?: (ids: string[]) => void;
  onExportRefs?: (ids: string[]) => void;
}

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
// LOD thresholds, spec §9: below this zoom the graph is unreadable as
// individual nodes, so it collapses to per-department clusters and edges hide;
// above the label threshold there is enough screen space per node to set type.
const EDGE_HIDE_ZOOM = 0.4;
const LABEL_SHOW_ZOOM = 0.8;
// A settling budget rather than an indefinite loop: a plant corpus is 50k
// nodes, and ticking forever after the graph has stabilised only burns CPU.
const SETTLE_FRAMES = 180;
const REDUCED_MOTION_TICKS = 150;
// Below this screen-pixel drag distance, a pointer gesture reads as a click
// (single-node hit test) rather than a lasso.
const CLICK_THRESHOLD_PX = 4;

const EDGE_DASH: Record<MemoryEdgeKind, number[]> = {
  'derived-from': [],
  references: [6, 4],
  'superseded-by': [1, 4],
};

function cssVar(el: Element, name: string): string {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value.length > 0 ? value : '#888888';
}

interface Cluster {
  key: string;
  x: number;
  y: number;
  radius: number;
  count: number;
}

/** Below `EDGE_HIDE_ZOOM`, nodes cluster by ACL (the closest field this data
 * model has to "department") rather than rendering 50k individual dots. */
function computeClusters(
  layoutNodes: LayoutNode[],
  nodesById: Map<string, MemoryNode>
): Cluster[] {
  const groups = new Map<string, { x: number; y: number; count: number; citations: number }>();
  for (const node of layoutNodes) {
    const memoryNode = nodesById.get(node.id);
    const key = memoryNode?.acl ?? 'Unclassified';
    const group = groups.get(key) ?? { x: 0, y: 0, count: 0, citations: 0 };
    group.x += node.x;
    group.y += node.y;
    group.count += 1;
    group.citations += memoryNode?.citingSessions ?? 0;
    groups.set(key, group);
  }
  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    x: group.x / group.count,
    y: group.y / group.count,
    radius: radiusForCitations(group.citations) + Math.min(20, group.count),
    count: group.count,
  }));
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <button
      type="button"
      onClick={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        height: 24,
        padding: '0 var(--space-3)',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        color: 'var(--text-hi)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-12)',
        lineHeight: 'var(--t-12--line-height)',
        fontWeight: 500,
        cursor: 'pointer',
        outline: focused ? '2px solid var(--focus)' : 'none',
        outlineOffset: '2px',
      }}
    >
      {label}
    </button>
  );
}

function BarDot() {
  return (
    <span aria-hidden="true" style={{ color: 'var(--text-faint)' }}>
      ·
    </span>
  );
}

/**
 * Canvas 2D memory graph (Task 18). DOM/SVG cannot hold a 50k-node plant
 * corpus as live elements, so both the drawing and hit-testing (quadtree, in
 * `forceLayout.ts`) run against a plain pixel buffer instead.
 *
 * Lasso-to-scope is the reason this view exists (spec §11): dragging a region
 * selects the nodes inside it and raises the same floating action bar the
 * Memory ledger's shift-select produces, so a scope drawn here is immediately
 * actionable rather than decorative.
 */
export function Constellation({
  nodes,
  edges,
  events = [],
  onLassoSelect,
  onAskScope,
  onSaveView,
  onExportRefs,
}: ConstellationProps) {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const layoutRef = useRef<LayoutNode[]>([]);
  // MemoryEdge, not the narrower LayoutEdge tick() takes — draw() still needs
  // `kind` for edge style, and MemoryEdge is structurally assignable to
  // LayoutEdge wherever tick() is called with it.
  const edgesRef = useRef<MemoryEdge[]>([]);
  const nodesByIdRef = useRef<Map<string, MemoryNode>>(new Map());
  const touchedIdsRef = useRef<Set<string>>(new Set());
  const selectedIdsRef = useRef<Set<string>>(new Set());

  const zoomRef = useRef(1);
  const draggingRef = useRef(false);
  const lassoRef = useRef<Point[]>([]);
  const downClientRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const touchedIds = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i];
      if (event.t === 'memory.touch') return new Set(event.node_ids);
    }
    return new Set<string>();
  }, [events]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.max(1, Math.round(width * dpr));
    const targetHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const zoom = zoomRef.current;
    const centerX = width / 2;
    const centerY = height / 2;
    const toScreen = (point: Point): Point => ({
      x: centerX + point.x * zoom,
      y: centerY + point.y * zoom,
    });

    const lineStrong = cssVar(container, '--line-strong');
    const textHi = cssVar(container, '--text-hi');
    const textDim = cssVar(container, '--text-dim');
    const textFaint = cssVar(container, '--text-faint');
    const degraded = cssVar(container, '--degraded');
    const surface = cssVar(container, '--surface');

    const clustered = zoom < EDGE_HIDE_ZOOM;
    const showLabels = zoom >= LABEL_SHOW_ZOOM;

    if (clustered) {
      for (const cluster of computeClusters(layoutRef.current, nodesByIdRef.current)) {
        const { x, y } = toScreen(cluster);
        const radius = Math.max(cluster.radius * zoom, 3);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = textFaint;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = lineStrong;
        ctx.stroke();
      }
      return;
    }

    const byId = new Map(layoutRef.current.map((node) => [node.id, node]));

    for (const edge of edgesRef.current) {
      const a = byId.get(edge.source);
      const b = byId.get(edge.target);
      if (!a || !b) continue;
      const from = toScreen(a);
      const to = toScreen(b);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.lineWidth = Math.max(0.5, edge.strength * 3);
      ctx.setLineDash(EDGE_DASH[edge.kind]);
      ctx.strokeStyle = lineStrong;
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (showLabels) {
      ctx.font = `11px ${cssVar(container, '--font-ui')}`;
      ctx.textBaseline = 'middle';
    }

    for (const layoutNode of layoutRef.current) {
      const memoryNode = nodesByIdRef.current.get(layoutNode.id);
      if (!memoryNode) continue;
      const { x, y } = toScreen(layoutNode);
      const radius = Math.max(layoutNode.radius * zoom, 1.5);

      // Fill = cache state, in grayscale — the product is achromatic (§3.2),
      // so cache freshness is a shade, and `stale` earns a signal-colour dot
      // rather than a signal-colour fill (never more than 2px of chroma).
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      if (memoryNode.state === 'evicted') {
        ctx.strokeStyle = textFaint;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = memoryNode.state === 'cached' ? textHi : textDim;
        ctx.fill();
      }

      // Ring = classification, carried by stroke weight rather than hue.
      ctx.beginPath();
      ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
      ctx.strokeStyle = lineStrong;
      ctx.lineWidth = ringWidthForClassification(memoryNode.acl);
      ctx.stroke();

      if (memoryNode.state === 'stale') {
        ctx.beginPath();
        ctx.arc(x + radius * 0.6, y - radius * 0.6, 2, 0, Math.PI * 2);
        ctx.fillStyle = degraded;
        ctx.fill();
      }

      if (touchedIdsRef.current.has(layoutNode.id)) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = textHi;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (selectedIdsRef.current.has(layoutNode.id)) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = textHi;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (showLabels) {
        ctx.fillStyle = textDim;
        ctx.fillText(memoryNode.label, x + radius + 4, y);
      }
    }

    if (draggingRef.current && lassoRef.current.length > 1) {
      const points = lassoRef.current.map(toScreen);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.closePath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = textHi;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = surface;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }
  }, []);

  // Seed / reconcile the simulation whenever the node set changes: nodes that
  // survive keep their position, new ones land on a ring rather than all at
  // one point (coincident points defeat the hit-test quadtree).
  useEffect(() => {
    const previous = new Map(layoutRef.current.map((node) => [node.id, node]));
    const count = nodes.length;
    layoutRef.current = nodes.map((node, index) => {
      const radius = radiusForCitations(node.citingSessions);
      const existing = previous.get(node.id);
      if (existing) return { ...existing, radius };
      const angle = (index / Math.max(count, 1)) * Math.PI * 2;
      const placementRadius = 120 + (index % 5) * 40;
      return createLayoutNode(
        node.id,
        Math.cos(angle) * placementRadius,
        Math.sin(angle) * placementRadius,
        radius
      );
    });
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges.filter(
      (edge) => nodesById.has(edge.source) && nodesById.has(edge.target)
    );
  }, [edges, nodesById]);

  useEffect(() => {
    nodesByIdRef.current = nodesById;
  }, [nodesById]);

  useEffect(() => {
    touchedIdsRef.current = touchedIds;
  }, [touchedIds]);

  useEffect(() => {
    selectedIdsRef.current = new Set(selectedIds);
    draw();
  }, [selectedIds, draw]);

  useEffect(() => {
    let cancelled = false;

    const step = (frame: number) => {
      if (cancelled) return;
      layoutRef.current = tick(layoutRef.current, edgesRef.current);
      draw();
      if (frame < SETTLE_FRAMES) {
        frameRef.current = requestAnimationFrame(() => step(frame + 1));
      } else {
        frameRef.current = null;
      }
    };

    if (reducedMotion) {
      for (let i = 0; i < REDUCED_MOTION_TICKS; i += 1) {
        layoutRef.current = tick(layoutRef.current, edgesRef.current);
      }
      draw();
    } else {
      frameRef.current = requestAnimationFrame(() => step(0));
    }

    return () => {
      cancelled = true;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, reducedMotion, draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  const toWorld = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const zoom = zoomRef.current;
    return {
      x: (clientX - rect.left - rect.width / 2) / zoom,
      y: (clientY - rect.top - rect.height / 2) / zoom,
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      draggingRef.current = true;
      downClientRef.current = { x: event.clientX, y: event.clientY };
      lassoRef.current = [toWorld(event.clientX, event.clientY)];
      draw();
    },
    [draw, toWorld]
  );

  const handlePointerMove = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (!draggingRef.current) return;
      lassoRef.current = [...lassoRef.current, toWorld(event.clientX, event.clientY)];
      draw();
    },
    [draw, toWorld]
  );

  const handlePointerUp = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const polygon = lassoRef.current;
      lassoRef.current = [];
      const down = downClientRef.current;
      downClientRef.current = null;
      const dragDistance = down ? Math.hypot(event.clientX - down.x, event.clientY - down.y) : 0;

      if (dragDistance < CLICK_THRESHOLD_PX) {
        const point = toWorld(event.clientX, event.clientY);
        const hit = hitTest(point.x, point.y, layoutRef.current);
        const ids = hit ? [hit.id] : [];
        setSelectedIds(ids);
        onLassoSelect?.(ids);
        draw();
        return;
      }

      const ids = polygon.length >= 3 ? nodesInLasso(layoutRef.current, polygon) : [];
      setSelectedIds(ids);
      onLassoSelect?.(ids);
      draw();
    },
    [draw, onLassoSelect, toWorld]
  );

  const handlePointerLeave = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    lassoRef.current = [];
    downClientRef.current = null;
    draw();
  }, [draw]);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      zoomRef.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor));
      draw();
    },
    [draw]
  );

  return (
    <section
      aria-label="Memory constellation"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: 320,
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
      }}
    >
      <div ref={containerRef} style={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Memory constellation, ${nodes.length} nodes. Use the Memory ledger for a keyboard-accessible equivalent.`}
          tabIndex={0}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerLeave}
          onWheel={handleWheel}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: 'crosshair',
            outline: focused ? '2px solid var(--focus)' : 'none',
            outlineOffset: '-2px',
          }}
        />
      </div>

      {selectedIds.length > 0 ? (
        <div
          role="toolbar"
          aria-label="Selection actions"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 'var(--space-6)',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            height: 36,
            padding: '0 var(--space-4)',
            background: 'var(--raised)',
            border: '1px solid var(--line-strong)',
            borderRadius: 'var(--r-md)',
            color: 'var(--text)',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--t-12)',
            lineHeight: 'var(--t-12--line-height)',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-hi)', fontWeight: 500 }}
          >
            {selectedIds.length === 1 ? '1 node selected' : `${selectedIds.length} nodes selected`}
          </span>
          <BarDot />
          <ActionButton label="Ask about this scope" onPress={() => onAskScope?.(selectedIds)} />
          <BarDot />
          <ActionButton label="Save as view" onPress={() => onSaveView?.(selectedIds)} />
          <BarDot />
          <ActionButton label="Export refs" onPress={() => onExportRefs?.(selectedIds)} />
        </div>
      ) : null}
    </section>
  );
}
