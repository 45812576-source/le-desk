"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

import type {
  MigrationImportStats,
  MigrationMatchedItem,
  MigrationStatus,
} from "@/app/(app)/data/components/shared/types";

type Step = "upload" | "match" | "adjust" | "import" | "gaps";

const STEP_LABELS: Record<Step, string> = {
  upload: "上传骨架",
  match: "查看匹配",
  adjust: "调整适配",
  import: "确认导入",
  gaps: "缺失项补入",
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  directly_reusable: { label: "可复用", color: "text-emerald-600 border-emerald-200 bg-emerald-50" },
  needs_adaptation: { label: "需适配", color: "text-amber-600 border-amber-200 bg-amber-50" },
  missing: { label: "缺失", color: "text-red-600 border-red-200 bg-red-50" },
};

export default function MigrationWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [skeleton, setSkeleton] = useState<Record<string, unknown> | null>(null);
  const [matched, setMatched] = useState<MigrationMatchedItem[]>([]);
  const [importStats, setImportStats] = useState<MigrationImportStats | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [acting, setActing] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [targetContext, setTargetContext] = useState('{"industry": "", "size": "", "departments": []}');

  useEffect(() => {
    void apiFetch<MigrationStatus>("/knowledge-governance/migration/status").then(setMigrationStatus).catch(() => {});
  }, []);

  async function handleExportCurrent() {
    setActing(true);
    try {
      const data = await apiFetch<Record<string, unknown>>("/knowledge-governance/migration/export", {
        method: "POST",
        body: JSON.stringify({ anonymize: true }),
      });
      setSkeleton(data);
      setJsonInput(JSON.stringify(data, null, 2));
      setStep("match");
    } finally {
      setActing(false);
    }
  }

  async function handleUploadJson() {
    try {
      const parsed = JSON.parse(jsonInput);
      setSkeleton(parsed);
      setStep("match");
    } catch {
      alert("JSON 格式错误");
    }
  }

  async function handleMatch() {
    if (!skeleton) return;
    setActing(true);
    try {
      let ctx = {};
      try { ctx = JSON.parse(targetContext); } catch { /* ignore */ }
      const result = await apiFetch<{ matched: MigrationMatchedItem[] }>("/knowledge-governance/migration/match", {
        method: "POST",
        body: JSON.stringify({ exported: skeleton, target_context: ctx }),
      });
      setMatched(result.matched);
      setStep("adjust");
    } finally {
      setActing(false);
    }
  }

  async function handleImport() {
    if (!skeleton) return;
    setActing(true);
    try {
      const stats = await apiFetch<MigrationImportStats>("/knowledge-governance/migration/import", {
        method: "POST",
        body: JSON.stringify({ exported: skeleton, matched }),
      });
      setImportStats(stats);
      setStep(stats.missing > 0 ? "gaps" : "import");
      setMigrationStatus(await apiFetch<MigrationStatus>("/knowledge-governance/migration/status"));
    } finally {
      setActing(false);
    }
  }

  const reusableCount = matched.filter((m) => m.match_status === "directly_reusable").length;
  const adaptCount = matched.filter((m) => m.match_status === "needs_adaptation").length;
  const missingCount = matched.filter((m) => m.match_status === "missing").length;

  return (
    <div className="space-y-4">
      {/* 步骤指示器 */}
      <div className="flex items-center gap-1">
        {(["upload", "match", "adjust", "import", "gaps"] as Step[]).map((s, idx) => (
          <span
            key={s}
            className={`px-2 py-0.5 text-[7px] font-bold rounded ${
              step === s ? "bg-[#0077B6] text-white" : "bg-gray-100 text-gray-400"
            }`}
          >
            {idx + 1}. {STEP_LABELS[s]}
          </span>
        ))}
        {migrationStatus && migrationStatus.total_pending > 0 && (
          <span className="ml-auto text-[8px] text-amber-600">
            待处理 {migrationStatus.total_pending} 项
          </span>
        )}
      </div>

      {/* Step 1: 上传骨架 */}
      {step === "upload" && (
        <div className="border border-border rounded bg-card px-4 py-3 space-y-3">
          <div className="text-[9px] font-bold text-gray-700">上传治理骨架 JSON（或从当前系统导出）</div>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='粘贴 JSON 骨架，或点击"导出当前"'
            className="w-full h-32 text-[9px] border border-border px-2 py-1 font-mono resize-y"
          />
          <div className="flex gap-2">
            <button
              onClick={() => void handleExportCurrent()}
              disabled={acting}
              className="px-3 py-1 text-[8px] font-bold border border-[#0077B6] text-[#0077B6] hover:bg-muted disabled:opacity-50"
            >
              {acting ? "导出中..." : "导出当前骨架"}
            </button>
            <button
              onClick={() => void handleUploadJson()}
              disabled={!jsonInput.trim()}
              className="px-3 py-1 text-[8px] font-bold border border-emerald-400 text-emerald-700 hover:bg-muted disabled:opacity-50"
            >
              使用粘贴的 JSON →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: 匹配 */}
      {step === "match" && (
        <div className="border border-border rounded bg-card px-4 py-3 space-y-3">
          <div className="text-[9px] font-bold text-gray-700">目标公司上下文（帮助 AI 匹配）</div>
          <textarea
            value={targetContext}
            onChange={(e) => setTargetContext(e.target.value)}
            className="w-full h-20 text-[9px] border border-border px-2 py-1 font-mono resize-y"
          />
          <button
            onClick={() => void handleMatch()}
            disabled={acting}
            className="px-3 py-1 text-[8px] font-bold border border-[#0077B6] text-[#0077B6] hover:bg-muted disabled:opacity-50"
          >
            {acting ? "AI 匹配中..." : "开始匹配 →"}
          </button>
        </div>
      )}

      {/* Step 3: 调整适配 */}
      {step === "adjust" && (
        <div className="border border-border rounded bg-card px-4 py-3 space-y-3">
          <div className="text-[9px] font-bold text-gray-700">匹配结果</div>
          <div className="flex gap-3 text-[8px]">
            <span className="text-emerald-600">可复用 {reusableCount}</span>
            <span className="text-amber-600">需适配 {adaptCount}</span>
            <span className="text-red-600">缺失 {missingCount}</span>
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {matched.map((m, idx) => {
              const style = STATUS_STYLES[m.match_status] || STATUS_STYLES.needs_adaptation;
              return (
                <div key={idx} className="flex items-center gap-2 text-[9px] border border-border rounded px-3 py-1">
                  <span className="font-semibold text-gray-700 w-32 truncate">{m.library_code}</span>
                  <span className={`px-1.5 py-0.5 rounded border text-[8px] font-bold ${style.color}`}>
                    {style.label}
                  </span>
                  <span className="text-gray-500 flex-1 truncate">{m.reason}</span>
                  {m.match_status !== "directly_reusable" && (
                    <select
                      value={m.match_status}
                      onChange={(e) => {
                        const updated = [...matched];
                        updated[idx] = { ...m, match_status: e.target.value as MigrationMatchedItem["match_status"] };
                        setMatched(updated);
                      }}
                      className="text-[8px] border border-border px-1 py-0.5"
                    >
                      <option value="directly_reusable">可复用</option>
                      <option value="needs_adaptation">需适配</option>
                      <option value="missing">缺失</option>
                    </select>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => void handleImport()}
            disabled={acting}
            className="px-3 py-1 text-[8px] font-bold border border-emerald-400 text-emerald-700 hover:bg-muted disabled:opacity-50"
          >
            {acting ? "导入中..." : "确认导入 →"}
          </button>
        </div>
      )}

      {/* Step 4/5: 导入结果 */}
      {(step === "import" || step === "gaps") && importStats && (
        <div className="border border-border rounded bg-card px-4 py-3 space-y-3">
          <div className="text-[9px] font-bold text-emerald-700">导入完成</div>
          <div className="grid grid-cols-3 gap-2 text-[8px]">
            <div className="border border-emerald-100 rounded px-2 py-1 text-center">
              <div className="text-emerald-600 font-bold text-[12px]">{importStats.reusable}</div>
              <div className="text-gray-500">直接复用</div>
            </div>
            <div className="border border-amber-100 rounded px-2 py-1 text-center">
              <div className="text-amber-600 font-bold text-[12px]">{importStats.adaptation}</div>
              <div className="text-gray-500">待适配</div>
            </div>
            <div className="border border-red-100 rounded px-2 py-1 text-center">
              <div className="text-red-600 font-bold text-[12px]">{importStats.missing}</div>
              <div className="text-gray-500">缺失项</div>
            </div>
          </div>
          {importStats.created_libraries.length > 0 && (
            <div className="text-[8px] text-gray-500">
              已创建资源库：{importStats.created_libraries.join(", ")}
            </div>
          )}
          {importStats.missing > 0 && (
            <div className="text-[9px] text-amber-700 border border-amber-200 bg-amber-50 rounded px-3 py-2">
              {importStats.missing} 个缺失项已链接到缺口补入流程，请前往"领域缺口" tab 处理
            </div>
          )}
          <button
            onClick={() => { setStep("upload"); setSkeleton(null); setMatched([]); setImportStats(null); }}
            className="px-3 py-1 text-[8px] font-bold border border-border text-gray-600 hover:bg-muted"
          >
            重新开始
          </button>
        </div>
      )}
    </div>
  );
}
