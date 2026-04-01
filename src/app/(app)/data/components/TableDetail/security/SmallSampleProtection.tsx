"use client";

import React, { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { updateSmallSampleProtection } from "../../shared/api";
import type { SmallSampleProtectionConfig, SmallSampleFallback, TableDetailV2 } from "../../shared/types";

const FALLBACK_OPTIONS: { value: SmallSampleFallback; label: string; desc: string }[] = [
  { value: "hide_bucket", label: "隐藏分桶", desc: "低于阈值的分组整行隐藏" },
  { value: "merge_adjacent", label: "合并相邻", desc: "将小分组合并到相邻分组" },
  { value: "suppress_cell", label: "抑制单元格", desc: "用 * 替代具体数值" },
];

interface Props {
  detail: TableDetailV2;
  onSaved: () => void;
}

export default function SmallSampleProtection({ detail, onSaved }: Props) {
  const [config, setConfig] = useState<SmallSampleProtectionConfig>(detail.small_sample_protection);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function update(patch: Partial<SmallSampleProtectionConfig>) {
    setConfig((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateSmallSampleProtection(detail.id, config);
      setDirty(false);
      onSaved();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  // 受影响的视图/Skill（筛 L2 及以上）
  const affectedViews = detail.views.filter(
    (v) => v.disclosure_ceiling && ["L2", "L3", "L4"].includes(v.disclosure_ceiling)
  );
  const affectedGrants = detail.skill_grants?.filter(
    (g) => ["L2", "L3", "L4"].includes(g.max_disclosure_level)
  ) || [];

  return (
    <div className="border-2 border-[#1A202C] p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">小样本保护</div>
        {dirty && (
          <PixelButton size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存配置"}
          </PixelButton>
        )}
      </div>

      {/* 开关 */}
      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="w-3.5 h-3.5"
          />
          <span className="text-[10px] font-bold">{config.enabled ? "已启用" : "未启用"}</span>
        </label>
      </div>

      {config.enabled && (
        <>
          {/* 阈值 */}
          <div className="mb-3">
            <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400 block mb-1">
              最小样本阈值
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={2}
                max={20}
                value={config.threshold}
                onChange={(e) => update({ threshold: Number(e.target.value) })}
                className="flex-1 h-1 accent-[#00D1FF]"
              />
              <span className="text-[10px] font-bold w-6 text-center">{config.threshold}</span>
            </div>
            <div className="text-[8px] text-gray-400 mt-0.5">
              当分组行数 &lt; {config.threshold} 时触发保护
            </div>
          </div>

          {/* 回退策略 */}
          <div className="mb-3">
            <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400 block mb-1">
              回退策略
            </label>
            <div className="space-y-1">
              {FALLBACK_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-start gap-2 cursor-pointer py-0.5">
                  <input
                    type="radio"
                    name="fallback"
                    checked={config.fallback === opt.value}
                    onChange={() => update({ fallback: opt.value })}
                    className="mt-0.5 w-3 h-3"
                  />
                  <div>
                    <span className="text-[9px] font-bold">{opt.label}</span>
                    <span className="text-[8px] text-gray-400 ml-1">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 受影响的视图/Skill */}
          {(affectedViews.length > 0 || affectedGrants.length > 0) && (
            <div className="border-t border-gray-200 pt-2 mt-2">
              <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                受影响范围（L2 及以上）
              </div>
              {affectedViews.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {affectedViews.map((v) => (
                    <span key={v.id} className="text-[7px] font-bold px-1 py-px bg-blue-50 text-blue-500 rounded">
                      {v.name}
                    </span>
                  ))}
                </div>
              )}
              {affectedGrants.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {affectedGrants.map((g) => (
                    <span key={g.id} className="text-[7px] font-bold px-1 py-px bg-green-50 text-green-500 rounded">
                      {g.skill_name || `Skill #${g.skill_id}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
