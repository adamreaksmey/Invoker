import { useState } from 'react';
import type { TaskState } from '../types.js';
import { getEffectiveVisualStatus } from '../lib/colors.js';
import {
  parsePlanningDraftTaskDescription,
  type PlanningDraftTaskField,
} from '../lib/planning-draft-task-view.js';

const SUMMARY_FIELD_LABELS = ['Layer', 'Feature state', 'Review claim'] as const;
const SUMMARY_SHOW_LABEL = 'Details';
const SUMMARY_HIDE_LABEL = 'Hide';

function draftField(fields: readonly PlanningDraftTaskField[], label: string): string | undefined {
  const value = fields.find((entry) => entry.label === label)?.value.trim();
  return value || undefined;
}

function humanizeStatus(status: string): string {
  const label = status.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className="truncate text-foreground" title={value}>{value}</div>
    </div>
  );
}

function summaryRows(task: TaskState, fields: readonly PlanningDraftTaskField[], prompt: string) {
  const visualStatus = getEffectiveVisualStatus(task.status, task.execution);
  const labeled = SUMMARY_FIELD_LABELS.flatMap((label) => {
    const value = draftField(fields, label);
    return value ? [{ label, value }] : [];
  });
  const reviewClaim = labeled.find((row) => row.label === 'Review claim');
  const leading = labeled.filter((row) => row.label !== 'Review claim');
  return [
    ...leading,
    { label: 'Status', value: humanizeStatus(visualStatus) },
    ...(reviewClaim ? [reviewClaim] : []),
    { label: 'Full prompt', value: prompt },
  ];
}

export function TaskGraphSelectionSummary({ task }: { task: TaskState }) {
  const [expanded, setExpanded] = useState(false);
  const view = parsePlanningDraftTaskDescription(task.description);
  const title = view.title || task.description;
  const prompt = task.config.prompt?.trim() || title;
  const rows = summaryRows(task, view.fields, prompt);

  return (
    <section className="shrink-0 border-t border-border bg-background/95" data-testid="task-graph-selection-summary">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
        aria-expanded={expanded}
        data-testid="task-graph-selection-summary-toggle"
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={title}>{title}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{expanded ? SUMMARY_HIDE_LABEL : SUMMARY_SHOW_LABEL}</span>
      </button>
      {expanded ? (
        <div className="flex max-h-32 flex-col gap-1.5 overflow-y-auto px-3 pb-2">
          {rows.map((row) => <SummaryRow key={row.label} label={row.label} value={row.value} />)}
        </div>
      ) : null}
    </section>
  );
}
