import { describe, expect, it } from 'vitest';
import { buildTaskExecutionPrompt, workRequestToTaskExecutionInput } from '../agent-adapter.js';
import type { WorkRequest } from '@invoker/contracts';

describe('buildTaskExecutionPrompt', () => {
  it('includes constraints and predecessors without orientation packs', () => {
    const prompt = buildTaskExecutionPrompt({
      executionId: 'attempt-1',
      cwd: '/tmp',
      objective: 'Implement feature X',
      constraints: 'Stay within packages/foo',
      verificationCommand: 'pnpm test',
      predecessors: [
        {
          taskId: 'upstream-a',
          description: 'Prepared fixtures',
          commitSha: 'deadbeef',
        },
      ],
    });

    expect(prompt).toContain('Implement feature X');
    expect(prompt).toContain('Constraints:');
    expect(prompt).toContain('Stay within packages/foo');
    expect(prompt).toContain('Verification command (must pass before task completion):');
    expect(prompt).toContain('pnpm test');
    expect(prompt).toContain('[Completed upstream task: upstream-a]');
    expect(prompt).not.toContain('Worker orientation pack');
  });
});

describe('workRequestToTaskExecutionInput', () => {
  it('maps WorkRequest fields into TaskExecutionInput', () => {
    const request: WorkRequest = {
      requestId: 'req-1',
      attemptId: 'attempt-1',
      actionId: 'task-a',
      executionGeneration: 0,
      actionType: 'ai_task',
      inputs: {
        prompt: 'Do the work',
        description: 'Task constraints',
        command: 'pnpm test',
        upstreamContext: [{ taskId: 'dep', description: 'Upstream done', commitHash: 'abc' }],
      },
      callbackUrl: '',
      timestamps: { createdAt: '2026-01-01T00:00:00.000Z' },
    };

    const input = workRequestToTaskExecutionInput(request, '/repo');
    expect(input.executionId).toBe('attempt-1');
    expect(input.objective).toBe('Do the work');
    expect(input.constraints).toBe('Task constraints');
    expect(input.verificationCommand).toBe('pnpm test');
    expect(input.predecessors?.[0]?.commitSha).toBe('abc');
  });
});
