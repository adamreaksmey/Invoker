import { describe, expect, it } from 'vitest';
import {
  PLANNING_CLONE_IN_PROGRESS,
  isLocalPlanningRepoUrl,
  planningCloneReadyText,
} from '../planning-clone-status.js';

describe('isLocalPlanningRepoUrl', () => {
  it('detects absolute and relative filesystem paths', () => {
    expect(isLocalPlanningRepoUrl('/Users/amos/dev/hrm-meta/main')).toBe(true);
    expect(isLocalPlanningRepoUrl('/tmp/repo-a')).toBe(true);
    expect(isLocalPlanningRepoUrl('./local-repo')).toBe(true);
    expect(isLocalPlanningRepoUrl('../sibling')).toBe(true);
    expect(isLocalPlanningRepoUrl('.')).toBe(true);
    expect(isLocalPlanningRepoUrl('file:///tmp/repo')).toBe(true);
    expect(isLocalPlanningRepoUrl('C:\\Users\\amos\\repo')).toBe(true);
  });

  it('detects remote git URLs', () => {
    expect(isLocalPlanningRepoUrl('git@github.com:meksys-dev/hrm-meta.git')).toBe(false);
    expect(isLocalPlanningRepoUrl('https://github.com/meksys-dev/hrm-meta')).toBe(false);
    expect(isLocalPlanningRepoUrl('ssh://git@github.com/meksys-dev/hrm-meta.git')).toBe(false);
  });
});

describe('planningCloneReadyText', () => {
  it('uses ready/worktree wording for local paths', () => {
    expect(planningCloneReadyText('/tmp/repo-a', 'main', 'provision')).toBe(
      'Ready: tmp/repo-a on main (isolated planning worktree).',
    );
    expect(planningCloneReadyText('/tmp/repo-a', 'main', 'reuse')).toBe(
      'Already ready on main: tmp/repo-a.',
    );
  });

  it('keeps clone wording for remote URLs', () => {
    expect(planningCloneReadyText('https://github.com/acme/widgets.git', 'main', 'provision')).toBe(
      'Cloned acme/widgets on main.',
    );
    expect(planningCloneReadyText('git@github.com:acme/widgets.git', 'master', 'reuse')).toBe(
      'Already cloned. Ready on master: acme/widgets.',
    );
  });

  it('uses preparing copy for in-progress status', () => {
    expect(PLANNING_CLONE_IN_PROGRESS).toBe('Preparing repository…');
  });
});
