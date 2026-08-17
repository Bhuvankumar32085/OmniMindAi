import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

interface MarkdownMessageProps {
  text: string;
  setInputText?: (text: string) => void;
  messageId?: string;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({
  text,
  setInputText,
  messageId,
}) => {
  return (
    <div className="prose max-w-none text-sm leading-relaxed dark:prose-invert md:text-base prose-p:my-3 prose-li:my-1 prose-pre:m-0 prose-pre:bg-transparent prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, node, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const codeText = String(children).replace(/\n$/, "");
            const hasLanguage = Boolean(match?.[1]);
            const hasMultipleLines = codeText.includes("\n");
            const isInsidePre = node?.parent?.tagName === "pre" || node?.tagName === "pre";

            // True code block ONLY if inside <pre>, or has explicit language tag, or has multiple lines
            const isBlock = (inline === false && (hasLanguage || hasMultipleLines || isInsidePre)) ||
                            (inline === undefined && (hasLanguage || hasMultipleLines || isInsidePre));

            if (isBlock) {
              return (
                <CodeBlock
                  code={codeText}
                  language={match?.[1] || undefined}
                  setInputText={setInputText}
                  messageId={messageId}
                />
              );
            }

            return (
              <code
                className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs md:text-sm text-indigo-600 dark:bg-white/10 dark:text-indigo-300"
                {...props}
              >
                {children}
              </code>
            );
          },
          a({ children, ...props }: any) {
            return (
              <a
                className="font-semibold text-indigo-500 underline-offset-4 hover:underline"
                target="_blank"
                rel="noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },
          table({ children }: any) {
            return (
              <div className="my-4 overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
                <table className="min-w-full text-left text-sm">
                  {children}
                </table>
              </div>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};
