"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { useTheme } from "@/lib/theme";

import "highlight.js/styles/github.css";

export function MarkdownBlock({ text }: { text: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <>
      <style>{`
        .md-body { font-size: 13px; line-height: 1.7; color: #1A202C; }
        .md-body p { margin: 0 0 10px; }
        .md-body p:last-child { margin-bottom: 0; }
        .md-body h1 { font-size: 15px; font-weight: 700; margin: 14px 0 6px; }
        .md-body h2 { font-size: 14px; font-weight: 700; margin: 12px 0 5px; }
        .md-body h3 { font-size: 13px; font-weight: 700; margin: 10px 0 4px; }
        .md-body ul, .md-body ol { padding-left: 20px; margin: 0 0 10px; }
        .md-body li { margin-bottom: 3px; font-size: 13px; }
        .md-body li > p { margin: 0; }
        .md-body code:not(pre code) {
          font-family: "Roboto Mono", monospace;
          font-size: 11.5px;
          background: #EBF4F7;
          border: 1px solid #CBD5E0;
          border-radius: 3px;
          padding: 1px 5px;
          color: #C53030;
        }
        .md-body pre {
          background: #F0F4F8;
          border: 2px solid #1A202C;
          padding: 12px 14px;
          overflow-x: auto;
          margin: 8px 0 12px;
          border-radius: 0;
        }
        .md-body pre code {
          font-family: "Roboto Mono", monospace;
          font-size: 11.5px;
          background: none;
          border: none;
          padding: 0;
          color: inherit;
        }
        .md-body blockquote {
          border-left: 3px solid #00A3C4;
          margin: 0 0 10px;
          padding: 4px 0 4px 12px;
          color: #718096;
          font-style: italic;
        }
        .md-body table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; font-size: 12px; }
        .md-body th { border: 2px solid #1A202C; padding: 5px 8px; background: #F0F4F8; font-weight: 700; text-align: left; }
        .md-body td { border: 1px solid #CBD5E0; padding: 5px 8px; }
        .md-body a { color: #00A3C4; text-decoration: underline; font-weight: 600; }
        .md-body hr { border: none; border-top: 2px solid #E2E8F0; margin: 12px 0; }
        ${isDark ? `
          .hljs { background: #1e1e2e; color: #cdd6f4; }
          .hljs-comment, .hljs-quote { color: #6c7086; }
          .hljs-keyword, .hljs-selector-tag { color: #cba6f7; }
          .hljs-string, .hljs-attr { color: #a6e3a1; }
          .hljs-number, .hljs-literal { color: #fab387; }
          .hljs-built_in, .hljs-type { color: #89b4fa; }
          .hljs-title, .hljs-section { color: #f38ba8; }
          .hljs-tag, .hljs-name { color: #89dceb; }
          .hljs-meta { color: #f9e2af; }
        ` : ""}
      `}</style>
      <div className="md-body">
        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
          {text}
        </ReactMarkdown>
      </div>
    </>
  );
}
