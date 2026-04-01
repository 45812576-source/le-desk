"use client";

import React from "react";
import type { RowAccessMode, FieldAccessMode, DisclosureLevel } from "../../shared/types";

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaults: {
    row_access_mode: RowAccessMode;
    field_access_mode: FieldAccessMode;
    disclosure_level: DisclosureLevel;
    export_permission: boolean;
    masking_sensitive: boolean;
  };
}

const SCENARIOS: ScenarioPreset[] = [
  {
    id: "open_readonly",
    name: "开放只读",
    description: "全员可读全部字段，敏感字段脱敏，禁止导出",
    icon: "👁",
    defaults: {
      row_access_mode: "all",
      field_access_mode: "all",
      disclosure_level: "L2",
      export_permission: false,
      masking_sensitive: true,
    },
  },
  {
    id: "dept_scoped",
    name: "部门隔离",
    description: "仅可见本部门数据行，敏感字段脱敏",
    icon: "🏢",
    defaults: {
      row_access_mode: "department",
      field_access_mode: "all",
      disclosure_level: "L2",
      export_permission: false,
      masking_sensitive: true,
    },
  },
  {
    id: "strict_locked",
    name: "严格管控",
    description: "仅白名单字段可见，禁止导出，统计级披露",
    icon: "🔒",
    defaults: {
      row_access_mode: "owner",
      field_access_mode: "allowlist",
      disclosure_level: "L1",
      export_permission: false,
      masking_sensitive: true,
    },
  },
  {
    id: "full_access",
    name: "完全开放",
    description: "管理员或全信任场景，全部权限开放",
    icon: "🔓",
    defaults: {
      row_access_mode: "all",
      field_access_mode: "all",
      disclosure_level: "L4",
      export_permission: true,
      masking_sensitive: false,
    },
  },
];

interface Props {
  onSelect: (scenario: ScenarioPreset) => void;
  selectedId?: string;
}

export default function ScenarioSelector({ onSelect, selectedId }: Props) {
  return (
    <div>
      <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-2">场景模板</div>
      <div className="grid grid-cols-2 gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className={`text-left p-2 border-2 transition-colors ${
              selectedId === s.id
                ? "border-[#00D1FF] bg-[#F0FBFF]"
                : "border-gray-200 hover:border-[#00D1FF] hover:bg-[#F0FBFF]"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">{s.icon}</span>
              <span className="text-[9px] font-bold">{s.name}</span>
            </div>
            <p className="text-[8px] text-gray-400">{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export { SCENARIOS };
