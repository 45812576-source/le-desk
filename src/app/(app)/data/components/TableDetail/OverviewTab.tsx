"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import { useV2DataAssets } from "../shared/feature-flags";
import type { TableDetail, TableDetailV2, TableCapabilities, DataAssetFolder } from "../shared/types";
import { patchTableMeta } from "../shared/api";
import SourceProfilePanel from "./source/SourceProfilePanel";
import DegradationAlert from "./source/DegradationAlert";

const SOURCE_LABELS: Record<string, string> = {
  lark_bitable: "飞书多维表",
  bitable: "飞书多维表",
  mysql: "MySQL 数据库",
  imported: "CSV/Excel 导入",
  blank: "手动创建",
};

const SYNC_COLORS: Record<string, string> = {
  idle: "bg-gray-100 text-gray-500",
  syncing: "bg-blue-50 text-blue-500",
  success: "bg-green-50 text-green-500",
  ok: "bg-green-50 text-green-500",
  partial_success: "bg-yellow-50 text-yellow-500",
  failed: "bg-red-50 text-red-500",
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 w-20 flex-shrink-0">{label}</span>
      <div className="text-[10px] text-[#1A202C] flex-1">{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">{children}</div>;
}

interface SummaryLine {
  label: string;
  value: string;
}

interface TableSummaryResponse {
  summary?: string | null;
  capability_summary?: string | null;
  limitation_summary?: string | null;
  related_departments?: string[] | null;
  suitable_skills?: string[] | null;
  suitable_skill_types?: string[] | null;
  use_cases?: string[] | null;
  generated_at?: string | null;
}

function buildCapabilitySummary(detail: TableDetail): SummaryLine[] {
  const dimensionFields = detail.fields.filter((field) => field.is_groupable);
  const metricFields = detail.fields.filter((field) => field.field_role_tags?.includes("metric") || field.field_type === "number");
  const relatedDepartments: string[] = [];

  return [
    {
      label: "这张表能提供什么",
      value: detail.description?.trim() || "可作为 Skill 编辑时的数据资产说明，帮助快速判断是否值得挂载。",
    },
    {
      label: "适合做什么 Skill",
      value: metricFields.length > 0 || dimensionFields.length > 0
        ? `适合围绕 ${dimensionFields.slice(0, 3).map((field) => field.display_name || field.field_name).join("、") || "业务维度"} 做筛选/分组，并对 ${metricFields.slice(0, 3).map((field) => field.display_name || field.field_name).join("、") || "关键指标"} 做统计分析。`
        : "当前更适合作为资料查询或字段补充型数据源。 ",
    },
    {
      label: "相关部门",
      value: relatedDepartments.length > 0 ? relatedDepartments.join("、") : "暂未标注部门，可由维护人补充。",
    },
    {
      label: "使用边界",
      value: [
        detail.record_count === 0 ? "当前表为空" : null,
        detail.views.length === 0 ? "尚未配置复用视图" : null,
        detail.sync_error ? "存在同步异常" : null,
      ].filter(Boolean).join("；") || "具体用户运行时权限、脱敏和输出策略统一在 SkillStudio 处理。",
    },
  ];
}

function normalizeSummaryResponse(detail: TableDetail, response: TableSummaryResponse | null): SummaryLine[] {
  if (!response) return buildCapabilitySummary(detail);

  const suitableSkills = response.suitable_skills || response.suitable_skill_types || response.use_cases || [];
  const relatedDepartments = response.related_departments || [];

  const lines: SummaryLine[] = [
    {
      label: "这张表能提供什么",
      value: response.summary?.trim() || detail.description?.trim() || "可作为 Skill 编辑时的数据资产说明，帮助快速判断是否值得挂载。",
    },
    {
      label: "适合做什么 Skill",
      value: suitableSkills.length > 0 ? suitableSkills.join("、") : response.capability_summary?.trim() || buildCapabilitySummary(detail)[1].value,
    },
    {
      label: "相关部门",
      value: relatedDepartments.length > 0 ? relatedDepartments.join("、") : buildCapabilitySummary(detail)[2].value,
    },
    {
      label: "使用边界",
      value: response.limitation_summary?.trim() || buildCapabilitySummary(detail)[3].value,
    },
  ];

  return lines;
}

function buildDiagnostics(detail: TableDetail) {
  const items: Array<{ tone: "green" | "yellow" | "red" | "gray"; title: string; detail: string; action: string }> = [];

  if (detail.source_type !== "blank") {
    if (detail.sync_status === "failed" || detail.sync_error) {
      items.push({
        tone: "red",
        title: "连接或同步异常",
        detail: detail.sync_error || "当前数据源最近一次同步失败，页面拿到的可能是旧快照或空结果。",
        action: "重新同步；如果仍失败，检查源表授权、链接有效性和工作表选择。",
      });
    } else if (!detail.last_synced_at) {
      items.push({
        tone: "yellow",
        title: "尚未完成首次同步",
        detail: "已经建表，但还没有成功拉到最近一次数据快照。",
        action: "先执行一次同步，确认能拿到行数、字段和样例数据。",
      });
    } else {
      items.push({
        tone: "green",
        title: "连接链路正常",
        detail: `最近一次同步时间为 ${new Date(detail.last_synced_at).toLocaleString("zh-CN")}。`,
        action: "如果样例数据与源表不一致，可手动触发重新同步。",
      });
    }
  }

  if (detail.record_count === 0) {
    items.push({
      tone: "yellow",
      title: "当前表内没有可用记录",
      detail: "编辑人即使拿到链接，也无法判断字段覆盖情况和数据分布。",
      action: "检查是否同步到了正确工作表，或确认源表当前是否为空表。",
    });
  } else if (detail.record_count === null) {
    items.push({
      tone: "yellow",
      title: "尚未统计总行数",
      detail: "页面还不能直接回答“这个表里到底有多少数据”。",
      action: "补齐统计或同步后重新进入详情页。",
    });
  }

  if (detail.fields.length === 0) {
    items.push({
      tone: "red",
      title: "没有解析出字段",
      detail: "当前无法支撑 Skill 编辑人理解表结构。",
      action: "检查字段解析链路或源表权限，再重新同步。",
    });
  } else if (detail.field_profile_status !== "ready" && detail.field_profile_status !== "completed") {
    items.push({
      tone: "yellow",
      title: "字段画像还没准备好",
      detail: detail.field_profile_error || "字段说明、样例和统计信息可能还不完整。",
      action: "等待字段画像完成，或重新触发同步和画像任务。",
    });
  }

  if (detail.views.length === 0) {
    items.push({
      tone: "gray",
      title: "还没有视图范围",
      detail: "Skill 编辑人暂时只能看到整张表的基础信息，不能直接复用视图。",
      action: "补一个按场景划分的视图，明确字段范围和行范围。",
    });
  }

  if (detail.bindings.length === 0 && detail.skill_grants.length === 0) {
    items.push({
      tone: "gray",
      title: "还没有 Skill 使用记录",
      detail: "目前无法从这张表反查有哪些 Skill 正在消费它。",
      action: "去 SkillStudio 挂载后，这里会回显只读投影。",
    });
  }

  return items;
}

interface Props {
  detail: TableDetail;
  onRefresh: () => void;
  onDeleteTable?: (id: number) => void;
  capabilities?: TableCapabilities;
}

export default function OverviewTab({ detail, onRefresh, onDeleteTable, capabilities }: Props) {
  const isV2 = useV2DataAssets();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [folders, setFolders] = useState<DataAssetFolder[]>([]);
  const [moving, setMoving] = useState(false);
  const [summaryLines, setSummaryLines] = useState<SummaryLine[]>(() => buildCapabilitySummary(detail));
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryNotice, setSummaryNotice] = useState<"api" | "derived">("derived");

  const isPublished = detail.publish_status === "published";

  async function handlePublish() {
    setPublishing(true);
    try {
      await apiFetch(`/data-assets/tables/${detail.id}/publish`, { method: "POST" });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "发布失败");
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!confirm("取消发布后，Skill 将无法绑定此数据表。确认？")) return;
    setPublishing(true);
    try {
      await apiFetch(`/data-assets/tables/${detail.id}/unpublish`, { method: "POST" });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "取消发布失败");
    } finally {
      setPublishing(false);
    }
  }

  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameValue, setNameValue] = useState(detail.display_name);
  const [descValue, setDescValue] = useState(detail.description || "");

  async function saveName() {
    if (nameValue.trim() === detail.display_name) {
      setEditingName(false);
      return;
    }
    try {
      await patchTableMeta(detail.id, { display_name: nameValue.trim() });
      setEditingName(false);
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "保存失败");
    }
  }

  async function saveDesc() {
    if (descValue === (detail.description || "")) {
      setEditingDesc(false);
      return;
    }
    try {
      await patchTableMeta(detail.id, { description: descValue });
      setEditingDesc(false);
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "保存失败");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/data-assets/tables/${detail.id}`, { method: "DELETE" });
      onDeleteTable?.(detail.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function triggerSync() {
    try {
      await apiFetch(`/data-assets/tables/${detail.id}/sync`, { method: "POST" });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "同步失败");
    }
  }

  useEffect(() => {
    apiFetch<{ items: DataAssetFolder[] }>("/data-assets/folders")
      .then((data) => setFolders(data.items))
      .catch(() => setFolders([]));
  }, [detail.id]);

  const refreshSummary = useCallback(async (mode: "load" | "refresh") => {
    const fallback = buildCapabilitySummary(detail);
    setSummaryLoading(true);
    try {
      const path = mode === "refresh"
        ? `/data-assets/tables/${detail.id}/summarize`
        : `/data-assets/tables/${detail.id}/summary`;
      const response = await apiFetch<TableSummaryResponse>(path, mode === "refresh" ? { method: "POST" } : undefined);
      setSummaryLines(normalizeSummaryResponse(detail, response));
      setSummaryNotice("api");
    } catch {
      setSummaryLines(fallback);
      setSummaryNotice("derived");
    } finally {
      setSummaryLoading(false);
    }
  }, [detail]);

  useEffect(() => {
    setSummaryLines(buildCapabilitySummary(detail));
    setSummaryNotice("derived");
    void refreshSummary("load");
  }, [detail, refreshSummary]);

  const folderOptions = useMemo(() => {
    const result: Array<{ id: number; label: string }> = [];
    const walk = (items: DataAssetFolder[], prefix = "") => {
      items.forEach((folder) => {
        const label = prefix ? `${prefix} / ${folder.name}` : folder.name;
        result.push({ id: folder.id, label });
        walk(folder.children || [], label);
      });
    };
    walk(folders);
    return result;
  }, [folders]);

  async function moveToFolder(folderId: string) {
    setMoving(true);
    try {
      await apiFetch(`/data-assets/tables/${detail.id}/move`, {
        method: "PATCH",
        body: JSON.stringify({ folder_id: folderId ? Number(folderId) : 0 }),
      });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "移动失败");
    } finally {
      setMoving(false);
    }
  }

  const syncColor = SYNC_COLORS[detail.sync_status] || SYNC_COLORS.idle;
  const diagnostics = buildDiagnostics(detail);
  const usageCount = new Set([
    ...detail.bindings.map((binding) => binding.skill_id),
    ...detail.skill_grants.map((grant) => grant.skill_id),
  ]).size;
  const sampleFieldNames = detail.fields
    .filter((field) => !field.is_system)
    .slice(0, 6)
    .map((field) => field.display_name || field.field_name);

  return (
    <div className="p-4 space-y-4">
      {isV2 && <DegradationAlert profile={(detail as TableDetailV2).source_profile} />}

      {detail.risk_warnings.length > 0 && (
        <div className="space-y-1">
          {detail.risk_warnings.map((warning) => (
            <div key={warning.code} className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 text-[9px] text-yellow-700 font-bold">
              <span>⚠</span>
              <span>{warning.message}</span>
              <span className="text-[8px] text-yellow-400 font-mono ml-auto">{warning.code}</span>
            </div>
          ))}
        </div>
      )}

      <div className="border-2 border-[#1A202C] p-3">
        <SectionTitle>可用性诊断</SectionTitle>
        <div className="space-y-2">
          {diagnostics.map((item) => (
            <div
              key={item.title}
              className={`border px-3 py-2 ${
                item.tone === "green"
                  ? "border-green-200 bg-green-50"
                  : item.tone === "yellow"
                    ? "border-yellow-200 bg-yellow-50"
                    : item.tone === "red"
                      ? "border-red-200 bg-red-50"
                      : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="text-[9px] font-bold text-[#1A202C]">{item.title}</div>
              <div className="text-[8px] text-gray-600 mt-0.5">{item.detail}</div>
              <div className="text-[8px] text-gray-500 mt-1">下一步：{item.action}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-2 border-[#1A202C] p-3">
        <div className="flex items-center gap-2 mb-2">
          <SectionTitle>表摘要</SectionTitle>
          <span className={`text-[8px] px-1.5 py-0.5 border rounded ${summaryNotice === "api" ? "border-green-200 bg-green-50 text-green-600" : "border-gray-200 bg-gray-50 text-gray-500"}`}>
            {summaryNotice === "api" ? "接口摘要" : "规则推断"}
          </span>
          <div className="ml-auto">
            <PixelButton size="sm" variant="secondary" onClick={() => { void refreshSummary("refresh"); }} disabled={summaryLoading}>
              {summaryLoading ? "刷新中..." : "刷新摘要"}
            </PixelButton>
          </div>
        </div>
        <div className="mb-3 border border-[#00D1FF] bg-[#F0FBFF] px-3 py-2 text-[8px] text-[#1A202C]">
          这里只回答这张表有什么、适合谁用、边界是什么；具体用户运行时的权限、脱敏和审批统一在 SkillStudio 处理。
        </div>
        <div className="space-y-2">
          {summaryLines.map((line) => (
            <div key={line.label}>
              <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{line.label}</div>
              <div className="text-[10px] text-[#1A202C] mt-0.5">{line.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-2 border-[#1A202C] p-3">
        <SectionTitle>基本信息</SectionTitle>

        <InfoRow label="名称">
          {capabilities?.can_edit_meta && editingName ? (
            <div className="flex items-center gap-1">
              <input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="flex-1 border border-border px-1.5 py-0.5 text-[10px] bg-background focus:outline-none focus:border-[#00D1FF]"
                autoFocus
              />
              <button onClick={saveName} className="text-[8px] font-bold text-[#00A3C4]">保存</button>
              <button onClick={() => setEditingName(false)} className="text-[8px] text-muted-foreground">取消</button>
            </div>
          ) : (
            <span
              className={capabilities?.can_edit_meta ? "cursor-pointer hover:text-[#00A3C4] transition-colors" : ""}
              onClick={() => {
                if (capabilities?.can_edit_meta) {
                  setNameValue(detail.display_name);
                  setEditingName(true);
                }
              }}
            >
              {detail.display_name}
              {capabilities?.can_edit_meta && <span className="text-[7px] text-muted-foreground ml-1">✎</span>}
            </span>
          )}
        </InfoRow>

        <InfoRow label="描述">
          {capabilities?.can_edit_meta && editingDesc ? (
            <div className="flex items-center gap-1">
              <input
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveDesc();
                  if (e.key === "Escape") setEditingDesc(false);
                }}
                placeholder="添加表描述..."
                className="flex-1 border border-border px-1.5 py-0.5 text-[10px] bg-background focus:outline-none focus:border-[#00D1FF]"
                autoFocus
              />
              <button onClick={saveDesc} className="text-[8px] font-bold text-[#00A3C4]">保存</button>
              <button onClick={() => setEditingDesc(false)} className="text-[8px] text-muted-foreground">取消</button>
            </div>
          ) : (
            <span
              className={capabilities?.can_edit_meta ? "cursor-pointer hover:text-[#00A3C4] transition-colors" : ""}
              onClick={() => {
                if (capabilities?.can_edit_meta) {
                  setDescValue(detail.description || "");
                  setEditingDesc(true);
                }
              }}
            >
              {detail.description || <span className="text-muted-foreground">无描述</span>}
              {capabilities?.can_edit_meta && <span className="text-[7px] text-muted-foreground ml-1">✎</span>}
            </span>
          )}
        </InfoRow>

        <InfoRow label="来源">{SOURCE_LABELS[detail.source_type] || detail.source_type}</InfoRow>
        <InfoRow label="归档目录">
          <div className="flex items-center gap-2">
            <select
              value={detail.folder_id ?? ""}
              onChange={(e) => moveToFolder(e.target.value)}
              disabled={!capabilities?.can_edit_meta || moving}
              className="border border-border px-1.5 py-0.5 text-[9px] bg-background focus:outline-none focus:border-[#00D1FF]"
            >
              <option value="">未归档</option>
              {folderOptions.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.label}</option>
              ))}
            </select>
            {!capabilities?.can_edit_meta && (
              <span className="text-[8px] text-gray-400">仅表创建者或管理员可移动</span>
            )}
          </div>
        </InfoRow>
        <InfoRow label="记录数">{detail.record_count ?? "未统计"}</InfoRow>
        <InfoRow label="字段数">{detail.fields.length}</InfoRow>
        <InfoRow label="视图数">{detail.views.length}</InfoRow>
        <InfoRow label="关联 Skill">{usageCount}</InfoRow>
        <InfoRow label="重点字段">
          {sampleFieldNames.length > 0 ? sampleFieldNames.join("、") : "暂无可展示字段"}
        </InfoRow>
        <InfoRow label="创建时间">{detail.created_at ? new Date(detail.created_at).toLocaleString("zh-CN") : "-"}</InfoRow>
        <InfoRow label="发布状态">
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${isPublished ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
              {isPublished ? "已发布" : "草稿"}
            </span>
            {capabilities?.can_manage_publish ? (
              isPublished ? (
                <PixelButton size="sm" variant="secondary" onClick={handleUnpublish} disabled={publishing}>
                  {publishing ? "..." : "取消发布"}
                </PixelButton>
              ) : (
                <PixelButton size="sm" onClick={handlePublish} disabled={publishing}>
                  {publishing ? "..." : "申请发布"}
                </PixelButton>
              )
            ) : (
              <span className="text-[8px] text-gray-400">仅表管理员可操作发布</span>
            )}
          </div>
        </InfoRow>
      </div>

      {detail.source_type !== "blank" && (
        <div className="border-2 border-[#1A202C] p-3">
          <SectionTitle>连接与同步</SectionTitle>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${syncColor}`}>
              {detail.sync_status}
            </span>
            {detail.sync_error && (
              <span className="text-[8px] text-red-500">最近一次同步存在异常</span>
            )}
          </div>
          {detail.sync_error && (
            <div className="text-[9px] text-red-500 mb-2 bg-red-50 px-2 py-1 border border-red-200">{detail.sync_error}</div>
          )}
          <InfoRow label="上次同步">{detail.last_synced_at ? new Date(detail.last_synced_at).toLocaleString("zh-CN") : "从未同步"}</InfoRow>
          {detail.source_ref.app_token && (
            <InfoRow label="源表标识">
              <span className="font-mono text-[9px]">{detail.source_ref.app_token}{detail.source_ref.table_id ? ` / ${detail.source_ref.table_id}` : ""}</span>
            </InfoRow>
          )}
          <div className="mt-2">
            <PixelButton size="sm" onClick={triggerSync} variant="secondary">
              {detail.sync_status === "syncing" ? "同步中..." : "立即同步"}
            </PixelButton>
          </div>
        </div>
      )}

      <div className="border-2 border-[#1A202C] p-3">
        <SectionTitle>字段画像</SectionTitle>
        <InfoRow label="状态">
          <span className={detail.field_profile_status === "ready" || detail.field_profile_status === "completed" ? "text-green-500" : detail.field_profile_status === "failed" ? "text-red-500" : "text-yellow-500"}>
            {detail.field_profile_status === "ready" || detail.field_profile_status === "completed" ? "已完成" : detail.field_profile_status === "failed" ? "失败" : "待分析"}
          </span>
        </InfoRow>
        {detail.field_profile_error && (
          <div className="text-[9px] text-red-500 mt-1">{detail.field_profile_error}</div>
        )}
      </div>

      {isV2 && detail.source_type !== "blank" && (detail as TableDetailV2).source_profile && (
        <SourceProfilePanel profile={(detail as TableDetailV2).source_profile!} />
      )}

      {onDeleteTable && capabilities?.can_delete_table && (
        <div className="border-2 border-red-200 p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-red-400 mb-2">危险操作</div>
          {!confirmDelete ? (
            <PixelButton size="sm" variant="secondary" onClick={() => setConfirmDelete(true)}>
              删除此数据表
            </PixelButton>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-red-500 font-bold">确认删除「{detail.display_name}」？此操作不可恢复。</span>
              <PixelButton size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? "删除中..." : "确认删除"}
              </PixelButton>
              <PixelButton size="sm" variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                取消
              </PixelButton>
            </div>
          )}
        </div>
      )}

      {onDeleteTable && !capabilities?.can_delete_table && (
        <div className="border border-yellow-200 bg-yellow-50 p-3 text-[9px] text-yellow-700">
          如果数据表处于未发布草稿且你是创建者，则可以直接删除；已发布或无所有权的表不能在这里删除。
        </div>
      )}

      {detail.recent_sync_jobs.length > 0 && (
        <div className="border-2 border-[#1A202C] p-3">
          <SectionTitle>最近同步记录</SectionTitle>
          <div className="space-y-1">
            {detail.recent_sync_jobs.map((job) => (
              <div key={job.id} className="flex items-center gap-3 text-[9px] py-1 border-b border-gray-100 last:border-0">
                <span className={`font-bold ${job.status === "success" || job.status === "ok" ? "text-green-500" : job.status === "failed" ? "text-red-500" : "text-gray-400"}`}>
                  {job.status}
                </span>
                <span className="text-gray-400">{job.job_type}</span>
                <span className="text-gray-400">{job.trigger_source}</span>
                <span className="text-gray-400 ml-auto font-mono">
                  {job.started_at ? new Date(job.started_at).toLocaleString("zh-CN") : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
