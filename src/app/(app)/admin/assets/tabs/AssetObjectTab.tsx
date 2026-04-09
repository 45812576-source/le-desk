"use client";

import { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelUserPicker, type SuggestedUser } from "@/components/pixel/PixelUserPicker";
import { apiFetch } from "@/lib/api";
import type {
  AssetType,
  AssetAction,
  AssetPermissionGrant,
  FolderTreeNode,
  BusinessTable,
  Skill,
  ToolEntry,
} from "@/lib/types";
import {
  ASSET_ACTION_LABELS,
  ASSET_AVAILABLE_ACTIONS,
  ASSET_DISABLED_ACTIONS,
  SOURCE_LABELS,
  SOURCE_COLORS,
} from "@/lib/knowledge-permission-constants";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Users,
  Plus,
  Pencil,
  AlertTriangle,
  RefreshCw,
  Trash2,
  MoveRight,
} from "lucide-react";

// ── 目录树节点 ──────────────────────────────────────────────────────────────

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: FolderTreeNode;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => onSelect(node.id, node.name)}
        className={`w-full flex items-center gap-1 px-2 py-1.5 text-left text-xs transition-colors rounded-sm ${
          selectedId === node.id
            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
            : "hover:bg-black/5 dark:hover:bg-white/5 text-foreground"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span className="flex-shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <FolderTree size={12} className="flex-shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{node.name}</span>
        <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">{node.entry_count}</span>
        {node.manager_count > 0 && <Users size={10} className="flex-shrink-0 text-blue-500" />}
      </button>
      {expanded && hasChildren && node.children.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ── 简单列表项 ──────────────────────────────────────────────────────────────

function ListItem({ name, selected, onSelect, subtitle }: { name: string; selected: boolean; onSelect: () => void; subtitle?: string }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2 text-xs transition-colors ${
        selected ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" : "hover:bg-black/5 dark:hover:bg-white/5 text-foreground"
      }`}
    >
      <div className="font-medium truncate">{name}</div>
      {subtitle && <div className="text-[10px] text-muted-foreground truncate">{subtitle}</div>}
    </button>
  );
}

// ── 文件夹治理信息面板（中栏） ──────────────────────────────────────────────

interface ManagerEntry { id: number; user_id: number; display_name: string | null; can_manage_children: boolean; can_delete_descendants: boolean; }

function FolderInfoPanel({ folderId, folderName, isSuperAdmin, onRefreshTree }: { folderId: number; folderName: string; isSuperAdmin: boolean; onRefreshTree: () => void }) {
  const [managers, setManagers] = useState<ManagerEntry[]>([]);
  const [rerunning, setRerunning] = useState(false);

  useEffect(() => {
    apiFetch<ManagerEntry[]>(`/knowledge/admin/folders/${folderId}/managers`)
      .then(setManagers).catch(() => setManagers([]));
  }, [folderId]);

  async function handleRerun() {
    setRerunning(true);
    try {
      const result = await apiFetch<{ affected_count: number; status: string }>(`/knowledge/admin/folders/${folderId}/rerun`, { method: "POST" });
      alert(`Rerun 完成：影响 ${result.affected_count} 篇文档`);
      onRefreshTree();
    } catch (e) { alert(e instanceof Error ? e.message : "Rerun 失败"); }
    finally { setRerunning(false); }
  }

  async function handleAddManager(user: SuggestedUser | null) {
    if (!user) return;
    try {
      await apiFetch("/knowledge/admin/folder-grants", { method: "POST", body: JSON.stringify({ folder_id: folderId, grantee_user_id: user.id }) });
      apiFetch<ManagerEntry[]>(`/knowledge/admin/folders/${folderId}/managers`).then(setManagers).catch(() => {});
    } catch (e) { alert(e instanceof Error ? e.message : "添加失败"); }
  }

  async function handleRemoveManager(grantId: number) {
    if (!confirm("确认移除该管理员？")) return;
    try {
      await apiFetch(`/knowledge/admin/folder-grants/${grantId}`, { method: "DELETE" });
      apiFetch<ManagerEntry[]>(`/knowledge/admin/folders/${folderId}/managers`).then(setManagers).catch(() => {});
    } catch (e) { alert(e instanceof Error ? e.message : "移除失败"); }
  }

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">基本信息</h3>
        <div className="text-xs text-foreground font-bold">{folderName}</div>
        <div className="text-[10px] text-muted-foreground">文件夹 #{folderId}</div>
      </section>

      <section>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">治理操作</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <PixelButton size="sm" variant="secondary" onClick={handleRerun} disabled={rerunning}>
            <RefreshCw size={10} className={`inline mr-1 ${rerunning ? "animate-spin" : ""}`} />
            {rerunning ? "执行中..." : "Rerun 分类"}
          </PixelButton>
        </div>
      </section>

      {isSuperAdmin && (
        <section>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">子树管理员</h3>
          {managers.length > 0 && (
            <div className="space-y-1 mb-2">
              {managers.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-2 py-1 bg-muted/50 rounded text-xs">
                  <span>{m.display_name || `用户 #${m.user_id}`}</span>
                  <button onClick={() => handleRemoveManager(m.id)} className="text-red-500 hover:text-red-700 text-[10px]">移除</button>
                </div>
              ))}
            </div>
          )}
          <div className="max-w-xs">
            <PixelUserPicker value={null} onChange={handleAddManager} excludeIds={managers.map((m) => m.user_id)} placeholder="添加管理员" />
          </div>
        </section>
      )}
    </div>
  );
}

// ── 通用资产信息面板（中栏） ────────────────────────────────────────────────

function GenericInfoPanel({ assetType, assetId, assetName }: { assetType: AssetType; assetId: number; assetName: string }) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">基本信息</h3>
        <div className="text-xs text-foreground font-bold">{assetName}</div>
        <div className="text-[10px] text-muted-foreground">#{assetId}</div>
      </section>
    </div>
  );
}

// ── 授权弹窗 ────────────────────────────────────────────────────────────────

function GrantDialog({ assetType, assetId, assetName, onClose, onGranted }: {
  assetType: AssetType; assetId: number; assetName: string; onClose: () => void; onGranted: () => void;
}) {
  const [selectedUser, setSelectedUser] = useState<SuggestedUser | null>(null);
  const [selectedActions, setSelectedActions] = useState<Set<AssetAction>>(new Set());
  const [scope, setScope] = useState<"exact" | "subtree">("subtree");
  const [saving, setSaving] = useState(false);

  const availableActions = ASSET_AVAILABLE_ACTIONS[assetType];
  const disabledActions = new Set(ASSET_DISABLED_ACTIONS[assetType]);

  function toggleAction(action: AssetAction) {
    if (disabledActions.has(action)) return;
    setSelectedActions((prev) => { const next = new Set(prev); if (next.has(action)) next.delete(action); else next.add(action); return next; });
  }

  async function handleSave() {
    if (!selectedUser || selectedActions.size === 0) return;
    setSaving(true);
    try {
      await apiFetch("/admin/asset-permissions", {
        method: "POST",
        body: JSON.stringify({ asset_type: assetType, asset_id: assetId, grantee_user_id: selectedUser.id, actions: Array.from(selectedActions), scope }),
      });
      onGranted();
    } catch (e) {
      if (e instanceof Error && e.message.includes("404")) {
        alert("该功能需后端支持，API /admin/asset-permissions 尚未就绪");
      }
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border-2 border-border w-[480px] max-w-[90vw] max-h-[80vh] flex flex-col">
        <div className="bg-muted border-b-2 border-border px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-widest text-[#00A3C4]">授予资产权限</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">资产：{assetName}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] block mb-1">选择用户</label>
            <PixelUserPicker value={selectedUser} onChange={setSelectedUser} placeholder="搜索并选择用户" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] block mb-1">权限动作</label>
            <div className="flex flex-col gap-2">
              {availableActions.map((action) => {
                const disabled = disabledActions.has(action);
                return (
                  <label key={action} className={`flex items-center gap-2 text-xs ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                    <input type="checkbox" checked={selectedActions.has(action)} onChange={() => toggleAction(action)} disabled={disabled} />
                    <span className="font-mono text-foreground">{ASSET_ACTION_LABELS[action]}</span>
                    {disabled && <span className="text-[9px] text-muted-foreground">不适用</span>}
                  </label>
                );
              })}
            </div>
          </div>
          {assetType === "knowledge_folder" && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] block mb-1">生效范围</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="radio" name="scope" checked={scope === "subtree"} onChange={() => setScope("subtree")} /> 含子目录
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="radio" name="scope" checked={scope === "exact"} onChange={() => setScope("exact")} /> 仅本目录
                </label>
              </div>
            </div>
          )}
        </div>
        <div className="border-t-2 border-border px-4 py-3 flex justify-end gap-2">
          <PixelButton variant="secondary" size="sm" onClick={onClose}>取消</PixelButton>
          <PixelButton size="sm" onClick={handleSave} disabled={saving || !selectedUser || selectedActions.size === 0}>
            {saving ? "保存中…" : "授予权限"}
          </PixelButton>
        </div>
      </div>
    </div>
  );
}

// ── 权限矩阵面板（右栏） ───────────────────────────────────────────────────

function PermissionsPanel({ assetType, assetId, assetName }: { assetType: AssetType; assetId: number; assetName: string }) {
  const [grants, setGrants] = useState<AssetPermissionGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  const loadGrants = useCallback(() => {
    setLoading(true);
    apiFetch<AssetPermissionGrant[]>(`/admin/asset-permissions?asset_type=${assetType}&asset_id=${assetId}`)
      .then(setGrants)
      .catch(() => setGrants([]))
      .finally(() => setLoading(false));
  }, [assetType, assetId]);

  useEffect(() => { loadGrants(); }, [loadGrants]);

  async function handleRevoke(grantId: number) {
    if (!confirm("确认回收此权限？")) return;
    try {
      await apiFetch(`/admin/asset-permissions/${grantId}`, { method: "DELETE" });
      loadGrants();
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">权限矩阵</h3>
        <PixelButton size="sm" variant="secondary" onClick={() => setShowDialog(true)}>+ 授予权限</PixelButton>
      </div>

      {loading ? (
        <p className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse">加载中…</p>
      ) : grants.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">暂无权限授权记录</p>
      ) : (
        <table className="w-full border border-border text-xs font-mono">
          <thead>
            <tr className="bg-muted">
              <th className="text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">用户</th>
              <th className="text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">权限</th>
              {assetType === "knowledge_folder" && <th className="text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border w-16">范围</th>}
              <th className="text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border w-16">来源</th>
              <th className="text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border w-14">操作</th>
            </tr>
          </thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.id} className="border-b border-border hover:bg-muted/50">
                <td className="px-3 py-1.5 font-medium text-foreground">{g.grantee_display_name || `用户#${g.grantee_user_id}`}</td>
                <td className="px-3 py-1.5">
                  <PixelBadge color="cyan">{ASSET_ACTION_LABELS[g.permission_key] || g.permission_key}</PixelBadge>
                </td>
                {assetType === "knowledge_folder" && <td className="px-3 py-1.5 text-[10px]">{g.scope === "subtree" ? "子树" : "本级"}</td>}
                <td className="px-3 py-1.5">
                  <span className={`text-[10px] font-bold ${SOURCE_COLORS[g.source] || ""}`}>{SOURCE_LABELS[g.source] || g.source}</span>
                </td>
                <td className="px-3 py-1.5">
                  <PixelButton size="sm" variant="danger" onClick={() => handleRevoke(g.id)}>回收</PixelButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showDialog && (
        <GrantDialog
          assetType={assetType}
          assetId={assetId}
          assetName={assetName}
          onClose={() => setShowDialog(false)}
          onGranted={() => { setShowDialog(false); loadGrants(); }}
        />
      )}
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────────────────────

interface AssetObjectTabProps {
  assetType: AssetType;
  isSuperAdmin: boolean;
}

export default function AssetObjectTab({ assetType, isSuperAdmin }: AssetObjectTabProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedName, setSelectedName] = useState("");

  // 左侧列表数据
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [totalFolders, setTotalFolders] = useState(0);
  const [tables, setTables] = useState<BusinessTable[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // 重置选择
  useEffect(() => {
    setSelectedId(null);
    setSelectedName("");
  }, [assetType]);

  const loadList = useCallback(() => {
    setListLoading(true);
    if (assetType === "knowledge_folder") {
      apiFetch<{ tree: FolderTreeNode[]; total_folders: number }>("/knowledge/admin/tree")
        .then((d) => { setFolderTree(d.tree || []); setTotalFolders(d.total_folders || 0); })
        .catch(() => { setFolderTree([]); setTotalFolders(0); })
        .finally(() => setListLoading(false));
    } else if (assetType === "business_table") {
      apiFetch<BusinessTable[]>("/business-tables").then(setTables).catch(() => setTables([])).finally(() => setListLoading(false));
    } else if (assetType === "skill") {
      apiFetch<Skill[]>("/skills").then(setSkills).catch(() => setSkills([])).finally(() => setListLoading(false));
    } else {
      apiFetch<ToolEntry[]>("/admin/tools").then(setTools).catch(() => setTools([])).finally(() => setListLoading(false));
    }
  }, [assetType]);

  useEffect(() => { loadList(); }, [loadList]);

  function select(id: number, name: string) { setSelectedId(id); setSelectedName(name); }

  // ── 渲染左侧 ─────────────────────────────────────────────────────────────

  function renderLeftPanel() {
    if (listLoading) return <p className="text-xs text-muted-foreground p-3 animate-pulse">加载中…</p>;
    if (assetType === "knowledge_folder") {
      if (folderTree.length === 0) return <div className="flex flex-col items-center justify-center h-32 text-muted-foreground"><AlertTriangle size={20} /><p className="text-[10px] mt-1">暂无目录树</p></div>;
      return <div className="py-1">{folderTree.map((n) => <TreeNode key={n.id} node={n} depth={0} selectedId={selectedId} onSelect={select} />)}</div>;
    }
    if (assetType === "business_table") {
      return <div className="py-1">{tables.map((t) => <ListItem key={t.id} name={t.display_name || t.table_name} subtitle={t.description || undefined} selected={selectedId === t.id} onSelect={() => select(t.id, t.display_name || t.table_name)} />)}</div>;
    }
    if (assetType === "skill") {
      return <div className="py-1">{skills.map((s) => <ListItem key={s.id} name={s.name} subtitle={s.description} selected={selectedId === s.id} onSelect={() => select(s.id, s.name)} />)}</div>;
    }
    return <div className="py-1">{tools.map((t) => <ListItem key={t.id} name={t.display_name || t.name} subtitle={t.description || undefined} selected={selectedId === t.id} onSelect={() => select(t.id, t.display_name || t.name)} />)}</div>;
  }

  const listLabel = assetType === "knowledge_folder" ? `目录树 (${totalFolders})` : assetType === "business_table" ? "数据表" : assetType === "skill" ? "Skill" : "Tool";

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
      {/* 左栏：对象列表 */}
      <div className="col-span-3 border border-border rounded-md overflow-y-auto bg-card">
        <div className="sticky top-0 bg-card border-b border-border px-3 py-2 flex items-center justify-between z-10">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{listLabel}</span>
          {assetType === "knowledge_folder" && isSuperAdmin && (
            <PixelButton size="sm" variant="ghost" onClick={() => {
              const name = prompt("根级目录名称");
              if (!name) return;
              apiFetch("/knowledge/admin/folders", { method: "POST", body: JSON.stringify({ name }) }).then(() => loadList()).catch((e) => alert(e instanceof Error ? e.message : "创建失败"));
            }}><Plus size={12} /></PixelButton>
          )}
        </div>
        {renderLeftPanel()}
      </div>

      {/* 中栏：基础信息与治理状态 */}
      <div className="col-span-4 border border-border rounded-md overflow-y-auto bg-card p-4">
        {selectedId ? (
          assetType === "knowledge_folder" ? (
            <FolderInfoPanel folderId={selectedId} folderName={selectedName} isSuperAdmin={isSuperAdmin} onRefreshTree={loadList} />
          ) : (
            <GenericInfoPanel assetType={assetType} assetId={selectedId} assetName={selectedName} />
          )
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <Pencil size={14} className="mr-2" />选择左侧对象查看详情
          </div>
        )}
      </div>

      {/* 右栏：权限矩阵 */}
      <div className="col-span-5 border border-border rounded-md overflow-y-auto bg-card p-4">
        {selectedId ? (
          <PermissionsPanel assetType={assetType} assetId={selectedId} assetName={selectedName} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            选择对象查看权限矩阵
          </div>
        )}
      </div>
    </div>
  );
}
