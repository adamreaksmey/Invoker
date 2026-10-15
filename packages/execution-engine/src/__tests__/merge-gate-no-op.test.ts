import { describe, expect, it, vi } from 'vitest';
import type { TaskState } from '@invoker/workflow-core';
import { emptyReviewPublicationStatus, runMergeGateActionImpl, type MergeRunnerHost } from '../merge-runner.js';

const MERGE_TASK_ID = '__merge__wf-noop';

function makeMergeTask(): TaskState {
  return {
    id: MERGE_TASK_ID,
    description: 'No-op gate',
    status: 'running',
    dependencies: ['t1'],
    createdAt: new Date(),
    config: { isMergeNode: true, workflowId: 'wf-noop' } as TaskState['config'],
    execution: { generation: 0 },
  } as TaskState;
}

describe('merge gate no_op mode', () => {
  it('completes without worktree, consolidate, or review publication', async () => {
    const createMergeWorktree = vi.fn(async () => '/tmp/should-not-create');
    const consolidateAndMerge = vi.fn(async () => undefined);
    const createReview = vi.fn(async () => ({ url: 'https://example.invalid/pr/1', identifier: '1' }));

    const host = {
      cwd: '/tmp/host-repo',
      defaultBranch: 'master',
      persistence: {
        loadWorkflow: () => ({
          id: 'wf-noop',
          onFinish: 'none',
          mergeMode: 'no_op',
          baseBranch: 'master',
          featureBranch: 'plan/noop-feature',
          name: 'No-op Workflow',
        }),
        updateTask: vi.fn(),
        getWorkspacePath: () => null,
      },
      orchestrator: {
        getTask: () => makeMergeTask(),
        getAllTasks: () => [makeMergeTask()],
        autoStartExternallyUnblockedReadyTasks: () => [],
      },
      createMergeWorktree,
      consolidateAndMerge,
      mergeGateProvider: { createReview },
      async detectDefaultBranch() {
        return 'master';
      },
      async buildMergeSummary() {
        return '## Summary';
      },
    } as unknown as MergeRunnerHost;

    const result = await runMergeGateActionImpl(host, makeMergeTask());

    expect(result.response.status).toBe('completed');
    expect(result.response.outputs.exitCode).toBe(0);
    expect(createMergeWorktree).not.toHaveBeenCalled();
    expect(consolidateAndMerge).not.toHaveBeenCalled();
    expect(createReview).not.toHaveBeenCalled();
  });

  it('names the empty branch when a pull request gate has nothing to publish', async () => {
    const createReview = vi.fn(async () => ({ url: 'https://example.invalid/pr/1', identifier: '1' }));
    const execGitIn = vi.fn(async (args: string[]) => {
      if (args[0] === 'diff') return '';
      return 'abc123\n';
    });
    const task = {
      ...makeMergeTask(),
      id: '__merge__wf-empty',
      config: { isMergeNode: true, workflowId: 'wf-empty' },
    } as TaskState;
    const host = {
      cwd: '/tmp/host-repo',
      defaultBranch: 'main',
      persistence: {
        loadWorkflow: () => ({
          id: 'wf-empty',
          onFinish: 'pull_request',
          mergeMode: 'manual',
          baseBranch: 'main',
          featureBranch: 'plan/empty',
          name: 'Empty diff',
        }),
        updateTask: vi.fn(),
        getWorkspacePath: () => null,
        logEvent: vi.fn(),
      },
      orchestrator: {
        getTask: () => task,
        getAllTasks: () => [task],
        autoStartExternallyUnblockedReadyTasks: () => [],
      },
      createMergeWorktree: async () => '/tmp/gate',
      consolidateAndMerge: async () => undefined,
      execGitIn,
      execGitReadonly: async () => 'abc123\n',
      mergeGateProvider: { createReview },
      async detectDefaultBranch() {
        return 'main';
      },
      async buildMergeSummary() {
        return 'summary';
      },
    } as unknown as MergeRunnerHost;

    const result = await runMergeGateActionImpl(host, task);

    expect(result.response.status).toBe('completed');
    expect(result.taskChanges.execution?.reviewStatus).toBe(
      emptyReviewPublicationStatus('main', 'plan/empty'),
    );
    expect(createReview).not.toHaveBeenCalled();
  });
});
