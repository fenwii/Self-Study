import { Children, isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownMessageProps {
  content: string;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: 'error', trust: false, throwOnError: false, output: 'htmlAndMathml' }]]}
        urlTransform={(url) => defaultUrlTransform(url)}
        components={{
          a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>,
          pre: ({ children }) => {
            const value = textFromChildren(children).replace(/\n$/u, '');
            const firstChild = Children.toArray(children)[0];
            const className = isValidElement<{ className?: string }>(firstChild)
              ? firstChild.props.className
              : undefined;
            const language = className?.replace('language-', '') ?? 'text';
            return (
              <div className="code-block">
                <div className="code-toolbar">
                  <span>{language}</span>
                  <button type="button" onClick={() => void navigator.clipboard?.writeText(value)}>复制</button>
                </div>
                <pre>{children}</pre>
              </div>
            );
          },
          code: ({ children, className }) => <code className={className}>{children}</code>,
          table: ({ children }) => <div className="table-scroll"><table>{children}</table></div>,
          input: (props) => <input {...props} disabled />
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function textFromChildren(children: ReactNode): string {
  return Children.toArray(children).map((child) => {
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    if (isValidElement<{ children?: ReactNode }>(child)) return textFromChildren(child.props.children);
    return '';
  }).join('');
}
