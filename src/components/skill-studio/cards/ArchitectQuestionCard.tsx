"use client";

import { memo, useState } from "react";
import type { ArchitectQuestion } from "../types";
import { PHASE_THEME } from "../RouteStatusBar";
import { architectPhaseToThemeKey, FRAMEWORK_LABELS } from "../utils";

// ─── ArchitectQuestionCard (Card B) ──────────────────────────────────────────

export const ArchitectQuestionCard = memo(function ArchitectQuestionCard({
  question,
  answered,
  answeredText,
  onAnswer,
  onCustom,
}: {
  question: ArchitectQuestion;
  answered: boolean;
  answeredText?: string;
  onAnswer: (answer: string) => void;
  onCustom: (text: string) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const themeKey = architectPhaseToThemeKey(question.phase);
  const theme = PHASE_THEME[themeKey] || PHASE_THEME.phase1;
  const fwLabel = FRAMEWORK_LABELS[question.framework] || question.framework;
  const hasOptions = question.options && question.options.length > 0;

  // Answered compact mode
  if (answered) {
    return (
      <div className={`mx-3 my-1 px-2.5 py-1.5 border ${theme.border} bg-white/60 dark:bg-card/60 text-[9px] font-mono opacity-60`}>
        <div className="flex items-center gap-2">
          <span className={`text-[7px] font-bold uppercase ${theme.text}`}>{fwLabel}</span>
          <span className="text-gray-500 dark:text-muted-foreground flex-1 truncate">{question.question}</span>
          {answeredText && (
            <span className={`text-[8px] font-bold ${theme.text} max-w-[50%] truncate`}>→ {answeredText}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-3 my-2 border ${theme.border} rounded-lg overflow-hidden bg-white dark:bg-card text-[9px] font-mono`}>
      {/* Header: phase + framework */}
      <div className={`px-2.5 py-1.5 border-b ${theme.border} flex items-center gap-2`}>
        <span className={`${theme.accent} text-white px-1 py-0.5 text-[6px] font-bold uppercase tracking-widest`}>
          {theme.label.split("·")[0].trim()}
        </span>
        <span className={`text-[7px] px-1 py-0.5 ${theme.bg} ${theme.text} border ${theme.border}`}>
          {fwLabel}
        </span>
      </div>

      {/* Question text */}
      <div className="px-2.5 py-2">
        <p className="font-bold text-[#1A202C] dark:text-foreground text-[10px] mb-2">{question.question}</p>

        {/* Options */}
        {hasOptions ? (
          <div className="space-y-1 mb-2">
            {question.options!.map((opt, i) => (
              <button
                key={i}
                onClick={() => onAnswer(opt)}
                className={`w-full text-left px-2.5 py-1.5 border ${theme.border} bg-white dark:bg-zinc-900 ${theme.text} transition-colors text-gray-600 dark:text-zinc-200 flex items-center gap-2`}
              >
                <span className={`w-3 h-3 border ${theme.border} flex-shrink-0 flex items-center justify-center text-[7px]`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span>{opt}</span>
              </button>
            ))}
            {/* Custom input toggle */}
            {!showCustom ? (
              <button
                onClick={() => setShowCustom(true)}
                className="w-full text-left px-2.5 py-1.5 border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-zinc-500 dark:hover:text-zinc-300 transition-colors"
              >
                <span className="text-[8px]">我想自己说 →</span>
              </button>
            ) : (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customInput.trim()) {
                      onCustom(customInput.trim());
                    }
                  }}
                  placeholder="输入你的回答..."
                  autoFocus
                  className={`flex-1 px-2 py-1 border ${theme.border} bg-white dark:bg-zinc-950 text-[9px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00D1FF]`}
                />
                <button
                  onClick={() => { if (customInput.trim()) onCustom(customInput.trim()); }}
                  disabled={!customInput.trim()}
                  className={`px-2 py-1 text-[8px] font-bold uppercase ${theme.accent} text-white disabled:opacity-40`}
                >
                  发送
                </button>
              </div>
            )}
          </div>
        ) : (
          /* No options — inline input */
          <div className="flex gap-1 mb-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customInput.trim()) {
                  onAnswer(customInput.trim());
                }
              }}
              placeholder="输入你的回答..."
              autoFocus
              className={`flex-1 px-2 py-1.5 border ${theme.border} bg-white dark:bg-zinc-950 text-[9px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00D1FF]`}
            />
            <button
              onClick={() => { if (customInput.trim()) onAnswer(customInput.trim()); }}
              disabled={!customInput.trim()}
              className={`px-2 py-1.5 text-[8px] font-bold uppercase ${theme.accent} text-white disabled:opacity-40`}
            >
              回答
            </button>
          </div>
        )}

        {/* Collapsible "why" */}
        {question.why && (
          <button
            onClick={() => setShowWhy((v) => !v)}
            className="text-[8px] text-gray-400 hover:text-gray-600 dark:text-muted-foreground dark:hover:text-foreground transition-colors"
          >
            {showWhy ? "▾" : "▸"} 为什么问这个
          </button>
        )}
        {question.why && showWhy && (
          <p className="mt-1 text-[8px] text-gray-400 dark:text-zinc-400 pl-3 border-l-2 border-gray-200 dark:border-zinc-700">
            {question.why}
          </p>
        )}
      </div>
    </div>
  );
});
