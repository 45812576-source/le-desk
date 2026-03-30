"use client";

import React from "react";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import type { TableDetail } from "../shared/types";

interface Props {
  detail: TableDetail;
}

export default function ViewsTab({ detail }: Props) {
  if (detail.views.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[10px] text-gray-400 uppercase tracking-widest">
        暂无视图
      </div>
    );
  }

  return (
    <div>
      {detail.views.map((v) => {
        const bindingCount = detail.bindings.filter((b) => b.view_id === v.id).length;
        return (
          <div key={v.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-[#F0FBFF] transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold">{v.name}</span>
                {v.is_default && <PixelBadge color="cyan">默认</PixelBadge>}
                {v.is_system && <PixelBadge color="gray">系统</PixelBadge>}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[8px] text-gray-400">
                <span>{v.view_type}</span>
                {v.view_purpose && <span>· {v.view_purpose}</span>}
                <span>· {v.visibility_scope}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {bindingCount > 0 && (
                <span className="text-[8px] text-[#00A3C4] font-bold">{bindingCount} Skill 绑定</span>
              )}
              {v.config.filters?.length > 0 && (
                <span className="text-[8px] text-gray-400">{v.config.filters.length} 筛选</span>
              )}
              {v.config.sorts?.length > 0 && (
                <span className="text-[8px] text-gray-400">{v.config.sorts.length} 排序</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
