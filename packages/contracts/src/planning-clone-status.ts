export const PLANNING_CLONE_IN_PROGRESS = 'Preparing repository…';

export const PLANNING_CLONE_FAILED_PREFIX = 'Clone failed: ';

export const PLANNING_CLONE_FINISHED_BIND_FAILED_PREFIX = 'Clone finished, but binding failed: ';

export type PlanningCloneAction = 'reuse' | 'provision' | 'invalidate_and_block_submit';

export function planningRepoLabel(repoUrl: string): string {
  const trimmed = repoUrl.trim().replace(/\.git$/, '');
  const segments = trimmed.split(/[/:]/).filter(Boolean);
  const tail = segments.length >= 2 ? segments.slice(-2).join('/') : segments.at(-1);
  return tail ?? trimmed;
}

/** True when the planning bind target is a filesystem path rather than a git remote URL. */
export function isLocalPlanningRepoUrl(repoUrl: string): boolean {
  const trimmed = repoUrl.trim();
  if (!trimmed) return false;
  if (trimmed === '.' || trimmed.startsWith('./') || trimmed.startsWith('../')) return true;
  if (/^file:/i.test(trimmed)) return true;
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) return true;
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) return true;
  if (/^git@[^:]+:/.test(trimmed)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) return false;
  return false;
}

export function planningCloneReadyText(
  repoUrl: string,
  baseBranch: string | undefined,
  action: PlanningCloneAction,
): string {
  const label = planningRepoLabel(repoUrl);
  const branch = baseBranch?.trim();
  const local = isLocalPlanningRepoUrl(repoUrl);
  if (action === 'reuse') return reuseReadyStatus(label, branch, local);
  if (local) {
    if (!branch) return `Ready: ${label} (isolated planning worktree).`;
    return `Ready: ${label} on ${branch} (isolated planning worktree).`;
  }
  if (!branch) return `Cloned ${label}.`;
  return `Cloned ${label} on ${branch}.`;
}

function reuseReadyStatus(label: string, branch: string | undefined, local: boolean): string {
  if (local) {
    if (!branch) return `Already ready: ${label}.`;
    return `Already ready on ${branch}: ${label}.`;
  }
  if (!branch) return `Already cloned. Ready: ${label}.`;
  return `Already cloned. Ready on ${branch}: ${label}.`;
}

export function planningBindFailureLine(message: string): string {
  if (message.startsWith(PLANNING_CLONE_FAILED_PREFIX)) return message;
  if (message.startsWith(PLANNING_CLONE_FINISHED_BIND_FAILED_PREFIX)) return message;
  return `Could not bind repository: ${message}`;
}
