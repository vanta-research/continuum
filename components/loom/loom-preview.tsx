'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface LoomPreviewProps {
  content: string;
  className?: string;
}

export function LoomPreview({ content, className }: LoomPreviewProps) {
  if (!content.trim()) {
    return (
      <div className={cn('h-full w-full flex items-center justify-center p-8', className)}>
        <p className="text-muted-foreground text-sm italic">
          No content yet. Switch to Edit mode to start writing, or ask the AI to help you draft something.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('loom-preview h-full w-full overflow-auto', className)}>
      <div className="prose prose-invert dark:prose-invert max-w-none p-6">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Custom heading styles
            h1: ({ children }) => (
              <h1 className="text-3xl font-bold mb-4 mt-6 first:mt-0 text-foreground border-b border-border/30 pb-2">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-2xl font-semibold mb-3 mt-5 text-foreground">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-xl font-semibold mb-2 mt-4 text-foreground">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-lg font-medium mb-2 mt-3 text-foreground">
                {children}
              </h4>
            ),
            // Paragraph styling
            p: ({ children }) => (
              <p className="mb-4 leading-relaxed text-foreground/90">
                {children}
              </p>
            ),
            // List styling
            ul: ({ children }) => (
              <ul className="list-disc list-inside mb-4 space-y-1 text-foreground/90">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside mb-4 space-y-1 text-foreground/90">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-foreground/90">{children}</li>
            ),
            // Blockquote styling
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-purple-500/50 pl-4 my-4 italic text-muted-foreground bg-purple-500/5 py-2 rounded-r">
                {children}
              </blockquote>
            ),
            // Code styling
            code: ({ className, children, ...props }) => {
              const isInline = !className;
              if (isInline) {
                return (
                  <code className="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono text-purple-300" {...props}>
                    {children}
                  </code>
                );
              }
              return (
                <code className={cn('block bg-muted/30 p-4 rounded-lg overflow-x-auto font-mono text-sm', className)} {...props}>
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre className="bg-muted/30 rounded-lg overflow-x-auto my-4 border border-border/30">
                {children}
              </pre>
            ),
            // Link styling
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
              >
                {children}
              </a>
            ),
            // Horizontal rule
            hr: () => (
              <hr className="my-6 border-border/50" />
            ),
            // Table styling
            table: ({ children }) => (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border border-border/30 rounded-lg overflow-hidden">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-muted/30">{children}</thead>
            ),
            th: ({ children }) => (
              <th className="px-4 py-2 text-left font-semibold border-b border-border/30">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-4 py-2 border-b border-border/20">
                {children}
              </td>
            ),
            // Strong and emphasis
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-foreground/90">{children}</em>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
