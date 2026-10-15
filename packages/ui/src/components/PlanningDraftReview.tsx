import type { InAppPlanningPlanSummary } from '@invoker/contracts';
import { Button } from './primitives/index.js';
import { MarkdownText } from './MarkdownText.js';
import { parsePlanningDraftTaskDescription } from '../lib/planning-draft-task-view.js';

export interface PlanningDraftTaskGroupView {
  workflow: string | null;
  tasks: string[];
}

export interface PlanningDraftReviewProps {
  draftPlanSummary: InAppPlanningPlanSummary;
  draftTaskGroups: PlanningDraftTaskGroupView[];
  draftPlanText?: string;
  confirmationMode?: string;
  keptDraft: boolean;
  onCreateWorkflow: () => void;
  onDiscardDraft: () => void;
  onCancelReview: () => void;
}

function DraftTaskFields({ fields }: {
  fields: ReturnType<typeof parsePlanningDraftTaskDescription>['fields'];
}): JSX.Element {
  return (
    <dl className="mt-2 space-y-1.5">
      {fields.map((field) => (
        <div key={field.label} className="grid gap-0.5">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {field.label}
          </dt>
          <dd className="text-xs leading-5 text-foreground break-words whitespace-pre-wrap">
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DraftTaskCard({ task }: { task: string }): JSX.Element {
  const view = parsePlanningDraftTaskDescription(task);
  if (!view.structured) {
    return (
      <li data-testid="draft-step-summary" className="rounded-md border border-border bg-background/80 px-3 py-2.5">
        <MarkdownText text={task} className="text-xs leading-5 text-muted-foreground" />
      </li>
    );
  }
  return (
    <li data-testid="draft-step-summary" className="rounded-md border border-border bg-background/80 px-3 py-2.5">
      <div className="text-xs font-medium leading-5 text-foreground">{view.title}</div>
      {view.fields.length > 0 ? <DraftTaskFields fields={view.fields} /> : null}
      {view.body ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
            Details
          </summary>
          <MarkdownText text={view.body} className="mt-1.5 text-xs leading-5 text-muted-foreground" />
        </details>
      ) : null}
    </li>
  );
}

function DraftTaskGroups({ groups }: { groups: PlanningDraftTaskGroupView[] }): JSX.Element {
  return (
    <>
      {groups.map((group, groupIndex) => (
        <section key={`${group.workflow ?? 'plan'}-${groupIndex}`} data-testid="draft-task-group">
          {group.workflow ? (
            <h3 className="mb-2 text-xs font-medium text-foreground">{group.workflow}</h3>
          ) : null}
          <ul className="space-y-2">
            {group.tasks.map((task, taskIndex) => (
              <DraftTaskCard key={`${task}-${taskIndex}`} task={task} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function DraftPlanYaml({ draftPlanText }: { draftPlanText: string }): JSX.Element {
  return (
    <details className="rounded-md border border-border bg-background">
      <summary className="cursor-pointer px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground">
        Show plan YAML
      </summary>
      <pre
        data-testid="draft-raw-yaml"
        className="max-h-56 overflow-auto border-t border-border px-3 py-2 text-[11px] leading-5 text-muted-foreground"
      >
        {draftPlanText}
      </pre>
    </details>
  );
}

function DraftConfirmActions({
  keptDraft,
  onCreateWorkflow,
  onDiscardDraft,
  onCancelReview,
}: {
  keptDraft: boolean;
  onCreateWorkflow: () => void;
  onDiscardDraft: () => void;
  onCancelReview: () => void;
}): JSX.Element {
  return (
    <div className="grid gap-2">
      <Button type="button" data-testid="planning-create-workflow" onClick={onCreateWorkflow} className="w-full">
        Create workflow
      </Button>
      {keptDraft ? (
        <button
          type="button"
          data-testid="planning-discard-draft"
          onClick={onDiscardDraft}
          className="w-full rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary"
        >
          Discard draft
        </button>
      ) : (
        <button
          type="button"
          data-testid="planning-cancel-review"
          onClick={onCancelReview}
          className="w-full rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

function DraftReviewActions(props: Pick<
  PlanningDraftReviewProps,
  'confirmationMode' | 'keptDraft' | 'onCreateWorkflow' | 'onDiscardDraft' | 'onCancelReview'
>): JSX.Element | null {
  if (props.confirmationMode !== 'require') return null;
  return (
    <div className="shrink-0 space-y-2 border-t border-border bg-card/80 p-4">
      <DraftConfirmActions
        keptDraft={props.keptDraft}
        onCreateWorkflow={props.onCreateWorkflow}
        onDiscardDraft={props.onDiscardDraft}
        onCancelReview={props.onCancelReview}
      />
    </div>
  );
}

function DraftReviewHeader({ summary }: { summary: InAppPlanningPlanSummary }): JSX.Element {
  const taskLabel = summary.taskCount === 1 ? 'task' : 'tasks';
  const workflowSuffix = summary.workflowCount && summary.workflowCount > 1
    ? ` · ${summary.workflowCount} workflows`
    : '';
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Draft</div>
      <p className="mt-1 text-sm font-medium text-foreground">{summary.name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {summary.taskCount} {taskLabel}{workflowSuffix}
      </p>
    </div>
  );
}

export function PlanningDraftReview({
  draftPlanSummary,
  draftTaskGroups,
  draftPlanText,
  confirmationMode,
  keptDraft,
  onCreateWorkflow,
  onDiscardDraft,
  onCancelReview,
}: PlanningDraftReviewProps): JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 text-sm">
        <p
          data-testid="planning-draft-locked-note"
          className="rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-xs leading-5 text-muted-foreground"
        >
          This draft is locked — critique in chat, or ask Invoker to re-draft, to change it.
        </p>
        <DraftReviewHeader summary={draftPlanSummary} />
        <DraftTaskGroups groups={draftTaskGroups} />
        {draftPlanText ? <DraftPlanYaml draftPlanText={draftPlanText} /> : null}
      </div>
      <DraftReviewActions
        confirmationMode={confirmationMode}
        keptDraft={keptDraft}
        onCreateWorkflow={onCreateWorkflow}
        onDiscardDraft={onDiscardDraft}
        onCancelReview={onCancelReview}
      />
    </div>
  );
}
