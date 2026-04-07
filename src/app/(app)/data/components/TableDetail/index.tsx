"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import { useV2DataAssets } from "../shared/feature-flags";
import type { TableDetail } from "../shared/types";
import HeaderBar from "./HeaderBar";
import GovernancePanel from "./GovernancePanel";
import OverviewTab from "./OverviewTab";
import PreviewTab from "./PreviewTab";
import FieldsTab from "./FieldsTab";
import ViewsTab from "./ViewsTab";
import PermissionsTab from "./PermissionsTab";
import SkillBindingsTab from "./SkillBindingsTab";
import UnifiedPermissionTab from "./UnifiedPermissionTab";
import LogicalViewWorkbench from "./consume/LogicalViewWorkbench";
import ExportRuleSummary from "./consume/ExportRuleSummary";
import ExportRuleEditor from "./security/ExportRuleEditor";

// ── V1 Tab 定义 ──
type V1TabId = "overview" | "preview" | "fields" | "views" | "permissions" | "bindings";
const V1_TABS: { id: V1TabId; label: string }[] = [
  { id: "overview", label: "概览" },
  { id: "preview", label: "数据" },
  { id: "fields", label: "字段" },
  { id: "views", label: "视图" },
  { id: "permissions", label: "权限" },
  { id: "bindings", label: "Skill" },
];

// ── V2 三级导航定义 ──
type NavGroup = "structure" | "consume" | "security";
const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  structure: "数据结构",
  consume: "消费方式",
  security: "安全治理",
};

type V2TabId =
  // structure
  | "fields" | "overview"
  // consume
  | "views" | "logical_views" | "export_summary" | "preview"
  // security
  | "permissions" | "export_editor";

interface V2Tab {
  id: V2TabId;
  label: string;
  group: NavGroup;
}

const V2_TABS: V2Tab[] = [
  // 数据结构
  { id: "fields", label: "字段字典", group: "structure" },
  { id: "overview", label: "概览", group: "structure" },
  // 消费方式
  { id: "views", label: "视图", group: "consume" },
  { id: "logical_views", label: "逻辑视图", group: "consume" },
  { id: "export_summary", label: "导出摘要", group: "consume" },
  { id: "preview", label: "数据预览", group: "consume" },
  // 安全治理
  { id: "permissions", label: "权限管理", group: "security" },
  { id: "export_editor", label: "导出规则", group: "security" },
];

interface Props {
  tableId: number;
  onRefresh?: () => void;
  onDeleteTable?: (id: number) => void;
}

export default function TableDetailPanel({ tableId, onRefresh, onDeleteTable }: Props) {
  const isV2 = useV2DataAssets();
  const [detail, setDetail] = useState<TableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [v1Tab, setV1Tab] = useState<V1TabId>("overview");
  const [v2Tab, setV2Tab] = useState<V2TabId>("fields");

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<TableDetail>(`/data-assets/tables/${tableId}`);
      setDetail(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // Reset tab when table changes
  useEffect(() => {
    setV1Tab("overview");
    setV2Tab("fields");
  }, [tableId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
        Loading...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="text-[10px] text-red-500 font-bold">{error || "数据表不存在"}</div>
        <PixelButton size="sm" onClick={fetchDetail}>重试</PixelButton>
      </div>
    );
  }

  function handleRefresh() {
    fetchDetail();
    onRefresh?.();
  }

  // ── V1 渲染 ──
  if (!isV2) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b-2 border-[#1A202C] flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-bold truncate flex-1">{detail.display_name}</h2>
            <span className="text-[8px] font-mono text-gray-400">{detail.table_name}</span>
          </div>
          {detail.description && (
            <p className="text-[9px] text-gray-500 truncate">{detail.description}</p>
          )}
        </div>
        <div className="flex gap-0 border-b-2 border-[#1A202C] flex-shrink-0">
          {V1_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setV1Tab(tab.id)}
              className={`px-4 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors border-b-2 -mb-[2px] ${
                v1Tab === tab.id
                  ? "border-[#00D1FF] text-[#00A3C4] bg-white"
                  : "border-transparent text-gray-400 hover:text-[#1A202C] hover:bg-[#F0F4F8]"
              }`}
            >
              {tab.label}
              {tab.id === "fields" && <span className="ml-1 text-[8px] opacity-60">{detail.fields.length}</span>}
              {tab.id === "bindings" && detail.bindings.length > 0 && (
                <span className="ml-1 text-[8px] opacity-60">{detail.bindings.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {v1Tab === "overview" && <OverviewTab detail={detail} onRefresh={handleRefresh} onDeleteTable={onDeleteTable} />}
          {v1Tab === "preview" && <PreviewTab detail={detail} />}
          {v1Tab === "fields" && <FieldsTab detail={detail} />}
          {v1Tab === "views" && <ViewsTab detail={detail} onRefresh={handleRefresh} />}
          {v1Tab === "permissions" && <PermissionsTab detail={detail} onRefresh={handleRefresh} />}
          {v1Tab === "bindings" && <SkillBindingsTab detail={detail} onRefresh={handleRefresh} />}
        </div>
      </div>
    );
  }

  // ── V2 三级导航渲染 ──
  const activeGroup = V2_TABS.find((t) => t.id === v2Tab)?.group || "structure";

  return (
    <div className="flex flex-col h-full">
      {/* HeaderBar 总览条 */}
      <HeaderBar detail={detail} />
      <GovernancePanel detail={detail} onRefresh={handleRefresh} />

      {/* 一级导航：分组 */}
      <div className="flex gap-0 border-b-2 border-[#1A202C] flex-shrink-0">
        {(Object.keys(NAV_GROUP_LABELS) as NavGroup[]).map((group) => {
          const isActive = activeGroup === group;
          return (
            <button
              key={group}
              onClick={() => {
                const firstTab = V2_TABS.find((t) => t.group === group);
                if (firstTab) setV2Tab(firstTab.id);
              }}
              className={`px-4 py-1.5 text-[8px] font-bold uppercase tracking-widest transition-colors border-b-2 -mb-[2px] ${
                isActive
                  ? "border-[#00D1FF] text-[#00A3C4] bg-white"
                  : "border-transparent text-gray-400 hover:text-[#1A202C] hover:bg-[#F0F4F8]"
              }`}
            >
              {NAV_GROUP_LABELS[group]}
            </button>
          );
        })}
      </div>

      {/* 二级导航：组内 Tab */}
      <div className="flex gap-0 border-b border-gray-200 flex-shrink-0 bg-[#F8FBFD]">
        {V2_TABS.filter((t) => t.group === activeGroup).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setV2Tab(tab.id)}
            className={`px-3 py-1.5 text-[8px] font-bold transition-colors border-b-2 -mb-[1px] ${
              v2Tab === tab.id
                ? "border-[#00A3C4] text-[#00A3C4] bg-white"
                : "border-transparent text-gray-400 hover:text-[#1A202C]"
            }`}
          >
            {tab.label}
            {tab.id === "fields" && <span className="ml-1 text-[7px] opacity-60">{detail.fields.length}</span>}
            {tab.id === "views" && <span className="ml-1 text-[7px] opacity-60">{detail.views.length}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* 数据结构 */}
        {v2Tab === "fields" && <FieldsTab detail={detail} onRefresh={handleRefresh} />}
        {v2Tab === "overview" && <OverviewTab detail={detail} onRefresh={handleRefresh} onDeleteTable={onDeleteTable} />}
        {/* 消费方式 */}
        {v2Tab === "views" && <ViewsTab detail={detail} onRefresh={handleRefresh} />}
        {v2Tab === "logical_views" && <LogicalViewWorkbench tableId={detail.id} />}
        {v2Tab === "export_summary" && <ExportRuleSummary tableId={detail.id} />}
        {v2Tab === "preview" && <PreviewTab detail={detail} />}
        {/* 安全治理 */}
        {v2Tab === "permissions" && <UnifiedPermissionTab detail={detail} onRefresh={handleRefresh} />}
        {v2Tab === "export_editor" && <ExportRuleEditor detail={detail} onSaved={handleRefresh} />}
      </div>
    </div>
  );
}
