import { describe, expect, it } from 'vitest';
import { splitMarkdownDetails } from '../lib/markdown-details.js';

describe('splitMarkdownDetails', () => {
  it('keeps markdown around a details block', () => {
    const segments = splitMarkdownDetails([
      '## Summary',
      '',
      '<details>',
      '<summary>Task breakdown</summary>',
      '',
      '| Task | Status |',
      '|------|--------|',
      '| task-a | completed |',
      '</details>',
    ].join('\n'));

    expect(segments).toEqual([
      { kind: 'markdown', text: '## Summary' },
      {
        kind: 'details',
        summary: 'Task breakdown',
        text: '| Task | Status |\n|------|--------|\n| task-a | completed |',
      },
    ]);
  });
});