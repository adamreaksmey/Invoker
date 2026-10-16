import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveHandoffScrubCommand } from '../handoff-scrub-command.js';

const TARGET_REPO_COMMAND = 'bash scripts/scrub-handoff-artifacts.sh';

function runCheck(command: string, cwd: string): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('/bin/bash', ['-c', command], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const failed = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failed.status ?? 1, stdout: failed.stdout ?? '', stderr: failed.stderr ?? '' };
  }
}

describe('resolveHandoffScrubCommand', () => {
  it('checks the worktree when the Invoker script is absent', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'handoff-scrub-clean-'));
    const command = resolveHandoffScrubCommand(TARGET_REPO_COMMAND);
    const result = runCheck(command, cwd);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('scrub-handoff-artifacts-ok');
  });

  it('fails when a handoff artifact remains and does not delete it', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'handoff-scrub-dirty-'));
    writeFileSync(join(cwd, 'candidates.json'), '{}');
    const result = runCheck(resolveHandoffScrubCommand(TARGET_REPO_COMMAND), cwd);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('candidates.json');
    expect(runCheck('test -f candidates.json', cwd).status).toBe(0);
  });

  it('leaves an apply invocation unchanged', () => {
    const command = 'bash scripts/scrub-handoff-artifacts.sh --apply';
    expect(resolveHandoffScrubCommand(command)).toBe(command);
  });

  it('leaves unrelated commands unchanged', () => {
    expect(resolveHandoffScrubCommand('echo hello')).toBe('echo hello');
  });
});
