"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelIcon, ICONS } from "@/components/pixel";
import { ThemedPageIcon } from "@/components/layout/PageShell";
import { useTheme } from "@/lib/theme";
import { Table2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

import type { DataAssetFolder, DataAssetTable, Tab } from "./components/shared/types";
import { ConnectTab } from "./components/connect";
import FolderTree from "./components/FolderTree";
import AssetList from "./components/AssetList";
import TableDetailPanel from "./components/TableDetail";

function ThemedIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon {...ICONS.data} size={size} />;
  return <Table2 size={size} className="text-muted-foreground" />;
}

// ─── ManageTab (new three-column layout) ─────────────────────────────────────
function ManageTab() {
  const [folders, setFolders] = useState<DataAssetFolder[]>([]);
  const [tables, setTables] = useState<DataAssetTable[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingTables, setLoadingTables] = useState(true);
  const [folderError, setFolderError] = useState(false);

  const fetchFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const data = await apiFetch<{ items: DataAssetFolder[] }>("/data-assets/folders");
      setFolders(data.items);
      setFolderError(false);
    } catch {
      setFolderError(true);
      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  const fetchTables = useCallback(async () => {
    setLoadingTables(true);
    try {
      const qs = selectedFolderId !== null ? `?folder_id=${selectedFolderId}` : "";
      const data = await apiFetch<{ items: DataAssetTable[]; total: number }>(`/data-assets/tables${qs}`);
      setTables(data.items);
    } catch {
      // Fallback: try old API
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await apiFetch<any[]>("/business-tables");
        const arr = Array.isArray(data) ? data : [];
        setTables(
          arr.map((t) => ({
            id: t.id as number,
            table_name: String(t.table_name ?? ""),
            display_name: String(t.display_name ?? ""),
            description: String(t.description ?? ""),
            folder_id: null,
            source_type: "blank",
            sync_status: "idle",
            last_synced_at: null,
            record_count: null,
            field_count: 0,
            bound_skills: [],
            risk_warnings: [],
            is_archived: false,
            created_at: (t.created_at as string) ?? null,
          }))
        );
      } catch {
        setTables([]);
      }
    } finally {
      setLoadingTables(false);
    }
  }, [selectedFolderId]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);
  useEffect(() => { fetchTables(); }, [fetchTables]);

  function handleSelectFolder(id: number | null) {
    setSelectedFolderId(id);
    setSelectedTableId(null);
  }

  return (
    <div className="flex h-full border-2 border-[#1A202C]">
      {/* Left: Folder tree */}
      <div className="w-48 flex-shrink-0 border-r-2 border-[#1A202C] bg-[#F0F4F8]">
        {loadingFolders ? (
          <div className="p-3 text-[9px] text-gray-400 animate-pulse">Loading...</div>
        ) : folderError ? (
          <div className="p-3">
            <div className="text-[9px] text-red-500 font-bold mb-2">目录加载失败</div>
            <PixelButton size="sm" onClick={fetchFolders}>重试</PixelButton>
          </div>
        ) : (
          <FolderTree
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={handleSelectFolder}
            onFoldersChange={fetchFolders}
          />
        )}
      </div>

      {/* Middle: Asset list */}
      <div className="w-72 flex-shrink-0 border-r-2 border-[#1A202C] bg-white">
        <AssetList
          tables={tables}
          selectedTableId={selectedTableId}
          onSelectTable={setSelectedTableId}
          loading={loadingTables}
        />
      </div>

      {/* Right: Table detail */}
      <div className="flex-1 min-w-0 bg-white">
        {selectedTableId !== null ? (
          <TableDetailPanel
            tableId={selectedTableId}
            onRefresh={() => { fetchTables(); }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[9px] text-gray-400 uppercase tracking-widest">
            <div className="mb-3 opacity-40"><ThemedIcon size={32} /></div>
            选择左侧数据表查看详情
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DataPage() {
  const [tab, setTab] = useState<Tab>("manage");
  const [manageKey, setManageKey] = useState(0);
  const { theme } = useTheme();
  const isLab = theme === "lab";
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "dept_admin";

  return (
    <div className="h-full flex flex-col">
      <div className="border-b-2 border-[#1A202C] px-6 h-12 flex items-center gap-4 flex-shrink-0" style={{ backgroundColor: "var(--card)" }}>
        <div className="flex items-center gap-2 mr-4">
          <ThemedPageIcon icon={ICONS.data} size={16} />
          <h1 className={`text-xs font-bold uppercase tracking-widest ${isLab ? "text-[#1A202C]" : "text-foreground"}`}>数据表</h1>
        </div>
        <div className="flex gap-1">
          <PixelButton variant={tab === "manage" ? "primary" : "secondary"} size="sm" onClick={() => setTab("manage")}>数据资产</PixelButton>
          {isAdmin && (
            <PixelButton variant={tab === "connect" ? "primary" : "secondary"} size="sm" onClick={() => setTab("connect")}>对接数据源</PixelButton>
          )}
        </div>
      </div>

      {tab === "connect" && isAdmin ? (
        <div className="flex-1 overflow-auto p-6">
          <ConnectTab onAdded={() => { setManageKey((k) => k + 1); setTab("manage"); }} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          <ManageTab key={manageKey} />
          {!isAdmin && (
            <div className="px-6 py-3 text-[10px] text-muted-foreground border-t border-border">
              外部数据源接入与同步仅对部门管理员和超级管理员开放。如需接入飞书多维表，请联系管理员。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
