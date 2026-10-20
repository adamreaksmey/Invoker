import { createHash } from 'node:crypto';

/**
 * Compute a deterministic 12-character hash of a repository URL.
 * Used for creating consistent cache directories across executors and pools.
 */
export function computeRepoUrlHash(repoUrl: string): string {
  return createHash('sha256').update(repoUrl).digest('hex').slice(0, 12);
}

/**
 * Compute a cache-only repository identity. This intentionally does not
 * replace the caller's repo URL for git remotes; it only lets equivalent
 * GitHub URL spellings share local mirror/worktree cache directories.
 */
export function computeRepoCacheKey(repoUrl: string): string {
  const normalized = normalizeGitHubRepoUrlForCache(repoUrl.trim());
  return normalized ?? repoUrl;
}

export function computeRepoCacheHash(repoUrl: string): string {
  return computeRepoUrlHash(computeRepoCacheKey(repoUrl));
}

function normalizeGitHubRepoUrlForCache(repoUrl: string): string | undefined {
  const ssh = repoUrl.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?\/?$/i);
  if (ssh) {
    return githubKey(ssh[1], ssh[2]);
  }

  const https = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/i);
  if (https) {
    return githubKey(https[1], https[2]);
  }

  const sshUrl = repoUrl.match(/^ssh:\/\/git@github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/i);
  if (sshUrl) {
    return githubKey(sshUrl[1], sshUrl[2]);
  }

  return undefined;
}

function githubKey(owner: string, repo: string): string {
  return `github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

/**
 * Sanitize a git branch name for use as a filesystem path segment.
 * Converts slashes to hyphens to create a safe directory name.
 * Example: "experiment/task-123-abc" → "experiment-task-123-abc"
 */
export function sanitizeBranchForPath(branch: string): string {
  return branch.replace(/\//g, '-');
}

const TRANSIENT_GIT_PUSH_ERROR_PATTERN = new RegExp([
  'could not resolve host',
  'could not resolve hostname',
  'temporary failure in name resolution',
  'network is unreachable',
  'no route to host',
  'connection timed out',
  'operation timed out',
  'connection reset by peer',
  'connection refused',
  'the requested url returned error: 5\\d\\d',
  '\\b502\\b',
  '\\b503\\b',
  '\\b504\\b',
  '\\bECONNRESET\\b',
  '\\bETIMEDOUT\\b',
  '\\bEAI_AGAIN\\b',
].join('|'), 'i');

export function toGitHubSshRemoteUrl(remoteUrl: string): string | undefined {
  const trimmed = remoteUrl.trim();
  const https = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/i);
  if (https) {
    const repo = https[2].replace(/\.git$/i, '');
    return `git@github.com:${https[1]}/${repo}.git`;
  }
  const sshScheme = trimmed.match(/^ssh:\/\/git@github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/i);
  if (sshScheme) {
    const repo = sshScheme[2].replace(/\.git$/i, '');
    return `git@github.com:${sshScheme[1]}/${repo}.git`;
  }
  return undefined;
}

export function isGitHubHttpsOAuthPushRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/without [`']workflow[`'] scope/i.test(message)) return true;
  if (/Authentication failed for 'https:\/\/github\.com\//i.test(message)) return true;
  if (/Permission to .+ denied/i.test(message)) return true;
  if (/Invalid username or token/i.test(message)) return true;
  return /The requested URL returned error: 403/i.test(message) && /github\.com/i.test(message);
}

export function isTransientGitPushError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return TRANSIENT_GIT_PUSH_ERROR_PATTERN.test(message)
    || isTransientGitHubCliError(err);
}

export interface GitPushRecoveryDeps {
  remoteName: string;
  getRemoteUrl: () => Promise<string>;
  setRemoteUrl: (url: string) => Promise<void>;
}

async function attemptPushWithOptionalSshFallback(
  attemptPush: () => Promise<void>,
  deps?: GitPushRecoveryDeps,
): Promise<void> {
  try {
    await attemptPush();
  } catch (err) {
    if (!deps || !isGitHubHttpsOAuthPushRejection(err)) throw err;
    const currentUrl = (await deps.getRemoteUrl()).trim();
    const sshUrl = toGitHubSshRemoteUrl(currentUrl);
    if (!sshUrl || sshUrl === currentUrl) throw err;
    await deps.setRemoteUrl(sshUrl);
    await attemptPush();
  }
}

export async function pushGitWithGitHubRecovery(
  attemptPush: () => Promise<void>,
  deps?: GitPushRecoveryDeps,
): Promise<void> {
  const transientAttempts = 3;
  const delayMs = 250;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= transientAttempts; attempt++) {
    try {
      await attemptPushWithOptionalSshFallback(attemptPush, deps);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt >= transientAttempts || !isTransientGitPushError(err)) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastErr;
}

export function isGitRefLockRace(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /cannot lock ref\b/i.test(message)
    && (
      /reference already exists/i.test(message)
      || /\bis at\b.+\bbut expected\b/i.test(message)
    );
}

export function isTransientGitHubCliError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\bi\/o timeout\b/i.test(message)
    || /\bcontext deadline exceeded\b/i.test(message)
    || /\bconnection (?:reset|refused|timed out)\b/i.test(message)
    || /\bECONNRESET\b|\bETIMEDOUT\b|\bEAI_AGAIN\b|\bENOTFOUND\b/i.test(message)
    || /\b(?:502|503|504)\b/.test(message)
    || /\bbad gateway\b|\bservice unavailable\b|\bgateway timeout\b/i.test(message)
    || /\brate limit\b/i.test(message);
}

export async function retryTransientGitHubCli<T>(
  operation: () => Promise<T>,
  opts: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const delayMs = opts.delayMs ?? 250;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastErr = err;
      if (attempt >= attempts || !isTransientGitHubCliError(err)) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastErr;
}
