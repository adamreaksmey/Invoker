import { describe, expect, it } from 'vitest';
import {
  InMemoryPersistence,
  makeOrchestrator,
  makeResponse,
} from './helpers/cross-workflow-cascade-helpers.js';

describe('recoverGitPublishSuccess', () => {
  it('preserves local commit on failed publish responses and can recover after retry', () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = makeOrchestrator(persistence);
    orchestrator.loadPlan({
      name: 'git-publish-recover',
      onFinish: 'none',
      tasks: [{ id: 'task-a', description: 'edit workflow', command: 'echo ok', runnerKind: 'worktree' }],
    });
    const task = orchestrator.getAllTasks().find((entry) => entry.id.endsWith('/task-a'))!;
    const commit = 'a'.repeat(40);

    orchestrator.startExecution();
    orchestrator.handleWorkerResponse(makeResponse({
      actionId: task.id,
      status: 'failed',
      outputs: {
        exitCode: 1,
        error: "remote: refusing to allow an OAuth App to create or update workflow `.github/workflows/ci.yml` without `workflow` scope",
        failureClass: 'git-publish-workflow-scope',
        commitHash: commit,
        branch: 'invoker/task-a',
      },
    }));

    const failed = persistence.getTaskEntry(task.id)?.task;
    expect(failed?.execution.commit).toBe(commit);
    expect(failed?.execution.failureClass).toBe('git-publish-workflow-scope');

    orchestrator.recoverGitPublishSuccess(task.id);
    expect(persistence.getTaskEntry(task.id)?.task.status).toBe('completed');
    expect(persistence.getTaskEntry(task.id)?.task.execution.exitCode).toBe(0);
    expect(persistence.getTaskEntry(task.id)?.task.execution.error).toBeUndefined();
    expect(persistence.getTaskEntry(task.id)?.task.execution.commit).toBe(commit);
  });
});
