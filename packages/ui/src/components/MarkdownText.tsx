import type { JSX, ReactNode } from 'react';
import Markdown from 'react-markdown';

const HEADING_CLASS = 'font-semibold text-foreground [&:not(:first-child)]:mt-3';
const INLINE_CODE_CLASS = 'rounded bg-muted px-1 py-0.5 font-mono text-[0.92em] text-foreground';
const BLOCK_CODE_CLASS = 'my-2 overflow-x-auto rounded-lg border border-border bg-card/80 px-3 py-2.5 font-mono text-[12px] leading-5 text-foreground';

function MarkdownHeading({ tag, className, children }: { tag: 'h1' | 'h2' | 'h3'; className: string; children: ReactNode }): JSX.Element {
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
  h1: ({ children }: { children?: ReactNode }) => <MarkdownHeading tag="h1" className={`${HEADING_CLASS} text-[15px]`}>{children}</MarkdownHeading>,
  h2: ({ children }: { children?: ReactNode }) => <MarkdownHeading tag="h2" className={`${HEADING_CLASS} text-[14px]`}>{children}</MarkdownHeading>,
  h3: ({ children }: { children?: ReactNode }) => <MarkdownHeading tag="h3" className={`${HEADING_CLASS} text-[13.5px]`}>{children}</MarkdownHeading>,
  pre: ({ children }: { children?: ReactNode }) => <pre className={BLOCK_CODE_CLASS}>{children}</pre>,
  code: MarkdownCode,
};

export function MarkdownText({ text, className = '' }: { text: string; className?: string }): JSX.Element {
  return (
    <div className={className}>
      <Markdown components={MARKDOWN_COMPONENTS}>{text}</Markdown>
    </div>
  );
}
