export interface GraphNode {
  id: number;
  neighbors: number[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: [number, number][];
}

export type TraversalMode = 'bfs' | 'dfs';

interface LayoutPoint {
  x: number;
  y: number;
}

export function parseGraph(input: string): GraphData | null {
  const lines = input.trim().split('\n').filter(l => l.trim());
  const nodes: GraphNode[] = [];
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];

  for (const line of lines) {
    const match = line.match(/Node\s+(\d+)\s*:\s*\(([^)]*)\)/i);
    if (!match) return null;

    const id = parseInt(match[1]);
    const neighborStr = match[2].trim();
    const neighbors = neighborStr
      ? neighborStr.split(',').map(s => parseInt(s.trim()))
      : [];

    nodes.push({ id, neighbors });
  }

  for (const node of nodes) {
    for (const neighbor of node.neighbors) {
      const key = [Math.min(node.id, neighbor), Math.max(node.id, neighbor)].join('-');
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push([node.id, neighbor]);
      }
    }
  }

  return { nodes, edges };
}

export function buildTraversalOrder(
  nodes: GraphNode[],
  sourceId: number,
  mode: TraversalMode
): number[] {
  const nodeIds = new Set(nodes.map(node => node.id));
  if (!nodeIds.has(sourceId)) return [];

  const adjacency = new Map(nodes.map(node => [node.id, node.neighbors.filter(neighbor => nodeIds.has(neighbor))]));
  const visited = new Set<number>();
  const order: number[] = [];

  if (mode === 'bfs') {
    const queue = [sourceId];
    visited.add(sourceId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }

    return order;
  }

  const stack = [sourceId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;

    visited.add(current);
    order.push(current);

    const neighbors = adjacency.get(current) ?? [];
    for (let index = neighbors.length - 1; index >= 0; index--) {
      const neighbor = neighbors[index];
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }

  return order;
}

export function computeLayout(
  nodes: GraphNode[],
  width: number,
  height: number,
  layoutSeed = 0
): Map<number, { x: number; y: number }> {
  const n = nodes.length;
  const edges = buildUniqueEdges(nodes);

  if (n === 0) return new Map<number, LayoutPoint>();

  const attempts = n <= 16 ? 8 : n <= 30 ? 5 : 3;
  let bestLayout: Map<number, LayoutPoint> | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const random = createRandom(
      deriveLayoutSeed(nodes, width, height, layoutSeed + attempt * 9973)
    );
    const positions = createRandomSeedLayout(nodes, width, height, random);
    runForceLayout(positions, nodes, edges, width, height);
    compactLayout(positions, width, height, n);

    const score = scoreLayout(positions, nodes, edges);
    if (score < bestScore) {
      bestScore = score;
      bestLayout = cloneLayout(positions);
    }
  }

  return bestLayout ?? new Map<number, LayoutPoint>();
}

function buildUniqueEdges(nodes: GraphNode[]): [number, number][] {
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];

  for (const node of nodes) {
    for (const neighbor of node.neighbors) {
      const edge: [number, number] = [
        Math.min(node.id, neighbor),
        Math.max(node.id, neighbor),
      ];
      const key = edge.join("-");
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push(edge);
    }
  }

  return edges;
}

function createRandomSeedLayout(
  nodes: GraphNode[],
  width: number,
  height: number,
  random: () => number
): Map<number, LayoutPoint> {
  const positions = new Map<number, LayoutPoint>();
  const padding = 90;
  const spreadW = Math.max(220, (width - padding * 2) * 0.52);
  const spreadH = Math.max(220, (height - padding * 2) * 0.52);
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const rows = Math.max(1, Math.ceil(nodes.length / cols));
  const cellW = spreadW / cols;
  const cellH = spreadH / rows;
  const startX = width / 2 - spreadW / 2;
  const startY = height / 2 - spreadH / 2;
  const shuffled = [...nodes];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  shuffled.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const jitterX = (random() - 0.5) * cellW * 0.45;
    const jitterY = (random() - 0.5) * cellH * 0.45;
    positions.set(node.id, {
      x: startX + cellW * (col + 0.5) + jitterX,
      y: startY + cellH * (row + 0.5) + jitterY,
    });
  });

  return positions;
}

function runForceLayout(
  positions: Map<number, LayoutPoint>,
  nodes: GraphNode[],
  edges: [number, number][],
  width: number,
  height: number
) {
  const padding = 90;
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  const centerX = width / 2;
  const centerY = height / 2;
  const k = Math.sqrt((innerW * innerH) / Math.max(nodes.length, 1)) * 0.68;
  const iterations = nodes.length <= 18 ? 260 : 180;
  const collisionDistance = 72;

  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<number, LayoutPoint>();
    nodes.forEach(node => forces.set(node.id, { x: 0, y: 0 }));

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions.get(nodes[i].id)!;
        const b = positions.get(nodes[j].id)!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.max(Math.hypot(dx, dy), 0.1);
        const repulsion = (k * k) / dist;
        const fa = forces.get(nodes[i].id)!;
        const fb = forces.get(nodes[j].id)!;

        fa.x += (dx / dist) * repulsion;
        fa.y += (dy / dist) * repulsion;
        fb.x -= (dx / dist) * repulsion;
        fb.y -= (dy / dist) * repulsion;
      }
    }

    for (const [aId, bId] of edges) {
      const a = positions.get(aId);
      const b = positions.get(bId);
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.hypot(dx, dy), 0.1);
      const attraction = (dist * dist) / (k * 1.35);
      const fa = forces.get(aId)!;
      const fb = forces.get(bId)!;

      fa.x += (dx / dist) * attraction;
      fa.y += (dy / dist) * attraction;
      fb.x -= (dx / dist) * attraction;
      fb.y -= (dy / dist) * attraction;
    }

    nodes.forEach(node => {
      const pos = positions.get(node.id)!;
      const force = forces.get(node.id)!;
      force.x += (centerX - pos.x) * 0.025;
      force.y += (centerY - pos.y) * 0.025;
    });

    const temperature = Math.max(1.5, 24 * (1 - iter / iterations));
    nodes.forEach(node => {
      const pos = positions.get(node.id)!;
      const force = forces.get(node.id)!;
      const magnitude = Math.max(Math.hypot(force.x, force.y), 0.1);
      pos.x += (force.x / magnitude) * Math.min(magnitude, temperature);
      pos.y += (force.y / magnitude) * Math.min(magnitude, temperature);
    });

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions.get(nodes[i].id)!;
        const b = positions.get(nodes[j].id)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.hypot(dx, dy), 0.1);
        if (dist >= collisionDistance) continue;

        const push = (collisionDistance - dist) * 0.5;
        const ux = dx / dist;
        const uy = dy / dist;

        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }

    positions.forEach(point => {
      point.x = clamp(point.x, padding, width - padding);
      point.y = clamp(point.y, padding, height - padding);
    });
  }
}

function compactLayout(
  positions: Map<number, LayoutPoint>,
  width: number,
  height: number,
  nodeCount: number
) {
  const padding = 90;
  const bounds = getBounds(positions);
  const currentW = Math.max(bounds.maxX - bounds.minX, 1);
  const currentH = Math.max(bounds.maxY - bounds.minY, 1);
  const fillRatio = nodeCount <= 6 ? 0.34 : nodeCount <= 12 ? 0.42 : nodeCount <= 24 ? 0.52 : 0.62;
  const targetW = Math.max(220, (width - padding * 2) * fillRatio);
  const targetH = Math.max(220, (height - padding * 2) * fillRatio);
  const scale = Math.min(targetW / currentW, targetH / currentH);
  const currentCenterX = (bounds.minX + bounds.maxX) / 2;
  const currentCenterY = (bounds.minY + bounds.maxY) / 2;
  const targetCenterX = width / 2;
  const targetCenterY = height / 2;

  positions.forEach(point => {
    point.x = targetCenterX + (point.x - currentCenterX) * scale;
    point.y = targetCenterY + (point.y - currentCenterY) * scale;
    point.x = clamp(point.x, padding, width - padding);
    point.y = clamp(point.y, padding, height - padding);
  });
}

function scoreLayout(
  positions: Map<number, LayoutPoint>,
  nodes: GraphNode[],
  edges: [number, number][]
): number {
  let overlapPenalty = 0;
  let edgeLengthPenalty = 0;
  let crossings = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = positions.get(nodes[i].id)!;
      const b = positions.get(nodes[j].id)!;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < 72) {
        overlapPenalty += (72 - dist) * (72 - dist) * 8;
      }
    }
  }

  for (const [aId, bId] of edges) {
    const a = positions.get(aId)!;
    const b = positions.get(bId)!;
    edgeLengthPenalty += Math.hypot(a.x - b.x, a.y - b.y);
  }

  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a1, a2] = edges[i];
      const [b1, b2] = edges[j];
      if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) continue;

      const p1 = positions.get(a1)!;
      const p2 = positions.get(a2)!;
      const p3 = positions.get(b1)!;
      const p4 = positions.get(b2)!;

      if (segmentsIntersect(p1, p2, p3, p4)) {
        crossings += 1;
      }
    }
  }

  return overlapPenalty + edgeLengthPenalty * 0.2 + crossings * 1800;
}

function segmentsIntersect(
  a: LayoutPoint,
  b: LayoutPoint,
  c: LayoutPoint,
  d: LayoutPoint
): boolean {
  const ab1 = orientation(a, b, c);
  const ab2 = orientation(a, b, d);
  const cd1 = orientation(c, d, a);
  const cd2 = orientation(c, d, b);
  return ab1 * ab2 < 0 && cd1 * cd2 < 0;
}

function orientation(a: LayoutPoint, b: LayoutPoint, c: LayoutPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function getBounds(positions: Map<number, LayoutPoint>) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  positions.forEach(point => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  return { minX, minY, maxX, maxY };
}

function cloneLayout(positions: Map<number, LayoutPoint>) {
  return new Map(
    Array.from(positions.entries()).map(([id, point]) => [id, { ...point }])
  );
}

function deriveLayoutSeed(
  nodes: GraphNode[],
  width: number,
  height: number,
  layoutSeed: number
) {
  let seed = 2166136261 ^ layoutSeed ^ width ^ (height << 1);

  for (const node of nodes) {
    seed ^= node.id + 0x9e3779b9;
    seed = Math.imul(seed, 16777619);

    for (const neighbor of node.neighbors) {
      seed ^= neighbor + 0x85ebca6b;
      seed = Math.imul(seed, 16777619);
    }
  }

  return seed >>> 0;
}

function createRandom(seed: number) {
  let state = seed || 1;

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
