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
  // Mobile: panel is collapsed by default so user sees the graph first
  const [panelOpen, setPanelOpen] = useState(false);

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
    // Collapse panel on mobile after visualizing so user sees the graph
    setPanelOpen(false);
  };

  const handleVisualize = () => {
    visualizeGraph(input);
  };

  const startTraversalSelection = (mode: TraversalMode) => {
    if (!graphData) return;
    setError(null);
    setTraversalRun(null);
    setPendingTraversalMode(mode);
    // Collapse panel so user can tap a node on mobile
    setPanelOpen(false);
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
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800/60 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
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

        {/* Desktop subtitle */}
        <>
          <div className="h-4 w-px bg-slate-700 hidden sm:block" />
          <span className="text-xs text-slate-500 tracking-wide hidden sm:block">Interactive Graph Visualizer</span>
        </>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">ready</span>
          </div>

          {/* Mobile panel toggle */}
          <button
            id="panel-toggle-btn"
            className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/60 bg-slate-900/50 text-xs font-mono text-slate-300 hover:border-violet-500/50 transition-all active:scale-95"
            onClick={() => setPanelOpen(o => !o)}
            aria-label={panelOpen ? 'Hide panel' : 'Show panel'}
          >
            {panelOpen ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Close
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="1" y="2.5" width="10" height="1.5" rx="0.75" fill="currentColor" />
                  <rect x="1" y="5.25" width="10" height="1.5" rx="0.75" fill="currentColor" />
                  <rect x="1" y="8" width="10" height="1.5" rx="0.75" fill="currentColor" />
                </svg>
                Controls
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      {/*
        Desktop: flex-row (sidebar left, canvas right)
        Mobile:  flex-col (canvas top, panel slides in from bottom as overlay)
      */}
      <main className="flex flex-1 overflow-hidden relative" style={{ height: 'calc(100dvh - 53px)' }}>

        {/* ── Sidebar / Panel ──────────────────────────────────────────────── */}
        {/*
          - Desktop (sm+): fixed 320px sidebar on the left, always visible
          - Mobile: full-width panel that slides up from the bottom as an overlay
        */}
        <aside
          id="control-panel"
          className={[
            // Mobile: absolute overlay at the bottom, slides in/out
            'absolute bottom-0 left-0 right-0 z-30',
            'sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:z-auto',
            // Desktop: fixed narrow sidebar
            'sm:w-80 sm:shrink-0 sm:border-r sm:border-slate-800/60',
            // Mobile open state
            panelOpen ? 'translate-y-0' : 'translate-y-full',
            // Desktop always visible
            'sm:translate-y-0',
            // Transition (only on mobile)
            'transition-transform duration-300 ease-in-out sm:transition-none',
            // Sizing & scroll
            'max-h-[80dvh] sm:max-h-full sm:h-full',
            'bg-slate-950 border-t border-slate-800/60 sm:border-t-0',
            'overflow-y-auto',
          ].join(' ')}
        >
          {/* Mobile drag handle */}
          <div className="sm:hidden w-10 h-1 bg-slate-700 rounded-full mx-auto mt-3 mb-1" />

          <div className="p-5 flex flex-col gap-5 h-full">
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

            <p className="text-xs text-slate-600 font-mono leading-relaxed pb-safe">
              Drag nodes to rearrange. Choose BFS or DFS, tap a source node, then step through the traversal.
            </p>
          </div>
        </aside>

        {/* Mobile backdrop when panel is open */}
        {panelOpen && (
          <div
            className="sm:hidden absolute inset-0 z-20 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setPanelOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Graph Canvas Area ────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden min-w-0">
          {/* Dot grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          {/* Vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, #020617 100%)',
            }}
          />

          {/* Traversal mode banner */}
          {pendingTraversalMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full border border-amber-400/30 bg-slate-950/85 backdrop-blur max-w-[90vw] text-center">
              <p className="text-xs uppercase tracking-widest text-amber-300 font-mono whitespace-nowrap">
                Tap a source node for {pendingTraversalMode.toUpperCase()}
              </p>
            </div>
          )}

          {/* Active traversal banner */}
          {activeTraversal && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full border border-cyan-400/25 bg-slate-950/85 backdrop-blur max-w-[90vw]">
              <p className="text-xs uppercase tracking-widest text-cyan-200 font-mono text-center">
                <span className="hidden sm:inline">{activeTraversal.mode.toUpperCase()} from node {activeTraversal.sourceNode} | visiting </span>
                <span className="sm:hidden">Visiting </span>
                node {activeTraversal.currentNode}
              </p>
            </div>
          )}

          {/* Mobile step controls overlay (shown during active traversal) */}
          {activeTraversal && (
            <div
              className="sm:hidden absolute left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-4 py-3 rounded-2xl border border-cyan-500/25 bg-slate-950/90 backdrop-blur"
              style={{ bottom: 'max(16px, env(safe-area-inset-bottom, 16px) + 8px)' }}
            >
              <button
                onClick={() => stepTraversal(-1)}
                disabled={!activeTraversal.canGoPrev}
                className="w-10 h-10 rounded-xl border border-slate-600/60 bg-slate-900/60 flex items-center justify-center text-slate-200 disabled:opacity-40 active:scale-95 transition-all"
                aria-label="Previous step"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div className="text-xs font-mono text-cyan-300 text-center min-w-[80px]">
                <div className="text-[10px] text-cyan-400/60 uppercase tracking-widest">{activeTraversal.mode.toUpperCase()}</div>
                <div>{activeTraversal.stepIndex + 1} / {activeTraversal.totalSteps}</div>
              </div>

              <button
                onClick={() => stepTraversal(1)}
                disabled={!activeTraversal.canGoNext}
                className="w-10 h-10 rounded-xl border border-slate-600/60 bg-slate-900/60 flex items-center justify-center text-slate-200 disabled:opacity-40 active:scale-95 transition-all"
                aria-label="Next step"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <button
                onClick={() => { exitTraversal(); setPanelOpen(false); }}
                className="w-10 h-10 rounded-xl border border-red-500/30 bg-red-900/20 flex items-center justify-center text-red-300 active:scale-95 transition-all"
                aria-label="Exit traversal"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          {isEmpty ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
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
                Open Controls, paste your adjacency list, and tap Visualize Graph
              </p>
              <button
                onClick={() => {
                  setInput(DEFAULT_INPUT);
                  visualizeGraph(DEFAULT_INPUT);
                }}
                id="load-example-btn"
                className="mt-2 px-4 py-2 rounded-lg text-xs font-mono text-violet-400 border border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/10 transition-all active:scale-95"
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
