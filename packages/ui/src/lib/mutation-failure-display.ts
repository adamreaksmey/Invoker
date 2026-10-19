import type { WorkflowMutationFailedEvent } from '@invoker/contracts';

/**
 * Task-scoped and workflow-scoped mutation failures belong in the task panel /
 * workflow UI, not the top banner. The banner is only for failures with no
 * task or workflow context to open. Approve and reject also toast. The
 * confirmation dialog stays open and shows the same reason.
 */
export function shouldShowMutationFailureBanner(
  event: WorkflowMutationFailedEvent,
): boolean {
  if (event.taskId) return false;
  if (event.workflowId) return false;
  return true;
}

export function isOperatorDecisionFailure(event: WorkflowMutationFailedEvent): boolean {
  return event.channel === 'invoker:approve'
    || event.channel === 'invoker:reject'
    || event.headlessCommand === 'approve'
    || event.headlessCommand === 'reject';
}

export function mutationFailureTitle(event: WorkflowMutationFailedEvent): string {
  if (event.channel === 'invoker:approve') return 'Approve failed';
  if (event.channel === 'invoker:reject') return 'Reject failed';
  if (event.channel === 'invoker:fix-with-agent') return 'Fix failed';
  if (event.headlessCommand === 'fix') return 'Fix failed';
  if (event.headlessCommand === 'approve') return 'Approve failed';
  if (event.headlessCommand === 'reject') return 'Reject failed';
  return `Mutation failed (${event.channel})`;
}

export function mutationFailureBannerMessage(
  event: WorkflowMutationFailedEvent,
): string {
  return summarizeBannerMessage(event.message);
}

function summarizeBannerMessage(message: string): string {
  let text = message.replace(/^Error:\s*/, '').trim();
  const stackIdx = text.indexOf('\n    at ');
  if (stackIdx >= 0) text = text.slice(0, stackIdx).trim();
  const firstLine = text.split('\n').find((line) => line.trim().length > 0)?.trim() ?? text;
  if (firstLine.length <= 160) return firstLine;
  return `${firstLine.slice(0, 159).trimEnd()}…`;
}
