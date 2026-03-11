"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

export function MarkdownBlock({ text }: { text: string }) {
  return (
    <div className="prose prose-sm max-w-none text-[#1A202C] leading-relaxed
      [&_pre]:bg-[#F0F4F8] [&_pre]:border-2 [&_pre]:border-[#1A202C] [&_pre]:p-3 [&_pre]:overflow-x-auto
      [&_code]:font-mono [&_code]:text-[11px]
      [&_p]:mb-2 [&_p:last-child]:mb-0
      [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mb-2
      [&_h2]:text-xs [&_h2]:font-bold [&_h2]:mb-1.5
      [&_h3]:text-xs [&_h3]:font-bold [&_h3]:mb-1
      [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:pl-4 [&_ol]:mb-2
      [&_li]:mb-0.5 [&_li]:text-xs
      [&_blockquote]:border-l-2 [&_blockquote]:border-[#00A3C4] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-500
      [&_table]:border-collapse [&_table]:w-full [&_table]:text-xs
      [&_th]:border-2 [&_th]:border-[#1A202C] [&_th]:px-2 [&_th]:py-1 [&_th]:bg-[#F0F4F8] [&_th]:font-bold
      [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1
      [&_a]:text-[#00A3C4] [&_a]:underline [&_a]:font-semibold
      [&_strong]:font-bold [&_em]:italic
    ">
      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
