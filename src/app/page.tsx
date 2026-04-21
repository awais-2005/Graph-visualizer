'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import InputPanel from '@/components/InputPanel';
import {
  buildTraversalOrder,
  GraphData,
  parseGraph,
  TraversalMode,
} from '@/lib/parseGraph';

const GraphCanvas = dynamic(() => import('@/components/GraphCanvas'), { ssr: false });

interface TraversalRun {
  mode: TraversalMode;
  sourceNode: number;
  order: number[];
  stepIndex: number;
}

const DEFAULT_INPUT = `Node 0 : (1, 4)
Node 1 : (0, 2, 5)
Node 2 : (1, 3, 6)
Node 3 : (2, 7)
Node 4 : (0, 5, 8)
Node 5 : (1, 4, 6, 9)
Node 6 : (2, 5, 7, 10)
Node 7 : (3, 6, 11)
Node 8 : (4, 9, 11)
Node 9 : (5, 8, 10)
Node 10 : (6, 9, 11)
Node 11 : (7, 10, 8)`;

export default function Home() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [graphData, setGraphData] = useState<GraphData | null>(() => parseGraph(DEFAULT_INPUT));
  const [error, setError] = useState<string | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [pendingTraversalMode, setPendingTraversalMode] = useState<TraversalMode | null>(null);
  const [traversalRun, setTraversalRun] = useState<TraversalRun | null>(null);

  const exitTraversal = () => {
    setPendingTraversalMode(null);
    setTraversalRun(null);
  };

  const visualizeGraph = (rawInput: string) => {
    const raw = rawInput.trim() || DEFAULT_INPUT;
    const result = parseGraph(raw);

    if (!result) {
      setError('Invalid format. Use: Node <id> : (<neighbors>)');
      return;
    }

    setError(null);
    setGraphData(result);
    setLayoutVersion(current => current + 1);
    exitTraversal();
  };

  const handleVisualize = () => {
    visualizeGraph(input);
  };

  const startTraversalSelection = (mode: TraversalMode) => {
    if (!graphData) return;
    setError(null);
    setTraversalRun(null);
    setPendingTraversalMode(mode);
  };

  const handleNodeSelect = (nodeId: number) => {
    if (!graphData || !pendingTraversalMode) return;

    const order = buildTraversalOrder(graphData.nodes, nodeId, pendingTraversalMode);
    if (order.length === 0) {
      setError(`Could not start ${pendingTraversalMode.toUpperCase()} from node ${nodeId}.`);
      return;
    }

    setError(null);
    setTraversalRun({
      mode: pendingTraversalMode,
      sourceNode: nodeId,
      order,
      stepIndex: 0,
    });
    setPendingTraversalMode(null);
  };

  const stepTraversal = (direction: -1 | 1) => {
    setTraversalRun(current => {
      if (!current) return current;
      const nextStep = Math.max(0, Math.min(current.order.length - 1, current.stepIndex + direction));
      if (nextStep === current.stepIndex) return current;
      return { ...current, stepIndex: nextStep };
    });
  };

  const currentNodeId = traversalRun ? traversalRun.order[traversalRun.stepIndex] ?? null : null;
  const visitedNodeIds = traversalRun
    ? traversalRun.order.slice(0, traversalRun.stepIndex + 1)
    : [];

  const activeTraversal = traversalRun && currentNodeId !== null
    ? {
      mode: traversalRun.mode,
      sourceNode: traversalRun.sourceNode,
      currentNode: currentNodeId,
      stepIndex: traversalRun.stepIndex,
      totalSteps: traversalRun.order.length,
      canGoPrev: traversalRun.stepIndex > 0,
      canGoNext: traversalRun.stepIndex < traversalRun.order.length - 1,
    }
    : null;

  const isEmpty = !graphData;

  return (
    <div
      className="min-h-screen bg-slate-950 text-white flex flex-col"
      style={{ fontFamily: 'var(--font-space-mono), monospace' }}
    >
      <header className="border-b border-slate-800/60 px-6 py-4 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="3" cy="3" r="2" fill="white" />
              <circle cx="11" cy="3" r="2" fill="white" />
              <circle cx="7" cy="11" r="2" fill="white" />
              <line x1="3" y1="3" x2="11" y2="3" stroke="white" strokeWidth="1.2" />
              <line x1="3" y1="3" x2="7" y2="11" stroke="white" strokeWidth="1.2" />
              <line x1="11" y1="3" x2="7" y2="11" stroke="white" strokeWidth="1.2" />
            </svg>
          </div>
          <span className="font-bold text-sm tracking-widest uppercase text-slate-200">GraphViz</span>
        </div>
        <div className="h-4 w-px bg-slate-700" />
        <span className="text-xs text-slate-500 tracking-wide">Interactive Graph Visualizer</span>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-600 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          ready
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
        <aside className="w-80 max-h-[100svh] border-r border-slate-800/60 p-5 flex flex-col gap-5 overflow-y-auto shrink-0">
          <div className="flex-1 flex flex-col gap-5">
            <div>
              <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-3">Input</h2>
              <InputPanel
                value={input}
                onChange={setInput}
                onVisualize={handleVisualize}
                error={error}
                nodeCount={graphData?.nodes.length ?? 0}
                edgeCount={graphData?.edges.length ?? 0}
                canTraverse={!isEmpty}
                pendingTraversalMode={pendingTraversalMode}
                activeTraversal={activeTraversal}
                onPlayBfs={() => startTraversalSelection('bfs')}
                onPlayDfs={() => startTraversalSelection('dfs')}
                onPrevStep={() => stepTraversal(-1)}
                onNextStep={() => stepTraversal(1)}
                onExitTraversal={exitTraversal}
              />
            </div>
          </div>

          <p className="text-xs text-slate-600 font-mono leading-relaxed">
            Drag nodes to rearrange. Choose BFS or DFS, click a source node, then move through the traversal with Previous and Next.
          </p>
        </aside>

        <div className="flex-1 relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, #020617 100%)',
            }}
          />

          {pendingTraversalMode && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full border border-amber-400/30 bg-slate-950/85 backdrop-blur">
              <p className="text-xs uppercase tracking-widest text-amber-300 font-mono">
                Select a source node for {pendingTraversalMode.toUpperCase()}
              </p>
            </div>
          )}

          {activeTraversal && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full border border-cyan-400/25 bg-slate-950/85 backdrop-blur">
              <p className="text-xs uppercase tracking-widest text-cyan-200 font-mono">
                {activeTraversal.mode.toUpperCase()} from node {activeTraversal.sourceNode} | visiting node {activeTraversal.currentNode}
              </p>
            </div>
          )}

          {isEmpty ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
              <div
                className="w-20 h-20 rounded-2xl border border-slate-700/50 flex items-center justify-center mb-2"
                style={{ background: 'rgba(109,40,217,0.08)' }}
              >
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity="0.5">
                  <circle cx="8" cy="8" r="5" stroke="#a78bfa" strokeWidth="2" />
                  <circle cx="32" cy="8" r="5" stroke="#a78bfa" strokeWidth="2" />
                  <circle cx="8" cy="32" r="5" stroke="#a78bfa" strokeWidth="2" />
                  <circle cx="32" cy="32" r="5" stroke="#a78bfa" strokeWidth="2" />
                  <circle cx="20" cy="20" r="5" stroke="#a78bfa" strokeWidth="2" />
                  <line x1="8" y1="8" x2="20" y2="20" stroke="#7c3aed" strokeWidth="1.5" />
                  <line x1="32" y1="8" x2="20" y2="20" stroke="#7c3aed" strokeWidth="1.5" />
                  <line x1="8" y1="32" x2="20" y2="20" stroke="#7c3aed" strokeWidth="1.5" />
                  <line x1="32" y1="32" x2="20" y2="20" stroke="#7c3aed" strokeWidth="1.5" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-400 tracking-wide">No graph yet</h3>
              <p className="text-sm text-slate-600 max-w-xs font-mono">
                Paste your adjacency list in the panel and click Visualize Graph
              </p>
              <button
                onClick={() => {
                  setInput(DEFAULT_INPUT);
                  visualizeGraph(DEFAULT_INPUT);
                }}
                className="mt-2 px-4 py-2 rounded-lg text-xs font-mono text-violet-400 border border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/10 transition-all"
              >
                Load example -&gt;
              </button>
            </div>
          ) : (
            <div className="absolute inset-0">
              <GraphCanvas
                data={graphData}
                layoutToken={layoutVersion}
                onSelectNode={pendingTraversalMode ? handleNodeSelect : undefined}
                visitedNodeIds={visitedNodeIds}
                activeNodeId={currentNodeId}
                sourceNodeId={traversalRun?.sourceNode ?? null}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
