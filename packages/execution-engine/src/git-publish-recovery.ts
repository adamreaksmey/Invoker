import {
  FailureClassifier,
  isGitPublishFailureClass,
  type FailureClass,
  type GitPublishFailureClass,
} from '@invoker/workflow-graph';
import type { TaskState } from '@invoker/workflow-core';

export function resolveTaskGitPublishFailureClass(task: TaskState): GitPublishFailureClass | undefined {
  const fromPersisted = task.execution.failureClass;
  if (isGitPublishFailureClass(fromPersisted)) return fromPersisted;
  return FailureClassifier.classifyGitPublishError(task.execution.error);
}

export function taskHasPreservedGitPublishCommit(task: TaskState): boolean {
  return Boolean(
    resolveTaskGitPublishFailureClass(task)
    && task.status === 'failed'
    && task.execution.commit?.trim()
    && task.execution.branch?.trim()
    && task.execution.workspacePath?.trim(),
  );
}

export function classifyPushFailure(error: string | undefined): FailureClass | undefined {
  return FailureClassifier.classifyGitPublishError(error);
}
