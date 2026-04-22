'use client';

import type { TraversalMode } from '@/lib/parseGraph';

interface ActiveTraversal {
  mode: TraversalMode;
  sourceNode: number;
  currentNode: number;
  stepIndex: number;
  totalSteps: number;
  canGoPrev: boolean;
  canGoNext: boolean;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onVisualize: () => void;
  error: string | null;
  nodeCount: number;
  edgeCount: number;
  canTraverse: boolean;
  pendingTraversalMode: TraversalMode | null;
  activeTraversal: ActiveTraversal | null;
  onPlayBfs: () => void;
  onPlayDfs: () => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onExitTraversal: () => void;
}

const PLACEHOLDER = `Node 0 : (1, 4)
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

export default function InputPanel({
  value,
  onChange,
  onVisualize,
  error,
  nodeCount,
  edgeCount,
  canTraverse,
  pendingTraversalMode,
  activeTraversal,
  onPlayBfs,
  onPlayDfs,
  onPrevStep,
  onNextStep,
  onExitTraversal,
}: Props) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">Format</p>
        <p className="text-xs text-slate-500 font-mono">Node {'<id>'} : {'(<neighbor>, ...)'}</p>
      </div>

      <div className="relative">
        <textarea
          className="w-full min-h-[140px] sm:min-h-[200px] max-h-[40dvh] sm:max-h-none bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 text-sm font-mono text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/30 transition-all"
          placeholder={PLACEHOLDER}
          value={value}
          onChange={e => onChange(e.target.value)}
          spellCheck={false}
        />
        {error && (
          <div className="absolute bottom-3 left-3 right-3 bg-red-900/80 border border-red-500/40 rounded-lg px-3 py-2 text-xs text-red-300 font-mono">
            Warning: {error}
          </div>
        )}
      </div>

      <button
        onClick={onVisualize}
        className="relative group w-full py-3 rounded-xl font-mono text-sm font-bold tracking-wider uppercase overflow-hidden transition-all"
        style={{
          background: 'linear-gradient(135deg, #6d28d9, #7c3aed)',
          boxShadow: '0 0 20px rgba(109,40,217,0.4)',
        }}
      >
        <span className="relative z-10 text-white">Visualize Graph</span>
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)' }}
        />
      </button>

      <div className="bg-slate-900/55 border border-slate-700/40 rounded-xl p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">Traverse</p>
          {activeTraversal && (
            <span className="text-[11px] font-mono text-cyan-300">
              {activeTraversal.mode.toUpperCase()} step {activeTraversal.stepIndex + 1}/{activeTraversal.totalSteps}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ActionButton onClick={onPlayBfs} disabled={!canTraverse}>
            Play BFS
          </ActionButton>
          <ActionButton onClick={onPlayDfs} disabled={!canTraverse}>
            Play DFS
          </ActionButton>
        </div>

        {!canTraverse && (
          <p className="text-xs text-slate-500 font-mono">
            Visualize a graph to enable traversal controls.
          </p>
        )}

        {pendingTraversalMode && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 flex flex-col gap-3">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-amber-300">Pick Source Node</p>
              <p className="mt-1 text-xs font-mono text-amber-100/80">
                Click any node in the graph to start {pendingTraversalMode.toUpperCase()} traversal.
              </p>
            </div>
            <GhostButton onClick={onExitTraversal}>Cancel Selection</GhostButton>
          </div>
        )}

        {activeTraversal && (
          <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <InfoTile label="Source" value={`Node ${activeTraversal.sourceNode}`} />
              <InfoTile label="Visiting" value={`Node ${activeTraversal.currentNode}`} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <GhostButton onClick={onPrevStep} disabled={!activeTraversal.canGoPrev}>
                Previous
              </GhostButton>
              <GhostButton onClick={onNextStep} disabled={!activeTraversal.canGoNext}>
                Next
              </GhostButton>
            </div>

            <GhostButton onClick={onExitTraversal}>Exit Traverse</GhostButton>
          </div>
        )}
      </div>

      {(nodeCount > 0 || edgeCount > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Nodes" value={nodeCount} />
          <Stat label="Edges" value={edgeCount} />
        </div>
      )}
    </div>
  );
}

function ActionButton({
  children,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl px-3 py-3 text-xs font-mono font-bold tracking-widest uppercase border transition-all disabled:cursor-not-allowed disabled:opacity-45 active:scale-95"
      style={{
        background: 'linear-gradient(135deg, rgba(6,182,212,0.18), rgba(34,197,94,0.1))',
        borderColor: 'rgba(34,211,238,0.22)',
        color: '#d5f5ff',
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl px-3 py-3 text-xs font-mono font-bold tracking-widest uppercase border border-slate-600/60 text-slate-200 bg-slate-950/40 hover:bg-slate-900/70 transition-all disabled:cursor-not-allowed disabled:opacity-45 active:scale-95"
    >
      {children}
    </button>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-950/35 border border-cyan-400/15 px-3 py-2">
      <p className="text-[11px] uppercase tracking-widest text-cyan-300/75">{label}</p>
      <p className="mt-1 text-sm text-cyan-100">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3 text-center">
      <p className="text-2xl font-bold font-mono text-violet-400">{value}</p>
      <p className="text-xs text-slate-500 uppercase tracking-widest mt-0.5">{label}</p>
    </div>
  );
}
