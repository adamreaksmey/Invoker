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

function makeRepairTaskRequest(prompt: string): WorkRequest {
  return {
    requestId: 'req-repair',
    actionId: 'admin-bypass-repair-check-pr-12911-198ca85',
    executionGeneration: 0,
    actionType: 'ai_task',
    inputs: {
      description: 'Repair the PR Body check on pull request #12911',
      prompt,
    },
    callbackUrl: '',
    timestamps: {
      createdAt: '2026-09-22T00:00:00.000Z',
    },
  };
}

const REPAIR_JOB_LOG_TAIL = [
  'Job log (tail):',
  'PR Body\tInstall validator deps\t2026-09-22T07:50:27.9Z  WARN  There are cyclic workspace'
    + ' dependencies: /home/runner/work/Invoker/Invoker/packages/data-store,'
    + ' /home/runner/work/Invoker/Invoker/packages/persistence',
  'PR Body\tInstall validator deps\t2026-09-22T07:50:32.0Z  WARN  Failed to create bin at'
    + ' /home/runner/work/Invoker/Invoker/packages/app/node_modules/.bin/invoker-cli',
].join('\n');

describe('worker orientation pack prompts', () => {
  it('prepends scoped orientation and does not inject class-search for default feature tasks', () => {
    const prompt = new PromptProbeExecutor().promptFor(makeAiTaskRequest([
      'Goal: Add a typed task summary field.',
      'Implementation details: Touch the execution-engine task runner only.',
    ].join('\n')));

    expect(prompt).toContain('Owning package');
    expect(prompt).toContain('Allowed files');
    expect(prompt).toContain('Do not start with an unscoped repository walk');
    expect(prompt).not.toMatch(/class[- ]search|git log --grep|git log -S|gh pr list --search/i);
  });

  it('does not scope a repair task to a package that only appears in the CI job log tail', () => {
    const prompt = new PromptProbeExecutor().promptFor(makeRepairTaskRequest([
      "This PR's CI check is failing. Diagnose why it is failing, then fix it.",
      'Failed check: PR Body',
      REPAIR_JOB_LOG_TAIL,
    ].join('\n')));

    expect(prompt).not.toContain('Owning package: packages/data-store');
    expect(prompt).toContain(
      'Owning package: not specified; infer the narrowest package from the named files before editing',
    );
  });

  it('tells a worker to reconcile HEAD with a Head SHA the task names', () => {
    const prompt = new PromptProbeExecutor().promptFor(makeRepairTaskRequest([
      'Address the unresolved review thread PRRT_kwDOT3uYWs6lYaDH.',
      '',
      'PR: #870',
      'Head branch: reflect/claimed-search-not-run-20260923',
      'Head SHA: 704f2db7bae560ed72a4d22a372eeff7a72864f1',
    ].join('\n')));

    expect(prompt).toContain('Head SHA 704f2db7bae560ed72a4d22a372eeff7a72864f1 is named in this task');
    expect(prompt).toContain('git rev-parse HEAD');
    expect(prompt).toContain('git reset --hard 704f2db7bae560ed72a4d22a372eeff7a72864f1');
  });

  it('tells a worker to stash uncommitted work before the hard reset', () => {
    const prompt = new PromptProbeExecutor().promptFor(makeRepairTaskRequest([
      'Address the unresolved review thread PRRT_kwDOT3uYWs6lYaDH.',
      '',
      'Head SHA: 704f2db7bae560ed72a4d22a372eeff7a72864f1',
    ].join('\n')));

    expect(prompt).toContain('git status --porcelain');
    expect(prompt).toContain('git stash push -u');
    expect(prompt.indexOf('git stash push -u')).toBeLessThan(
      prompt.indexOf('git reset --hard 704f2db7bae560ed72a4d22a372eeff7a72864f1'),
    );
  });

  it('stays silent about stashing when the task names no Head SHA', () => {
    const prompt = new PromptProbeExecutor().promptFor(makeAiTaskRequest([
      'Goal: Add a typed task summary field.',
    ].join('\n')));

    expect(prompt).not.toContain('git stash push -u');
  });

  it('stays silent about HEAD when the task names no Head SHA', () => {
    const prompt = new PromptProbeExecutor().promptFor(makeAiTaskRequest([
      'Goal: Add a typed task summary field.',
      'Implementation details: Touch the execution-engine task runner only.',
    ].join('\n')));

    expect(prompt).not.toContain('git rev-parse HEAD');
    expect(prompt).not.toMatch(/Head SHA/i);
  });

  it('does not treat a Head SHA from the CI job log tail as the task-named head', () => {
    const prompt = new PromptProbeExecutor().promptFor(makeRepairTaskRequest([
      "This PR's CI check is failing. Diagnose why it is failing, then fix it.",
      'Failed check: PR Body',
      'Job log (tail):',
      'PR Body\tCheckout\tHead SHA: 0123456789abcdef0123456789abcdef01234567',
    ].join('\n')));

    expect(prompt).not.toContain('git rev-parse HEAD');
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

  it('still scopes a repair task to a package named before the job log tail', () => {
    const prompt = new PromptProbeExecutor().promptFor(makeRepairTaskRequest([
      "This PR's CI check is failing. Diagnose why it is failing, then fix it.",
      'Failed check: unit / packages/execution-engine',
      REPAIR_JOB_LOG_TAIL,
    ].join('\n')));

    expect(prompt).toContain('Owning package: packages/execution-engine');
  });
});
