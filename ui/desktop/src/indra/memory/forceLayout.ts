// Pure force-simulation and hit-testing math for the memory constellation
// (Task 18). Kept free of Canvas/DOM so it is unit-testable directly — the
// rendering surface (Constellation.tsx) is not: a plant corpus is 50k nodes,
// which DOM/SVG cannot hold as live elements, so the canvas owns drawing and
// this module owns everything that can be verified without one.

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Visual radius in canvas pixels — Task 18: radius encodes citation frequency. */
  radius: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
  /** Relationship strength, 0..1. Drives both spring pull and edge weight. */
  strength: number;
}

export interface TickOptions {
  idealLength?: number;
  springStrength?: number;
  repulsionStrength?: number;
  centerStrength?: number;
  damping?: number;
  dt?: number;
  center?: { x: number; y: number };
}

const DEFAULT_OPTIONS: Required<TickOptions> = {
  idealLength: 80,
  springStrength: 0.02,
  repulsionStrength: 1200,
  centerStrength: 0.002,
  damping: 0.85,
  dt: 1,
  center: { x: 0, y: 0 },
};

export function createLayoutNode(
  id: string,
  x: number,
  y: number,
  radius: number = MIN_HIT_RADIUS
): LayoutNode {
  return { id, x, y, vx: 0, vy: 0, radius };
}

/**
 * Advances the simulation by one step: mutual repulsion keeps the graph from
 * collapsing, edge springs pull connected nodes toward `idealLength` scaled by
 * relationship strength, and a weak centering force keeps the whole graph near
 * the viewport origin. Returns new node objects; does not mutate the input.
 */
export function tick(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: TickOptions = {}
): LayoutNode[] {
  const opts: Required<TickOptions> = { ...DEFAULT_OPTIONS, ...options };
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const forceX = new Map<string, number>();
  const forceY = new Map<string, number>();
  for (const node of nodes) {
    forceX.set(node.id, 0);
    forceY.set(node.id, 0);
  }

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let distSq = dx * dx + dy * dy;
      if (distSq < 0.0001) {
        // Coincident nodes: nudge deterministically instead of dividing by zero.
        dx = 0.01;
        dy = 0.01;
        distSq = dx * dx + dy * dy;
      }
      const dist = Math.sqrt(distSq);
      const repulsion = opts.repulsionStrength / distSq;
      const ux = dx / dist;
      const uy = dy / dist;
      forceX.set(a.id, forceX.get(a.id)! + ux * repulsion);
      forceY.set(a.id, forceY.get(a.id)! + uy * repulsion);
      forceX.set(b.id, forceX.get(b.id)! - ux * repulsion);
      forceY.set(b.id, forceY.get(b.id)! - uy * repulsion);
    }
  }

  for (const edge of edges) {
    const a = byId.get(edge.source);
    const b = byId.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
    const displacement = dist - opts.idealLength;
    const spring = displacement * opts.springStrength * edge.strength;
    const ux = dx / dist;
    const uy = dy / dist;
    forceX.set(a.id, forceX.get(a.id)! + ux * spring);
    forceY.set(a.id, forceY.get(a.id)! + uy * spring);
    forceX.set(b.id, forceX.get(b.id)! - ux * spring);
    forceY.set(b.id, forceY.get(b.id)! - uy * spring);
  }

  for (const node of nodes) {
    forceX.set(node.id, forceX.get(node.id)! + (opts.center.x - node.x) * opts.centerStrength);
    forceY.set(node.id, forceY.get(node.id)! + (opts.center.y - node.y) * opts.centerStrength);
  }

  return nodes.map((node) => {
    const vx = (node.vx + forceX.get(node.id)! * opts.dt) * opts.damping;
    const vy = (node.vy + forceY.get(node.id)! * opts.dt) * opts.damping;
    return {
      ...node,
      vx,
      vy,
      x: node.x + vx * opts.dt,
      y: node.y + vy * opts.dt,
    };
  });
}

/**
 * Minimum click/tap target regardless of visual size (Task 18): a node drawn
 * at 2px radius must still be as easy to hit as one drawn at 12px.
 */
export const MIN_HIT_RADIUS = 12;

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boundsContainsPoint(bounds: Bounds, x: number, y: number): boolean {
  return (
    x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height
  );
}

function boundsIntersectsCircle(bounds: Bounds, cx: number, cy: number, radius: number): boolean {
  const closestX = Math.max(bounds.x, Math.min(cx, bounds.x + bounds.width));
  const closestY = Math.max(bounds.y, Math.min(cy, bounds.y + bounds.height));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

// Node capacity per leaf before a quadrant splits.
const QUAD_CAPACITY = 8;
// Caps recursion so a cluster of coincident points (e.g. before the first
// layout tick runs) cannot subdivide forever.
const QUAD_MAX_DEPTH = 10;

/**
 * Quadtree over node positions, used only to narrow the candidate set before
 * the exact-distance check in `hitTest`. This is what lets hit-testing stay
 * cheap at a 50k-node plant corpus (§9) instead of scanning every node on
 * every pointer move.
 */
class Quadtree {
  private readonly bounds: Bounds;
  private readonly depth: number;
  private points: LayoutNode[] = [];
  private children: Quadtree[] | null = null;

  constructor(bounds: Bounds, depth: number = 0) {
    this.bounds = bounds;
    this.depth = depth;
  }

  insert(node: LayoutNode): boolean {
    if (!boundsContainsPoint(this.bounds, node.x, node.y)) return false;

    if (this.children === null) {
      if (this.points.length < QUAD_CAPACITY || this.depth >= QUAD_MAX_DEPTH) {
        this.points.push(node);
        return true;
      }
      this.subdivide();
    }

    for (const child of this.children!) {
      if (child.insert(node)) return true;
    }
    // Falls between quadrants only from floating-point edge cases; keep it
    // rather than drop it silently.
    this.points.push(node);
    return true;
  }

  private subdivide(): void {
    const { x, y, width, height } = this.bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    this.children = [
      new Quadtree({ x, y, width: halfWidth, height: halfHeight }, this.depth + 1),
      new Quadtree({ x: x + halfWidth, y, width: halfWidth, height: halfHeight }, this.depth + 1),
      new Quadtree({ x, y: y + halfHeight, width: halfWidth, height: halfHeight }, this.depth + 1),
      new Quadtree(
        { x: x + halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight },
        this.depth + 1
      ),
    ];
    const existing = this.points;
    this.points = [];
    for (const point of existing) {
      let placed = false;
      for (const child of this.children) {
        if (child.insert(point)) {
          placed = true;
          break;
        }
      }
      if (!placed) this.points.push(point);
    }
  }

  queryRadius(cx: number, cy: number, radius: number, found: LayoutNode[]): void {
    if (!boundsIntersectsCircle(this.bounds, cx, cy, radius)) return;
    for (const point of this.points) {
      const dx = point.x - cx;
      const dy = point.y - cy;
      if (dx * dx + dy * dy <= radius * radius) found.push(point);
    }
    if (this.children) {
      for (const child of this.children) child.queryRadius(cx, cy, radius, found);
    }
  }
}

function computeBounds(nodes: LayoutNode[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    if (node.x < minX) minX = node.x;
    if (node.y < minY) minY = node.y;
    if (node.x > maxX) maxX = node.x;
    if (node.y > maxY) maxY = node.y;
  }
  const pad = 1;
  return {
    x: minX - pad,
    y: minY - pad,
    width: Math.max(maxX - minX, 0) + pad * 2,
    height: Math.max(maxY - minY, 0) + pad * 2,
  };
}

/**
 * Returns the node under (x, y), or null. Every node's effective hit radius
 * is at least `MIN_HIT_RADIUS` regardless of its drawn radius, so a node
 * rendered small because it is rarely cited is not effectively unclickable.
 * When multiple nodes' hit areas overlap the point, the nearest one wins.
 */
export function hitTest(x: number, y: number, nodes: LayoutNode[]): LayoutNode | null {
  if (nodes.length === 0) return null;

  const tree = new Quadtree(computeBounds(nodes));
  let maxRadius = MIN_HIT_RADIUS;
  for (const node of nodes) {
    tree.insert(node);
    if (node.radius > maxRadius) maxRadius = node.radius;
  }

  const candidates: LayoutNode[] = [];
  tree.queryRadius(x, y, maxRadius, candidates);

  let closest: LayoutNode | null = null;
  let closestDist = Infinity;
  for (const node of candidates) {
    const dx = node.x - x;
    const dy = node.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hitRadius = Math.max(node.radius, MIN_HIT_RADIUS);
    if (dist <= hitRadius && dist < closestDist) {
      closest = node;
      closestDist = dist;
    }
  }
  return closest;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Point-in-polygon test (ray casting), used to resolve a freeform lasso drag
 * into the set of enclosed node ids. Kept pure and separate from pointer
 * handling so the drag gesture in Constellation.tsx has nothing left to get
 * wrong beyond collecting the path.
 */
export function nodesInLasso(
  nodes: ReadonlyArray<{ id: string; x: number; y: number }>,
  polygon: ReadonlyArray<Point>
): string[] {
  if (polygon.length < 3) return [];
  const selected: string[] = [];
  for (const node of nodes) {
    if (pointInPolygon(node, polygon)) selected.push(node.id);
  }
  return selected;
}

function pointInPolygon(point: Point, polygon: ReadonlyArray<Point>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

const MIN_NODE_RADIUS = 4;
const MAX_NODE_RADIUS = 28;

/**
 * Maps citation count to drawn radius (Task 18: "radius = citation
 * frequency"). Logarithmic so one heavily-cited node cannot dwarf a 50k-node
 * canvas — linear scaling would make everything else invisible by comparison.
 */
export function radiusForCitations(citingSessions: number): number {
  const safe = Math.max(0, citingSessions);
  const scaled = MIN_NODE_RADIUS + Math.log2(safe + 1) * 5;
  return Math.min(MAX_NODE_RADIUS, Math.max(MIN_NODE_RADIUS, scaled));
}

const RING_WIDTHS = [1, 2, 3] as const;

/**
 * Deterministically maps an ACL/classification string to one of a small set
 * of ring stroke widths. The product is achromatic (§3.2) — classification
 * cannot be a hue — so it is carried by ring weight instead of colour.
 */
export function ringWidthForClassification(acl: string): number {
  let hash = 0;
  for (let i = 0; i < acl.length; i += 1) {
    hash = (hash * 31 + acl.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % RING_WIDTHS.length;
  return RING_WIDTHS[index];
}
