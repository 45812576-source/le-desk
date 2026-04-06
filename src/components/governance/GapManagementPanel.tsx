"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

import type {
  GovernanceCoverageGap,
  GovernanceDetectedGaps,
  GovernanceDomainGap,
} from "@/app/(app)/data/components/shared/types";

type WizardStep = "detect" | "scope" | "import" | "generate" | "verify" | "merge";

export default function GapManagementPanel() {
  const [gaps, setGaps] = useState<GovernanceDetectedGaps | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeGap, setActiveGap] = useState<(GovernanceDomainGap | GovernanceCoverageGap) | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>("detect");
  const [suggestionId, setSuggestionId] = useState<number | null>(null);
  const [acting, setActing] = useState(false);

  async function loadGaps() {
    setLoading(true);
    try {
      const data = await apiFetch<GovernanceDetectedGaps>("/knowledge-governance/gaps/detected");
      setGaps(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGaps();
  }, []);

  const allGaps = [
    ...(gaps?.domain_gaps.map((g) => ({ ...g, _source: "domain" as const })) || []),
    ...(gaps?.coverage_gaps.map((g) => ({ ...g, _source: "coverage" as const })) || []),
  ];

  async function handleStartWizard(gap: GovernanceDomainGap | GovernanceCoverageGap) {
    setActiveGap(gap);
    setWizardStep("scope");
    setSuggestionId(null);
  }

  async function handleDefineScope() {
    if (!activeGap) return;
    const code = "library_code" in activeGap ? activeGap.library_code : null;
    if (!code) return;
    setActing(true);
    try {
      await apiFetch("/knowledge-governance/gap/define-scope", {
        method: "POST",
        body: JSON.stringify({ library_code: code, domain_keywords: [], description: "" }),
      });
      setWizardStep("import");
    } finally {
      setActing(false);
    }
  }

  async function handleImport() {
    if (!activeGap) return;
    const code = "library_code" in activeGap ? activeGap.library_code : null;
    if (!code) return;
    setActing(true);
    try {
      const result = await apiFetch<{ suggestion_id: number }>("/knowledge-governance/gap/import-materials", {
        method: "POST",
        body: JSON.stringify({ library_code: code, terminology: [], sample_entry_ids: [], correct_classifications: [] }),
      });
      setSuggestionId(result.suggestion_id);
      setWizardStep("generate");
    } finally {
      setActing(false);
    }
  }

  async function handleGenerate() {
    if (!suggestionId) return;
    setActing(true);
    try {
      await apiFetch("/knowledge-governance/gap/generate-strategy", {
        method: "POST",
        body: JSON.stringify({ suggestion_id: suggestionId }),
      });
      setWizardStep("verify");
    } finally {
      setActing(false);
    }
  }

  async function handleVerify() {
    if (!suggestionId) return;
    setActing(true);
    try {
      await apiFetch("/knowledge-governance/gap/verify", {
        method: "POST",
        body: JSON.stringify({ suggestion_id: suggestionId, duration_days: 3 }),
      });
      setWizardStep("merge");
    } finally {
      setActing(false);
    }
  }

  async function handleMerge() {
    if (!suggestionId) return;
    setActing(true);
    try {
      await apiFetch("/knowledge-governance/gap/merge", {
        method: "POST",
        body: JSON.stringify({ suggestion_id: suggestionId }),
      });
      setActiveGap(null);
      setWizardStep("detect");
      setSuggestionId(null);
      await loadGaps();
    } finally {
      setActing(false);
    }
  }

  const STEP_LABELS: Record<WizardStep, string> = {
    detect: "检测", scope: "定义范围", import: "导入资料",
    generate: "生成策略", verify: "灰度验证", merge: "合入基线",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700">领域缺口</span>
        <span className="text-[8px] text-gray-400">
          {(gaps?.domain_gaps.length || 0) + (gaps?.coverage_gaps.length || 0)} 个缺口
        </span>
        <button
          onClick={() => void loadGaps()}
          disabled={loading}
          className="ml-auto px-2 py-1 text-[8px] font-bold border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          重新检测
        </button>
      </div>

      {loading && <div className="text-[9px] text-gray-400">检测中...</div>}
      {!loading && allGaps.length === 0 && (
        <div className="text-center py-6 text-[10px] text-emerald-600">暂无领域缺口，AI 表现良好</div>
      )}

      {/* 缺口列表 */}
      {!activeGap && (
        <div className="space-y-2">
          {allGaps.map((gap, idx) => (
            <div key={idx} className={`border rounded px-3 py-2 text-[9px] ${
              gap.severity === "high" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
            }`}>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${gap.severity === "high" ? "text-red-700" : "text-amber-700"}`}>
                  {gap.gap_type === "high_reject_rate" ? "高拒绝率" : gap.gap_type === "low_coverage" ? "覆盖不足" : "低对齐率"}
                </span>
                <span className="text-gray-600">{"library_code" in gap ? gap.library_code : ""}</span>
                {"reject_rate" in gap && (
                  <span className="text-red-600">拒绝率 {(gap.reject_rate * 100).toFixed(0)}%</span>
                )}
                {"coverage_rate" in gap && (
                  <span className="text-amber-600">覆盖率 {gap.coverage_rate}%</span>
                )}
                <button
                  onClick={() => void handleStartWizard(gap)}
                  className="ml-auto px-2 py-0.5 text-[8px] font-bold border border-[#0077B6] text-[#0077B6] hover:bg-muted"
                >
                  补入向导
                </button>
              </div>
              {"reason" in gap && gap.reason && (
                <div className="mt-1 text-[8px] text-gray-500">{gap.reason}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 补入向导 */}
      {activeGap && (
        <div className="border border-[#0077B6] rounded bg-card px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-[#0077B6]">一次性补入向导</span>
            <div className="flex gap-1 ml-auto">
              {(["scope", "import", "generate", "verify", "merge"] as WizardStep[]).map((step, idx) => (
                <span
                  key={step}
                  className={`px-1.5 py-0.5 text-[7px] font-bold rounded ${
                    wizardStep === step
                      ? "bg-[#0077B6] text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {idx + 1}. {STEP_LABELS[step]}
                </span>
              ))}
            </div>
            <button
              onClick={() => { setActiveGap(null); setWizardStep("detect"); }}
              className="px-2 py-0.5 text-[8px] text-gray-500 hover:text-gray-700"
            >
              取消
            </button>
          </div>

          {wizardStep === "scope" && (
            <div className="space-y-2">
              <div className="text-[9px] text-gray-600">确认缺口范围</div>
              <div className="text-[8px] text-gray-500">
                资源库：{"library_code" in activeGap ? activeGap.library_code : "—"}
              </div>
              <button onClick={() => void handleDefineScope()} disabled={acting}
                className="px-3 py-1 text-[8px] font-bold border border-[#0077B6] text-[#0077B6] hover:bg-muted disabled:opacity-50">
                {acting ? "处理中..." : "确认范围 →"}
              </button>
            </div>
          )}

          {wizardStep === "import" && (
            <div className="space-y-2">
              <div className="text-[9px] text-gray-600">导入补充资料（术语表、样本文档、正确分类标注）</div>
              <div className="text-[8px] text-gray-400">当前版本自动导入空模板，后续支持文件上传</div>
              <button onClick={() => void handleImport()} disabled={acting}
                className="px-3 py-1 text-[8px] font-bold border border-[#0077B6] text-[#0077B6] hover:bg-muted disabled:opacity-50">
                {acting ? "导入中..." : "导入资料 →"}
              </button>
            </div>
          )}

          {wizardStep === "generate" && (
            <div className="space-y-2">
              <div className="text-[9px] text-gray-600">AI 基于补充资料生成增量分类策略</div>
              <button onClick={() => void handleGenerate()} disabled={acting}
                className="px-3 py-1 text-[8px] font-bold border border-amber-400 text-amber-700 hover:bg-muted disabled:opacity-50">
                {acting ? "生成中..." : "生成策略 →"}
              </button>
            </div>
          )}

          {wizardStep === "verify" && (
            <div className="space-y-2">
              <div className="text-[9px] text-gray-600">灰度验证：只对该领域跑新策略 3 天</div>
              <button onClick={() => void handleVerify()} disabled={acting}
                className="px-3 py-1 text-[8px] font-bold border border-violet-400 text-violet-700 hover:bg-muted disabled:opacity-50">
                {acting ? "启动中..." : "启动验证 →"}
              </button>
            </div>
          )}

          {wizardStep === "merge" && (
            <div className="space-y-2">
              <div className="text-[9px] text-gray-600">验证完成，合入基线（版本号 +0.1）</div>
              <button onClick={() => void handleMerge()} disabled={acting}
                className="px-3 py-1 text-[8px] font-bold border border-emerald-400 text-emerald-700 hover:bg-muted disabled:opacity-50">
                {acting ? "合入中..." : "合入基线 ✓"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
