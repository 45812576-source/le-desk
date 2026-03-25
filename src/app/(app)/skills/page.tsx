"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Zap, Wrench } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS, PixelIcon } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { useTheme } from "@/lib/theme";
import { apiFetch } from "@/lib/api";
import type { SkillDetail, ToolEntry, Department } from "@/lib/types";
import { SandboxTestModal } from "@/components/skill/SandboxTestModal";

type MainTab = "skill" | "tool" | "webapp";
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

// ─── Web App Card ─────────────────────────────────────────────────────────────
interface WebAppEntry {
  id: number;
  name: string;
  description: string | null;
  share_token: string;
  is_public: boolean;
  created_at: string | null;
  preview_url: string;
  share_url: string | null;
  status: string;
  publish_scope?: string;
  publish_department_ids?: number[];
  publish_user_ids?: number[];
}

const WEBAPP_STATUS_BADGE: Record<string, { color: "cyan" | "green" | "yellow" | "gray" | "red"; label: string }> = {
  draft: { color: "gray", label: "草稿" },
  reviewing: { color: "yellow", label: "审核中" },
  published: { color: "green", label: "已发布" },
};

function WebAppPublishModal({
  appId,
  appName,
  onSubmitted,
  onCancel,
}: {
  appId: number;
  appName: string;
  onSubmitted: () => void;
  onCancel: () => void;
}) {
  const [scope, setScope] = useState<"company" | "dept" | "personal">("company");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<number>>(new Set());
  const [userInput, setUserInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Department[]>("/admin/departments").then(setDepartments).catch(() => {});
  }, []);

  function toggleDept(id: number) {
    setSelectedDeptIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    const userIds = userInput.split(/[,，\s]+/).map(Number).filter((n) => !isNaN(n) && n > 0);
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/web-apps/${appId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "reviewing",
          publish_scope: scope,
          publish_department_ids: scope === "dept" ? Array.from(selectedDeptIds) : [],
          publish_user_ids: scope === "personal" ? userIds : [],
        }),
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  const scopeOptions = [
    { value: "company" as const, label: "全公司", desc: "所有员工审批通过后可见" },
    { value: "dept" as const, label: "指定部门", desc: "仅选中部门的成员可见" },
    { value: "personal" as const, label: "指定个人", desc: "填写用户 ID，仅这些人可见" },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-[#1A202C] w-[400px] max-h-[80vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-[#1A202C] bg-[#EBF4F7]">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">申请发布 Web App</span>
          <span className="text-xs font-bold text-[#1A202C] ml-1">— {appName}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">发布范围</div>
          <div className="space-y-2">
            {scopeOptions.map((o) => (
              <label
                key={o.value}
                className={`flex items-start gap-3 border-2 p-3 cursor-pointer ${
                  scope === o.value ? "border-[#00D1FF] bg-[#CCF2FF]" : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <input
                  type="radio"
                  name="webapp_scope"
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

          {scope === "dept" && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">选择部门（可多选）</div>
              <div className="border-2 border-gray-200 max-h-40 overflow-y-auto">
                {departments.map((d) => (
                  <label
                    key={d.id}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-gray-100 last:border-0 ${
                      selectedDeptIds.has(d.id) ? "bg-[#CCF2FF]" : "hover:bg-[#F0F4F8]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDeptIds.has(d.id)}
                      onChange={() => toggleDept(d.id)}
                    />
                    <span className="text-[10px] font-bold">{d.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {scope === "personal" && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">用户 ID（逗号/空格分隔）</div>
              <input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="例：101, 205, 310"
                className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00D1FF]"
              />
            </div>
          )}

          {error && (
            <div className="border-2 border-red-400 bg-red-50 px-3 py-2 text-[9px] font-bold text-red-500">✕ {error}</div>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t-2 border-[#1A202C]">
          <PixelButton onClick={handleSubmit} disabled={submitting}>
            {submitting ? "提交中..." : "提交审批"}
          </PixelButton>
          <PixelButton variant="secondary" onClick={onCancel}>取消</PixelButton>
        </div>
      </div>
    </div>
  );
}

function WebAppCard({ app, onDelete, onRefresh }: { app: WebAppEntry; onDelete: () => void; onRefresh: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  async function handleDelete() {
    if (!confirm(`确认删除「${app.name}」？`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/web-apps/${app.id}`, { method: "DELETE" });
      onDelete();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  }

  const badge = WEBAPP_STATUS_BADGE[app.status] ?? WEBAPP_STATUS_BADGE.draft;

  const scopeLabel = app.publish_scope === "company" ? "全公司"
    : app.publish_scope === "dept" ? "指定部门"
    : app.publish_scope === "personal" ? "指定个人"
    : null;

  return (
    <>
      {showPublishModal && (
        <WebAppPublishModal
          appId={app.id}
          appName={app.name}
          onSubmitted={() => { setShowPublishModal(false); onRefresh(); }}
          onCancel={() => setShowPublishModal(false)}
        />
      )}
      <div className="bg-white border-2 border-[#1A202C] p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-bold uppercase truncate">{app.name}</span>
              <PixelBadge color={badge.color}>{badge.label}</PixelBadge>
              {app.status === "published" && scopeLabel && (
                <PixelBadge color="cyan">{scopeLabel}</PixelBadge>
              )}
            </div>
            {app.description && (
              <p className="text-[9px] text-gray-500 line-clamp-2 mb-2">{app.description}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={app.preview_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[8px] font-bold uppercase tracking-widest border border-[#00A3C4] text-[#00A3C4] px-2 py-0.5 hover:bg-[#CCF2FF] transition-colors"
              >
                预览
              </a>
              {app.status === "published" && app.share_url && (
                <a
                  href={app.share_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[8px] font-bold uppercase tracking-widest border border-[#6B46C1] text-[#6B46C1] px-2 py-0.5 hover:bg-purple-50 transition-colors"
                >
                  ↗ 分享链接
                </a>
              )}
              {app.status === "draft" && (
                <PixelButton size="sm" variant="secondary" onClick={() => setShowPublishModal(true)}>
                  申请发布
                </PixelButton>
              )}
              {app.status === "reviewing" && (
                <span className="text-[9px] font-bold text-yellow-600 border border-yellow-400 bg-yellow-50 px-2 py-1">审批中</span>
              )}
              {app.created_at && (
                <span className="text-[8px] text-gray-400 font-mono">{new Date(app.created_at).toLocaleDateString("zh-CN")}</span>
              )}
            </div>
          </div>
          {(app.status === "draft" || app.status === "reviewing") && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="shrink-0 text-[9px] font-bold text-red-400 hover:text-red-600 border border-red-200 px-2 py-0.5 hover:border-red-400 transition-colors disabled:opacity-40"
            >
              {deleting ? "..." : "删除"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

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
  const [showSandbox, setShowSandbox] = useState(false);
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
      {showSandbox && (
        <SandboxTestModal
          type="skill"
          id={skill.id}
          name={skill.name}
          onPassed={() => { setShowSandbox(false); setShowPublishModal(true); }}
          onCancel={() => setShowSandbox(false)}
        />
      )}
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
                <PixelButton size="sm" variant="secondary" onClick={() => setShowSandbox(true)}>发布</PixelButton>
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
            {detail?.rejection_comment && skill.status === "draft" && (
              <div className="mb-3 border-2 border-red-300 bg-red-50 px-3 py-2">
                <div className="text-[8px] font-bold uppercase tracking-widest text-red-400 mb-0.5">审批驳回意见</div>
                <div className="text-[10px] text-red-600">{detail.rejection_comment}</div>
              </div>
            )}
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

// ─── Tool Card ────────────────────────────────────────────────────────────────
function MyToolCard({ tool, onRefresh }: { tool: ToolEntry; onRefresh: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);
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
      {showSandbox && (
        <SandboxTestModal
          type="tool"
          id={tool.id}
          name={tool.display_name || tool.name}
          onPassed={() => { setShowSandbox(false); setShowPublishModal(true); }}
          onCancel={() => setShowSandbox(false)}
        />
      )}
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
            <PixelButton size="sm" variant="secondary" onClick={() => setShowSandbox(true)} disabled={publishing}>
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
  const [tab, setTab] = useState<MainTab>("skill");

  // Skill state
  const [mySkills, setMySkills] = useState<SkillDetail[]>([]);
  const [skillLoading, setSkillLoading] = useState(false);
  const [showNewSkillForm, setShowNewSkillForm] = useState(false);
  const [uploadingMd, setUploadingMd] = useState(false);
  const [uploadMdError, setUploadMdError] = useState<string | null>(null);
  const [uploadingZip, setUploadingZip] = useState(false);
  const [uploadZipError, setUploadZipError] = useState<string | null>(null);
  const skillZipInputRef = useRef<HTMLInputElement>(null);

  // Tool state
  const [myTools, setMyTools] = useState<ToolEntry[]>([]);
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

  // Web App state
  const [webApps, setWebApps] = useState<WebAppEntry[]>([]);
  const [webAppLoading, setWebAppLoading] = useState(false);

  // ─── Skill fetchers ───────────────────────────────────────────────────────
  const fetchSkills = useCallback(() => {
    setSkillLoading(true);
    apiFetch<SkillDetail[]>("/skills?mine=true").catch(() => [] as SkillDetail[])
      .then((mine) => {
        // 只展示未发布的（草稿/审核中），已发布通过 # 调用，不需要在这里管理
        setMySkills(mine.filter(s => s.status === "draft" || s.status === "reviewing"));
      }).finally(() => setSkillLoading(false));
  }, []);

  // ─── Tool fetchers ────────────────────────────────────────────────────────
  const fetchTools = useCallback(() => {
    setToolLoading(true);
    apiFetch<ToolEntry[]>("/tools?mine=true").catch(() => [] as ToolEntry[])
      .then((mine) => {
        // 只展示未发布的（草稿/审核中）
        setMyTools(mine.filter(t => t.status === "draft" || t.status === "reviewing"));
      }).finally(() => setToolLoading(false));
  }, []);

  // ─── Web App fetchers ─────────────────────────────────────────────────────
  const fetchWebApps = useCallback(() => {
    setWebAppLoading(true);
    apiFetch<WebAppEntry[]>("/web-apps").catch(() => [] as WebAppEntry[])
      .then(setWebApps)
      .finally(() => setWebAppLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "skill") fetchSkills();
    else if (tab === "tool") fetchTools();
    else fetchWebApps();
  }, [tab, fetchSkills, fetchTools, fetchWebApps]);

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
      const statusNote = res.status === "published" ? "已发布" : "已存为草稿，可在列表中编辑后提交发布";
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

  const WebAppActions = (
    <div className="flex items-center gap-2">
      <PixelButton onClick={() => { window.location.href = "/dev-studio"; }}>
        + 工作台新建
      </PixelButton>
    </div>
  );

  const isLoading = tab === "skill" ? skillLoading : tab === "tool" ? toolLoading : webAppLoading;

  return (
    <PageShell
      title="Skills & Tools"
      icon={ICONS.skills}
      actions={tab === "skill" ? SkillActions : tab === "tool" ? ToolActions : WebAppActions}
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
        <PixelButton
          variant={tab === "webapp" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTab("webapp")}
        >
          Web App
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

          {/* 我的未发布 Skill（草稿 + 审核中） */}
          {mySkills.length > 0 && (
            <SectionGroup label="待发布" count={mySkills.length}>
              {mySkills.map((s) => <MySkillCard key={s.id} skill={s} onRefresh={fetchSkills} />)}
            </SectionGroup>
          )}

          {mySkills.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center mb-4">
                <SkillIcon size={16} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                暂无待发布 Skill，点击新建或上传 .md
              </p>
            </div>
          )}
        </>
      ) : tab === "tool" ? (
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

          {/* 我的未发布工具（草稿 + 审核中） */}
          {myTools.length > 0 && (
            <SectionGroup label="待发布" count={myTools.length}>
              {myTools.map((t) => <MyToolCard key={t.id} tool={t} onRefresh={fetchTools} />)}
            </SectionGroup>
          )}

          {myTools.length === 0 && (
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
      ) : (
        /* ── Web App Tab ── */
        <>
          {webApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 bg-purple-100 border-2 border-purple-400 flex items-center justify-center mb-4">
                <span className="text-purple-500 text-lg">🖥</span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                尚无 Web App，前往工作台新建
              </p>
              <PixelButton size="sm" onClick={() => { window.location.href = "/dev-studio"; }}>
                + 工作台新建
              </PixelButton>
            </div>
          ) : (
            <div className="space-y-2">
              {webApps.map((app) => (
                <WebAppCard key={app.id} app={app} onDelete={fetchWebApps} onRefresh={fetchWebApps} />
              ))}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
