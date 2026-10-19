/**
 * MergeGateNode — Synthetic terminal node showing the merge/PR gate.
 *
 * Styled to match TaskNode cards so DAG visuals stay consistent.
 * Keeps dashed border to distinguish gate semantics.
 */

import { Handle, Position } from '@xyflow/react';
import type { TaskStatus } from '../types.js';
import { getStatusColor, getEffectiveVisualStatus } from '../lib/colors.js';
import type { MergeGateKind } from '../lib/merge-gate.js';
import { GitMergeIcon, GitPullRequestIcon } from './icons/index.js';
import { TASK_GRAPH_NODE_WIDTH } from '../lib/task-graph-metrics.js';

interface MergeGateNodeData {
  taskId?: string;
  status: TaskStatus;
  /** Plan title only (no "… gate for" prefix). */
  label: string;
  gateKind: MergeGateKind;
  mergeMode?: 'manual' | 'automatic' | 'external_review';
  baseBranch?: string;
  reviewUrl?: string;
  reviewStatus?: string;
  /** Set when merge gate was fixed with Claude — first approve clears this (orchestrator). */
  pendingFixError?: string;
  dimmed?: boolean;
  selected?: boolean;
}

interface MergeGateNodeProps {
  data: MergeGateNodeData;
}

const PRIMARY_LABEL: Record<MergeGateKind, string> = {
  external_review: 'Review',
  pull_request: 'Pull request',
  merge: 'Merge',
  workflow: 'Workflow',
};

export function MergeGateNode({ data }: MergeGateNodeProps) {
  const {
    status,
    label,
    gateKind,
    mergeMode = 'manual',
    baseBranch,
    reviewUrl,
    reviewStatus,
    pendingFixError,
    dimmed: dataDimmed,
    selected: dataSelected,
  } = data;
  const dimmed = dataDimmed ?? false;
  const selected = dataSelected ?? false;
  const visualStatus = getEffectiveVisualStatus(
    status,
    pendingFixError ? { pendingFixError } : undefined,
  );
  const colors = getStatusColor(visualStatus);

  /** mergeMode wins over gateKind so we never show "Pull request" + "Review" when workflow is external_review mode. */
  const effectiveGateKind: MergeGateKind = mergeMode === 'external_review' ? 'external_review' : gateKind;

  const usePrIcon = effectiveGateKind === 'external_review' || effectiveGateKind === 'pull_request';
  const IconComponent = usePrIcon ? GitPullRequestIcon : GitMergeIcon;

  const statusLabel =
    visualStatus === 'completed' ? 'Completed' :
    visualStatus === 'fix_approval' ? 'Approve fix' :
    visualStatus === 'review_ready' ? 'Review ready' :
    visualStatus === 'awaiting_approval' ? 'Approve' :
    visualStatus === 'running' ? 'Running' :
    visualStatus === 'closed' ? 'Closed' :
    visualStatus === 'failed' ? 'Blocked' :
    'Pending';

  const selectedClass = selected ? 'ring-2 ring-sky-400/80' : '';
  const dimmedClass = dimmed ? 'pointer-events-none opacity-20' : '';
  const pendingPulse = visualStatus === 'pending' ? 'pulse-strong' : '';

  return (
    <div
      className={`relative rounded-xl border border-dashed px-3 py-2.5 shadow-sm transition-[opacity,box-shadow,border-color] duration-75 ${colors.bg} ${colors.border} ${selectedClass} ${dimmedClass}`}
      style={{ width: TASK_GRAPH_NODE_WIDTH }}
      title={label}
      data-selected={selected ? 'true' : 'false'}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border !border-slate-900 !bg-slate-500/90" />
      <div className={`flex items-center gap-1.5 ${colors.text}`}>
        <IconComponent className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-wide" data-testid="merge-gate-primary-label">
          {PRIMARY_LABEL[effectiveGateKind]}
        </span>
      </div>
      <div className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-4 text-card-foreground">
        {label}
      </div>
      {baseBranch ? (
        <div className="mt-2">
          <span
            data-testid="merge-gate-base-branch"
            className="rounded-full border border-border px-1.5 py-0.5 text-[10px] leading-3 text-muted-foreground"
          >
            base {baseBranch}
          </span>
        </div>
      ) : null}
      <div className={`mt-2 flex items-center gap-1.5 text-[11px] ${colors.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${colors.dot} ${pendingPulse}`} />
        {statusLabel}
      </div>
      {!reviewUrl && reviewStatus ? (
        <div data-testid="merge-gate-publication-note" className="mt-1.5 line-clamp-3 text-[11px] leading-4 text-amber-200">
          {reviewStatus}
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border !border-slate-900 !bg-slate-500/90" />
    </div>
  );
}
