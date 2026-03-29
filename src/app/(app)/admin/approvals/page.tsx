"use client";

import { useCallback, useEffect, useState } from "react";
import React from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelSelect } from "@/components/pixel/PixelSelect";
import { apiFetch } from "@/lib/api";
import type { ToolApprovalDetail } from "@/lib/types";
import { SandboxTestModal } from "@/components/skill/SandboxTestModal";

interface ApprovalAction {
  id: number;
  actor_id: number;
  actor_name: string | null;
  action: string;
  comment: string | null;
  created_at: string;
}

interface SkillSourceFile {
  filename: string;
  category: string;
}

interface SkillDetail {
  name: string;
  description: string;
  scope: string;
  mode: string;
  system_prompt: string;
  change_note: string;
  source_files: SkillSourceFile[];
}

interface WebAppApprovalDetail {
  name: string;
  description: string;
  is_public: boolean;
  preview_url: string;
}

interface SensitiveField {
  field: string;
  domain: string;
  risk: string;
  reason: string;
}

interface ToolRisk {
  tool: string;
  risk: string;
  level: string;
}

interface PromptRisk {
  pattern: string;
  risk: string;
  level: string;
}

interface MaskOverrideDraft {
  field: string;
  action: string;
  params?: Record<string, unknown>;
  position_id: number | null;
}

interface RoleOverrideDraft {
  position_id: number | null;
  callable: boolean;
  data_scope: Record<string, string>;
}

interface SuggestedPolicy {
  publish_scope: string;
  default_data_scope: Record<string, string>;
  role_overrides: RoleOverrideDraft[];
  mask_overrides: MaskOverrideDraft[];
}

interface SecurityScanResult {
  scan_version?: string;
  risk_level?: "high" | "medium" | "low" | "unknown";
  risk_summary?: string;
  data_domains_accessed?: string[];
  sensitive_fields?: SensitiveField[];
  tool_risks?: ToolRisk[];
  prompt_risks?: PromptRisk[];
  suggested_policy?: SuggestedPolicy;
  error?: string;
  fallback?: boolean;
}

interface ApprovalItem {
  id: number;
  request_type: string;
  target_id: number | null;
  target_type: string | null;
  target_detail: SkillDetail | ToolApprovalDetail | WebAppApprovalDetail | Record<string, never>;
  requester_id: number;
  requester_name: string | null;
  status: string;
  stage: string | null;
  conditions: string[];
  security_scan_result: SecurityScanResult | null;
  dept_approved_policy: SuggestedPolicy | null;
  created_at: string;
  actions: ApprovalAction[];
}

interface ApprovalResponse {
  total: number;
  page: number;
  page_size: number;
  items: ApprovalItem[];
}

const STATUS_COLOR: Record<string, "green" | "yellow" | "red" | "cyan"> = {
  pending: "yellow",
  approved: "green",
  rejected: "red",
  conditions: "cyan",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "待审批",
  approved: "已通过",
  rejected: "已拒绝",
  conditions: "附条件",
};
const TYPE_LABEL: Record<string, string> = {
  skill_publish: "Skill发布",
  tool_publish: "工具发布",
  webapp_publish: "WebApp发布",
  scope_change: "权限变更",
  mask_override: "脱敏覆盖",
  schema_approval: "Schema审批",
};

function stageLabel(stage: string | null): string | null {
  if (!stage) return null;
  if (stage === "super_pending") return "待超管终审";
  if (stage === "dept_pending") return "待首轮审批";
  return stage;
}

function stageClass(stage: string | null): string {
  return stage === "super_pending"
    ? "border-[#6B46C1] text-[#6B46C1]"
    : "border-[#B7791F] text-[#B7791F]";
}

export default function AdminApprovalsPage() {
  const [data, setData] = useState<ApprovalResponse>({ total: 0, page: 1, page_size: 20, items: [] });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [conditions, setConditions] = useState("");
  const [sandboxItem, setSandboxItem] = useState<{ id: number; name: string } | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [fileLoading, setFileLoading] = useState<string | null>(null);

  async function loadFileContent(skillId: number, filename: string) {
    const key = `${skillId}:${filename}`;
    if (fileContents[key] !== undefined) {
      // toggle collapse
      setFileContents((prev) => { const next = { ...prev }; delete next[key]; return next; });
      return;
    }
    setFileLoading(key);
    try {
      const data = await apiFetch<{ content: string }>(`/skills/${skillId}/files/${encodeURIComponent(filename)}`);
      setFileContents((prev) => ({ ...prev, [key]: data.content }));
    } catch {
      setFileContents((prev) => ({ ...prev, [key]: "加载失败" }));
    } finally {
      setFileLoading(null);
    }
  }

  const fetchData = useCallback(() => {
    Promise.resolve().then(() => setLoading(true));
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    apiFetch<ApprovalResponse>(`/approvals?${params}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function act(requestId: number, action: string) {
    try {
      const body: Record<string, unknown> = { action, comment: comment || null };
      if (action === "add_conditions" && conditions) {
        body.conditions = conditions.split("\n").filter(Boolean);
      }
      await apiFetch(`/approvals/${requestId}/actions`, { method: "POST", body: JSON.stringify(body) });
      setActing(null);
      setComment("");
      setConditions("");
      fetchData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  }

  const totalPages = Math.ceil(data.total / data.page_size);

  return (
    <PageShell title="审批管理" icon={ICONS.approvals}>
      {sandboxItem && (
        <SandboxTestModal
          type="skill"
          id={sandboxItem.id}
          name={sandboxItem.name}
          onPassed={() => setSandboxItem(null)}
          onCancel={() => setSandboxItem(null)}
          passedLabel="✓ 测试通过，关闭"
        />
      )}
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          {["", "pending", "approved", "rejected", "conditions"].map((s) => (
            <PixelButton
              key={s}
              size="sm"
              variant={statusFilter === s ? "primary" : "secondary"}
              onClick={() => { setStatusFilter(s); setPage(1); }}
            >
              {s ? STATUS_LABEL[s] : "全部"}
            </PixelButton>
          ))}
        </div>
        <PixelSelect
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="w-auto"
        >
          <option value="">全部类型</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </PixelSelect>
        <span className="text-[10px] text-gray-400 font-bold ml-auto">共 {data.total} 条</span>
      </div>

      {loading ? (
        <div className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse py-10 text-center">Loading...</div>
      ) : (
        <>
          <table className="w-full border-2 border-[#1A202C]">
            <thead>
              <tr className="bg-[#EBF4F7]">
                {["ID", "类型", "申请人", "目标", "状态", "时间", "操作"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <React.Fragment key={item.id}>
                  <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-3 py-2 text-xs text-gray-400">{item.id}</td>
                    <td className="px-3 py-2">
                      <PixelBadge color="cyan">{TYPE_LABEL[item.request_type] || item.request_type}</PixelBadge>
                    </td>
                    <td className="px-3 py-2 text-xs">{item.requester_name || `#${item.requester_id}`}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {item.target_detail && "name" in item.target_detail
                        ? <span className="font-bold">{(item.target_detail as SkillDetail).name}</span>
                        : item.target_type ? `${item.target_type} #${item.target_id}` : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <PixelBadge color={STATUS_COLOR[item.status] || "cyan"}>
                        {STATUS_LABEL[item.status] || item.status}
                      </PixelBadge>
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-400 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-3 py-2 flex gap-1">
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="text-[10px] font-bold text-[#00A3C4] hover:underline"
                      >
                        {expandedId === item.id ? "收起" : "详情"}
                      </button>
                      {item.status === "pending" && (
                        <button
                          onClick={() => setActing(acting === item.id ? null : item.id)}
                          className="text-[10px] font-bold text-[#B7791F] hover:underline ml-2"
                        >
                          {acting === item.id ? "取消" : "审批"}
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {expandedId === item.id && (
                    <tr key={`${item.id}-detail`}>
                      <td colSpan={7} className="px-4 py-3 bg-muted border-b-2 border-border">

                        {/* Skill 详情 */}
                        {item.target_type !== "tool" && item.target_detail && "name" in item.target_detail && (() => {
                          const d = item.target_detail as SkillDetail;
                          return (
                            <div className="mb-4 border-2 border-[#6B46C1] bg-card p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1]">Skill 详情</span>
                                {stageLabel(item.stage) && (
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 border ${stageClass(item.stage)}`}>
                                    {stageLabel(item.stage)}
                                  </span>
                                )}
                                {item.status === "pending" && item.target_id && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSandboxItem({ id: item.target_id!, name: d.name }); }}
                                    className="ml-auto text-[8px] font-bold uppercase tracking-widest border border-[#6B46C1] text-[#6B46C1] px-2 py-0.5 hover:bg-purple-50 transition-colors"
                                  >
                                    ▶ 沙盒测试
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="text-muted-foreground">名称：</span><span className="font-bold text-foreground">{d.name}</span></div>
                                <div><span className="text-muted-foreground">描述：</span><span className="text-foreground">{d.description || <span className="text-muted-foreground">无</span>}</span></div>
                              </div>
                              {d.change_note && (
                                <div className="text-xs"><span className="text-muted-foreground">变更说明：</span><span className="text-foreground">{d.change_note}</span></div>
                              )}
                              {d.system_prompt && (
                                <div>
                                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1] mb-1">System Prompt</div>
                                  <pre className="text-[9px] text-foreground whitespace-pre-wrap leading-relaxed font-sans bg-muted border border-border px-3 py-2 max-h-48 overflow-y-auto">
                                    {d.system_prompt}
                                  </pre>
                                </div>
                              )}
                              {/* 附属文件包 */}
                              {d.source_files && d.source_files.length > 0 && (
                                <div>
                                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1] mb-1">
                                    附属文件 ({d.source_files.length})
                                  </div>
                                  <div className="space-y-1">
                                    {d.source_files.map((f) => {
                                      const key = `${item.target_id}:${f.filename}`;
                                      const catColor: Record<string, string> = {
                                        example: "border-[#00CC99] text-[#00CC99] bg-green-50",
                                        "knowledge-base": "border-[#00A3C4] text-[#00A3C4] bg-cyan-50",
                                        reference: "border-[#B7791F] text-[#B7791F] bg-amber-50",
                                        template: "border-[#6B46C1] text-[#6B46C1] bg-purple-50",
                                      };
                                      return (
                                        <div key={f.filename}>
                                          <button
                                            onClick={() => item.target_id && loadFileContent(item.target_id, f.filename)}
                                            className="flex items-center gap-2 w-full text-left px-2 py-1 border border-border bg-card hover:bg-muted/50 transition-colors"
                                          >
                                            <span className="text-[9px] font-mono font-bold text-foreground">{f.filename}</span>
                                            <span className={`text-[7px] font-bold px-1.5 py-0.5 border ${catColor[f.category] || "border-gray-300 text-gray-400 bg-gray-50"}`}>
                                              {f.category}
                                            </span>
                                            {fileLoading === key && (
                                              <span className="text-[7px] text-[#00A3C4] animate-pulse ml-auto">Loading...</span>
                                            )}
                                            <span className="ml-auto text-[8px] text-gray-400">
                                              {fileContents[key] !== undefined ? "▼" : "▶"}
                                            </span>
                                          </button>
                                          {fileContents[key] !== undefined && (
                                            <pre className="text-[8px] text-foreground whitespace-pre-wrap leading-relaxed font-mono bg-muted border border-t-0 border-border px-3 py-2 max-h-48 overflow-y-auto">
                                              {fileContents[key]}
                                            </pre>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* 安全扫描报告（Skill 审批） */}
                        {item.target_type !== "tool" && item.target_type !== "webapp" && (() => {
                          const scan = item.security_scan_result;
                          if (!scan) {
                            return (
                              <div className="mb-4 border-2 border-dashed border-gray-300 bg-gray-50 p-3 text-center">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">安全扫描进行中…</span>
                              </div>
                            );
                          }
                          if (scan.error) {
                            return (
                              <div className="mb-4 border-2 border-dashed border-red-300 bg-red-50 p-3">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-red-400">安全扫描失败：{scan.error}</span>
                              </div>
                            );
                          }
                          const riskColor: Record<string, string> = {
                            high: "border-red-400 bg-red-50",
                            medium: "border-amber-400 bg-amber-50",
                            low: "border-green-400 bg-green-50",
                            unknown: "border-gray-400 bg-gray-50",
                          };
                          const riskBadge: Record<string, string> = {
                            high: "text-red-600 border-red-400",
                            medium: "text-amber-600 border-amber-400",
                            low: "text-green-600 border-green-400",
                            unknown: "text-gray-500 border-gray-400",
                          };
                          const riskLabel: Record<string, string> = { high: "🔴 高风险", medium: "🟡 中风险", low: "🟢 低风险", unknown: "⚪ 未知" };
                          const level = scan.risk_level ?? "unknown";
                          return (
                            <div className={`mb-4 border-2 ${riskColor[level] ?? riskColor.unknown} p-3 space-y-2`}>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">安全扫描报告</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 border ${riskBadge[level] ?? riskBadge.unknown}`}>
                                  {riskLabel[level] ?? level}
                                </span>
                              </div>

                              {scan.risk_summary && (
                                <div className="text-xs text-gray-700">{scan.risk_summary}</div>
                              )}

                              {/* 数据域访问 */}
                              {scan.data_domains_accessed && scan.data_domains_accessed.length > 0 && (
                                <div>
                                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">涉及数据域</div>
                                  <div className="flex flex-wrap gap-1">
                                    {scan.data_domains_accessed.map((d) => (
                                      <span key={d} className="text-[7px] font-mono border border-blue-300 bg-blue-50 text-blue-600 px-1.5 py-0.5">{d}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 敏感字段 */}
                              {scan.sensitive_fields && scan.sensitive_fields.length > 0 && (
                                <div>
                                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">敏感字段</div>
                                  <div className="space-y-1">
                                    {scan.sensitive_fields.map((f, i) => (
                                      <div key={i} className="flex items-start gap-2 text-[8px] border border-gray-200 bg-white px-2 py-1">
                                        <span className="font-mono font-bold text-red-500">{f.field}</span>
                                        <span className="text-gray-400">[{f.domain}]</span>
                                        <span className="text-gray-600 flex-1">{f.reason}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 工具风险 */}
                              {scan.tool_risks && scan.tool_risks.length > 0 && (
                                <div>
                                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">工具风险</div>
                                  <div className="space-y-1">
                                    {scan.tool_risks.map((t, i) => (
                                      <div key={i} className="flex items-center gap-2 text-[8px] border border-amber-200 bg-amber-50 px-2 py-1">
                                        <span className="font-mono font-bold text-amber-600">{t.tool}</span>
                                        <span className="text-gray-600">{t.risk}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Prompt 风险 */}
                              {scan.prompt_risks && scan.prompt_risks.length > 0 && (
                                <div>
                                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">Prompt 风险</div>
                                  <div className="space-y-1">
                                    {scan.prompt_risks.map((p, i) => (
                                      <div key={i} className="flex items-start gap-2 text-[8px] border border-red-200 bg-red-50 px-2 py-1">
                                        <span className="font-mono text-red-400">&ldquo;{p.pattern}&rdquo;</span>
                                        <span className="text-gray-600">{p.risk}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Policy 草案分层视图 */}
                              {scan.suggested_policy && (() => {
                                const deptApproved = item.dept_approved_policy;
                                const isSuperStage = item.stage === "super_pending";
                                const deptPosIds = new Set((deptApproved?.role_overrides ?? []).map(o => o.position_id));
                                const superOverrides = (scan.suggested_policy.role_overrides ?? []).filter(o => !deptPosIds.has(o.position_id));
                                const scopeOrder = ["self_only", "same_role", "cross_role", "org_wide"];
                                const deptScope = deptApproved?.publish_scope ?? "same_role";
                                const suggestedScope = scan.suggested_policy.publish_scope;
                                const needsScopeUpgrade = scopeOrder.indexOf(suggestedScope) > scopeOrder.indexOf(deptScope);

                                return (
                                  <div>
                                    <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                                      Policy 草案
                                      {!isSuperStage && <span className="ml-1 text-amber-500">（部门管理员审核阶段）</span>}
                                      {isSuperStage && <span className="ml-1 text-purple-500">（超管审核阶段）</span>}
                                    </div>

                                    {/* dept 已确认部分 */}
                                    {deptApproved && (
                                      <div className="mb-1 bg-green-50 border border-green-200 px-2 py-1.5 space-y-1">
                                        <div className="text-[7px] font-bold text-green-600 uppercase tracking-widest">✓ 部门管理员已确认</div>
                                        <div className="text-[8px]">
                                          <span className="text-gray-400">发布范围：</span>
                                          <span className="font-mono font-bold">{deptApproved.publish_scope}</span>
                                        </div>
                                        {(deptApproved.role_overrides ?? []).length > 0 && (
                                          <div className="text-[7px] text-gray-500">
                                            本部门角色覆盖 {deptApproved.role_overrides.length} 条，
                                            其中 {deptApproved.role_overrides.filter(o => !o.callable).length} 个禁止调用
                                          </div>
                                        )}
                                        {(deptApproved.mask_overrides ?? []).length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {deptApproved.mask_overrides.slice(0, 5).map((m, i) => (
                                              <span key={i} className="text-[7px] font-mono border border-green-300 bg-green-100 text-green-700 px-1 py-0.5">
                                                {m.field}: {m.action}
                                              </span>
                                            ))}
                                            {(deptApproved.mask_overrides ?? []).length > 5 && (
                                              <span className="text-[7px] text-gray-400">+{deptApproved.mask_overrides.length - 5}</span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* super 待审部分 */}
                                    {(superOverrides.length > 0 || needsScopeUpgrade || !deptApproved) && (
                                      <div className="bg-purple-50 border border-purple-200 px-2 py-1.5 space-y-1">
                                        <div className="text-[7px] font-bold text-purple-600 uppercase tracking-widest">
                                          {isSuperStage ? "↑ 待超管确认" : "↑ 将流转超管确认"}
                                        </div>
                                        {needsScopeUpgrade && (
                                          <div className="text-[8px]">
                                            <span className="text-gray-400">范围升级：</span>
                                            <span className="font-mono text-gray-500 line-through mr-1">{deptScope}</span>
                                            <span className="font-mono font-bold text-purple-600">→ {suggestedScope}</span>
                                          </div>
                                        )}
                                        {superOverrides.length > 0 && (
                                          <div className="text-[7px] text-gray-500">
                                            跨部门角色覆盖 {superOverrides.length} 条
                                          </div>
                                        )}
                                        {!deptApproved && (
                                          <div className="text-[7px] text-gray-400">（等待部门管理员先行审核）</div>
                                        )}
                                      </div>
                                    )}

                                    {/* 无需超管介入 */}
                                    {deptApproved && superOverrides.length === 0 && !needsScopeUpgrade && (
                                      <div className="bg-blue-50 border border-blue-200 px-2 py-1 text-[7px] text-blue-500">
                                        全部在部门管理员权限内，超管仅需最终发布确认
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })()}

                        {/* Tool 详情 */}
                        {item.target_type === "tool" && item.target_detail && "tool_name" in item.target_detail && (() => {
                          const d = item.target_detail as ToolApprovalDetail;
                          const di = d.deploy_info ?? {};
                          const TYPE_LABEL_MAP: Record<string, string> = { builtin: "内置 Python", mcp: "MCP", http: "HTTP" };
                          const MODE_LABEL_MAP: Record<string, string> = { chat: "对话触发", registered_table: "业务表模式", file_upload: "文件上传" };
                          const DS_TYPE_MAP: Record<string, string> = { registered_table: "业务表", uploaded_file: "上传文件", chat_context: "对话上下文" };
                          return (
                            <div className="mb-4 border-2 border-[#00CC99] bg-card p-3 space-y-3">
                              {/* 标题行 */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-[#00CC99]">工具详情</span>
                                <span className="text-[8px] font-mono text-gray-500">{d.tool_name}</span>
                                {d.tool_type && <span className="text-[7px] border border-[#00CC99] text-[#00CC99] px-1.5 py-0.5 font-bold uppercase">{TYPE_LABEL_MAP[d.tool_type] ?? d.tool_type}</span>}
                                {stageLabel(item.stage) && (
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 border ml-auto ${stageClass(item.stage)}`}>
                                    {stageLabel(item.stage)}
                                  </span>
                                )}
                              </div>

                              {/* 基本信息 */}
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                <div><span className="text-muted-foreground">显示名：</span><span className="font-bold">{d.name}</span></div>
                                <div><span className="text-muted-foreground">发布范围：</span><span className="font-bold">{d.scope}</span></div>
                                {d.invocation_mode && <div><span className="text-muted-foreground">触发方式：</span><span>{MODE_LABEL_MAP[d.invocation_mode] ?? d.invocation_mode}</span></div>}
                                {d.description && <div className="col-span-2"><span className="text-muted-foreground">描述：</span><span>{d.description}</span></div>}
                              </div>

                              {/* 数据来源 */}
                              {d.data_sources?.length > 0 && (
                                <div>
                                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">数据来源</div>
                                  <div className="space-y-1">
                                    {d.data_sources.map((ds) => (
                                      <div key={ds.key} className="flex items-center gap-2 text-[8px] border border-gray-200 bg-gray-50 px-2 py-1">
                                        <span className="font-mono font-bold text-[#00A3C4]">{ds.key}</span>
                                        <span className="text-gray-500">{DS_TYPE_MAP[ds.type] ?? ds.type}</span>
                                        {ds.required !== false ? <span className="text-red-400 font-bold">必填</span> : <span className="text-gray-300">选填</span>}
                                        {ds.accept?.length && <span className="font-mono text-gray-400">{ds.accept.join(" ")}</span>}
                                        {ds.description && <span className="text-gray-500">{ds.description}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 权限声明 */}
                              {d.permissions?.length > 0 && (
                                <div>
                                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">权限声明</div>
                                  <div className="flex flex-wrap gap-1">
                                    {d.permissions.map((p) => (
                                      <span key={p} className="text-[7px] font-mono border border-amber-300 bg-amber-50 text-amber-600 px-1.5 py-0.5">{p}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 部署说明（开发者填写） */}
                              <div className="border-t border-gray-200 pt-2 space-y-1.5">
                                <div className="text-[8px] font-bold uppercase tracking-widest text-[#00CC99] mb-1">开发者部署说明</div>
                                {di.purpose && (
                                  <div className="text-xs"><span className="text-muted-foreground font-bold">用途：</span><span>{di.purpose}</span></div>
                                )}
                                {di.env_requirements && (
                                  <div className="text-xs"><span className="text-muted-foreground font-bold">运行环境：</span><span className="font-mono">{di.env_requirements}</span></div>
                                )}
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground font-bold">本地测试：</span>
                                  {di.tested
                                    ? <span className="text-[#00CC99] font-bold">✓ 已通过</span>
                                    : <span className="text-red-400 font-bold">✗ 未确认</span>
                                  }
                                  {di.test_note && <span className="text-gray-500">— {di.test_note}</span>}
                                </div>
                                {di.extra_note && (
                                  <div className="text-xs"><span className="text-muted-foreground font-bold">其他说明：</span><span>{di.extra_note}</span></div>
                                )}
                                {!di.purpose && !di.env_requirements && !di.extra_note && (
                                  <div className="text-[8px] text-gray-400">开发者未填写部署说明</div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* WebApp 详情 */}
                        {item.target_type === "webapp" && item.target_detail && "preview_url" in item.target_detail && (() => {
                          const d = item.target_detail as WebAppApprovalDetail;
                          return (
                            <div className="mb-4 border-2 border-[#6B46C1] bg-card p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1]">Web App 详情</span>
                                {stageLabel(item.stage) && (
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 border ${stageClass(item.stage)}`}>
                                    {stageLabel(item.stage)}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="text-muted-foreground">名称：</span><span className="font-bold">{d.name}</span></div>
                                <div><span className="text-muted-foreground">可见性：</span><span className="font-bold">{d.is_public ? "公开" : "私有"}</span></div>
                                {d.description && <div className="col-span-2"><span className="text-muted-foreground">描述：</span><span>{d.description}</span></div>}
                              </div>
                              <a
                                href={d.preview_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-[8px] font-bold uppercase tracking-widest border border-[#6B46C1] text-[#6B46C1] px-2 py-0.5 hover:bg-purple-50 transition-colors"
                              >
                                预览 Web App ↗
                              </a>
                            </div>
                          );
                        })()}

                        {item.conditions.length > 0 && (
                          <div className="mb-2">
                            <span className="text-[9px] font-bold uppercase text-[#B7791F]">附加条件</span>
                            <ul className="mt-1 space-y-0.5">
                              {item.conditions.map((c, i) => (
                                <li key={i} className="text-xs text-foreground">• {c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {item.actions.length > 0 && (
                          <div>
                            <span className="text-[9px] font-bold uppercase text-[#00A3C4]">审批历史</span>
                            <div className="mt-1 space-y-1">
                              {item.actions.map((a) => (
                                <div key={a.id} className="flex items-start gap-2 text-xs">
                                  <span className="text-muted-foreground whitespace-nowrap">
                                    {new Date(a.created_at).toLocaleString("zh-CN")}
                                  </span>
                                  <span className="font-bold text-foreground">{a.actor_name || `#${a.actor_id}`}</span>
                                  <PixelBadge color={a.action === "approve" ? "green" : a.action === "reject" ? "red" : "yellow"}>
                                    {a.action === "approve" ? "通过" : a.action === "reject" ? "拒绝" : "附条件"}
                                  </PixelBadge>
                                  {a.comment && <span className="text-muted-foreground">{a.comment}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}

                  {/* Action panel */}
                  {acting === item.id && (
                    <tr key={`${item.id}-act`}>
                      <td colSpan={7} className="px-4 py-3 bg-card border-b-2 border-[#B7791F]">
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-[#B7791F] block mb-1">审批备注</label>
                            <input
                              type="text"
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                              placeholder="可选"
                              className="w-full border-2 border-[#B7791F] px-3 py-1.5 text-xs focus:outline-none bg-muted text-foreground"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-[#B7791F] block mb-1">附加条件（每行一条，仅&ldquo;附条件通过&rdquo;时填写）</label>
                            <textarea
                              value={conditions}
                              onChange={(e) => setConditions(e.target.value)}
                              rows={2}
                              className="w-full border-2 border-[#B7791F] px-3 py-1.5 text-xs focus:outline-none bg-muted text-foreground resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <PixelButton variant="primary" size="sm" onClick={() => act(item.id, "approve")}>
                              通过
                            </PixelButton>
                            <PixelButton variant="secondary" size="sm" onClick={() => act(item.id, "add_conditions")}>
                              附条件通过
                            </PixelButton>
                            <PixelButton variant="danger" size="sm" onClick={() => act(item.id, "reject")}>
                              拒绝
                            </PixelButton>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <PixelButton size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                上一页
              </PixelButton>
              <span className="text-[10px] font-bold">{page} / {totalPages}</span>
              <PixelButton size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                下一页
              </PixelButton>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
