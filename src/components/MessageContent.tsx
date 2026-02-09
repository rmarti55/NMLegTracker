"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ReactNode } from "react";

interface MessageContentProps {
  content: string;
  onGoToPage?: (page: number) => void;
}

// Regex to match [page X] or [page X-Y] patterns
const PAGE_LINK_REGEX = /\[page\s+([\d\w-]+)\]|\(page\s+(\d+)\)|p\.?\s*(\d+)|see\s+page\s+(\d+)/gi;

export default function MessageContent({
  content,
  onGoToPage,
}: MessageContentProps) {
  // Pre-process content to convert [page X] to markdown links
  // so react-markdown can handle them
  const processedContent = content.replace(
    PAGE_LINK_REGEX,
    (match, pageRef1, pageRef2, pageRef3, pageRef4) => {
      const pageRef = pageRef1 || pageRef2 || pageRef3 || pageRef4;
      if (!pageRef) return match;
      return `[${match}](#page-${pageRef})`;
    }
  );

  return (
    <div className="chat-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Custom link renderer to handle page references
        a: ({ href, children }) => {
          // Check if this is a page link
          if (href?.startsWith("#page-") && onGoToPage) {
            const pageRef = href.replace("#page-", "");
            // Extract the first number from the page reference (e.g., "1-1" -> 1)
            const pageMatch = pageRef.match(/^(\d+)/);
            const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : 1;

            return (
              <button
                onClick={() => onGoToPage(pageNumber)}
                className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors cursor-pointer"
              >
                {children}
              </button>
            );
          }

          // Regular external link
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {children}
            </a>
          );
        },
        // Ensure paragraphs don't add excessive margins
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        // Style lists nicely
        ul: ({ children }) => (
          <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        // Style headers appropriately for chat context
        h1: ({ children }) => (
          <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold mt-3 mb-1">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
        ),
        // Code blocks
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-black/5 px-1.5 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            );
          }
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-gray-100 rounded-md p-3 overflow-x-auto text-sm my-2">
            {children}
          </pre>
        ),
        // Strong/bold
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-3 border-gray-300 pl-3 italic text-gray-700 my-2">
            {children}
          </blockquote>
        ),
      }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
