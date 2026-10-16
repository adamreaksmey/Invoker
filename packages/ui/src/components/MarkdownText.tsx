import type { JSX, ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { splitMarkdownDetails, type MarkdownSegment } from '../lib/markdown-details.js';

const HEADING_CLASS = 'font-semibold text-foreground [&:not(:first-child)]:mt-3';
const INLINE_CODE_CLASS = 'rounded bg-muted px-1 py-0.5 font-mono text-[0.92em] text-foreground';
const BLOCK_CODE_CLASS = 'my-2 overflow-x-auto rounded-lg border border-border bg-card/80 px-3 py-2.5 font-mono text-[12px] leading-5 text-foreground';
const TABLE_CLASS = 'my-2 w-full border-collapse text-left';
const CELL_CLASS = 'border border-border px-2 py-1 align-top';

function MarkdownHeading({ tag, className, children }: { tag: 'h1' | 'h2' | 'h3' | 'h4'; className: string; children: ReactNode }): JSX.Element {
  const Tag = tag;
  return <Tag className={className}>{children}</Tag>;
}

function MarkdownCode({ className, children }: { className?: string; children?: ReactNode }): JSX.Element {
  if (className) return <code className={className}>{children}</code>;
  return <code className={INLINE_CODE_CLASS}>{children}</code>;
}

const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: ReactNode }) => <p className="whitespace-pre-wrap [&:not(:first-child)]:mt-2">{children}</p>,
  ul: ({ children }: { children?: ReactNode }) => <ul className="my-1 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }: { children?: ReactNode }) => <ol className="my-1 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }: { children?: ReactNode }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }: { children?: ReactNode }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }: { children?: ReactNode }) => <em className="italic">{children}</em>,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={href} className="underline underline-offset-2" target="_blank" rel="noreferrer">{children}</a>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  h1: ({ children }: { children?: ReactNode }) => <MarkdownHeading tag="h1" className={`${HEADING_CLASS} text-[15px]`}>{children}</MarkdownHeading>,
  h2: ({ children }: { children?: ReactNode }) => <MarkdownHeading tag="h2" className={`${HEADING_CLASS} text-[14px]`}>{children}</MarkdownHeading>,
  h3: ({ children }: { children?: ReactNode }) => <MarkdownHeading tag="h3" className={`${HEADING_CLASS} text-[13.5px]`}>{children}</MarkdownHeading>,
  h4: ({ children }: { children?: ReactNode }) => <MarkdownHeading tag="h4" className={`${HEADING_CLASS} text-[13px]`}>{children}</MarkdownHeading>,
  pre: ({ children }: { children?: ReactNode }) => <pre className={BLOCK_CODE_CLASS}>{children}</pre>,
  code: MarkdownCode,
  table: ({ children }: { children?: ReactNode }) => <table className={TABLE_CLASS}>{children}</table>,
  th: ({ children }: { children?: ReactNode }) => <th className={`${CELL_CLASS} font-medium text-foreground`}>{children}</th>,
  td: ({ children }: { children?: ReactNode }) => <td className={CELL_CLASS}>{children}</td>,
};

function MarkdownBody({ text }: { text: string }): JSX.Element {
  return <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{text}</Markdown>;
}

function MarkdownSegmentView({ segment }: { segment: MarkdownSegment }): JSX.Element {
  if (segment.kind === 'markdown') return <MarkdownBody text={segment.text} />;
  return (
    <details className="my-2">
      <summary className="cursor-pointer font-medium text-foreground">{segment.summary}</summary>
      <MarkdownText text={segment.text} />
    </details>
  );
}

export function MarkdownText({ text, className = '' }: { text: string; className?: string }): JSX.Element {
  const segments = splitMarkdownDetails(text);
  return (
    <div className={className}>
      {segments.map((segment, index) => (
        <MarkdownSegmentView key={segmentKey(segment, index)} segment={segment} />
      ))}
    </div>
  );
}

function segmentKey(segment: MarkdownSegment, index: number): string {
  return `${segment.kind}-${index}`;
}
