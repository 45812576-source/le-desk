"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useV2DataAssets } from "../shared/feature-flags";
import type { TableDetail } from "../shared/types";
import { getTableCapabilities } from "../shared/types";
import HeaderBar from "./HeaderBar";
import OverviewTab from "./OverviewTab";
import PreviewTab from "./PreviewTab";
import FieldsTab from "./FieldsTab";
import ViewsTab from "./ViewsTab";
import SkillBindingsTab from "./SkillBindingsTab";

// ── V1 Tab 定义 ──
type V1TabId = "overview" | "preview" | "fields" | "views" | "bindings";
const V1_TABS: { id: V1TabId; label: string }[] = [
  { id: "overview", label: "资产说明" },
  { id: "preview", label: "数据预览" },
  { id: "fields", label: "字段样例" },
  { id: "views", label: "视图范围" },
  { id: "bindings", label: "关联 Skill" },
];

// ── V2 三级导航定义 ──
type NavGroup = "asset" | "consume";
const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  asset: "资产说明",
  consume: "使用入口",
};

type V2TabId =
  | "overview"
  | "preview"
  | "fields"
  | "views"
  | "bindings";

interface V2Tab {
  id: V2TabId;
  label: string;
  group: NavGroup;
}

const V2_TABS: V2Tab[] = [
  { id: "overview", label: "资产说明", group: "asset" },
  { id: "preview", label: "数据预览", group: "consume" },
  { id: "fields", label: "字段样例", group: "consume" },
  { id: "views", label: "视图范围", group: "consume" },
  { id: "bindings", label: "关联 Skill", group: "consume" },
];

interface Props {
  tableId: number;
  onRefresh?: () => void;
  onDeleteTable?: (id: number) => void;
  initialTab?: string | null;
}

export default function TableDetailPanel({ tableId, onRefresh, onDeleteTable, initialTab }: Props) {
  const isV2 = useV2DataAssets();
  const { user } = useAuth();
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
    const nextTab = initialTab?.toLowerCase();
    const normalizedTab = nextTab === "permissions" || nextTab === "skill" ? "bindings" : nextTab;
    if (normalizedTab && V1_TABS.some((tab) => tab.id === normalizedTab)) {
      setV1Tab(normalizedTab as V1TabId);
    } else {
      setV1Tab("overview");
    }

    if (normalizedTab && V2_TABS.some((tab) => tab.id === normalizedTab)) {
      setV2Tab(normalizedTab as V2TabId);
    } else if (normalizedTab === "views") {
      setV2Tab("views");
    } else {
      setV2Tab("overview");
    }
  }, [initialTab, tableId]);

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

  const capabilities = getTableCapabilities(detail, user);

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
              {tab.id === "bindings" && (detail.bindings.length > 0 || detail.skill_grants.length > 0) && (
                <span className="ml-1 text-[8px] opacity-60">
                  {new Set([...detail.bindings.map((b) => b.skill_id), ...detail.skill_grants.map((g) => g.skill_id)]).size}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {v1Tab === "overview" && <OverviewTab detail={detail} onRefresh={handleRefresh} onDeleteTable={onDeleteTable} capabilities={capabilities} />}
          {v1Tab === "preview" && <PreviewTab detail={detail} capabilities={capabilities} />}
          {v1Tab === "fields" && <FieldsTab detail={detail} onRefresh={handleRefresh} capabilities={capabilities} />}
          {v1Tab === "views" && <ViewsTab detail={detail} onRefresh={handleRefresh} capabilities={capabilities} />}
          {v1Tab === "bindings" && <SkillBindingsTab detail={detail} onRefresh={handleRefresh} capabilities={capabilities} />}
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
        {v2Tab === "overview" && <OverviewTab detail={detail} onRefresh={handleRefresh} onDeleteTable={onDeleteTable} capabilities={capabilities} />}
        {v2Tab === "preview" && <PreviewTab detail={detail} capabilities={capabilities} />}
        {v2Tab === "fields" && <FieldsTab detail={detail} onRefresh={handleRefresh} capabilities={capabilities} />}
        {v2Tab === "views" && <ViewsTab detail={detail} onRefresh={handleRefresh} capabilities={capabilities} />}
        {v2Tab === "bindings" && <SkillBindingsTab detail={detail} onRefresh={handleRefresh} capabilities={capabilities} />}
      </div>
    </div>
  );
}
