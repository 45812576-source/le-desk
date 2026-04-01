"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { useTheme } from "@/lib/theme";

import "highlight.js/styles/github.css";

// 若全文被单个 markdown/text/plain fenced code block 包裹，剥离外层按普通文本渲染
const WRAPPER_BLOCK_RE = /^\s*```(?:markdown|md|text|plain)?\s*\n([\s\S]*?)\n\s*```\s*$/;
function normalizeText(raw: string): string {
  const m = WRAPPER_BLOCK_RE.exec(raw);
  return m ? m[1] : raw;
}

export const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const normalized = normalizeText(text);

  return (
    <div className={`md-body${isDark ? " md-dark" : ""}`}>
      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
});
