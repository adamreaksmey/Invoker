import { describe, expect, it } from 'vitest';
import {
  describeGitPublishRemediation,
  formatTaskExecutionErrorForDisplay,
  resolveGitPublishFailureClass,
} from './task-execution-error-display.js';

describe('formatTaskExecutionErrorForDisplay', () => {
  it('normalizes legacy ssh cleanup-tail blobs after a completed agent turn', () => {
    const raw = [
      '{"type":"item.completed","item":{"type":"agent_message","text":"done"}}',
      '{"type":"turn.completed","usage":{"input_tokens":1}}',
      'main: line 1: pop_var_context: head of shell_variables not a function context [SshExecutor] Recording task result and pushing branch on remote...',
    ].join('\n');

    expect(formatTaskExecutionErrorForDisplay(raw)).toBe(
      'Executor cleanup failed (ssh remote finalize): bash pop_var_context after remote run completed.',
    );
  });

  it('leaves unrelated errors unchanged', () => {
    expect(formatTaskExecutionErrorForDisplay('Unit tests failed')).toBe('Unit tests failed');
  });

  it('preserves already-normalized cleanup-tail errors', () => {
    const normalized = 'Executor cleanup failed (ssh remote finalize): bash pop_var_context after remote run completed.';
    expect(formatTaskExecutionErrorForDisplay(normalized)).toBe(normalized);
  });
});

describe('resolveGitPublishFailureClass', () => {
  it('classifies workflow scope errors from raw git output', () => {
    expect(resolveGitPublishFailureClass(
      undefined,
      "remote: refusing to allow an OAuth App to create or update workflow without 'workflow' scope",
    )).toBe('git-publish-workflow-scope');
  });
});

describe('describeGitPublishRemediation', () => {
  it('includes the local commit and gh auth refresh command for workflow scope failures', () => {
    const message = describeGitPublishRemediation({
      failureClass: 'git-publish-workflow-scope',
      localCommit: '238519efeabc1234567890abcdef1234567890ab',
    });

    expect(message).toContain('238519efeabc');
    expect(message).toContain('gh auth refresh -h github.com -s workflow');
    expect(message).toContain('.github/workflows/');
  });
});
