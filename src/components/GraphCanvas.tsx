'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GraphData, computeLayout } from '@/lib/parseGraph';

interface Props {
  data: GraphData;
  layoutToken?: number;
  onSelectNode?: (nodeId: number) => void;
  visitedNodeIds?: number[];
  activeNodeId?: number | null;
  sourceNodeId?: number | null;
}

interface NodePos {
  x: number;
  y: number;
}

interface GraphSceneProps {
  data: GraphData;
  dims: { w: number; h: number };
  initialPositions: Map<number, NodePos>;
  onSelectNode?: (nodeId: number) => void;
  visitedNodeIds: number[];
  activeNodeId: number | null;
  sourceNodeId: number | null;
}

const NODE_RADIUS = 18;
const DRAG_THRESHOLD = 4;

export default function GraphCanvas({
  data,
  layoutToken = 0,
  onSelectNode,
  visitedNodeIds = [],
  activeNodeId = null,
  sourceNodeId = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });

    if (containerRef.current) {
      obs.observe(containerRef.current);
    }

    return () => obs.disconnect();
  }, []);

  const initialPositions = useMemo(
    () => computeLayout(data.nodes, dims.w, dims.h, layoutToken),
    [data, dims.h, dims.w, layoutToken]
  );

  const sceneKey = useMemo(
    () =>
      `${dims.w}x${dims.h}:${data.nodes
        .map(node => `${node.id}:${node.neighbors.join(',')}`)
        .join('|')}:${layoutToken}`,
    [data, dims.h, dims.w, layoutToken]
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <GraphScene
        key={sceneKey}
        data={data}
        dims={dims}
        initialPositions={initialPositions}
        onSelectNode={onSelectNode}
        visitedNodeIds={visitedNodeIds}
        activeNodeId={activeNodeId}
        sourceNodeId={sourceNodeId}
      />
    </div>
  );
}

function GraphScene({
  data,
  dims,
  initialPositions,
  onSelectNode,
  visitedNodeIds,
  activeNodeId,
  sourceNodeId,
}: GraphSceneProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [posMap, setPosMap] = useState<Map<number, NodePos>>(() => new Map(initialPositions));
  const dragMetaRef = useRef({ startX: 0, startY: 0, moved: false });

  const canDrag = !onSelectNode;
  const hasTraversalFocus = activeNodeId !== null || visitedNodeIds.length > 0;
  const visitedSet = useMemo(() => new Set(visitedNodeIds), [visitedNodeIds]);

  const getSvgPoint = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent, nodeId: number) => {
    if (!canDrag) return;

    e.preventDefault();
    const svg = (e.currentTarget as SVGElement).closest('svg');
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const pos = posMap.get(nodeId);
    if (!pos) return;

    dragMetaRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    setDragging(nodeId);
    setOffset({ x: pt.x - pos.x, y: pt.y - pos.y });
  };

  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!canDrag || dragging === null) return;

    const travel = Math.hypot(
      e.clientX - dragMetaRef.current.startX,
      e.clientY - dragMetaRef.current.startY
    );

    if (travel > DRAG_THRESHOLD) {
      dragMetaRef.current.moved = true;
    }

    const pt = getSvgPoint(e);
    setPosMap(prev => {
      const next = new Map(prev);
      next.set(dragging, {
        x: Math.max(NODE_RADIUS, Math.min(dims.w - NODE_RADIUS, pt.x - offset.x)),
        y: Math.max(NODE_RADIUS, Math.min(dims.h - NODE_RADIUS, pt.y - offset.y)),
      });
      return next;
    });
  }, [canDrag, dims.h, dims.w, dragging, offset.x, offset.y]);

  const endDrag = useCallback(() => {
    dragMetaRef.current = { startX: 0, startY: 0, moved: false };
    setDragging(null);
  }, []);

  const highlightedNodes = hoveredNode !== null && !hasTraversalFocus && !onSelectNode
    ? new Set([hoveredNode, ...(data.nodes.find(node => node.id === hoveredNode)?.neighbors ?? [])])
    : null;

  return (
    <svg
      width={dims.w}
      height={dims.h}
      className="w-full h-full"
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={() => {
        endDrag();
        setHoveredNode(null);
      }}
      style={{ cursor: dragging !== null ? 'grabbing' : onSelectNode ? 'pointer' : 'default' }}
    >
      <defs>
        <radialGradient id="nodeGrad" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6d28d9" />
        </radialGradient>
        <radialGradient id="nodeGradHover" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#f0abfc" />
          <stop offset="100%" stopColor="#a21caf" />
        </radialGradient>
        <radialGradient id="nodeGradVisited" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
        <radialGradient id="nodeGradActive" cx="42%" cy="32%" r="64%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ea580c" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="visitedGlow">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#22d3ee" floodOpacity="0.85" />
          <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#0ea5e9" floodOpacity="0.25" />
        </filter>
        <filter id="activeGlow">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#fbbf24" floodOpacity="0.95" />
          <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#fb7185" floodOpacity="0.35" />
        </filter>
        <filter id="shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.5" />
        </filter>
      </defs>

      {data.edges.map(([a, b]) => {
        const pa = posMap.get(a);
        const pb = posMap.get(b);
        if (!pa || !pb) return null;

        const hoveredEdge = highlightedNodes?.has(a) && highlightedNodes?.has(b);
        const traversedEdge = visitedSet.has(a) && visitedSet.has(b);
        const activeEdge = activeNodeId !== null && (a === activeNodeId || b === activeNodeId);

        return (
          <line
            key={`${a}-${b}`}
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            stroke={activeEdge ? '#fbbf24' : traversedEdge ? '#22d3ee' : hoveredEdge ? '#c084fc' : '#334155'}
            strokeWidth={activeEdge ? 2.8 : traversedEdge ? 2 : hoveredEdge ? 2.5 : 1.5}
            strokeOpacity={activeEdge ? 1 : traversedEdge ? 0.95 : hoveredEdge ? 1 : 0.5}
            style={{ transition: 'stroke 0.2s, stroke-width 0.2s, stroke-opacity 0.2s' }}
          />
        );
      })}

      {data.nodes.map(node => {
        const pos = posMap.get(node.id);
        if (!pos) return null;

        const isHovered = hoveredNode === node.id;
        const isNeighbor = highlightedNodes?.has(node.id) && !isHovered;
        const isDimmed = highlightedNodes && !highlightedNodes.has(node.id);
        const isVisited = visitedSet.has(node.id);
        const isActive = activeNodeId === node.id;
        const isSource = sourceNodeId === node.id;
        const fill = isActive
          ? 'url(#nodeGradActive)'
          : isVisited
            ? 'url(#nodeGradVisited)'
            : isHovered || isNeighbor
              ? 'url(#nodeGradHover)'
              : 'url(#nodeGrad)';
        const filter = isActive
          ? 'url(#activeGlow)'
          : isVisited || isSource
            ? 'url(#visitedGlow)'
            : isHovered
              ? 'url(#glow)'
              : 'url(#shadow)';

        return (
          <g
            key={node.id}
            transform={`translate(${pos.x},${pos.y})`}
            onMouseDown={e => onMouseDown(e, node.id)}
            onClick={onSelectNode ? () => onSelectNode(node.id) : undefined}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(current => (current === node.id ? null : current))}
            style={{
              cursor: onSelectNode ? 'pointer' : 'grab',
              userSelect: 'none',
              backgroundColor: 'red',
            }}
          >
            {isActive && (
              <circle
                r={NODE_RADIUS + 11}
                fill="none"
                stroke="#fde68a"
                strokeWidth="1.6"
                strokeOpacity="0.9"
              >
                <animate
                  attributeName="stroke-opacity"
                  values="0.9;0.35;0.9"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              </circle>
            )}

            {isSource && !isActive && (
              <circle
                r={NODE_RADIUS + 7}
                fill="none"
                stroke="#67e8f9"
                strokeWidth="1.1"
                strokeOpacity="0.65"
                strokeDasharray="4 3"
              />
            )}

            <circle
              r={NODE_RADIUS}
              fill={fill}
              opacity={isDimmed ? 0.25 : 1}
              filter={filter}
              style={{ transition: 'opacity 0.2s, r 0.15s, fill 0.2s' }}
            />

            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="11"
              fontWeight="700"
              fontFamily="var(--font-jetbrains-mono), monospace"
              fill="white"
              opacity={isDimmed ? 0.3 : 1}
              style={{ pointerEvents: 'none', transition: 'opacity 0.2s' }}
            >
              {node.id}
            </text>

            {isActive && (
              <text
                y={NODE_RADIUS + 16}
                textAnchor="middle"
                fontSize="9"
                fontFamily="var(--font-jetbrains-mono), monospace"
                fill="#fde68a"
                style={{ pointerEvents: 'none' }}
              >
                visiting
              </text>
            )}

            {!isActive && isHovered && !hasTraversalFocus && (
              <text
                y={NODE_RADIUS + 14}
                textAnchor="middle"
                fontSize="9"
                fontFamily="var(--font-jetbrains-mono), monospace"
                fill="#c084fc"
                style={{ pointerEvents: 'none' }}
              >
                [{node.neighbors.join(', ')}]
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
