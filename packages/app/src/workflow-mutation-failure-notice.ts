import type { WorkflowMutationFailedEvent } from '@invoker/contracts';

export function reportWorkflowMutationFailure(
  event: WorkflowMutationFailedEvent,
  publish: (event: WorkflowMutationFailedEvent) => void,
  sendToLocalWindow?: (event: WorkflowMutationFailedEvent) => void,
): void {
  publish(event);
  sendToLocalWindow?.(event);
}

export function forwardViewerWorkflowMutationFailure(
  ownerMode: boolean,
  event: WorkflowMutationFailedEvent,
  sendToLocalWindow: (event: WorkflowMutationFailedEvent) => void,
): void {
  if (ownerMode) return;
  sendToLocalWindow(event);
}
