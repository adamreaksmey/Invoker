import { describe, expect, it, vi } from 'vitest';
import type { WorkflowMutationFailedEvent } from '@invoker/contracts';
import {
  forwardViewerWorkflowMutationFailure,
  reportWorkflowMutationFailure,
} from '../workflow-mutation-failure-notice.js';

const failure: WorkflowMutationFailedEvent = {
  intentId: 15,
  workflowId: 'wf-1',
  channel: 'headless.exec',
  headlessCommand: 'approve',
  taskId: '__merge__wf-1',
  message: '2 is open',
  failedAt: '2026-10-15T14:39:33.000Z',
};

describe('workflow mutation failure notice', () => {
  it('publishes the failure and also tells a local window', () => {
    const publish = vi.fn();
    const sendToLocalWindow = vi.fn();
    reportWorkflowMutationFailure(failure, publish, sendToLocalWindow);
    expect(publish).toHaveBeenCalledWith(failure);
    expect(sendToLocalWindow).toHaveBeenCalledWith(failure);
  });

  it('forwards a published failure only to a viewer window', () => {
    const sendToLocalWindow = vi.fn();
    forwardViewerWorkflowMutationFailure(true, failure, sendToLocalWindow);
    forwardViewerWorkflowMutationFailure(false, failure, sendToLocalWindow);
    expect(sendToLocalWindow).toHaveBeenCalledTimes(1);
  });
});