/**
 * TaskNode — Custom node component for the DAG visualization.
 *
 * Used as a custom node type in @xyflow/react.
 */

import { Handle, Position } from '@xyflow/react';
import type { TaskState } from '../types.js';
import { getStatusColor, getEffectiveVisualStatus } from '../lib/colors.js';
import { parsePlanningDraftTaskDescription } from '../lib/planning-draft-task-view.js';
import { TASK_GRAPH_NODE_WIDTH } from '../lib/task-graph-metrics.js';

interface TaskNodeData {
  task: TaskState;
  label?: string;
  dimmed?: boolean;
  selected?: boolean;
  runningLike?: boolean;
  [key: string]: unknown;
}

interface TaskNodeProps {
  data: TaskNodeData;
}

const TASK_NODE_STATUS_LABELS: Record<string, string> = {
  assigning: 'Assigning',
  awaiting_approval: 'Approve',
  fix_approval: 'Approve fix',
  fixing_with_ai: 'Fixing with AI',
  running: 'Running',
  running_executing: 'Running · Executing',
};

function humanizeStatus(status: string): string {
  const label = status.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getTaskNodeStatusLabel(task: TaskState, visualStatus: string): string {
  if (task.config.isReconciliation && task.status === 'needs_input') return 'Select';
  return TASK_NODE_STATUS_LABELS[visualStatus] ?? humanizeStatus(task.status);
}

export function isTaskNodeActionable(status: string): boolean {
  return status !== 'stale' && status !== 'skipped';
}

function draftField(fields: readonly { label: string; value: string }[], label: string): string | undefined {
  const value = fields.find((entry) => entry.label === label)?.value.trim();
  return value || undefined;
}

function MetaPill({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] leading-3 text-muted-foreground">
      {text}
    </span>
  );
}

function TaskNodeCard({
  title,
  description,
  layer,
  featureState,
  statusLabel,
  className,
  muted,
  animated,
  dotClass,
  textClass,
  selected,
}: {
  title: string;
  description: string;
  layer?: string;
  featureState?: string;
  statusLabel: string;
  className: string;
  muted: boolean;
  animated: boolean;
  dotClass: string;
  textClass: string;
  selected: boolean;
}) {
  const titleClass = muted ? 'line-through opacity-70' : '';
  return (
    <div
      className={className}
      style={{ width: TASK_GRAPH_NODE_WIDTH }}
      title={description}
      data-selected={selected ? 'true' : 'false'}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border !border-background !bg-neutral-500/90" />
      <div className={`line-clamp-2 text-[13px] font-medium leading-4 text-card-foreground ${titleClass}`}>{title}</div>
      {(layer || featureState) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {layer ? <MetaPill text={layer} /> : null}
          {featureState ? <MetaPill text={featureState} /> : null}
        </div>
      )}
      <div className={`mt-2 flex items-center gap-1.5 text-[11px] ${textClass}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass} ${animated ? 'pulse-strong' : ''}`} />
        {statusLabel}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border !border-background !bg-neutral-500/90" />
    </div>
  );
}

export function TaskNode({ data }: TaskNodeProps) {
  const { task } = data;
  const dimmed = data.dimmed ?? false;
  const selected = data.selected ?? false;
  const visualStatus = getEffectiveVisualStatus(task.status, task.execution, { runningLike: data.runningLike });
  const colors = getStatusColor(visualStatus);

  const isAnimated =
    data.runningLike === true ||
    task.status === 'running' ||
    task.status === 'needs_input' ||
    task.status === 'awaiting_approval';

  const statusLabel = getTaskNodeStatusLabel(task, visualStatus);

  const isStale = task.status === 'stale';
  const isSkipped = task.status === 'skipped';
  const isMuted = isStale || isSkipped;
  const isActionable = isTaskNodeActionable(task.status);
  const parsed = parsePlanningDraftTaskDescription(task.description);
  const title = parsed.title || task.description;
  const layer = draftField(parsed.fields, 'Layer');
  const featureState = draftField(parsed.fields, 'Feature state');
  const opacityClass = dimmed ? 'opacity-20' : isMuted ? 'opacity-50' : '';
  const interactionClass = dimmed || !isActionable ? 'pointer-events-none' : '';
  const selectedClass = selected ? 'ring-2 ring-sky-400/80' : '';
  const className = `relative rounded-xl border px-3 py-2.5 shadow-sm transition-[opacity,box-shadow,border-color] duration-150 ${colors.bg} ${colors.border} ${selectedClass} ${opacityClass} ${interactionClass}`;

  return (
    <TaskNodeCard
      title={title}
      description={task.description}
      layer={layer}
      featureState={featureState}
      statusLabel={statusLabel}
      className={className}
      muted={isMuted}
      animated={isAnimated}
      dotClass={colors.dot}
      textClass={colors.text}
      selected={selected}
    />
  );
}
