"use client";

import { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";

export function KnowledgeConfirmModal({
  skillId,
  items,
  onDone,
  onCancel,
}: {
  skillId: number;
  items: { check: string; ok: boolean; issue?: string }[];
  onDone: (info?: { confirmed: number; knowledgeEntryCount: number }) => void;
  onCancel: () => void;
}) {
  const [confirmations, setConfirmations] = useState(
    items.map((it) => ({ filename: it.check, target_board: "", target_category: "general", display_title: it.check.replace(/\.[^.]+$/, "") }))
  );
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  async function handleConfirmAll() {
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch<Record<string, unknown>>(`/sandbox/preflight/${skillId}/knowledge-confirm`, {
        method: "POST",
        body: JSON.stringify({ confirmations }),
      });
      const failedFiles = (result.failed_files as string[] | undefined) ?? [];
      const failedCount = (result.failed_count as number | undefined) ?? 0;
      if (failedCount > 0 && failedFiles.length === confirmations.length) {
        setError(`归档失败：${failedFiles.join("、")} 文件内容为空或无法读取，请检查文件是否存在`);
        return;
      }
      if (failedCount > 0) {
        console.warn("部分文件归档失败:", failedFiles);
      }
      const ids = [
        ...(((result.knowledge_entry_ids as unknown[] | undefined) ?? []).filter((item): item is number => typeof item === "number")),
        ...(((result.created_entry_ids as unknown[] | undefined) ?? []).filter((item): item is number => typeof item === "number")),
      ];
      onDone({ confirmed: confirmations.length - failedCount, knowledgeEntryCount: ids.length });
    } catch (err) {
      console.error("Knowledge confirm failed", err);
      setError(err instanceof Error ? err.message : "归档失败，请重试");
    } finally { setSaving(false); }
  }

  const current = confirmations[step];
  if (!current) return null;

  function updateField(field: string, value: string) {
    setConfirmations((prev) => prev.map((c, i) => i === step ? { ...c, [field]: value } : c));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-[#1A202C] w-[480px] max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b-2 border-[#1A202C] bg-[#EBF4F7] flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1]">确认知识库归档</span>
          <span className="text-[8px] text-gray-400 ml-auto">{step + 1} / {confirmations.length}</span>
        </div>

        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">文件名</div>
            <div className="text-[10px] font-mono text-gray-700 bg-[#F0F4F8] px-3 py-2 border border-gray-200">{current.filename}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">条目标题</div>
            <input
              value={current.display_title}
              onChange={(e) => updateField("display_title", e.target.value)}
              className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-[10px] focus:outline-none focus:border-[#6B46C1]"
            />
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">归档板块</div>
            <input
              value={current.target_board}
              onChange={(e) => updateField("target_board", e.target.value)}
              placeholder="如：A.渠道与平台"
              className="w-full border-2 border-gray-300 px-3 py-1.5 text-[10px] focus:outline-none focus:border-[#6B46C1]"
            />
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">分类</div>
            <select
              value={current.target_category}
              onChange={(e) => updateField("target_category", e.target.value)}
              className="w-full border-2 border-gray-300 px-3 py-1.5 text-[10px] focus:outline-none focus:border-[#6B46C1]"
            >
              <option value="general">通用</option>
              <option value="experience">经验</option>
              <option value="external_intel">外部情报</option>
              <option value="methodology">方法论</option>
              <option value="sop">SOP</option>
            </select>
          </div>
          <div className="text-[8px] text-gray-400">
            命名建议：使用「领域-主题-类型」格式，如「投放-抖音ROI分析-SOP」
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-2 text-[10px] text-red-600 border border-red-300 bg-red-50 px-3 py-2">
            {error}
          </div>
        )}
        <div className="px-4 py-3 border-t-2 border-[#1A202C] flex items-center gap-2">
          {step > 0 && (
            <PixelButton size="sm" variant="secondary" onClick={() => setStep(step - 1)}>上一个</PixelButton>
          )}
          {step < confirmations.length - 1 ? (
            <PixelButton size="sm" onClick={() => setStep(step + 1)}>下一个</PixelButton>
          ) : (
            <PixelButton size="sm" onClick={handleConfirmAll} disabled={saving}>
              {saving ? "入库中..." : "全部入库"}
            </PixelButton>
          )}
          <PixelButton size="sm" variant="secondary" onClick={onCancel}>取消</PixelButton>
        </div>
      </div>
    </div>
  );
}
