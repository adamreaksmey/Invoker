import { describe, expect, it } from 'vitest';
import type { WorkRequest } from '@invoker/contracts';
import { BaseExecutor, type BaseEntry } from '../base-executor.js';
import type { ExecutorHandle, TerminalSpec } from '../executor.js';

class PromptProbeExecutor extends BaseExecutor<BaseEntry> {
  readonly type = 'prompt-probe';

  async start(_request: WorkRequest): Promise<ExecutorHandle> {
    throw new Error('Not implemented');
  }
  sendInput(_handle: ExecutorHandle, _input: string): void {}
  getTerminalSpec(_handle: ExecutorHandle): TerminalSpec | null { return null; }
  getRestoredTerminalSpec(): TerminalSpec { throw new Error('Not implemented'); }
  async destroyAll(): Promise<void> { this.entries.clear(); }

  promptFor(request: WorkRequest): string {
    return this.buildFullPrompt(request);
  }
}

function makeAiTaskRequest(prompt: string): WorkRequest {
  return {
    requestId: 'req-orientation',
    actionId: 'packages/execution-engine/add-orientation-pack',
    executionGeneration: 0,
    actionType: 'ai_task',
    inputs: {
      description: 'Inject a worker orientation pack into feature-task prompts',
      prompt,
    },
    callbackUrl: '',
    timestamps: {
      createdAt: '2026-09-15T00:00:00.000Z',
    },
  };
}

describe('task execution prompt policy', () => {
  it('passes the task objective without control-plane orientation packs', () => {
    const taskGoal = 'Goal: Add a typed task summary field.';
    const prompt = new PromptProbeExecutor().promptFor(makeAiTaskRequest([
      taskGoal,
      'Implementation details: Touch the execution-engine task runner only.',
    ].join('\n')));

    expect(prompt).toContain(taskGoal);
    expect(prompt).not.toContain('Worker orientation pack');
    expect(prompt).not.toContain('Owning package');
    expect(prompt).not.toMatch(/class[- ]search|git log --grep|git log -S|gh pr list --search/i);
  });

  it('includes an explicit verification command contract when provided', () => {
    const request = makeAiTaskRequest('Goal: run checks');
    request.inputs.command = 'pnpm --filter @invoker/execution-engine test';

    const prompt = new PromptProbeExecutor().promptFor(request);
    expect(prompt).toContain('Verification command (must pass before task completion):');
    expect(prompt).toContain('pnpm --filter @invoker/execution-engine test');
  });

  it('puts the current task before upstream and scrubs read-only verify non-goals', () => {
    const taskGoal = 'Goal: Build a responsive, accessible same-device board UI wired to the engine.';
    const request = makeAiTaskRequest(taskGoal);
    request.inputs.upstreamContext = [
      {
        taskId: 'wf/verify-engine-tests',
        description:
          'Safety invariant: This command only runs the repo test script; it does not modify production code.\n'
          + 'Non-goals: Do not modify source files during verification.',
        summary: 'npm test passed',
        commitHash: 'abc1234',
        commitMessage: 'invoker: verify — Do not modify source files during verification.',
      },
    ];

    const prompt = new PromptProbeExecutor().promptFor(request);
    const taskAt = prompt.indexOf(taskGoal);
    const upstreamAt = prompt.indexOf('Completed upstream dependencies');
    expect(taskAt).toBeGreaterThanOrEqual(0);
    expect(upstreamAt).toBeGreaterThan(taskAt);
    expect(prompt).toContain('Do not adopt upstream Non-goals');
    expect(prompt).toContain('[Completed upstream task: wf/verify-engine-tests]');
    expect(prompt).toContain('Status: completed (read-only verification).');
    expect(prompt).not.toMatch(/Do not modify source files during verification/i);
    expect(prompt).toContain('Summary: npm test passed');
    expect(prompt).toContain('Commit: abc1234');
  });
});
