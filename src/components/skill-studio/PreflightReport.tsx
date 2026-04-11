"use client";

import { PixelButton } from "@/components/pixel/PixelButton";
import type { PreflightResult, PreflightGate } from "./types";

export function PreflightReport({
  result,
  stage,
  running,
  onConfirmKnowledge,
  onSubmit,
  onRerun,
}: {
  result: PreflightResult | null;
  stage: string | null;
  running: boolean;
  onConfirmKnowledge: (items: PreflightGate["items"]) => void;
  onSubmit: () => void;
  onRerun: () => void;
}) {
  if (!running && !result) return null;

  return (
    <div className="px-4 py-3 border-t-2 border-[#6B46C1] bg-[#6B46C1]/5 flex-shrink-0 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1]">
          {running ? "质量检测中..." : "质量检测"}
        </span>
        {result && !running && (
          <>
            <span className={`text-xs font-bold ${result.passed ? "text-[#00CC99]" : "text-red-500"}`}>
              {result.score != null ? `${result.score} / 100` : ""}
            </span>
            <span className={`text-[9px] font-bold ${result.passed ? "text-[#00CC99]" : "text-red-500"}`}>
              {result.passed ? "✓ 通过" : result.blocked_by ? `✗ 未通过 — ${result.blocked_by}` : "✗ 质量未达标"}
            </span>
          </>
        )}
      </div>

      {/* Running stage */}
      {running && stage && (
        <div className="text-[9px] text-[#6B46C1] font-bold animate-pulse">{stage}</div>
      )}

      {/* Gates */}
      {result && (
        <div className="flex flex-wrap gap-2">
          {result.gates.map((g) => (
            <div key={g.gate} className={`flex items-center gap-1 px-2 py-1 border text-[8px] font-bold ${
              g.status === "passed" ? "border-[#00CC99] text-[#00CC99] bg-[#00CC99]/5" :
              g.status === "failed" ? "border-red-400 text-red-500 bg-red-50" :
              "border-gray-300 text-gray-400"
            }`}>
              {g.status === "passed" ? "✓" : g.status === "failed" ? "✗" : "..."} {g.label}
              {g.cached && <span className="text-[7px] text-gray-400 ml-1">(缓存)</span>}
            </div>
          ))}
        </div>
      )}

      {/* Gate failure items */}
      {result && result.gates.filter((g) => g.status === "failed").map((g) => (
        <div key={g.gate} className="space-y-1">
          {(g.items || []).filter((it) => !it.ok).map((it, i) => (
            <div key={i} className="flex items-center gap-2 text-[9px]">
              <span className="text-red-500">⚠</span>
              <span className="text-gray-700">{it.check}：{it.issue}</span>
              {it.action === "confirm_archive" && (
                <button
                  onClick={() => onConfirmKnowledge(g.items?.filter((x) => x.action === "confirm_archive") || [])}
                  className="text-[8px] font-bold px-1.5 py-0.5 bg-[#6B46C1] text-white"
                >
                  确认归档
                </button>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Test results */}
      {result && result.tests && result.tests.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400">测试用例</div>
          {result.tests.map((t) => (
            <div key={t.index} className="border border-gray-200 bg-white">
              <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-100">
                <span className={`text-[9px] font-bold ${t.score >= 70 ? "text-[#00CC99]" : "text-red-500"}`}>
                  {t.score}分
                </span>
                <span className="text-[8px] text-gray-500 flex-1 truncate">{t.test_input}</span>
              </div>
              <div className="px-2 py-1 text-[8px] text-gray-500">
                {t.detail.reason || ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {!running && result && (
        <div className="flex items-center gap-2 pt-1">
          {result.passed && (
            <PixelButton size="sm" onClick={onSubmit}>提交审核</PixelButton>
          )}
          <PixelButton size="sm" variant="secondary" onClick={onRerun}>
            {result.passed ? "重新检测" : "修复后重检"}
          </PixelButton>
        </div>
      )}
    </div>
  );
}
