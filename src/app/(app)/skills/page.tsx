"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Zap, Wrench } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS, PixelIcon } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { SkillDetail, SavedSkill, ToolEntry } from "@/lib/types";

type MainTab = "skill" | "tool";
type ScopeOption = "company" | "department" | "personal";

function SkillIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon {...ICONS.skills} size={size} />;
  return <Zap size={size} className="text-muted-foreground" />;
}

function ToolIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon {...ICONS.tools} size={size} />;
  return <Wrench size={size} className="text-muted-foreground" />;
}

const SKILL_STATUS_BADGE: Record<string, { color: "cyan" | "green" | "yellow" | "gray" | "red"; label: string }> = {
  draft: { color: "gray", label: "草稿" },
  reviewing: { color: "yellow", label: "审核中" },
  published: { color: "green", label: "已发布" },
  archived: { color: "red", label: "已归档" },
};

const TOOL_STATUS_BADGE: Record<string, { color: "cyan" | "green" | "yellow" | "gray" | "red"; label: string }> = {
  draft: { color: "gray", label: "草稿" },
  reviewing: { color: "yellow", label: "审核中" },
  published: { color: "green", label: "已发布" },
  archived: { color: "red", label: "已归档" },
};

const SCOPE_LABEL: Record<string, string> = {
  personal: "我的",
  department: "部门",
  company: "公司",
};

const TOOL_TYPE_LABEL: Record<string, string> = { builtin: "内置", mcp: "MCP", http: "HTTP" };
const TOOL_TYPE_COLOR: Record<string, "cyan" | "green" | "purple" | "gray"> = {
  mcp: "cyan", builtin: "green", http: "purple",
};

// ─── Publish Scope Modal ──────────────────────────────────────────────────────
function PublishScopeModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (scope: ScopeOption, departmentId?: number) => void;
  onCancel: () => void;
}) {
  const [scope, setScope] = useState<ScopeOption>("personal");
  const [deptId, setDeptId] = useState("");

  const scopeOptions: { value: ScopeOption; label: string; desc: string }[] = [
    { value: "company", label: "全公司", desc: "所有员工可见" },
    { value: "department", label: "指定部门", desc: "填写部门 ID，仅该部门可见" },
    { value: "personal", label: "仅自己", desc: "不对外共享" },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-[#1A202C] p-6 w-80">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-4">
          选择发布范围
        </div>
        <div className="space-y-2 mb-4">
          {scopeOptions.map((o) => (
            <label
              key={o.value}
              className={`flex items-start gap-3 border-2 p-3 cursor-pointer ${
                scope === o.value ? "border-[#00D1FF] bg-[#CCF2FF]" : "border-[#1A202C]"
              }`}
            >
              <input
                type="radio"
                name="scope"
                value={o.value}
                checked={scope === o.value}
                onChange={() => setScope(o.value)}
                className="mt-0.5"
              />
              <div>
                <div className="text-xs font-bold">{o.label}</div>
                <div className="text-[9px] text-gray-500">{o.desc}</div>
              </div>
            </label>
          ))}
        </div>
        {scope === "department" && (
          <input
            type="number"
            placeholder="部门 ID"
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold mb-4 focus:outline-none focus:border-[#00D1FF]"
          />
        )}
        <div className="flex gap-2">
          <PixelButton
            onClick={() =>
              onConfirm(scope, scope === "department" && deptId ? Number(deptId) : undefined)
            }
          >
            确认发布
          </PixelButton>
          <PixelButton variant="secondary" onClick={onCancel}>
            取消
          </PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─── Skill Card ───────────────────────────────────────────────────────────────
function MySkillCard({ skill, onRefresh }: { skill: SkillDetail; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [detail, setDetail] = useState<SkillDetail | null>(null);

  useEffect(() => {
    if (!editing) {
      const latest = detail?.versions?.[0];
      if (latest?.system_prompt) setPrompt(latest.system_prompt);
    }
  }, [detail, editing]);

  async function loadDetail() {
    if (detail) return;
    try {
      const data = await apiFetch<SkillDetail>(`/skills/${skill.id}`);
      setDetail(data);
    } catch { /* ignore */ }
  }

  async function handleDelete() {
    if (!confirm(`确认删除 Skill「${skill.name}」？`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`/skills/${skill.id}`, { method: "DELETE" });
      onRefresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  function handleExpand() {
    if (!expanded) loadDetail();
    setExpanded((v) => !v);
    setEditing(false);
  }

  async function handleSaveVersion() {
    if (!prompt.trim() || saving) return;
    setSaving(true);
    try {
      await apiFetch(`/skills/${skill.id}/versions`, {
        method: "POST",
        body: JSON.stringify({ system_prompt: prompt.trim(), change_note: changeNote || "手动编辑" }),
      });
      setEditing(false);
      setChangeNote("");
      onRefresh();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function handlePublish(scope: ScopeOption, departmentId?: number) {
    const params = new URLSearchParams({ status: "published", scope });
    if (departmentId) params.set("department_id", String(departmentId));
    try {
      await apiFetch(`/skills/${skill.id}/status?${params}`, { method: "PATCH" });
      onRefresh();
    } catch { /* ignore */ }
    finally { setShowPublishModal(false); }
  }

  async function handleArchive() {
    try {
      await apiFetch(`/skills/${skill.id}/status?status=archived`, { method: "PATCH" });
      onRefresh();
    } catch { /* ignore */ }
  }

  const badge = SKILL_STATUS_BADGE[skill.status] || SKILL_STATUS_BADGE.draft;
  const latestVersion = detail?.versions?.[0];

  return (
    <>
      {showPublishModal && (
        <PublishScopeModal
          onConfirm={handlePublish}
          onCancel={() => setShowPublishModal(false)}
        />
      )}
      <div className="bg-white border-2 border-[#1A202C]">
        <div
          className="p-4 flex items-start justify-between gap-3 cursor-pointer select-none"
          onClick={handleExpand}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <SkillIcon size={12} />
              <span className="text-xs font-bold uppercase">{skill.name}</span>
              <PixelBadge color={badge.color}>{badge.label}</PixelBadge>
              {skill.current_version > 0 && <PixelBadge color="cyan">v{skill.current_version}</PixelBadge>}
            </div>
            <p className="text-[9px] text-gray-500 line-clamp-2">{skill.description || "无描述"}</p>
          </div>
          <span className="text-[9px] text-gray-400 mt-1">{expanded ? "▲" : "▼"}</span>
        </div>
        {expanded && (
          <div className="border-t-2 border-[#1A202C] p-4">
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <PixelButton size="sm" variant={editing ? "primary" : "secondary"} onClick={() => setEditing((v) => !v)}>
                {editing ? "取消编辑" : "编辑"}
              </PixelButton>
              {(skill.status === "draft" || skill.status === "archived") ? (
                <PixelButton size="sm" variant="secondary" onClick={() => setShowPublishModal(true)}>发布</PixelButton>
              ) : skill.status === "reviewing" ? (
                <span className="text-[9px] font-bold text-yellow-600 border border-yellow-400 bg-yellow-50 px-2 py-1">审批中</span>
              ) : skill.status === "published" ? (
                <PixelButton size="sm" variant="secondary" onClick={handleArchive}>归档</PixelButton>
              ) : null}
              {(skill.status === "draft" || skill.status === "reviewing" || skill.status === "archived") && (
                <PixelButton size="sm" variant="secondary" onClick={handleDelete} disabled={deleting}>
                  {deleting ? "删除中..." : "删除"}
                </PixelButton>
              )}
              {deleteError && (
                <span className="text-[9px] font-bold text-red-500 border border-red-300 bg-red-50 px-2 py-1">✕ {deleteError}</span>
              )}
            </div>
            {editing ? (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-1">System Prompt</div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={10}
                  className="w-full border-2 border-[#1A202C] px-3 py-2 text-[10px] font-mono resize-y focus:outline-none focus:border-[#00D1FF] mb-2"
                />
                <input
                  type="text"
                  placeholder="变更说明（可选）"
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold mb-3 focus:outline-none focus:border-[#00D1FF]"
                />
                <PixelButton onClick={handleSaveVersion} disabled={saving}>
                  {saving ? "保存中..." : "保存新版本"}
                </PixelButton>
              </div>
            ) : (
              <>
                {latestVersion?.system_prompt && (
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-1">
                      System Prompt (v{latestVersion.version})
                    </div>
                    <pre className="text-[9px] text-gray-700 bg-[#F0F4F8] border border-gray-200 p-3 overflow-auto max-h-48 whitespace-pre-wrap font-mono">
                      {latestVersion.system_prompt}
                    </pre>
                  </div>
                )}
                {(skill.source_files ?? (detail?.source_files ?? [])).length > 0 && (
                  <div className="mt-3">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-1">附属文件</div>
                    <div className="space-y-1">
                      {(skill.source_files ?? detail?.source_files ?? []).map((f) => (
                        <div key={f.filename} className="flex items-center gap-2 text-[9px] font-mono text-gray-600 bg-[#F0F4F8] border border-gray-200 px-2 py-1">
                          <span className="text-gray-400">📄</span>
                          <span className="flex-1 truncate">{f.filename}</span>
                          <span className="text-gray-400 flex-shrink-0">{(f.size / 1024).toFixed(1)}kb</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function SavedSkillCard({ skill, onUnsave }: { skill: SavedSkill; onUnsave: (id: number) => void }) {
  const [removing, setRemoving] = useState(false);
  const badge = SKILL_STATUS_BADGE[skill.status] || SKILL_STATUS_BADGE.draft;

  async function handleUnsave() {
    setRemoving(true);
    try {
      await apiFetch(`/skills/save-from-market/${skill.id}`, { method: "DELETE" });
      onUnsave(skill.id);
    } catch { /* ignore */ }
    finally { setRemoving(false); }
  }

  return (
    <div className="bg-white border-2 border-[#1A202C] p-4 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <SkillIcon size={12} />
          <span className="text-xs font-bold uppercase">{skill.name}</span>
          <PixelBadge color={badge.color}>{badge.label}</PixelBadge>
          {skill.current_version > 0 && <PixelBadge color="cyan">v{skill.current_version}</PixelBadge>}
          {skill.has_update && <PixelBadge color="yellow">UPDATE</PixelBadge>}
        </div>
        <p className="text-[9px] text-gray-500 line-clamp-2">{skill.description || "无描述"}</p>
      </div>
      <PixelButton size="sm" variant="secondary" onClick={handleUnsave} disabled={removing}>
        {removing ? "移除中..." : "移除"}
      </PixelButton>
    </div>
  );
}

// ─── Tool Card ────────────────────────────────────────────────────────────────
function MyToolCard({ tool, onRefresh }: { tool: ToolEntry; onRefresh: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);

  async function handleDelete() {
    if (!confirm(`确认删除工具「${tool.display_name}」？`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/tools/${tool.id}`, { method: "DELETE" });
      onRefresh();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  }

  async function handlePublish(scope: ScopeOption, departmentId?: number) {
    setPublishing(true);
    try {
      await apiFetch(`/tools/${tool.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "published", scope, department_id: departmentId ?? null }),
      });
      onRefresh();
    } catch { /* ignore */ }
    finally { setPublishing(false); setShowPublishModal(false); }
  }

  async function handleArchive() {
    try {
      await apiFetch(`/tools/${tool.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" }),
      });
      onRefresh();
    } catch { /* ignore */ }
  }

  const typeColor = TOOL_TYPE_COLOR[tool.tool_type ?? ""] ?? "gray";
  const typeLabel = TOOL_TYPE_LABEL[tool.tool_type ?? ""] ?? tool.tool_type ?? "未知";
  const badge = TOOL_STATUS_BADGE[tool.status ?? "draft"] || TOOL_STATUS_BADGE.draft;

  return (
    <>
      {showPublishModal && (
        <PublishScopeModal
          onConfirm={handlePublish}
          onCancel={() => setShowPublishModal(false)}
        />
      )}
      <div className="bg-white border-2 border-[#1A202C] p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <ToolIcon size={12} />
            <span className="text-xs font-bold uppercase">{tool.display_name}</span>
            <PixelBadge color={badge.color}>{badge.label}</PixelBadge>
            <PixelBadge color={typeColor}>{typeLabel}</PixelBadge>
          </div>
          <p className="text-[9px] text-gray-500 line-clamp-2">{tool.description || "无描述"}</p>
          <p className="text-[8px] text-gray-400 mt-1 font-mono">{tool.name}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {(tool.status === "draft" || tool.status === "archived") && (
            <PixelButton size="sm" variant="secondary" onClick={() => setShowPublishModal(true)} disabled={publishing}>
              发布
            </PixelButton>
          )}
          {tool.status === "reviewing" && (
            <span className="text-[9px] font-bold text-yellow-600 border border-yellow-400 bg-yellow-50 px-2 py-1">
              审批中
            </span>
          )}
          {tool.status === "published" && (
            <PixelButton size="sm" variant="secondary" onClick={handleArchive}>归档</PixelButton>
          )}
          {(tool.status === "draft" || tool.status === "archived") && (
            <PixelButton size="sm" variant="secondary" onClick={handleDelete} disabled={deleting}>
              {deleting ? "删除中..." : "删除"}
            </PixelButton>
          )}
        </div>
      </div>
    </>
  );
}

function SavedToolCard({ tool, onUnsave }: { tool: ToolEntry & { saved_at?: string }; onUnsave: (id: number) => void }) {
  const [removing, setRemoving] = useState(false);
  const typeColor = TOOL_TYPE_COLOR[tool.tool_type ?? ""] ?? "gray";
  const typeLabel = TOOL_TYPE_LABEL[tool.tool_type ?? ""] ?? tool.tool_type ?? "未知";

  async function handleUnsave() {
    setRemoving(true);
    try {
      await apiFetch(`/tools/save-from-market/${tool.id}`, { method: "DELETE" });
      onUnsave(tool.id);
    } catch { /* ignore */ }
    finally { setRemoving(false); }
  }

  return (
    <div className="bg-white border-2 border-[#1A202C] p-4 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <ToolIcon size={12} />
          <span className="text-xs font-bold uppercase">{tool.display_name}</span>
          <PixelBadge color={typeColor}>{typeLabel}</PixelBadge>
        </div>
        <p className="text-[9px] text-gray-500 line-clamp-2">{tool.description || "无描述"}</p>
      </div>
      <PixelButton size="sm" variant="secondary" onClick={handleUnsave} disabled={removing}>
        {removing ? "移除中..." : "移除"}
      </PixelButton>
    </div>
  );
}

// ─── Section Group ────────────────────────────────────────────────────────────
function SectionGroup({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">{label}</span>
        <span className="text-[9px] text-gray-400">({count})</span>
        <div className="flex-1 h-px bg-[#E2E8F0]" />
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ─── New Skill Form ───────────────────────────────────────────────────────────
function NewSkillForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; prompt?: string }>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: { name?: string; prompt?: string } = {};
    if (!name.trim()) newErrors.name = "Skill 名称不能为空";
    if (!prompt.trim()) newErrors.prompt = "System Prompt 不能为空";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    if (submitting) return;
    setSubmitting(true);
    try {
      await apiFetch("/skills", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          system_prompt: prompt.trim(),
          mode: "hybrid",
          variables: [],
          auto_inject: true,
        }),
      });
      onCreated();
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border-2 border-[#1A202C] p-4 mb-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">新建 Skill</div>
      <input
        type="text"
        placeholder="Skill 名称"
        value={name}
        onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: undefined })); }}
        className={`w-full border-2 px-3 py-1.5 text-xs font-bold mb-1 focus:outline-none focus:border-[#00D1FF] ${errors.name ? "border-red-500" : "border-[#1A202C]"}`}
      />
      {errors.name && <div className="text-[9px] text-red-500 font-bold mb-2">{errors.name}</div>}
      <input
        type="text"
        placeholder="描述（可选）"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold mb-2 focus:outline-none focus:border-[#00D1FF]"
      />
      <textarea
        placeholder="System Prompt"
        value={prompt}
        onChange={(e) => { setPrompt(e.target.value); if (errors.prompt) setErrors((p) => ({ ...p, prompt: undefined })); }}
        rows={6}
        className={`w-full border-2 px-3 py-2 text-[10px] font-mono resize-y mb-1 focus:outline-none focus:border-[#00D1FF] ${errors.prompt ? "border-red-500" : "border-[#1A202C]"}`}
      />
      {errors.prompt && <div className="text-[9px] text-red-500 font-bold mb-2">{errors.prompt}</div>}
      <PixelButton type="submit" disabled={submitting}>{submitting ? "创建中..." : "创建"}</PixelButton>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SkillsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<MainTab>("skill");

  // Skill state
  const [mySkills, setMySkills] = useState<SkillDetail[]>([]);
  const [deptSkills, setDeptSkills] = useState<SkillDetail[]>([]);
  const [savedSkills, setSavedSkills] = useState<SavedSkill[]>([]);
  const [skillLoading, setSkillLoading] = useState(false);
  const [showNewSkillForm, setShowNewSkillForm] = useState(false);
  const [uploadingMd, setUploadingMd] = useState(false);
  const [uploadMdError, setUploadMdError] = useState<string | null>(null);
  const [uploadingZip, setUploadingZip] = useState(false);
  const [uploadZipError, setUploadZipError] = useState<string | null>(null);
  const skillZipInputRef = useRef<HTMLInputElement>(null);

  // Tool state
  const [myTools, setMyTools] = useState<ToolEntry[]>([]);
  const [deptTools, setDeptTools] = useState<ToolEntry[]>([]);
  const [savedTools, setSavedTools] = useState<(ToolEntry & { saved_at?: string })[]>([]);
  const [toolLoading, setToolLoading] = useState(false);
  const [showMcpUpload, setShowMcpUpload] = useState(false);
  const [uploadTab, setUploadTab] = useState<"py" | "mcp">("py");
  const [uploadingPy, setUploadingPy] = useState(false);
  const [uploadPyError, setUploadPyError] = useState<string | null>(null);
  const pyInputRef = useRef<HTMLInputElement>(null);
  const [mcpZipUploading, setMcpZipUploading] = useState(false);
  const [mcpZipResult, setMcpZipResult] = useState<{ id: number; name: string; project_type: string; warnings: string[] } | null>(null);
  const [mcpZipError, setMcpZipError] = useState<string | null>(null);
  const mcpZipInputRef = useRef<HTMLInputElement>(null);
  const [mcpDescription, setMcpDescription] = useState("");
  const [mcpGenerating, setMcpGenerating] = useState(false);
  const [mcpGenerated, setMcpGenerated] = useState<Record<string, unknown> | null>(null);
  const [mcpGenError, setMcpGenError] = useState<string | null>(null);
  const [mcpSubmitting, setMcpSubmitting] = useState(false);
  const [mcpSubmitMsg, setMcpSubmitMsg] = useState<string | null>(null);

  // ─── Skill fetchers ───────────────────────────────────────────────────────
  const fetchSkills = useCallback(() => {
    setSkillLoading(true);
    Promise.all([
      apiFetch<SkillDetail[]>("/skills?mine=true").catch(() => [] as SkillDetail[]),
      apiFetch<SkillDetail[]>("/skills?scope=department").catch(() => [] as SkillDetail[]),
      apiFetch<SavedSkill[]>("/skills/my-saved").catch(() => [] as SavedSkill[]),
    ]).then(([mine, dept, saved]) => {
      setMySkills(mine);
      setDeptSkills(dept);
      setSavedSkills(saved);
    }).finally(() => setSkillLoading(false));
  }, []);

  // ─── Tool fetchers ────────────────────────────────────────────────────────
  const fetchTools = useCallback(() => {
    setToolLoading(true);
    Promise.all([
      apiFetch<ToolEntry[]>("/tools?mine=true").catch(() => [] as ToolEntry[]),
      apiFetch<ToolEntry[]>("/tools?scope=department").catch(() => [] as ToolEntry[]),
      apiFetch<(ToolEntry & { saved_at?: string })[]>("/tools/my-saved").catch(() => [] as ToolEntry[]),
    ]).then(([mine, dept, saved]) => {
      setMyTools(mine);
      setDeptTools(dept);
      setSavedTools(saved);
    }).finally(() => setToolLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "skill") fetchSkills();
    else fetchTools();
  }, [tab, fetchSkills, fetchTools]);

  // ─── Skill uploads ────────────────────────────────────────────────────────
  async function handleUploadMd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMd(true);
    setUploadMdError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await apiFetch<{ action: string; name: string; version: number; status?: string }>("/skills/upload-md", { method: "POST", body: form });
      const statusNote = res.status === "published" ? "已发布" : "已提交审批";
      setUploadMdError(`✓ ${res.action === "created" ? "已创建" : "已更新"} [${res.name}] v${res.version}，${statusNote}`);
    } catch (err) {
      setUploadMdError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploadingMd(false);
      e.target.value = "";
      fetchSkills();
    }
  }

  async function handleUploadZip(file: File) {
    if (!file.name.toLowerCase().endsWith(".zip")) { setUploadZipError("只支持 .zip 文件"); return; }
    setUploadingZip(true);
    setUploadZipError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await apiFetch<{ action: string; name: string; version: number; source_files: { filename: string }[] }>(
        "/skills/upload-zip", { method: "POST", body: form }
      );
      const fileCount = res.source_files?.length ?? 0;
      setUploadZipError(null);
      // 显示成功提示（复用 error 状态显示绿色）
      setUploadZipError(`✓ ${res.action === "created" ? "新建" : "更新"} [${res.name}] v${res.version}${fileCount > 0 ? `，附属文件 ${fileCount} 个` : ""}`);
    } catch (err) {
      setUploadZipError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploadingZip(false);
      if (skillZipInputRef.current) skillZipInputRef.current.value = "";
      fetchSkills();
    }
  }

  // ─── Tool uploads ─────────────────────────────────────────────────────────
  async function handleUploadPy(file: File) {
    if (!file.name.endsWith(".py")) { setUploadPyError("只支持 .py 文件"); return; }
    setUploadingPy(true);
    setUploadPyError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      await apiFetch("/tools/upload-py", { method: "POST", body: form });
      fetchTools();
    } catch (err) {
      setUploadPyError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploadingPy(false);
    }
  }

  async function handleMcpZipUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".zip")) { setMcpZipError("只支持 .zip 文件"); return; }
    setMcpZipUploading(true);
    setMcpZipResult(null);
    setMcpZipError(null);
    setMcpGenerated(null);
    setMcpSubmitMsg(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await apiFetch<{ id: number; name: string; project_type: string; warnings: string[] }>("/tools/upload-mcp", { method: "POST", body: form });
      setMcpZipResult(res);
    } catch (err) {
      setMcpZipError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setMcpZipUploading(false);
    }
  }

  async function handleMcpGenerate() {
    if (!mcpDescription.trim()) return;
    setMcpGenerating(true);
    setMcpGenError(null);
    try {
      const res = await apiFetch<Record<string, unknown>>("/tools/generate-mcp-config", {
        method: "POST",
        body: JSON.stringify({ description: mcpDescription }),
      });
      setMcpGenerated(res);
    } catch (err) {
      setMcpGenError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setMcpGenerating(false);
    }
  }

  async function handleMcpSubmit() {
    if (!mcpZipResult || !mcpGenerated) return;
    setMcpSubmitting(true);
    setMcpSubmitMsg(null);
    try {
      await apiFetch(`/tools/${mcpZipResult.id}`, {
        method: "PUT",
        body: JSON.stringify({
          display_name: String(mcpGenerated.display_name || mcpZipResult.name),
          description: String(mcpGenerated.description || ""),
          config: {
            manifest: { invocation_mode: mcpGenerated.invocation_mode ?? "chat", data_sources: mcpGenerated.data_sources ?? [], permissions: mcpGenerated.permissions ?? [], preconditions: mcpGenerated.preconditions ?? [] },
            deploy_info: { env_requirements: mcpGenerated.env_requirements ?? "" },
          },
        }),
      });
      await apiFetch(`/tools/${mcpZipResult.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "published", scope: "company" }),
      });
      setMcpSubmitMsg(`「${mcpGenerated.display_name ?? mcpZipResult.name}」已提交审批`);
      setMcpZipResult(null);
      setMcpGenerated(null);
      setMcpDescription("");
      fetchTools();
    } catch (err) {
      setMcpSubmitMsg(`提交失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setMcpSubmitting(false);
    }
  }

  // ─── Actions bar ──────────────────────────────────────────────────────────
  const SkillActions = (
    <div className="flex items-center gap-2">
      <label className="cursor-pointer">
        <input type="file" accept=".md" className="hidden" onChange={handleUploadMd} />
        <span className="inline-flex items-center border-2 border-[#1A202C] px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-white hover:bg-[#F0F4F8] transition-colors cursor-pointer">
          {uploadingMd ? "上传中..." : "上传 .md"}
        </span>
      </label>
      <label className="cursor-pointer">
        <input
          ref={skillZipInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadZip(f); }}
        />
        <span className="inline-flex items-center border-2 border-[#1A202C] px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-white hover:bg-[#F0F4F8] transition-colors cursor-pointer">
          {uploadingZip ? "上传中..." : "上传 .zip"}
        </span>
      </label>
      <PixelButton variant="secondary" onClick={() => setShowNewSkillForm((v) => !v)}>
        {showNewSkillForm ? "取消" : "+ 手动新建"}
      </PixelButton>
      <PixelButton onClick={() => { window.location.href = "/dev-studio"; }}>
        + 工作台新建
      </PixelButton>
    </div>
  );

  const ToolActions = (
    <div className="flex items-center gap-2">
      <PixelButton variant="secondary" onClick={() => { setShowMcpUpload(v => !v); setMcpZipResult(null); setMcpGenerated(null); setMcpSubmitMsg(null); setMcpZipError(null); }}>
        {showMcpUpload ? "▾ 收起" : "+ 上传工具"}
      </PixelButton>
      <PixelButton onClick={() => { window.location.href = "/dev-studio"; }}>
        + 工作台新建
      </PixelButton>
    </div>
  );

  const isLoading = tab === "skill" ? skillLoading : toolLoading;

  return (
    <PageShell
      title="Skills & Tools"
      icon={ICONS.skills}
      actions={tab === "skill" ? SkillActions : ToolActions}
    >
      {/* 主 Tab */}
      <div className="flex gap-1 mb-6">
        <PixelButton
          variant={tab === "skill" ? "primary" : "secondary"}
          size="sm"
          onClick={() => { setTab("skill"); setShowNewSkillForm(false); }}
        >
          Skill
        </PixelButton>
        <PixelButton
          variant={tab === "tool" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTab("tool")}
        >
          工具
        </PixelButton>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">Loading...</div>
        </div>
      ) : tab === "skill" ? (
        <>
          {uploadMdError && (
            <div className={`border-2 px-4 py-2 mb-3 text-[9px] font-bold ${uploadMdError.startsWith("✓") ? "border-[#00CC99] bg-[#F0FFF4] text-[#00CC99]" : "border-red-400 bg-red-50 text-red-500"}`}>
              {uploadMdError.startsWith("✓") ? uploadMdError : `上传失败：${uploadMdError}`}
            </div>
          )}
          {uploadZipError && (
            <div className={`border-2 px-4 py-2 mb-3 text-[9px] font-bold ${uploadZipError.startsWith("✓") ? "border-[#00CC99] bg-[#F0FFF4] text-[#00CC99]" : "border-red-400 bg-red-50 text-red-500"}`}>
              {uploadZipError.startsWith("✓") ? uploadZipError : `上传失败：${uploadZipError}`}
            </div>
          )}
          {showNewSkillForm && (
            <NewSkillForm onCreated={() => { setShowNewSkillForm(false); fetchSkills(); }} />
          )}

          {/* 我的 Skill */}
          {mySkills.length > 0 && (
            <SectionGroup label={SCOPE_LABEL.personal} count={mySkills.length}>
              {mySkills.map((s) => <MySkillCard key={s.id} skill={s} onRefresh={fetchSkills} />)}
            </SectionGroup>
          )}

          {/* 部门 Skill */}
          {deptSkills.length > 0 && (
            <SectionGroup label={SCOPE_LABEL.department} count={deptSkills.length}>
              {deptSkills.map((s) => {
                const badge = SKILL_STATUS_BADGE[s.status] || SKILL_STATUS_BADGE.draft;
                return (
                  <div key={s.id} className="bg-white border-2 border-[#1A202C] p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <SkillIcon size={12} />
                      <span className="text-xs font-bold uppercase">{s.name}</span>
                      <PixelBadge color={badge.color}>{badge.label}</PixelBadge>
                      {(s.current_version ?? 0) > 0 && <PixelBadge color="cyan">v{s.current_version}</PixelBadge>}
                    </div>
                    <p className="text-[9px] text-gray-500 line-clamp-2">{s.description || "无描述"}</p>
                  </div>
                );
              })}
            </SectionGroup>
          )}

          {/* 公司 Skill（已保存） */}
          <SectionGroup label={SCOPE_LABEL.company} count={savedSkills.length}>
            {savedSkills.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                  尚未保存任何公司 Skill
                </p>
                <PixelButton size="sm" onClick={() => { window.location.href = "/skills/market"; }}>
                  浏览市场
                </PixelButton>
              </div>
            ) : (
              <>
                {savedSkills.map((s) => <SavedSkillCard key={s.id} skill={s} onUnsave={(id) => setSavedSkills((prev) => prev.filter((x) => x.id !== id))} />)}
                <div className="pt-1">
                  <PixelButton size="sm" variant="secondary" onClick={() => { window.location.href = "/skills/market"; }}>
                    + 浏览市场
                  </PixelButton>
                </div>
              </>
            )}
          </SectionGroup>

          {mySkills.length === 0 && deptSkills.length === 0 && savedSkills.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center mb-4">
                <SkillIcon size={16} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                暂无 Skill，点击新建或上传 .md
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* 工具上传面板 */}
          {showMcpUpload && (
            <div className="mb-4 border-2 border-[#1A202C] bg-white">
              {/* Tab bar */}
              <div className="flex border-b-2 border-[#1A202C]">
                {(["py", "mcp"] as const).map((t) => (
                  <button key={t} onClick={() => setUploadTab(t)}
                    className={`px-5 py-2.5 text-[9px] font-bold uppercase tracking-widest border-r-2 border-[#1A202C] last:border-r-0 transition-colors ${
                      uploadTab === t ? "bg-[#1A202C] text-white" : "bg-[#EBF4F7] text-[#1A202C] hover:bg-[#D8EEF5]"
                    }`}
                  >
                    {t === "py" ? "Python 脚本" : "MCP 服务"}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {/* ── Python 脚本 tab ── */}
                {uploadTab === "py" && (
                  <div>
                    <div
                      onClick={() => pyInputRef.current?.click()}
                      className="border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-7 border-gray-300 hover:border-[#00A3C4] hover:bg-[#F0F4F8] transition-colors"
                    >
                      <input ref={pyInputRef} type="file" accept=".py" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadPy(f); e.target.value = ""; }} />
                      {uploadingPy ? (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">解析中...</span>
                      ) : (
                        <>
                          <span className="text-2xl mb-2 opacity-40">🐍</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">点击选择 .py 文件</span>
                          <span className="text-[8px] text-gray-300 mt-1 font-mono">文件顶部需包含 # __le_desk_manifest__ 注释块</span>
                        </>
                      )}
                    </div>
                    {uploadPyError && <p className="mt-2 text-[8px] text-red-500 font-bold">✕ {uploadPyError}</p>}
                  </div>
                )}

                {/* ── MCP 服务 tab ── */}
                {uploadTab === "mcp" && (
                  <div className="space-y-3">
                    {/* Step 1 */}
                    <div>
                      <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Step 1 — 上传 .zip 服务包</div>
                      <div onClick={() => mcpZipInputRef.current?.click()}
                        className="border-2 border-dashed cursor-pointer flex items-center justify-center py-5 border-gray-300 hover:border-[#00A3C4] hover:bg-[#F0F4F8] transition-colors"
                      >
                        <input ref={mcpZipInputRef} type="file" accept=".zip" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMcpZipUpload(f); e.target.value = ""; }} />
                        {mcpZipUploading ? (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">解析中...</span>
                        ) : mcpZipResult ? (
                          <div className="flex items-center gap-2 text-[9px]">
                            <span className="text-[#00CC99] font-bold">✓ {mcpZipResult.name}</span>
                            <span className="text-gray-400 border border-gray-200 px-1.5 py-0.5">{mcpZipResult.project_type}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">📦 点击选择 .zip 文件</span>
                        )}
                      </div>
                      {mcpZipError && <p className="mt-1 text-[8px] text-red-500 font-bold">✕ {mcpZipError}</p>}
                      {(mcpZipResult?.warnings ?? []).map((w, i) => <p key={i} className="mt-1 text-[8px] text-amber-600">⚠ {w}</p>)}
                    </div>

                    {/* Step 2 */}
                    {mcpZipResult && (
                      <div>
                        <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Step 2 — 描述工具用途</div>
                        <textarea rows={2} value={mcpDescription} onChange={(e) => setMcpDescription(e.target.value)}
                          placeholder="这个工具做什么？访问哪些数据？需要什么权限？"
                          className="w-full border-2 border-[#1A202C] px-2 py-1.5 text-[9px] resize-none focus:outline-none focus:border-[#00A3C4]"
                        />
                        <button onClick={handleMcpGenerate} disabled={mcpGenerating || !mcpDescription.trim()}
                          className="mt-1.5 px-3 py-1 border-2 border-[#1A202C] text-[8px] font-bold uppercase tracking-widest bg-white hover:bg-[#F0F4F8] disabled:opacity-40 transition-colors"
                        >
                          {mcpGenerating ? "生成中..." : "✦ AI 生成配置"}
                        </button>
                        {mcpGenError && <p className="mt-1 text-[8px] text-red-500">{mcpGenError}</p>}
                        {mcpGenerated && (
                          <p className="mt-1.5 text-[8px] text-[#00CC99] font-bold">✓ {String(mcpGenerated.display_name ?? "")} — {String(mcpGenerated.description ?? "")}</p>
                        )}
                      </div>
                    )}

                    {/* Step 3 */}
                    {mcpZipResult && mcpGenerated && (
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                        <button onClick={handleMcpSubmit} disabled={mcpSubmitting}
                          className="px-3 py-1 border-2 border-[#1A202C] bg-[#1A202C] text-white text-[8px] font-bold uppercase tracking-widest hover:bg-[#2D3748] disabled:opacity-40 transition-colors"
                        >
                          {mcpSubmitting ? "提交中..." : "提交审批"}
                        </button>
                        {mcpSubmitMsg && (
                          <span className={`text-[8px] font-bold ${mcpSubmitMsg.startsWith("提交失败") ? "text-red-500" : "text-[#00CC99]"}`}>
                            {mcpSubmitMsg}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 我的工具 */}
          {myTools.length > 0 && (
            <SectionGroup label={SCOPE_LABEL.personal} count={myTools.length}>
              {myTools.map((t) => <MyToolCard key={t.id} tool={t} onRefresh={fetchTools} />)}
            </SectionGroup>
          )}

          {/* 部门工具 */}
          {deptTools.length > 0 && (
            <SectionGroup label={SCOPE_LABEL.department} count={deptTools.length}>
              {deptTools.map((t) => {
                const typeColor = TOOL_TYPE_COLOR[t.tool_type ?? ""] ?? "gray";
                const typeLabel = TOOL_TYPE_LABEL[t.tool_type ?? ""] ?? t.tool_type ?? "未知";
                return (
                  <div key={t.id} className="bg-white border-2 border-[#1A202C] p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <ToolIcon size={12} />
                      <span className="text-xs font-bold uppercase">{t.display_name}</span>
                      <PixelBadge color={typeColor}>{typeLabel}</PixelBadge>
                    </div>
                    <p className="text-[9px] text-gray-500 line-clamp-2">{t.description || "无描述"}</p>
                  </div>
                );
              })}
            </SectionGroup>
          )}

          {/* 公司工具（已保存） */}
          <SectionGroup label={SCOPE_LABEL.company} count={savedTools.length}>
            {savedTools.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  尚未保存任何公司工具
                </p>
              </div>
            ) : (
              savedTools.map((t) => (
                <SavedToolCard
                  key={t.id}
                  tool={t}
                  onUnsave={(id) => setSavedTools((prev) => prev.filter((x) => x.id !== id))}
                />
              ))
            )}
          </SectionGroup>

          {myTools.length === 0 && deptTools.length === 0 && savedTools.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center mb-4">
                <ToolIcon size={16} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                暂无工具，上传 .py 文件创建工具
              </p>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
