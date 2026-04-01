"use client";

import React, { useState } from "react";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import { useV2DataAssets } from "../shared/feature-flags";
import type { TableDetail, SkillDataGrant } from "../shared/types";
import { DISCLOSURE_LABELS, type DisclosureLevel } from "../shared/types";
import OutputReviewPanel from "./security/OutputReviewPanel";

interface Props {
  detail: TableDetail;
  onRefresh: () => void;
}

function GrantDetailPanel({ grant }: { grant: SkillDataGrant }) {
  return (
    <div className="border-2 border-[#00D1FF] bg-white p-2 mt-1 mb-2 mx-4 text-[9px]">
      <div className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4] mb-1">数据授权详情</div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <span className="text-[7px] text-gray-400 uppercase block">授权模式</span>
          <span className={`font-bold ${grant.grant_mode === "deny" ? "text-red-500" : "text-green-500"}`}>
            {grant.grant_mode === "deny" ? "拒绝" : "允许"}
          </span>
        </div>
        <div>
          <span className="text-[7px] text-gray-400 uppercase block">最高披露</span>
          <span className="font-bold">{DISCLOSURE_LABELS[grant.max_disclosure_level as DisclosureLevel] || grant.max_disclosure_level}</span>
        </div>
        <div>
          <span className="text-[7px] text-gray-400 uppercase block">需审批</span>
          <span className={`font-bold ${grant.approval_required ? "text-orange-500" : "text-gray-400"}`}>
            {grant.approval_required ? "是" : "否"}
          </span>
        </div>
        <div>
          <span className="text-[7px] text-gray-400 uppercase block">允许操作</span>
          <span>{(grant.allowed_actions || []).join(", ") || "无"}</span>
        </div>
        <div>
          <span className="text-[7px] text-gray-400 uppercase block">审计级别</span>
          <span>{grant.audit_level}</span>
        </div>
        <div>
          <span className="text-[7px] text-gray-400 uppercase block">绑定视图</span>
          <span>{grant.view_name || "未绑定"}</span>
        </div>
      </div>
    </div>
  );
}

function BindingRelationGraph({ detail }: { detail: TableDetail }) {
  if (detail.bindings.length === 0 && (!detail.skill_grants || detail.skill_grants.length === 0)) {
    return null;
  }

  // 构建关系: Table → Views → Skills
  const viewSkillMap = new Map<number | null, { skills: Set<string>; viewName: string }>();

  for (const b of detail.bindings) {
    const key = b.view_id;
    if (!viewSkillMap.has(key)) {
      viewSkillMap.set(key, { skills: new Set(), viewName: b.view_name || "未绑定视图" });
    }
    viewSkillMap.get(key)!.skills.add(b.skill_name);
  }

  return (
    <div className="px-4 py-2 mb-2 border-b border-gray-100">
      <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-2">绑定关系</div>
      <div className="flex items-start gap-4">
        {/* 表 */}
        <div className="text-[9px] font-bold px-2 py-1 border-2 border-[#1A202C] bg-[#EBF4F7] whitespace-nowrap">
          {detail.display_name}
        </div>

        <div className="text-gray-300 pt-1">→</div>

        {/* 视图列 */}
        <div className="flex flex-col gap-1">
          {Array.from(viewSkillMap.entries()).map(([viewId, { skills, viewName }]) => (
            <div key={viewId ?? "null"} className="flex items-center gap-2">
              <div className={`text-[8px] px-1.5 py-0.5 border rounded whitespace-nowrap ${
                viewId ? "border-[#00D1FF] text-[#00A3C4] bg-[#F0FBFF]" : "border-yellow-300 text-yellow-600 bg-yellow-50"
              }`}>
                {viewName}
              </div>
              <span className="text-gray-300">→</span>
              <div className="flex flex-wrap gap-1">
                {Array.from(skills).map((s) => (
                  <span key={s} className="text-[8px] px-1.5 py-0.5 bg-green-50 border border-green-200 text-green-600 rounded">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SkillBindingsTab({ detail, onRefresh }: Props) {
  const isV2 = useV2DataAssets();
  const [expandedGrantId, setExpandedGrantId] = useState<number | null>(null);

  async function handleDeleteBinding(bindingId: number) {
    if (!confirm("确认解除此绑定？")) return;
    await apiFetch(`/data-assets/bindings/${bindingId}`, { method: "DELETE" });
    onRefresh();
  }

  if (detail.bindings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <div className="text-[10px] text-gray-400 uppercase tracking-widest">暂无 Skill 绑定</div>
        <div className="text-[8px] text-gray-300">在 Skill Studio 中绑定数据表后，将在此显示</div>
      </div>
    );
  }

  return (
    <div>
      <BindingRelationGraph detail={detail} />

      {detail.bindings.map((b, i) => {
        // 找到对应的 grant
        const grant = detail.skill_grants?.find((g) => g.skill_id === b.skill_id);
        const isExpanded = expandedGrantId === (grant?.id ?? null);

        return (
          <div key={`${b.skill_id}-${b.binding_id ?? i}`}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-[#F0FBFF] transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold">{b.skill_name}</span>
                  {b.status === "legacy_unbound" ? (
                    <PixelBadge color="yellow">待迁移</PixelBadge>
                  ) : (
                    <PixelBadge color="green">已绑定</PixelBadge>
                  )}
                  {grant && (
                    <>
                      <span className={`text-[7px] font-bold px-1 py-px rounded ${
                        grant.grant_mode === "deny" ? "bg-red-50 text-red-500" : "bg-green-50 text-green-500"
                      }`}>
                        {grant.grant_mode === "deny" ? "拒绝" : grant.max_disclosure_level}
                      </span>
                      {grant.approval_required && (
                        <span className="text-[7px] font-bold px-1 py-px bg-orange-50 text-orange-500 rounded">需审批</span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[8px] text-gray-400">
                  {b.binding_type && <span>{b.binding_type}</span>}
                  {b.view_name && <span>· 视图: {b.view_name}</span>}
                  {b.alias && <span>· 别名: {b.alias}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {b.status === "legacy_unbound" && (
                  <div className="text-[8px] text-yellow-600 bg-yellow-50 px-2 py-1 border border-yellow-200 flex-shrink-0">
                    旧 Skill，尚未绑定具体视图
                  </div>
                )}
                {grant && (
                  <button
                    onClick={() => setExpandedGrantId(isExpanded ? null : grant.id)}
                    className="text-[8px] text-[#00A3C4] hover:underline px-1"
                  >
                    {isExpanded ? "收起" : "详情"}
                  </button>
                )}
                {b.binding_id && (
                  <button
                    onClick={() => handleDeleteBinding(b.binding_id!)}
                    className="text-[8px] text-gray-400 hover:text-red-500 flex-shrink-0 px-1"
                    title="解除绑定"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            {isExpanded && grant && <GrantDetailPanel grant={grant} />}
          </div>
        );
      })}

      {/* V2: 输出审查日志 */}
      {isV2 && <OutputReviewPanel tableId={detail.id} />}
    </div>
  );
}
