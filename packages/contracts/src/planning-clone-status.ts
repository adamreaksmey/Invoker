export const PLANNING_CLONE_IN_PROGRESS = 'Cloning repository…';

export const PLANNING_CLONE_FAILED_PREFIX = 'Clone failed: ';

export const PLANNING_CLONE_FINISHED_BIND_FAILED_PREFIX = 'Clone finished, but binding failed: ';

export type PlanningCloneAction = 'reuse' | 'provision' | 'invalidate_and_block_submit';

export function planningRepoLabel(repoUrl: string): string {
  const trimmed = repoUrl.trim().replace(/\.git$/, '');
  const segments = trimmed.split(/[/:]/).filter(Boolean);
  const tail = segments.length >= 2 ? segments.slice(-2).join('/') : segments.at(-1);
  return tail ?? trimmed;
}

export function planningCloneReadyText(
  repoUrl: string,
  baseBranch: string | undefined,
  action: PlanningCloneAction,
): string {
  const label = planningRepoLabel(repoUrl);
  const branch = baseBranch?.trim();
  if (action === 'reuse') return reuseCloneStatus(label, branch);
  if (!branch) return `Cloned ${label}.`;
  return `Cloned ${label} on ${branch}.`;
}

function reuseCloneStatus(label: string, branch: string | undefined): string {
  if (!branch) return `Already cloned. Ready: ${label}.`;
  return `Already cloned. Ready on ${branch}: ${label}.`;
}

export function planningBindFailureLine(message: string): string {
  if (message.startsWith(PLANNING_CLONE_FAILED_PREFIX)) return message;
  if (message.startsWith(PLANNING_CLONE_FINISHED_BIND_FAILED_PREFIX)) return message;
  return `Could not bind repository: ${message}`;
}
