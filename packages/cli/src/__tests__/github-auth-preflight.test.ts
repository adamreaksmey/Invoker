import { describe, expect, it } from 'vitest';
import { checkGithubWorkflowScope, parseGhAuthStatusOutput } from '../github-auth-preflight.js';

describe('parseGhAuthStatusOutput', () => {
  it('reads git protocol and token scopes from gh auth status output', () => {
    const output = [
      'github.com',
      '  ✓ Logged in to github.com account user (keyring)',
      '  - Git operations protocol: https',
      "  - Token scopes: 'gist', 'repo', 'read:org'",
    ].join('\n');
    expect(parseGhAuthStatusOutput(output)).toEqual({
      gitProtocol: 'https',
      tokenScopes: ['gist', 'repo', 'read:org'],
    });
  });
});

describe('checkGithubWorkflowScope', () => {
  it('passes when git operations use SSH', () => {
    const check = checkGithubWorkflowScope(() => ({
      status: 0,
      stdout: 'Git operations protocol: ssh\nToken scopes: \'repo\'',
      stderr: '',
    }));
    expect(check.status).toBe('ok');
  });

  it('warns when HTTPS is active without the workflow scope', () => {
    const check = checkGithubWorkflowScope(() => ({
      status: 0,
      stdout: 'Git operations protocol: https\nToken scopes: \'repo\'',
      stderr: '',
    }));
    expect(check.status).toBe('warn');
    expect(check.remediation).toContain('gh auth refresh -h github.com -s workflow');
  });
});
