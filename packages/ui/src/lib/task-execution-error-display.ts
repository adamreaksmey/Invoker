import {
  FailureClassifier,
  isGitPublishFailureClass,
  type FailureClass,
  type GitPublishFailureClass,
} from '@invoker/workflow-graph';

const SSH_REMOTE_FINALIZE_PREFIX = 'Executor cleanup failed (ssh remote finalize):';
const CLEANUP_TAIL_MARKERS = [
  'pop_var_context',
  'Orphan function call output',
  '[SshExecutor] Recording task result and pushing branch on remote...',
] as const;

function hasCompletedAgentTurn(error: string): boolean {
  return error.includes('"type":"turn.completed"')
    || (error.includes('"type":"item.completed"') && error.includes('"type":"agent_message"'));
}

function normalizeLegacySshCleanupTail(error: string): string | undefined {
  if (error.startsWith(SSH_REMOTE_FINALIZE_PREFIX)) return error;
  if (!hasCompletedAgentTurn(error)) return undefined;
  if (!CLEANUP_TAIL_MARKERS.some((marker) => error.includes(marker))) return undefined;
  if (error.includes('pop_var_context')) {
    return `${SSH_REMOTE_FINALIZE_PREFIX} bash pop_var_context after remote run completed.`;
  }
  if (error.includes('Orphan function call output')) {
    return `${SSH_REMOTE_FINALIZE_PREFIX} orphan function-call output after remote run completed.`;
  }
  return `${SSH_REMOTE_FINALIZE_PREFIX} remote finalize wrapper output after remote run completed.`;
}

export function formatTaskExecutionErrorForDisplay(error?: string): string | undefined {
  if (typeof error !== 'string' || error.length === 0) return error;
  return normalizeLegacySshCleanupTail(error) ?? error;
}

export function resolveGitPublishFailureClass(
  failureClass: FailureClass | undefined,
  error: string | undefined,
): GitPublishFailureClass | undefined {
  if (isGitPublishFailureClass(failureClass)) return failureClass;
  return FailureClassifier.classifyGitPublishError(error);
}

export function describeGitPublishRemediation(args: {
  failureClass: GitPublishFailureClass;
  localCommit?: string;
}): string {
  const commitNote = args.localCommit
    ? `Your changes are saved locally at commit ${args.localCommit.slice(0, 12)}.`
    : 'Your task changes may already be committed locally.';
  switch (args.failureClass) {
    case 'git-publish-workflow-scope':
      return `${commitNote} GitHub rejected the push because this task changed files under .github/workflows/, which requires the workflow OAuth scope over HTTPS. Use SSH for git operations, or run: gh auth refresh -h github.com -s workflow`;
    case 'git-publish-auth':
      return `${commitNote} GitHub rejected the push due to missing or invalid credentials. Check gh auth status and ensure this repository is accessible to the authenticated account.`;
    case 'git-publish-protected-branch':
      return `${commitNote} GitHub rejected the push because branch protection or repository rules block this update. Adjust permissions or publish through an allowed branch or PR workflow.`;
  }
}
