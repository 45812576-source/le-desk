"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelSelect } from "@/components/pixel/PixelSelect";
import { apiFetch } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SkillItem {
  id: number;
  name: string;
  description: string;
  status: string;
  scope: string; // personal / department / company
}

interface ToolItem {
  id: number;
  name: string;
  display_name: string;
  description: string;
  tool_type: string; // builtin / mcp / http
}

interface WsDetail {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  status: string;
  visibility: string;
  welcome_message: string;
  system_context?: string;
  sort_order: number;
  skills: { id: number; name: string; description: string; scope: string }[];
  tools: { id: number; name: string; display_name: string; description: string; tool_type: string }[];
}

interface WsSummary {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  status: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SCOPE_LABEL: Record<string, string> = {
  company: "公司通用",
  department: "部门专属",
  personal: "个人",
};

const SCOPE_COLOR: Record<string, "cyan" | "green" | "yellow" | "gray"> = {
  company: "cyan",
  department: "green",
  personal: "gray",
};

const TOOL_TYPE_LABEL: Record<string, string> = {
  builtin: "内置工具",
  mcp: "MCP 工具",
  http: "HTTP 工具",
};

const TOOL_TYPE_COLOR: Record<string, "cyan" | "green" | "yellow" | "gray"> = {
  builtin: "green",
  mcp: "cyan",
  http: "yellow",
};

const STATUS_COLOR: Record<string, "cyan" | "green" | "yellow" | "gray"> = {
  draft: "gray",
  reviewing: "yellow",
  published: "green",
  archived: "gray",
};

const ICON_OPTIONS = ["chat", "star", "code", "doc", "tool", "chart", "user", "team"];
const COLOR_OPTIONS = [
  "#00D1FF", "#00A3C4", "#0077A8", "#004F7A",
  "#7153EE", "#9B7FFF", "#5B3FCC", "#3A1FA0",
  "#00CC99", "#00A87A", "#00845C", "#006040",
  "#FFC043", "#FFD97A", "#E09000", "#B86800",
  "#FF6B6B", "#FF9A9A", "#E03E3E", "#B01010",
  "#1A202C", "#4A5568", "#718096", "#A0AEC0",
];
const CATEGORY_OPTIONS = ["通用", "营销", "培训", "人事", "运营", "研究", "行政"];

// ─── Checkbox group ───────────────────────────────────────────────────────────

function CheckGroup({
  label,
  badge,
  badgeColor,
  items,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
}: {
  label: string;
  badge: string;
  badgeColor: "cyan" | "green" | "yellow" | "gray";
  items: { id: number; name: string; description: string }[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: (ids: number[]) => void;
  onClearAll: (ids: number[]) => void;
}) {
  const ids = items.map((i) => i.id);
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
  if (items.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <PixelBadge color={badgeColor}>{badge}</PixelBadge>
        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
        <span className="text-[9px] text-gray-400">({items.length})</span>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => (allSelected ? onClearAll(ids) : onSelectAll(ids))}
            className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4] hover:text-[#00D1FF]"
          >
            {allSelected ? "取消全选" : "全选"}
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <label
            key={item.id}
            className={`flex items-start gap-2 p-2 border cursor-pointer hover:bg-[#F0F4F8] transition-colors ${
              selectedIds.has(item.id) ? "border-[#00D1FF] bg-[#F0FAFF]" : "border-[#E2E8F0]"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(item.id)}
              onChange={() => onToggle(item.id)}
              className="mt-0.5 accent-[#00D1FF]"
            />
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-[#1A202C] truncate">{item.name}</div>
              {item.description && (
                <div className="text-[9px] text-gray-400 truncate">{item.description}</div>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WsSummary[]>([]);
  const [allSkills, setAllSkills] = useState<SkillItem[]>([]);
  const [allTools, setAllTools] = useState<ToolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillSearch, setSkillSearch] = useState("");
  const [toolSearch, setToolSearch] = useState("");

  // selected workspace detail
  const [selected, setSelected] = useState<WsDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // edit state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("通用");
  const [editIcon, setEditIcon] = useState("chat");
  const [editColor, setEditColor] = useState("#00D1FF");
  const [editVisibility, setEditVisibility] = useState("all");
  const [editWelcome, setEditWelcome] = useState("");
  const [editContext, setEditContext] = useState("");
  const [editSkillIds, setEditSkillIds] = useState<Set<number>>(new Set());
  const [editToolIds, setEditToolIds] = useState<Set<number>>(new Set());

  // create new
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ws, skills, tools] = await Promise.all([
        apiFetch<WsSummary[]>("/workspaces"),
        apiFetch<SkillItem[]>("/skills"),
        apiFetch<ToolItem[]>("/tools"),
      ]);
      setWorkspaces(ws);
      setAllSkills(Array.isArray(skills) ? skills : []);
      setAllTools(Array.isArray(tools) ? tools : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function selectWorkspace(id: number) {
    setLoadingDetail(true);
    try {
      const ws = await apiFetch<WsDetail>(`/workspaces/${id}`);
      setSelected(ws);
      setEditName(ws.name);
      setEditDesc(ws.description || "");
      setEditCategory(ws.category || "通用");
      setEditIcon(ws.icon || "chat");
      setEditColor(ws.color || "#00D1FF");
      setEditVisibility(ws.visibility || "all");
      setEditWelcome(ws.welcome_message || "");
      setEditContext(ws.system_context || "");
      setEditSkillIds(new Set(ws.skills.map((s) => s.id)));
      setEditToolIds(new Set(ws.tools.map((t) => t.id)));
    } finally {
      setLoadingDetail(false);
    }
  }

  function toggleSkill(id: number) {
    setEditSkillIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllSkills(ids: number[]) {
    setEditSkillIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function clearAllSkills(ids: number[]) {
    setEditSkillIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  function toggleTool(id: number) {
    setEditToolIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllTools(ids: number[]) {
    setEditToolIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function clearAllTools(ids: number[]) {
    setEditToolIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await apiFetch(`/workspaces/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          category: editCategory,
          icon: editIcon,
          color: editColor,
          visibility: editVisibility,
          welcome_message: editWelcome,
          system_context: editContext || null,
        }),
      });
      await Promise.all([
        apiFetch(`/workspaces/${selected.id}/skills`, {
          method: "PUT",
          body: JSON.stringify({ ids: Array.from(editSkillIds) }),
        }),
        apiFetch(`/workspaces/${selected.id}/tools`, {
          method: "PUT",
          body: JSON.stringify({ ids: Array.from(editToolIds) }),
        }),
      ]);
      await fetchAll();
      await selectWorkspace(selected.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const ws = await apiFetch<WsSummary>("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), category: "通用" }),
      });
      await fetchAll();
      setCreating(false);
      setNewName("");
      selectWorkspace(ws.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确认删除该工作台？")) return;
    await apiFetch(`/workspaces/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    fetchAll();
  }

  async function handleReview(id: number, action: "approve" | "reject") {
    await apiFetch(`/workspaces/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    fetchAll();
    if (selected?.id === id) selectWorkspace(id);
  }

  // Group skills by scope
  const skillsByScope = allSkills.reduce<Record<string, SkillItem[]>>((acc, s) => {
    const key = s.scope || "personal";
    (acc[key] = acc[key] || []).push(s);
    return acc;
  }, {});

  // Group tools by type
  const toolsByType = allTools.reduce<Record<string, ToolItem[]>>((acc, t) => {
    const key = t.tool_type || "builtin";
    (acc[key] = acc[key] || []).push(t);
    return acc;
  }, {});

  return (
    <PageShell title="工作台管理" icon={ICONS.workspaceAdmin}>
      <div className="flex gap-4 h-[calc(100vh-120px)]">

        {/* ── Left: workspace list ── */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-2">
          <PixelButton size="sm" onClick={() => setCreating(true)}>
            + 新建工作台
          </PixelButton>

          {creating && (
            <div className="border-2 border-[#00D1FF] bg-white p-2 flex flex-col gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
                placeholder="工作台名称"
                className="text-[10px] border border-[#1A202C] px-2 py-1 w-full font-mono outline-none"
              />
              <div className="flex gap-1">
                <PixelButton size="sm" onClick={handleCreate} disabled={saving}>确认</PixelButton>
                <PixelButton size="sm" variant="ghost" onClick={() => setCreating(false)}>取消</PixelButton>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-[9px] text-[#00A3C4] animate-pulse uppercase tracking-widest">Loading...</div>
          ) : (
            <div className="flex flex-col gap-1 overflow-y-auto">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => selectWorkspace(ws.id)}
                  className={`text-left border-2 p-2 transition-colors ${
                    selected?.id === ws.id
                      ? "border-[#00D1FF] bg-[#F0FAFF]"
                      : "border-[#1A202C] bg-white hover:bg-[#F0F4F8]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div
                      className="w-3 h-3 border border-[#1A202C] flex-shrink-0"
                      style={{ backgroundColor: ws.color }}
                    />
                    <span className="text-[10px] font-bold truncate">{ws.name}</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <PixelBadge color={STATUS_COLOR[ws.status] || "gray"}>
                      {ws.status}
                    </PixelBadge>
                    <PixelBadge color="yellow">{ws.category}</PixelBadge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: edit panel ── */}
        <div className="flex-1 overflow-y-auto">
          {loadingDetail ? (
            <div className="text-[9px] text-[#00A3C4] animate-pulse uppercase tracking-widest py-10 text-center">Loading...</div>
          ) : !selected ? (
            <div className="text-[10px] text-gray-400 uppercase tracking-widest py-20 text-center">
              ← 选择左侧工作台进行配置
            </div>
          ) : (
            <div className="space-y-4">

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-[#1A202C]" style={{ backgroundColor: editColor }} />
                  <span className="text-xs font-bold">{selected.name}</span>
                  <PixelBadge color={STATUS_COLOR[selected.status] || "gray"}>{selected.status}</PixelBadge>
                </div>
                <div className="flex gap-1">
                  {selected.status === "reviewing" && (
                    <>
                      <PixelButton size="sm" onClick={() => handleReview(selected.id, "approve")}>通过</PixelButton>
                      <PixelButton size="sm" variant="danger" onClick={() => handleReview(selected.id, "reject")}>拒绝</PixelButton>
                    </>
                  )}
                  <PixelButton size="sm" variant="danger" onClick={() => handleDelete(selected.id)}>删除</PixelButton>
                  <PixelButton size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? "保存中..." : "保存"}
                  </PixelButton>
                </div>
              </div>

              {/* Basic info */}
              <div className="bg-white border-2 border-[#1A202C] p-4">
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">基本信息</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">名称</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-[10px] border border-[#1A202C] px-2 py-1 w-full font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">分类</label>
                    <PixelSelect value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                      {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </PixelSelect>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">描述</label>
                    <input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="text-[10px] border border-[#1A202C] px-2 py-1 w-full font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">可见范围</label>
                    <PixelSelect value={editVisibility} onChange={(e) => setEditVisibility(e.target.value)}>
                      <option value="all">全员可见</option>
                      <option value="department">仅本部门</option>
                    </PixelSelect>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">主色</label>
                    <div className="grid grid-cols-6 gap-1">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          title={c}
                          className={`w-5 h-5 border-2 ${editColor === c ? "border-[#1A202C] scale-110" : "border-transparent hover:border-gray-400"} transition-transform`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">欢迎语</label>
                    <input
                      value={editWelcome}
                      onChange={(e) => setEditWelcome(e.target.value)}
                      className="text-[10px] border border-[#1A202C] px-2 py-1 w-full font-mono outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">
                      附加系统指令 <span className="text-gray-400 normal-case font-normal">（注入所有对话，仅 Admin）</span>
                    </label>
                    <textarea
                      value={editContext}
                      onChange={(e) => setEditContext(e.target.value)}
                      rows={3}
                      className="text-[10px] border border-[#1A202C] px-2 py-1 w-full font-mono outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="bg-white border-2 border-[#1A202C] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
                    Skill 配置
                  </div>
                  <span className="text-[9px] text-gray-400">{editSkillIds.size} 已选</span>
                </div>
                <input
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder="搜索 Skill 名称或描述..."
                  className="text-[10px] border border-[#1A202C] px-2 py-1 w-full font-mono outline-none mb-3"
                />
                {Object.entries(skillsByScope).map(([scope, items]) => {
                  const filtered = skillSearch
                    ? items.filter((s) =>
                        s.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
                        (s.description || "").toLowerCase().includes(skillSearch.toLowerCase())
                      )
                    : items;
                  return (
                    <CheckGroup
                      key={scope}
                      label={SCOPE_LABEL[scope] || scope}
                      badge={SCOPE_LABEL[scope] || scope}
                      badgeColor={SCOPE_COLOR[scope] || "gray"}
                      items={filtered}
                      selectedIds={editSkillIds}
                      onToggle={toggleSkill}
                      onSelectAll={selectAllSkills}
                      onClearAll={clearAllSkills}
                    />
                  );
                })}
                {allSkills.length === 0 && (
                  <div className="text-[9px] text-gray-400">暂无已发布 Skill</div>
                )}
              </div>

              {/* Tools */}
              <div className="bg-white border-2 border-[#1A202C] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
                    工具配置
                  </div>
                  <span className="text-[9px] text-gray-400">{editToolIds.size} 已选</span>
                </div>
                <input
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  placeholder="搜索工具名称或描述..."
                  className="text-[10px] border border-[#1A202C] px-2 py-1 w-full font-mono outline-none mb-3"
                />
                {Object.entries(toolsByType).map(([type, items]) => {
                  const filtered = toolSearch
                    ? items.filter((t) =>
                        t.display_name.toLowerCase().includes(toolSearch.toLowerCase()) ||
                        (t.description || "").toLowerCase().includes(toolSearch.toLowerCase())
                      )
                    : items;
                  return (
                    <CheckGroup
                      key={type}
                      label={TOOL_TYPE_LABEL[type] || type}
                      badge={TOOL_TYPE_LABEL[type] || type}
                      badgeColor={TOOL_TYPE_COLOR[type] || "gray"}
                      items={filtered.map((t) => ({ id: t.id, name: t.display_name, description: t.description }))}
                      selectedIds={editToolIds}
                      onToggle={toggleTool}
                      onSelectAll={selectAllTools}
                      onClearAll={clearAllTools}
                    />
                  );
                })}
                {allTools.length === 0 && (
                  <div className="text-[9px] text-gray-400">暂无已启用工具</div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
