// MarkdownDocPage — renders markdown content with theme-aware styling
// Compatible with react-markdown v10+
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '../hooks/useTheme';

interface Props {
  content: string;
}

export default function MarkdownDocPage({ content }: Props) {
  const { isDark } = useTheme();

  return (
    <div className={`max-w-4xl mx-auto px-6 py-6 overflow-auto`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: (props) => (
            <h1 className={`text-2xl font-bold mb-2 mt-0 first:mt-0 ${isDark ? 'text-white' : 'text-ds-text'}`}>{props.children}</h1>
          ),
          h2: (props) => (
            <h2 className={`text-xl font-bold mt-8 mb-3 pb-2 border-b ${isDark ? 'text-white border-slate-800' : 'text-ds-text border-surface-border'}`}>{props.children}</h2>
          ),
          h3: (props) => (
            <h3 className={`text-lg font-semibold mt-6 mb-2 ${isDark ? 'text-white' : 'text-ds-text'}`}>{props.children}</h3>
          ),
          h4: (props) => (
            <h4 className={`text-base font-semibold mt-4 mb-2 ${isDark ? 'text-slate-200' : 'text-ds-text'}`}>{props.children}</h4>
          ),

          // Paragraphs & text
          p: (props) => (
            <p className={`text-sm leading-relaxed mb-3 ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{props.children}</p>
          ),
          strong: (props) => (
            <strong className={`font-semibold ${isDark ? 'text-white' : 'text-ds-text'}`}>{props.children}</strong>
          ),
          em: (props) => (
            <em className={`italic ${isDark ? 'text-slate-400' : 'text-ds-text-subtlest'}`}>{props.children}</em>
          ),

          // Blockquotes
          blockquote: (props) => (
            <blockquote className={`border-l-4 border-brand-500 pl-4 my-4 italic ${isDark ? 'text-slate-400' : 'text-ds-text-subtlest'}`}>
              {props.children}
            </blockquote>
          ),

          // Lists
          ul: (props) => (
            <ul className={`list-disc list-inside text-sm space-y-1 mb-4 ml-2 ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{props.children}</ul>
          ),
          ol: (props) => (
            <ol className={`list-decimal list-inside text-sm space-y-1 mb-4 ml-2 ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{props.children}</ol>
          ),
          li: (props) => (
            <li className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{props.children}</li>
          ),

          // Tables
          table: (props) => (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm text-left border-collapse">{props.children}</table>
            </div>
          ),
          thead: (props) => (
            <thead className={`border-b ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-surface-raised border-surface-border'}`}>{props.children}</thead>
          ),
          tbody: (props) => (
            <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-surface-border'}`}>{props.children}</tbody>
          ),
          tr: (props) => (
            <tr className={isDark ? 'hover:bg-slate-800/30' : 'hover:bg-surface-subtle'}>{props.children}</tr>
          ),
          th: (props) => (
            <th className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-ds-text-subtlest'}`}>{props.children}</th>
          ),
          td: (props) => (
            <td className={`px-3 py-2 text-sm ${isDark ? 'text-slate-300' : 'text-ds-text-subtle'}`}>{props.children}</td>
          ),

          // Code blocks (pre > code) and inline code
          pre: (props) => (
            <pre className={`rounded-lg p-4 overflow-x-auto mb-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-surface-raised border-surface-border'}`}>
              {props.children}
            </pre>
          ),
          code: (props) => {
            // If parent is <pre>, render as block code
            const isBlock = props.node?.position && props.className;
            if (isBlock || ((props.node as any)?.parent?.tagName === 'pre')) {
              return (
                <code className={`text-sm font-mono whitespace-pre ${isDark ? 'text-slate-300' : 'text-ds-text'}`}>
                  {props.children}
                </code>
              );
            }
            // Inline code
            return (
              <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-slate-800 text-blue-300' : 'bg-surface-raised text-brand-600'}`}>
                {props.children}
              </code>
            );
          },

          // Horizontal rules
          hr: () => <hr className={`my-6 ${isDark ? 'border-slate-800' : 'border-surface-border'}`} />,

          // Links
          a: (props) => (
            <a href={props.href} className={`underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-brand-500 hover:text-brand-600'}`} target="_blank" rel="noopener noreferrer">
              {props.children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
