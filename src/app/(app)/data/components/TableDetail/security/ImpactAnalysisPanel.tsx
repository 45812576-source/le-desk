"use client";

import React from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import type { TableDetailV2 } from "../../shared/types";

interface ImpactItem {
  type: "view" | "skill" | "policy" | "grant";
  name: string;
  detail: string;
}

interface Props {
  detail: TableDetailV2;
  changeDescription: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** B4 前端影响分析面板 — 在保存策略变更前展示 */
export default function ImpactAnalysisPanel({ detail, changeDescription, onConfirm, onCancel }: Props) {
  const impacts = computeImpacts(detail);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white border-2 border-[#1A202C] p-4 w-[480px] max-h-[80vh] overflow-y-auto">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">影响分析</div>

        <div className="text-[9px] text-gray-500 mb-3 bg-[#F0FBFF] px-2 py-1.5 border border-[#00D1FF]">
          {changeDescription}
        </div>

        {impacts.length === 0 ? (
          <div className="text-[8px] text-gray-400 mb-3">此变更不影响现有视图、Skill 或策略</div>
        ) : (
          <div className="space-y-2 mb-3">
            <div className="text-[8px] font-bold text-orange-500">
              以下 {impacts.length} 项可能受影响：
            </div>
            {impacts.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[9px] py-1 border-b border-gray-100 last:border-0">
                <span className={`text-[7px] font-bold px-1 py-px rounded ${
                  item.type === "view" ? "bg-blue-50 text-blue-500" :
                  item.type === "skill" ? "bg-green-50 text-green-500" :
                  item.type === "policy" ? "bg-purple-50 text-purple-500" :
                  "bg-orange-50 text-orange-500"
                }`}>
                  {item.type === "view" ? "视图" : item.type === "skill" ? "Skill" : item.type === "policy" ? "策略" : "授权"}
                </span>
                <span className="font-bold">{item.name}</span>
                <span className="text-gray-400 text-[8px]">{item.detail}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
          <PixelButton size="sm" onClick={onConfirm}>
            {impacts.length > 0 ? "确认继续保存" : "继续保存"}
          </PixelButton>
          <PixelButton size="sm" variant="secondary" onClick={onCancel}>取消</PixelButton>
        </div>
      </div>
    </div>
  );
}

function computeImpacts(detail: TableDetailV2): ImpactItem[] {
  const items: ImpactItem[] = [];

  // 受影响的视图
  for (const v of detail.views) {
    if (v.allowed_role_group_ids?.length > 0 || v.disclosure_ceiling) {
      items.push({
        type: "view",
        name: v.name,
        detail: v.disclosure_ceiling ? `披露上限 ${v.disclosure_ceiling}` : "有角色限制",
      });
    }
  }

  // 受影响的 Skill
  for (const b of detail.bindings) {
    items.push({
      type: "skill",
      name: b.skill_name,
      detail: b.view_name ? `绑定视图: ${b.view_name}` : "未绑定视图",
    });
  }

  // 受影响的授权
  for (const g of detail.skill_grants || []) {
    items.push({
      type: "grant",
      name: g.skill_name || `Skill #${g.skill_id}`,
      detail: `${g.max_disclosure_level}${g.approval_required ? " (需审批)" : ""}`,
    });
  }

  return items;
}
