import type { WorkflowMutationFailedEvent } from '@invoker/contracts';
import {
  mutationFailureBannerMessage,
  mutationFailureTitle,
} from './mutation-failure-display.js';

const OPEN_REVIEW_ARTIFACT_PATTERN = /\((\d+) is open\)/;
const OPEN_APPROVAL_STATUSES = new Set(['review_ready', 'awaiting_approval', 'fix_approval']);

export function approvalDialogStillWaiting(status: string): boolean {
  return OPEN_APPROVAL_STATUSES.has(status);
}

export function operatorDecisionFailureCopy(
  event: WorkflowMutationFailedEvent,
): { title: string; message: string } {
  const summary = mutationFailureBannerMessage(event);
  const openPullRequest = summary.match(OPEN_REVIEW_ARTIFACT_PATTERN);
  const isApprove = event.headlessCommand === 'approve' || event.channel === 'invoker:approve';
  if (openPullRequest && isApprove) {
    return {
      title: 'Pull request is still open',
      message: openPullRequestStillOpenMessage(openPullRequest[1]),
    };
  }
  return { title: mutationFailureTitle(event), message: summary };
}

function openPullRequestStillOpenMessage(pullRequestNumber: string): string {
  return `Pull request #${pullRequestNumber} is still open. Merge it on GitHub, then refresh. This plan finishes after GitHub reports that merge.`;
}
