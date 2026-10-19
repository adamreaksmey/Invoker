import { describe, expect, it } from 'vitest';
import {
  approvalDialogStillWaiting,
  operatorDecisionFailureCopy,
} from '../lib/approval-decision-feedback.js';

const failedAt = '2026-10-15T14:06:53.000Z';

describe('operatorDecisionFailureCopy', () => {
  it('explains an open pull request instead of the raw artifact status', () => {
    const copy = operatorDecisionFailureCopy({
      intentId: 11,
      workflowId: 'wf-1792071872346-1',
      channel: 'headless.exec',
      headlessCommand: 'approve',
      taskId: '__merge__wf-1792071872346-1',
      message: 'Cannot approve merge gate __merge__wf-1792071872346-1: 1 required review artifact(s) are not approved (2 is open).',
      failedAt,
    });

    expect(copy.title).toBe('Pull request is still open');
    expect(copy.message).toBe(
      'Pull request #2 is still open on GitHub. Merge it there. This screen does not merge it. Invoker marks the plan done after it sees that merge.',
    );
  });

  it('keeps other approve failures on the generic title', () => {
    const copy = operatorDecisionFailureCopy({
      intentId: 1,
      workflowId: 'wf-1',
      channel: 'invoker:approve',
      taskId: 'task-1',
      message: 'missing execution harness "codex"',
      failedAt,
    });

    expect(copy.title).toBe('Approve failed');
    expect(copy.message).toBe('missing execution harness "codex"');
  });
});

describe('approvalDialogStillWaiting', () => {
  it('stays open only while a decision can still be made', () => {
    expect(approvalDialogStillWaiting('review_ready')).toBe(true);
    expect(approvalDialogStillWaiting('awaiting_approval')).toBe(true);
    expect(approvalDialogStillWaiting('completed')).toBe(false);
  });
});
