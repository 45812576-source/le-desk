"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type {
  KnowledgeTag,
  TagRelationEntry,
} from "@/lib/types";
import {
  Plus,
  Trash2,
  Tag,
  Link2,
} from "lucide-react";

const TAG_API = "/knowledge/tags";

const CATEGORY_LABELS: Record<string, string> = {
  industry: "行业", platform: "平台", topic: "主题", scenario: "场景", custom: "自定义",
};
const CATEGORY_COLORS: Record<string, "cyan" | "green" | "yellow" | "purple" | "gray"> = {
  industry: "cyan", platform: "green", topic: "yellow", scenario: "purple", custom: "gray",
};
const RELATION_LABELS: Record<string, string> = {
  synonym: "同义", broader: "上位", narrower: "下位", related: "相关",
};

export default function TagGovernanceTab() {
  const [tags, setTags] = useState<KnowledgeTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<(KnowledgeTag & { relations?: TagRelationEntry[] }) | null>(null);
  const [filterCat, setFilterCat] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newTag, setNewTag] = useState({ name: "", code: "", category: "topic", description: "" });
  const [creating, setCreating] = useState(false);

  const [showAddRel, setShowAddRel] = useState(false);
  const [relForm, setRelForm] = useState({ target_code: "", relation_type: "synonym" });
  const [addingRel, setAddingRel] = useState(false);

  const loadTags = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCat) params.set("category", filterCat);
    if (searchQ) params.set("q", searchQ);
    apiFetch<KnowledgeTag[]>(`${TAG_API}?${params}`)
      .then(setTags)
      .catch(() => setTags([]))
      .finally(() => setLoading(false));
  }, [filterCat, searchQ]);

  useEffect(() => { loadTags(); }, [loadTags]);

  async function loadTagDetail(id: number) {
    try {
      const detail = await apiFetch<KnowledgeTag & { relations: TagRelationEntry[] }>(`${TAG_API}/${id}`);
      setSelectedTag(detail);
    } catch { /* ignore */ }
  }

  async function handleCreateTag() {
    setCreating(true);
    try {
      const created = await apiFetch<KnowledgeTag>(`${TAG_API}`, {
        method: "POST",
        body: JSON.stringify(newTag),
      });
      setShowCreate(false);
      setNewTag({ name: "", code: "", category: "topic", description: "" });
      loadTags();
      loadTagDetail(created.id);
    } catch (e) { alert(e instanceof Error ? e.message : "创建失败"); }
    finally { setCreating(false); }
  }

  async function handleDeleteTag(id: number) {
    if (!confirm("确认删除该标签及其所有关系？")) return;
    try {
      await apiFetch(`${TAG_API}/${id}`, { method: "DELETE" });
      setSelectedTag(null);
      loadTags();
    } catch (e) { alert(e instanceof Error ? e.message : "删除失败"); }
  }

  async function handleAddRelation() {
    if (!selectedTag || !relForm.target_code) return;
    setAddingRel(true);
    try {
      const allTags = await apiFetch<KnowledgeTag[]>(`${TAG_API}?q=${encodeURIComponent(relForm.target_code)}`);
      const target = allTags.find((t) => t.code === relForm.target_code || t.name === relForm.target_code);
      if (!target) { alert("找不到目标标签"); return; }
      await apiFetch(`${TAG_API}/relations`, {
        method: "POST",
        body: JSON.stringify({
          source_tag_id: selectedTag.id,
          target_tag_id: target.id,
          relation_type: relForm.relation_type,
        }),
      });
      setShowAddRel(false);
      setRelForm({ target_code: "", relation_type: "synonym" });
      loadTagDetail(selectedTag.id);
    } catch (e) { alert(e instanceof Error ? e.message : "添加失败"); }
    finally { setAddingRel(false); }
  }

  async function handleDeleteRelation(relId: number) {
    try {
      await apiFetch(`${TAG_API}/relations/${relId}`, { method: "DELETE" });
      if (selectedTag) loadTagDetail(selectedTag.id);
    } catch (e) { alert(e instanceof Error ? e.message : "删除失败"); }
  }

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-160px)]">
      <div className="col-span-4 border border-border rounded-md overflow-y-auto bg-card">
        <div className="sticky top-0 bg-card border-b border-border px-3 py-2 z-10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              标签主数据 ({tags.length})
            </span>
            <PixelButton size="sm" variant="ghost" onClick={() => setShowCreate(!showCreate)}>
              <Plus size={12} />
            </PixelButton>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="搜索标签..."
              className="flex-1 px-2 py-1 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="px-2 py-1 text-xs border border-border rounded-md bg-background text-foreground"
            >
              <option value="">全部类型</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {showCreate && (
          <div className="px-3 py-2 border-b border-border space-y-2 bg-muted/30">
            <input value={newTag.name} onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
              placeholder="标签名称" className="w-full px-2 py-1 text-xs border border-border rounded-md bg-background text-foreground" />
            <input value={newTag.code} onChange={(e) => setNewTag({ ...newTag, code: e.target.value })}
              placeholder="唯一编码 (如 ind_food)" className="w-full px-2 py-1 text-xs border border-border rounded-md bg-background text-foreground" />
            <div className="flex items-center gap-2">
              <select value={newTag.category} onChange={(e) => setNewTag({ ...newTag, category: e.target.value })}
                className="flex-1 px-2 py-1 text-xs border border-border rounded-md bg-background text-foreground">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
              <PixelButton size="sm" onClick={handleCreateTag} disabled={creating || !newTag.name || !newTag.code}>
                {creating ? "..." : "创建"}
              </PixelButton>
              <PixelButton size="sm" variant="ghost" onClick={() => setShowCreate(false)}>取消</PixelButton>
            </div>
          </div>
        )}

        <div className="py-1">
          {loading ? (
            <div className="p-4 text-xs text-muted-foreground text-center">加载中...</div>
          ) : tags.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground text-center">暂无标签</div>
          ) : (
            tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => loadTagDetail(tag.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                  selectedTag?.id === tag.id
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Tag size={11} className="flex-shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{tag.name}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{tag.code}</span>
                </div>
                <PixelBadge color={CATEGORY_COLORS[tag.category] || "gray"}>
                  {CATEGORY_LABELS[tag.category] || tag.category}
                </PixelBadge>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="col-span-8 border border-border rounded-md overflow-y-auto bg-card p-4">
        {selectedTag ? (
          <div className="space-y-4">
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">{selectedTag.name}</h3>
                <PixelButton size="sm" variant="danger" onClick={() => handleDeleteTag(selectedTag.id)}>
                  <Trash2 size={10} className="inline mr-1" />删除
                </PixelButton>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <PixelBadge color={CATEGORY_COLORS[selectedTag.category] || "gray"}>
                  {CATEGORY_LABELS[selectedTag.category] || selectedTag.category}
                </PixelBadge>
                <span className="text-xs text-muted-foreground">编码: {selectedTag.code}</span>
              </div>
              {selectedTag.description && (
                <p className="text-xs text-muted-foreground">{selectedTag.description}</p>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  <Link2 size={11} className="inline mr-1" />
                  语义关系 ({selectedTag.relations?.length || 0})
                </h3>
                <PixelButton size="sm" variant="secondary" onClick={() => setShowAddRel(!showAddRel)}>
                  <Plus size={10} className="inline mr-1" />添加关系
                </PixelButton>
              </div>

              {showAddRel && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-muted/30 rounded">
                  <select value={relForm.relation_type} onChange={(e) => setRelForm({ ...relForm, relation_type: e.target.value })}
                    className="px-2 py-1 text-xs border border-border rounded-md bg-background text-foreground">
                    {Object.entries(RELATION_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                  <input value={relForm.target_code} onChange={(e) => setRelForm({ ...relForm, target_code: e.target.value })}
                    placeholder="目标标签名或编码" className="flex-1 px-2 py-1 text-xs border border-border rounded-md bg-background text-foreground" />
                  <PixelButton size="sm" onClick={handleAddRelation} disabled={addingRel || !relForm.target_code}>确定</PixelButton>
                  <PixelButton size="sm" variant="ghost" onClick={() => setShowAddRel(false)}>取消</PixelButton>
                </div>
              )}

              {(selectedTag.relations?.length || 0) === 0 ? (
                <p className="text-xs text-muted-foreground">暂无语义关系</p>
              ) : (
                <div className="space-y-1">
                  {selectedTag.relations!.map((rel) => (
                    <div key={rel.id} className="flex items-center justify-between px-2 py-1.5 bg-muted/50 rounded text-xs">
                      <div className="flex items-center gap-2">
                        <PixelBadge color={rel.direction === "outgoing" ? "cyan" : "purple"}>
                          {rel.direction === "outgoing" ? "→" : "←"} {RELATION_LABELS[rel.relation_type] || rel.relation_type}
                        </PixelBadge>
                        <span className="font-medium">{rel.related_tag_name}</span>
                        <span className="text-muted-foreground">({rel.related_tag_code})</span>
                        {rel.confidence < 1 && (
                          <span className="text-[10px] text-muted-foreground">置信度 {(rel.confidence * 100).toFixed(0)}%</span>
                        )}
                      </div>
                      <button onClick={() => handleDeleteRelation(rel.id)} className="text-red-500 hover:text-red-700 text-[10px]">
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <Tag size={14} className="mr-2" />选择左侧标签查看详情和关系
          </div>
        )}
      </div>
    </div>
  );
}
