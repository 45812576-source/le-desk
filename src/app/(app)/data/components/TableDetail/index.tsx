"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { TableDetail } from "../shared/types";
import OverviewTab from "./OverviewTab";
import PreviewTab from "./PreviewTab";
import FieldsTab from "./FieldsTab";
import ViewsTab from "./ViewsTab";
import PermissionsTab from "./PermissionsTab";
import SkillBindingsTab from "./SkillBindingsTab";

type TabId = "overview" | "preview" | "fields" | "views" | "permissions" | "bindings";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "概览" },
  { id: "preview", label: "数据" },
  { id: "fields", label: "字段" },
  { id: "views", label: "视图" },
  { id: "permissions", label: "权限" },
  { id: "bindings", label: "Skill" },
];

interface Props {
  tableId: number;
  onRefresh?: () => void;
}

export default function TableDetailPanel({ tableId, onRefresh }: Props) {
  const [detail, setDetail] = useState<TableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");

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

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Reset tab when table changes
  useEffect(() => {
    setActiveTab("overview");
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-[#1A202C] flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-sm font-bold truncate flex-1">{detail.display_name}</h2>
          <span className="text-[8px] font-mono text-gray-400">{detail.table_name}</span>
        </div>
        {detail.description && (
          <p className="text-[9px] text-gray-500 truncate">{detail.description}</p>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b-2 border-[#1A202C] flex-shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors border-b-2 -mb-[2px] ${
              activeTab === tab.id
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

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "overview" && <OverviewTab detail={detail} onRefresh={handleRefresh} />}
        {activeTab === "preview" && <PreviewTab detail={detail} />}
        {activeTab === "fields" && <FieldsTab detail={detail} />}
        {activeTab === "views" && <ViewsTab detail={detail} />}
        {activeTab === "permissions" && <PermissionsTab detail={detail} onRefresh={handleRefresh} />}
        {activeTab === "bindings" && <SkillBindingsTab detail={detail} onRefresh={handleRefresh} />}
      </div>
    </div>
  );
}
