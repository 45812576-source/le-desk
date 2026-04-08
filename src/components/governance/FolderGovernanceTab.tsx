"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelUserPicker, type SuggestedUser } from "@/components/pixel/PixelUserPicker";
import { apiFetch } from "@/lib/api";
import type {
  FolderTreeNode,
  FolderAuditLog,
  KnowledgeRerunJob,
  FolderImpact,
} from "@/lib/types";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  ArrowRightLeft,
  RefreshCw,
  Users,
  FolderTree,
  AlertTriangle,
  MoveRight,
} from "lucide-react";

const API = "/knowledge/admin";

// ── 目录树节点 ─────────────────────────────────────────────────────────────

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: FolderTreeNode;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        onClick={() => onSelect(node.id)}
        className={`w-full flex items-center gap-1 px-2 py-1.5 text-left text-xs transition-colors rounded-sm ${
          isSelected
            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
            : "hover:bg-black/5 dark:hover:bg-white/5 text-foreground"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span
            className="flex-shrink-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <FolderTree size={12} className="flex-shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{node.name}</span>
        <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">
          {node.entry_count}
        </span>
        {node.manager_count > 0 && (
          <Users size={10} className="flex-shrink-0 text-blue-500" />
        )}
      </button>
      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

// ── 目录选择器（用于 move） ─────────────────────────────────────────────────

function FolderPicker({
  tree,
  excludeIds,
  onSelect,
  onCancel,
}: {
  tree: FolderTreeNode[];
  excludeIds: Set<number>;
  onSelect: (id: number | null) => void;
  onCancel: () => void;
}) {
  function renderPickNode(node: FolderTreeNode, depth: number): React.ReactNode {
    const disabled = excludeIds.has(node.id);
    return (
      <div key={node.id}>
        <button
          disabled={disabled}
          onClick={() => onSelect(node.id)}
          className={`w-full flex items-center gap-1 px-2 py-1 text-left text-xs transition-colors rounded-sm ${
            disabled
              ? "opacity-30 cursor-not-allowed"
              : "hover:bg-blue-50 dark:hover:bg-blue-950 text-foreground"
          }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
        >
          <FolderTree size={11} className="flex-shrink-0 text-muted-foreground" />
          <span className="truncate">{node.name}</span>
        </button>
        {node.children.map((c) => renderPickNode(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md bg-card p-2 max-h-60 overflow-y-auto">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
        选择目标父目录
      </div>
      <button
        onClick={() => onSelect(null)}
        className="w-full text-left px-2 py-1 text-xs hover:bg-blue-50 dark:hover:bg-blue-950 text-foreground rounded-sm"
      >
        (根级——无父目录)
      </button>
      {tree.map((n) => renderPickNode(n, 0))}
      <div className="mt-2 flex justify-end">
        <PixelButton size="sm" variant="ghost" onClick={onCancel}>
          取消
        </PixelButton>
      </div>
    </div>
  );
}

// ── 节点配置面板 ───────────────────────────────────────────────────────────

interface ManagerEntry {
  id: number;
  user_id: number;
  display_name: string | null;
  can_manage_children: boolean;
  can_delete_descendants: boolean;
}

function NodeConfigPanel({
  node,
  isSuperAdmin,
  tree,
  onRefresh,
}: {
  node: FolderTreeNode;
  isSuperAdmin: boolean;
  tree: FolderTreeNode[];
  onRefresh: () => void;
}) {
  const [editName, setEditName] = useState(node.name);
  const [editSort, setEditSort] = useState(node.sort_order);
  const [saving, setSaving] = useState(false);
  const [managers, setManagers] = useState<ManagerEntry[]>([]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [addingChild, setAddingChild] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    setEditName(node.name);
    setEditSort(node.sort_order);
    setShowMovePicker(false);
    loadManagers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  function loadManagers() {
    apiFetch<ManagerEntry[]>(`${API}/folders/${node.id}/managers`)
      .then(setManagers)
      .catch(() => setManagers([]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch(`${API}/folders/${node.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName, sort_order: editSort }),
      });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddChild() {
    if (!childName.trim()) return;
    setAddingChild(true);
    try {
      await apiFetch(`${API}/folders`, {
        method: "POST",
        body: JSON.stringify({ name: childName.trim(), parent_id: node.id }),
      });
      setChildName("");
      setShowAddChild(false);
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "创建失败");
    } finally {
      setAddingChild(false);
    }
  }

  async function handleMove(targetId: number | null) {
    setMoving(true);
    try {
      await apiFetch(`${API}/folders/${node.id}/move`, {
        method: "POST",
        body: JSON.stringify({ new_parent_id: targetId }),
      });
      setShowMovePicker(false);
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "移动失败");
    } finally {
      setMoving(false);
    }
  }

  function collectSubtreeIds(n: FolderTreeNode): Set<number> {
    const ids = new Set<number>([n.id]);
    for (const c of n.children) {
      for (const id of collectSubtreeIds(c)) ids.add(id);
    }
    return ids;
  }

  async function handleAddManager(user: SuggestedUser | null) {
    if (!user) return;
    try {
      await apiFetch(`${API}/folder-grants`, {
        method: "POST",
        body: JSON.stringify({ folder_id: node.id, grantee_user_id: user.id }),
      });
      loadManagers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "添加失败");
    }
  }

  async function handleRemoveManager(grantId: number) {
    if (!confirm("确认移除该管理员？")) return;
    try {
      await apiFetch(`${API}/folder-grants/${grantId}`, { method: "DELETE" });
      loadManagers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "移除失败");
    }
  }

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          基本信息
        </h3>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground">目录名称</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">排序权重</label>
            <input
              type="number"
              value={editSort}
              onChange={(e) => setEditSort(Number(e.target.value))}
              className="w-full mt-1 px-2 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {node.taxonomy_board && <PixelBadge color="cyan">板块 {node.taxonomy_board}</PixelBadge>}
            {node.taxonomy_code && <PixelBadge color="green">编码 {node.taxonomy_code}</PixelBadge>}
          </div>
          <div className="flex items-center gap-2">
            <PixelButton
              size="sm"
              onClick={handleSave}
              disabled={saving || (editName === node.name && editSort === node.sort_order)}
            >
              {saving ? "保存中..." : "保存修改"}
            </PixelButton>
            <PixelButton
              size="sm"
              variant="secondary"
              onClick={() => setShowMovePicker(!showMovePicker)}
              disabled={moving}
            >
              <MoveRight size={10} className="inline mr-1" />
              移动目录
            </PixelButton>
          </div>
        </div>
        {showMovePicker && (
          <div className="mt-2">
            <FolderPicker
              tree={tree}
              excludeIds={collectSubtreeIds(node)}
              onSelect={(id) => handleMove(id)}
              onCancel={() => setShowMovePicker(false)}
            />
          </div>
        )}
      </section>

      <section>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          子目录管理
        </h3>
        {node.children.length > 0 && (
          <div className="space-y-1 mb-2">
            {node.children.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-2 py-1 bg-muted/50 rounded text-xs">
                <span>{c.name}</span>
                <span className="text-muted-foreground">{c.entry_count} 篇</span>
              </div>
            ))}
          </div>
        )}
        {showAddChild ? (
          <div className="flex items-center gap-2">
            <input
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="子目录名称"
              className="flex-1 px-2 py-1 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => e.key === "Enter" && handleAddChild()}
            />
            <PixelButton size="sm" onClick={handleAddChild} disabled={addingChild}>确定</PixelButton>
            <PixelButton size="sm" variant="ghost" onClick={() => setShowAddChild(false)}>取消</PixelButton>
          </div>
        ) : (
          <PixelButton size="sm" variant="secondary" onClick={() => setShowAddChild(true)}>
            <Plus size={10} className="inline mr-1" />新增子目录
          </PixelButton>
        )}
      </section>

      {isSuperAdmin && (
        <section>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            子树管理员
          </h3>
          {managers.length > 0 && (
            <div className="space-y-1 mb-2">
              {managers.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-2 py-1 bg-muted/50 rounded text-xs">
                  <span>{m.display_name || `用户 #${m.user_id}`}</span>
                  <button onClick={() => handleRemoveManager(m.id)} className="text-red-500 hover:text-red-700 text-[10px]">
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="max-w-xs">
            <PixelUserPicker
              value={null}
              onChange={handleAddManager}
              excludeIds={managers.map((m) => m.user_id)}
              placeholder="添加管理员"
            />
          </div>
        </section>
      )}
    </div>
  );
}

// ── 影响与执行面板 ─────────────────────────────────────────────────────────

function ImpactPanel({
  folderId,
  folderName,
  isSuperAdmin,
  onRefreshTree,
}: {
  folderId: number;
  folderName: string;
  isSuperAdmin: boolean;
  onRefreshTree: () => void;
}) {
  const [impact, setImpact] = useState<FolderImpact | null>(null);
  const [rerunJobs, setRerunJobs] = useState<KnowledgeRerunJob[]>([]);
  const [auditLogs, setAuditLogs] = useState<FolderAuditLog[]>([]);
  const [rerunning, setRerunning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiFetch<FolderImpact>(`${API}/folders/${folderId}/impact`).then(setImpact).catch(() => setImpact(null));
    apiFetch<{ items: KnowledgeRerunJob[] }>(`${API}/rerun-jobs?limit=5`).then((d) => setRerunJobs(d.items || [])).catch(() => setRerunJobs([]));
    apiFetch<{ items: FolderAuditLog[] }>(`${API}/audit-logs?folder_id=${folderId}&limit=10`).then((d) => setAuditLogs(d.items || [])).catch(() => setAuditLogs([]));
  }, [folderId]);

  async function handleRerun() {
    setRerunning(true);
    try {
      const result = await apiFetch<{ job_id: number; status: string; affected_count: number }>(
        `${API}/folders/${folderId}/rerun`, { method: "POST" }
      );
      alert(`Rerun 完成：影响 ${result.affected_count} 篇文档，状态: ${result.status}`);
      onRefreshTree();
    } catch (e) { alert(e instanceof Error ? e.message : "Rerun 失败"); }
    finally { setRerunning(false); }
  }

  async function handleDelete() {
    if (!confirm(`确认删除目录「${folderName}」？\n\n受影响文档将尝试按分类编码重绑到其他目录，无法重绑的标记为待重审。`)) return;
    setDeleting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiFetch<any>(`${API}/folders/${folderId}`, { method: "DELETE" });
      const msg = [`已删除，影响 ${result.affected_entries} 篇文档`];
      if (result.rerun) {
        msg.push(`重绑成功 ${result.rerun.rebound} 篇，待重审 ${result.rerun.needs_review} 篇`);
      }
      alert(msg.join("\n"));
      onRefreshTree();
    } catch (e) { alert(e instanceof Error ? e.message : "删除失败"); }
    finally { setDeleting(false); }
  }

  const RERUN_STATUS_COLOR: Record<string, "green" | "yellow" | "red" | "gray"> = { success: "green", running: "yellow", failed: "red", pending: "gray" };
  const ACTION_LABELS: Record<string, string> = { rename: "重命名", move: "移动", delete: "删除", create: "创建", sort: "排序", grant: "授权", revoke: "撤权", rerun_trigger: "触发重绑" };

  const canDelete = isSuperAdmin || (impact && impact.grant_count === 0);

  return (
    <div className="space-y-4">
      {impact && (
        <section>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">影响范围</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: impact.entry_count, label: "文档数" },
              { val: impact.child_folder_count, label: "子目录" },
              { val: impact.grant_count, label: "授权数" },
            ].map(({ val, label }) => (
              <div key={label} className="text-center p-2 bg-muted/50 rounded">
                <div className="text-lg font-bold text-foreground">{val}</div>
                <div className="text-[10px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex items-center gap-2 flex-wrap">
        <PixelButton size="sm" variant="secondary" onClick={handleRerun} disabled={rerunning}>
          <RefreshCw size={10} className={`inline mr-1 ${rerunning ? "animate-spin" : ""}`} />
          {rerunning ? "执行中..." : "手动 Rerun"}
        </PixelButton>
        <PixelButton size="sm" variant="danger" onClick={handleDelete} disabled={deleting || !canDelete}
          title={!canDelete ? "子树内有其他用户的授权，不能删除" : undefined}
        >
          <Trash2 size={10} className="inline mr-1" />
          {deleting ? "删除中..." : "删除目录"}
        </PixelButton>
        {!canDelete && !isSuperAdmin && (
          <span className="text-[10px] text-amber-600">子树内有其他授权，需超管操作</span>
        )}
      </section>

      <section>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">最近 Rerun 作业</h3>
        {rerunJobs.length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无作业记录</p>
        ) : (
          <div className="space-y-1">
            {rerunJobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between px-2 py-1.5 bg-muted/50 rounded text-xs">
                <div className="flex items-center gap-2">
                  <PixelBadge color={RERUN_STATUS_COLOR[j.status] || "gray"}>{j.status}</PixelBadge>
                  <span className="text-muted-foreground">{j.trigger_type}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>影响 {j.affected_count}</span>
                  <span>重绑 {j.reclassified_count}</span>
                  <span>改名 {j.renamed_count}</span>
                  {j.failed_count > 0 && <span className="text-red-500">失败 {j.failed_count}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">变更审计</h3>
        {auditLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无审计记录</p>
        ) : (
          <div className="space-y-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="px-2 py-1.5 bg-muted/50 rounded text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PixelBadge color="gray">{ACTION_LABELS[log.action] || log.action}</PixelBadge>
                    <span className="text-muted-foreground">{log.performer_name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {log.created_at ? new Date(log.created_at).toLocaleString("zh-CN") : ""}
                  </span>
                </div>
                {log.old_value && Object.keys(log.old_value).length > 0 && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    旧值: {JSON.stringify(log.old_value)} → 新值: {JSON.stringify(log.new_value)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── 目录治理 Tab ─────────────────────────────────────────────────────

export default function FolderGovernanceTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [tree, setTree] = useState<FolderTreeNode[]>([]);
  const [totalFolders, setTotalFolders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadTree = useCallback(() => {
    setLoading(true);
    apiFetch<{ tree: FolderTreeNode[]; total_folders: number }>(`${API}/tree`)
      .then((d) => { setTree(d.tree || []); setTotalFolders(d.total_folders || 0); })
      .catch(() => { setTree([]); setTotalFolders(0); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const d = await apiFetch<{ tree: FolderTreeNode[]; total_folders: number }>(`${API}/tree`);
        if (!cancelled) { setTree(d.tree || []); setTotalFolders(d.total_folders || 0); }
      } catch {
        if (!cancelled) { setTree([]); setTotalFolders(0); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  function findNode(nodes: FolderTreeNode[], id: number): FolderTreeNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      const found = findNode(n.children, id);
      if (found) return found;
    }
    return null;
  }

  const selectedNode = selectedId ? findNode(tree, selectedId) : null;

  if (loading && tree.length === 0) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">加载中...</div>;
  }
  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <AlertTriangle size={32} />
        <p className="text-sm">暂无系统目录树。请先运行 taxonomy 初始化。</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-160px)]">
      <div className="col-span-3 border border-border rounded-md overflow-y-auto bg-card">
        <div className="sticky top-0 bg-card border-b border-border px-3 py-2 flex items-center justify-between z-10">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            系统目录树 ({totalFolders})
          </span>
          {isSuperAdmin && (
            <PixelButton size="sm" variant="ghost" onClick={() => {
              const name = prompt("根级目录名称");
              if (!name) return;
              apiFetch(`${API}/folders`, { method: "POST", body: JSON.stringify({ name }) })
                .then(() => loadTree()).catch((e) => alert(e instanceof Error ? e.message : "创建失败"));
            }}>
              <Plus size={12} />
            </PixelButton>
          )}
        </div>
        <div className="py-1">
          {tree.map((node) => (
            <TreeNode key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={setSelectedId} />
          ))}
        </div>
      </div>

      <div className="col-span-4 border border-border rounded-md overflow-y-auto bg-card p-4">
        {selectedNode ? (
          <NodeConfigPanel node={selectedNode} isSuperAdmin={isSuperAdmin} tree={tree} onRefresh={loadTree} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <Pencil size={14} className="mr-2" />选择左侧目录节点进行配置
          </div>
        )}
      </div>

      <div className="col-span-5 border border-border rounded-md overflow-y-auto bg-card p-4">
        {selectedNode ? (
          <ImpactPanel folderId={selectedNode.id} folderName={selectedNode.name} isSuperAdmin={isSuperAdmin} onRefreshTree={() => { loadTree(); setSelectedId(null); }} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <ArrowRightLeft size={14} className="mr-2" />选择目录节点查看影响范围
          </div>
        )}
      </div>
    </div>
  );
}
