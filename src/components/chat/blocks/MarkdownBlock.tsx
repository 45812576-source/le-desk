"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { useTheme } from "@/lib/theme";

import "highlight.js/styles/github.css";

export const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={`md-body${isDark ? " md-dark" : ""}`}>
      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
