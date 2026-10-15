import type { TaskState } from '../types.js';
import { getEffectiveVisualStatus } from '../lib/colors.js';
import {
  parsePlanningDraftTaskDescription,
  type PlanningDraftTaskField,
} from '../lib/planning-draft-task-view.js';

const SUMMARY_FIELD_LABELS = ['Layer', 'Feature state', 'Review claim'] as const;

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
  const view = parsePlanningDraftTaskDescription(task.description);
  const title = view.title || task.description;
  const prompt = task.config.prompt?.trim() || title;
  const rows = summaryRows(task, view.fields, prompt);

  return (
    <section
      className="max-h-[46%] shrink-0 overflow-y-auto border-t border-border bg-background/80 px-4 py-3"
      data-testid="task-graph-selection-summary"
    >
      <h3 className="mb-2 truncate text-sm font-semibold text-foreground" title={title}>{title}</h3>
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => <SummaryRow key={row.label} label={row.label} value={row.value} />)}
      </div>
    </section>
  );
}
