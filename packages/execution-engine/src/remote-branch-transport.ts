import type { TaskState } from '@invoker/workflow-core';

const REMOTE_BRANCH_RUNNER_KINDS = new Set(['ssh', 'docker']);

function effectiveRunnerKind(task: TaskState): string {
  return task.config.runnerKind ?? 'worktree';
}

function runnerKindRequiresRemoteBranchPush(runnerKind: string): boolean {
  return REMOTE_BRANCH_RUNNER_KINDS.has(runnerKind);
}

function collectDependents(workflowTasks: readonly TaskState[]): Map<string, string[]> {
  const dependents = new Map<string, string[]>();
  for (const workflowTask of workflowTasks) {
    for (const dependencyId of workflowTask.dependencies) {
      const existing = dependents.get(dependencyId);
      if (existing) {
        existing.push(workflowTask.id);
      } else {
        dependents.set(dependencyId, [workflowTask.id]);
      }
    }
  }
  return dependents;
}

function descendantRequiresRemoteBranchPush(
  startTaskId: string,
  tasksById: Map<string, TaskState>,
  dependents: Map<string, string[]>,
): boolean {
  const pending = [startTaskId];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const taskId = pending.pop();
    if (!taskId || visited.has(taskId)) continue;
    visited.add(taskId);

    const workflowTask = tasksById.get(taskId);
    if (!workflowTask) continue;
    if (runnerKindRequiresRemoteBranchPush(effectiveRunnerKind(workflowTask))) {
      return true;
    }

    for (const dependentId of dependents.get(taskId) ?? []) {
      pending.push(dependentId);
    }
  }

  return false;
}

export function computeRequiresRemoteBranchPush(args: {
  task: TaskState;
  workflowIntermediateRepoUrl?: string;
  workflowTasks: readonly TaskState[];
}): boolean {
  if (args.workflowIntermediateRepoUrl?.trim()) return true;
  if (runnerKindRequiresRemoteBranchPush(effectiveRunnerKind(args.task))) return true;

  const tasksById = new Map(args.workflowTasks.map((workflowTask) => [workflowTask.id, workflowTask]));
  const dependents = collectDependents(args.workflowTasks);
  return descendantRequiresRemoteBranchPush(args.task.id, tasksById, dependents);
}
