import { spawnSync } from 'node:child_process';
import type { PrerequisiteCheck } from '@invoker/contracts';
import type { CommandRunner, CommandRunnerResult } from './onboarding.js';

const WORKFLOW_SCOPE_REMEDIATION = 'gh auth refresh -h github.com -s workflow';

export function parseGhAuthStatusOutput(output: string): {
  gitProtocol?: string;
  tokenScopes: string[];
} {
  const protocolMatch = output.match(/Git operations protocol:\s*(\S+)/i);
  const scopesLine = output.match(/Token scopes:\s*(.+)/i);
  const tokenScopes: string[] = [];
  if (scopesLine?.[1]) {
    const scopeMatches = scopesLine[1].matchAll(/['`]([^'`]+)['`]/g);
    for (const match of scopeMatches) {
      const scope = match[1]?.trim();
      if (scope) tokenScopes.push(scope);
    }
  }
  return {
    gitProtocol: protocolMatch?.[1]?.trim().toLowerCase(),
    tokenScopes,
  };
}

function skippedWorkflowScopeCheck(): PrerequisiteCheck {
  return {
    id: 'github-workflow-scope',
    name: 'GitHub workflow push scope',
    status: 'warn',
    detail: 'gh not installed; skipped workflow OAuth scope check',
    remediation: 'Install GitHub CLI, then run `gh auth refresh -h github.com -s workflow` if you push workflow changes over HTTPS',
  };
}

function ghAuthStatusResult(runner: CommandRunner): CommandRunnerResult | 'missing' {
  try {
    return runner('gh', ['auth', 'status']);
  } catch {
    return 'missing';
  }
}

export function checkGithubWorkflowScope(runner: CommandRunner): PrerequisiteCheck {
  let result: CommandRunnerResult | 'missing';
  try {
    result = ghAuthStatusResult(runner);
  } catch {
    return skippedWorkflowScopeCheck();
  }
  if (result === 'missing') return skippedWorkflowScopeCheck();

  const combined = `${result.stdout}\n${result.stderr}`;
  if (result.status !== 0) {
    return {
      id: 'github-workflow-scope',
      name: 'GitHub workflow push scope',
      status: 'warn',
      detail: 'gh is not authenticated; skipped workflow OAuth scope check',
      remediation: 'Run `gh auth login`, then `gh auth refresh -h github.com -s workflow` if you push workflow changes over HTTPS',
    };
  }

  const { gitProtocol, tokenScopes } = parseGhAuthStatusOutput(combined);
  if (gitProtocol === 'ssh') {
    return {
      id: 'github-workflow-scope',
      name: 'GitHub workflow push scope',
      status: 'ok',
      detail: 'Git operations use SSH; OAuth workflow scope is not required for git push',
    };
  }

  if (tokenScopes.includes('workflow')) {
    return {
      id: 'github-workflow-scope',
      name: 'GitHub workflow push scope',
      status: 'ok',
      detail: 'GitHub OAuth token includes the workflow scope for HTTPS pushes',
    };
  }

  return {
    id: 'github-workflow-scope',
    name: 'GitHub workflow push scope',
    status: 'warn',
    detail: 'HTTPS git push can fail when tasks change .github/workflows/ because the GitHub OAuth token lacks the workflow scope',
    remediation: WORKFLOW_SCOPE_REMEDIATION,
  };
}

export function defaultGhAuthStatusRunner(): CommandRunnerResult {
  const result = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
  return {
    status: result.status,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
  };
}
