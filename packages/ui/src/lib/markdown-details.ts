const DETAILS_BLOCK_PATTERN = /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;

export interface MarkdownSegment {
  kind: 'markdown' | 'details';
  text: string;
  summary?: string;
}

export function splitMarkdownDetails(source: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  let cursor = 0;
  for (const match of source.matchAll(DETAILS_BLOCK_PATTERN)) {
    pushMarkdown(segments, source.slice(cursor, match.index ?? cursor));
    segments.push({ kind: 'details', summary: match[1].trim(), text: match[2].trim() });
    cursor = (match.index ?? cursor) + match[0].length;
  }
  pushMarkdown(segments, source.slice(cursor));
  if (segments.length === 0) segments.push({ kind: 'markdown', text: source });
  return segments;
}

function pushMarkdown(segments: MarkdownSegment[], text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  segments.push({ kind: 'markdown', text: trimmed });
}
