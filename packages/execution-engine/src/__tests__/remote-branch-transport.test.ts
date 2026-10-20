import { describe, expect, it } from 'vitest';
import type { TaskState } from '@invoker/workflow-core';
import { computeRequiresRemoteBranchPush } from '../remote-branch-transport.js';

function makeTask(
  id: string,
  overrides: Partial<TaskState['config']> & { dependencies?: string[] } = {},
): TaskState {
  const { dependencies = [], ...configOverrides } = overrides;
  return {
    id,
    description: id,
    status: 'pending',
    dependencies,
    createdAt: new Date(),
    config: {
      workflowId: 'wf-1',
      command: 'echo ok',
      ...configOverrides,
    },
    execution: {},
    taskStateVersion: 1,
  } as TaskState;
}

describe('computeRequiresRemoteBranchPush', () => {
  it('returns false for a purely local worktree chain', () => {
    const upstream = makeTask('wf-1/upstream');
    const downstream = makeTask('wf-1/downstream', { dependencies: ['wf-1/upstream'] });

    expect(computeRequiresRemoteBranchPush({
      task: upstream,
      workflowTasks: [upstream, downstream],
    })).toBe(false);
  });

  it('returns true when a downstream task uses ssh', () => {
    const upstream = makeTask('wf-1/upstream');
    const downstream = makeTask('wf-1/downstream', {
      dependencies: ['wf-1/upstream'],
      runnerKind: 'ssh',
      poolMemberId: 'remote-1',
    });

    expect(computeRequiresRemoteBranchPush({
      task: upstream,
      workflowTasks: [upstream, downstream],
    })).toBe(true);
  });

  it('returns true when intermediateRepoUrl is configured', () => {
    const task = makeTask('wf-1/task');

    expect(computeRequiresRemoteBranchPush({
      task,
      workflowIntermediateRepoUrl: 'git@github.com:org/intermediate.git',
      workflowTasks: [task],
    })).toBe(true);
  });

  it('returns true when the task itself uses docker', () => {
    const task = makeTask('wf-1/task', { runnerKind: 'docker' });

    expect(computeRequiresRemoteBranchPush({
      task,
      workflowTasks: [task],
    })).toBe(true);
  });
});
