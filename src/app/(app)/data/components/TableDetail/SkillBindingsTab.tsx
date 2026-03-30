"use client";

import React from "react";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { TableDetail } from "../shared/types";

interface Props {
  detail: TableDetail;
  onRefresh: () => void;
}

export default function SkillBindingsTab({ detail, onRefresh }: Props) {
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
      {detail.bindings.map((b, i) => (
        <div
          key={`${b.skill_id}-${b.binding_id ?? i}`}
          className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-[#F0FBFF] transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold">{b.skill_name}</span>
              {b.status === "legacy_unbound" ? (
                <PixelBadge color="yellow">待迁移</PixelBadge>
              ) : (
                <PixelBadge color="green">已绑定</PixelBadge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[8px] text-gray-400">
              {b.binding_type && <span>{b.binding_type}</span>}
              {b.view_name && <span>· 视图: {b.view_name}</span>}
              {b.alias && <span>· 别名: {b.alias}</span>}
            </div>
          </div>
          {b.status === "legacy_unbound" && (
            <div className="text-[8px] text-yellow-600 bg-yellow-50 px-2 py-1 border border-yellow-200 flex-shrink-0">
              此 Skill 通过旧 SkillDataQuery 声明，尚未绑定具体视图
            </div>
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
      ))}
    </div>
  );
}
