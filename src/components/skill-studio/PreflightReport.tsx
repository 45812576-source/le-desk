"use client";

import { PixelButton } from "@/components/pixel/PixelButton";
import type { PreflightResult, PreflightGate, PreflightTestResult } from "./types";

function ScoreBadge({ label, score }: { label: string; score?: number }) {
  const val = typeof score === "number" ? score : null;
  const tone = val == null
    ? "border-gray-200 text-gray-400 bg-gray-50"
    : val >= 70
      ? "border-[#00CC99] text-[#00CC99] bg-[#00CC99]/5"
      : val >= 60
        ? "border-amber-300 text-amber-600 bg-amber-50"
        : "border-red-300 text-red-500 bg-red-50";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[8px] font-bold ${tone}`}>
      <span>{label}</span>
      <span>{val ?? "N/A"}</span>
    </span>
  );
}

function deductionText(test: PreflightTestResult) {
  const deductions = test.detail.deductions || [];
  if (deductions.length === 0) return test.detail.reason || "";
  const first = deductions[0];
  if (!first) return test.detail.reason || "";
  const suffix = first.fix_suggestion ? ` → ${first.fix_suggestion}` : "";
  return `[${first.dimension || "quality"}] ${first.reason || test.detail.reason || ""}${suffix}`;
}

export function PreflightReport({
  result,
  stage,
  running,
  onConfirmKnowledge,
  onSubmit,
  onRerun,
  submitLabel = "提交审批",
}: {
  result: PreflightResult | null;
  stage: string | null;
  running: boolean;
  onConfirmKnowledge: (items: PreflightGate["items"]) => void;
  onSubmit: () => void;
  onRerun: () => void;
  submitLabel?: string;
}) {
  if (!running && !result) return null;

  return (
    <div className="px-4 py-3 border-t-2 border-[#6B46C1] bg-[#6B46C1]/5 flex-shrink-0 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1]">
          {running ? "质量检测中..." : "质量检测（沙盒标准）"}
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

      {result?.quality_detail && (
        <div className="space-y-1">
          <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400">沙盒质量维度</div>
          <div className="flex flex-wrap gap-2">
            <ScoreBadge label="覆盖" score={result.quality_detail.avg_coverage} />
            <ScoreBadge label="正确" score={result.quality_detail.avg_correctness} />
            <ScoreBadge label="约束" score={result.quality_detail.avg_constraint} />
            <ScoreBadge label="可行动" score={result.quality_detail.avg_actionability} />
          </div>
          {result.quality_detail.top_deductions && result.quality_detail.top_deductions.length > 0 && (
            <div className="space-y-1">
              {result.quality_detail.top_deductions.slice(0, 3).map((d, i) => (
                <div key={i} className="text-[8px] text-red-600 bg-red-50 px-2 py-1 border border-red-100">
                  [{d.dimension || "quality"}] {d.points ?? 0}分: {d.reason || "未达标"}
                  {d.fix_suggestion ? <span className="text-amber-600"> → {d.fix_suggestion}</span> : null}
                </div>
              ))}
            </div>
          )}
        </div>
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
              <div className="px-2 pt-1 flex flex-wrap gap-1">
                <ScoreBadge label="覆盖" score={t.detail.coverage_score} />
                <ScoreBadge label="正确" score={t.detail.correctness_score} />
                <ScoreBadge label="约束" score={t.detail.constraint_score} />
                <ScoreBadge label="可行动" score={t.detail.actionability_score} />
              </div>
              <div className="px-2 py-1 text-[8px] text-gray-500">
                {deductionText(t)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {!running && result && (
        <div className="flex items-center gap-2 pt-1">
          {result.passed && (
            <PixelButton size="sm" onClick={onSubmit}>{submitLabel}</PixelButton>
          )}
          <PixelButton size="sm" variant="secondary" onClick={onRerun}>
            {result.passed ? "重新检测" : "修复后重检"}
          </PixelButton>
        </div>
      )}
    </div>
  );
}
