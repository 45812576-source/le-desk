"use client";

import { useState } from "react";

const GOVERNANCE_SECTIONS = [
  { key: "authority_map", label: "权限映射", icon: "🔐" },
  { key: "resource_access_matrix", label: "资源访问矩阵", icon: "📊" },
  { key: "approval_route_candidates", label: "审批路由", icon: "✅" },
  { key: "policy_hints", label: "策略建议", icon: "📋" },
] as const;

type GovernanceOutputs = {
  authority_map?: Record<string, unknown>[];
  resource_access_matrix?: Record<string, unknown>[];
  approval_route_candidates?: Record<string, unknown>[];
  policy_hints?: Record<string, unknown>[];
};

export default function SnapshotGovernancePanel({
  outputs,
}: {
  outputs: GovernanceOutputs;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const hasAnyData = GOVERNANCE_SECTIONS.some(
    (sec) => (outputs[sec.key]?.length ?? 0) > 0,
  );

  if (!hasAnyData) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs font-medium text-foreground">治理中间产物</div>

      <div className="mt-3 space-y-2">
        {GOVERNANCE_SECTIONS.map((sec) => {
          const items = outputs[sec.key] ?? [];
          if (items.length === 0) return null;
          const isExpanded = expandedSection === sec.key;

          return (
            <div key={sec.key} className="rounded border border-border/70">
              <button
                onClick={() => setExpandedSection(isExpanded ? null : sec.key)}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/20"
              >
                <span className="text-xs font-medium text-foreground">
                  {sec.label}
                  <span className="ml-1.5 text-[11px] text-muted-foreground">
                    ({items.length})
                  </span>
                </span>
                <svg
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="border-t border-border/70 px-3 py-2">
                  {sec.key === "authority_map" && (
                    <GovernanceTable
                      items={items}
                      columns={["entity", "authority_type", "scope", "source"]}
                      labels={["实体", "权限类型", "范围", "来源"]}
                    />
                  )}
                  {sec.key === "resource_access_matrix" && (
                    <GovernanceTable
                      items={items}
                      columns={["resource", "accessor", "access_level", "redaction"]}
                      labels={["资源", "访问者", "级别", "脱敏"]}
                    />
                  )}
                  {sec.key === "approval_route_candidates" && (
                    <GovernanceTable
                      items={items}
                      columns={["action", "approver", "condition", "priority"]}
                      labels={["动作", "审批人", "条件", "优先级"]}
                    />
                  )}
                  {sec.key === "policy_hints" && (
                    <GovernanceTable
                      items={items}
                      columns={["policy", "description", "confidence", "source"]}
                      labels={["策略", "说明", "置信度", "来源"]}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GovernanceTable({
  items,
  columns,
  labels,
}: {
  items: Record<string, unknown>[];
  columns: string[];
  labels: string[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-muted/20">
            {labels.map((label, i) => (
              <th key={i} className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, rowIndex) => (
            <tr key={rowIndex} className="border-t border-border/50">
              {columns.map((col, colIndex) => (
                <td key={colIndex} className="px-2 py-1.5 text-foreground">
                  {formatGovernanceValue(item[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatGovernanceValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value)) return value.map(formatGovernanceValue).join("、");
  return JSON.stringify(value);
}
