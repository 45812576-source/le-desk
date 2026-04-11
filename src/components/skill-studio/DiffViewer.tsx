"use client";

import { memo, useMemo, useRef } from "react";

// ─── Diff helpers ─────────────────────────────────────────────────────────────

export function diffLines(oldText: string, newText: string) {
  const a = oldText ? oldText.split("\n") : [];
  const b = newText ? newText.split("\n") : [];
  const m = a.length, n = b.length;

  if (m * n > 40000) {
    return [
      ...a.map((text) => ({ type: "removed" as const, text })),
      ...b.map((text) => ({ type: "added" as const, text })),
    ];
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const result: { type: "added" | "removed" | "unchanged"; text: string }[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) { result.push({ type: "unchanged", text: a[i] }); i++; j++; }
    else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) { result.push({ type: "added", text: b[j] }); j++; }
    else { result.push({ type: "removed", text: a[i] }); i++; }
  }
  return result;
}

// ─── Line-numbered editor ─────────────────────────────────────────────────────

export const LineNumberedEditor = memo(function LineNumberedEditor({ value, onChange, disabled, placeholder }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = (value.match(/\n/g) ?? []).length + 1;
  const LINE_H = 20;

  return (
    <div className="flex flex-1 overflow-hidden border-2 border-[#1A202C] focus-within:border-[#00D1FF] min-h-0">
      <div
        ref={gutterRef}
        className="overflow-hidden bg-gray-50 border-r border-gray-200 select-none flex-shrink-0 w-9"
        style={{ overflowY: "hidden" }}
      >
        <div className="pt-[9px] pb-2">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} style={{ lineHeight: `${LINE_H}px`, height: LINE_H }} className="text-right pr-2 text-[9px] font-mono text-gray-400">
              {i + 1}
            </div>
          ))}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={() => {
          if (gutterRef.current && textareaRef.current)
            gutterRef.current.scrollTop = textareaRef.current.scrollTop;
        }}
        disabled={disabled}
        placeholder={placeholder}
        wrap="off"
        spellCheck={false}
        className="flex-1 px-3 py-2 text-[10px] font-mono resize-none focus:outline-none disabled:opacity-50 disabled:bg-gray-50 overflow-auto"
        style={{ lineHeight: `${LINE_H}px` }}
      />
    </div>
  );
});

// ─── Diff viewer ──────────────────────────────────────────────────────────────

export const DiffViewer = memo(function DiffViewer({ oldText, newText }: { oldText: string; newText: string }) {
  const diff = useMemo(() => diffLines(oldText, newText), [oldText, newText]);
  let newNum = 0;
  const LINE_H = 20;

  return (
    <div className="flex-1 overflow-auto border-2 border-[#1A202C] bg-white font-mono text-[10px] min-h-0">
      {diff.map((line, i) => {
        let bgClass = "", textClass = "text-[#1A202C]", indClass = "text-gray-200", ind = " ", lineNum = "";
        if (line.type === "unchanged") {
          newNum++;
          lineNum = String(newNum);
        } else if (line.type === "added") {
          newNum++;
          bgClass = "bg-green-50"; textClass = "text-green-900"; indClass = "text-green-600 font-bold"; ind = "+"; lineNum = String(newNum);
        } else {
          bgClass = "bg-red-50"; textClass = "text-red-700"; indClass = "text-red-500 font-bold"; ind = "−"; lineNum = "";
        }
        return (
          <div key={i} className={`flex ${bgClass}`} style={{ lineHeight: `${LINE_H}px`, minHeight: LINE_H }}>
            <div className="w-8 text-right pr-1.5 text-gray-400 select-none flex-shrink-0 border-r border-gray-200 text-[9px]">
              {lineNum}
            </div>
            <div className={`w-5 text-center select-none flex-shrink-0 ${indClass}`}>{ind}</div>
            <div className={`flex-1 px-2 whitespace-pre overflow-hidden ${textClass}`}>
              {line.text || "\u00A0"}
            </div>
          </div>
        );
      })}
    </div>
  );
});
