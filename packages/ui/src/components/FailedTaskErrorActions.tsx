import type { TaskState } from '../types.js';
import {
  describeGitPublishRemediation,
  resolveGitPublishFailureClass,
} from '../lib/task-execution-error-display.js';

function capitalizeAgentName(agentName: string): string {
  if (!agentName) return agentName;
  return agentName.charAt(0).toUpperCase() + agentName.slice(1);
}

export interface FailedTaskErrorActionsProps {
  task: TaskState;
  displayError?: string;
  fixAgentName: string;
  onFix?: (taskId: string, agentName: string) => void;
  onRestartTask?: (taskId: string) => void;
  testIdPrefix?: string;
  remediationClassName?: string;
}

export function FailedTaskErrorActions({
  task,
  displayError,
  fixAgentName,
  onFix,
  onRestartTask,
  testIdPrefix = 'task-error',
  remediationClassName = 'mt-2 rounded border border-amber-500/40 bg-amber-950/40 p-2 text-xs text-amber-100 whitespace-pre-wrap break-words',
}: FailedTaskErrorActionsProps) {
  if (task.status !== 'failed') return null;

  const gitPublishClass = resolveGitPublishFailureClass(
    task.execution.failureClass,
    displayError ?? task.execution.error,
  );
  const remediation = gitPublishClass
    ? describeGitPublishRemediation({
      failureClass: gitPublishClass,
      localCommit: task.execution.commit,
    })
    : undefined;
  const showActions = Boolean(onFix || onRestartTask);
  if (!remediation && !showActions) return null;

  const fixLabel = `Fix with ${capitalizeAgentName(fixAgentName)}`;

  return (
    <>
      {remediation && (
        <p
          data-testid={`${testIdPrefix}-git-publish-remediation`}
          className={remediationClassName}
        >
          {remediation}
        </p>
      )}
      {showActions && (
        <div className="mt-3 flex gap-2" data-testid={`${testIdPrefix}-recovery-actions`}>
          {onFix && (
            <button
              type="button"
              data-testid={`${testIdPrefix}-fix-with-agent`}
              data-sidebar-nav-item
              data-sidebar-nav-order="14"
              onClick={() => onFix(task.id, fixAgentName)}
              className="flex-1 rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500"
            >
              {fixLabel}
            </button>
          )}
          {onRestartTask && (
            <button
              type="button"
              data-testid={`${testIdPrefix}-restart-task`}
              data-sidebar-nav-item
              data-sidebar-nav-order="15"
              onClick={() => onRestartTask(task.id)}
              className="flex-1 rounded border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Restart Task
            </button>
          )}
        </div>
      )}
    </>
  );
}
