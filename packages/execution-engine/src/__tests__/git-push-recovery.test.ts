import { describe, expect, it, vi } from 'vitest';
import {
  isGitHubHttpsOAuthPushRejection,
  pushGitWithGitHubRecovery,
  toGitHubSshRemoteUrl,
} from '../git-utils.js';

describe('toGitHubSshRemoteUrl', () => {
  it('converts https GitHub remotes to SSH form', () => {
    expect(toGitHubSshRemoteUrl('https://github.com/o/r.git')).toBe('git@github.com:o/r.git');
    expect(toGitHubSshRemoteUrl('https://github.com/o/r')).toBe('git@github.com:o/r.git');
  });

  it('converts ssh:// GitHub remotes to git@ form', () => {
    expect(toGitHubSshRemoteUrl('ssh://git@github.com/o/r.git')).toBe('git@github.com:o/r.git');
  });

  it('returns undefined for non-GitHub remotes', () => {
    expect(toGitHubSshRemoteUrl('git@gitlab.com:o/r.git')).toBeUndefined();
    expect(toGitHubSshRemoteUrl('/tmp/bare.git')).toBeUndefined();
  });
});

describe('isGitHubHttpsOAuthPushRejection', () => {
  it('detects workflow scope and HTTPS auth failures', () => {
    expect(isGitHubHttpsOAuthPushRejection(
      "remote: refusing to update workflow without 'workflow' scope",
    )).toBe(true);
    expect(isGitHubHttpsOAuthPushRejection(
      "fatal: Authentication failed for 'https://github.com/o/r.git/'",
    )).toBe(true);
    expect(isGitHubHttpsOAuthPushRejection('remote: Permission to o/r.git denied to user.')).toBe(true);
  });
});

describe('pushGitWithGitHubRecovery', () => {
  it('retries push over SSH after HTTPS OAuth rejection', async () => {
    const push = vi.fn()
      .mockRejectedValueOnce(new Error("Authentication failed for 'https://github.com/o/r.git/'"))
      .mockResolvedValueOnce(undefined);
    const setRemoteUrl = vi.fn(async () => {});

    await pushGitWithGitHubRecovery(push, {
      remoteName: 'origin',
      getRemoteUrl: async () => 'https://github.com/o/r.git',
      setRemoteUrl,
    });

    expect(push).toHaveBeenCalledTimes(2);
    expect(setRemoteUrl).toHaveBeenCalledWith('git@github.com:o/r.git');
  });

  it('retries transient push failures before giving up', async () => {
    vi.useFakeTimers();
    const push = vi.fn()
      .mockRejectedValueOnce(new Error('fatal: unable to access: Could not resolve host: github.com'))
      .mockResolvedValueOnce(undefined);

    const pending = pushGitWithGitHubRecovery(push);
    await vi.advanceTimersByTimeAsync(250);
    await pending;

    expect(push).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
