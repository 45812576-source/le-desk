"use client";

import { useCallback, useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS, PixelIcon } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { SkillDetail, SavedSkill } from "@/lib/types";

function ThemedIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon {...ICONS.skills} size={size} />;
  return <Zap size={size} className="text-muted-foreground" />;
}

type Tab = "mine" | "dept" | "company" | "all";
type ScopeOption = "company" | "department" | "personal";

const STATUS_BADGE: Record<string, { color: "cyan" | "green" | "yellow" | "gray" | "red"; label: string }> = {
  draft: { color: "gray", label: "草稿" },
  reviewing: { color: "yellow", label: "审核中" },
  published: { color: "green", label: "已发布" },
  archived: { color: "red", label: "已归档" },
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

// ─── My Skill Card ────────────────────────────────────────────────────────────
function MySkillCard({ skill, onRefresh }: { skill: SkillDetail; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [detail, setDetail] = useState<SkillDetail | null>(null);

  // 当 detail 加载完成后，自动同步 prompt（仅非编辑中时）
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
    } catch {
      // ignore
    }
  }

  async function handleDelete() {
    try {
      await apiFetch(`/skills/${skill.id}`, { method: "DELETE" });
      onRefresh();
    } catch {
      // ignore
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
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(scope: ScopeOption, departmentId?: number) {
    const params = new URLSearchParams({ status: "published", scope });
    if (departmentId) params.set("department_id", String(departmentId));
    try {
      await apiFetch(`/skills/${skill.id}/status?${params}`, { method: "PATCH" });
      onRefresh();
    } catch {
      // ignore
    } finally {
      setShowPublishModal(false);
    }
  }

  async function handleArchive() {
    try {
      await apiFetch(`/skills/${skill.id}/status?status=archived`, { method: "PATCH" });
      onRefresh();
    } catch {
      // ignore
    }
  }

  const badge = STATUS_BADGE[skill.status] || STATUS_BADGE.draft;
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
        {/* Header */}
        <div
          className="p-4 flex items-start justify-between gap-3 cursor-pointer select-none"
          onClick={handleExpand}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <ThemedIcon size={12} />
              <span className="text-xs font-bold uppercase">{skill.name}</span>
              <PixelBadge color={badge.color}>{badge.label}</PixelBadge>
              {skill.current_version > 0 && (
                <PixelBadge color="cyan">v{skill.current_version}</PixelBadge>
              )}
            </div>
            <p className="text-[9px] text-gray-500 line-clamp-2">{skill.description || "无描述"}</p>
          </div>
          <span className="text-[9px] text-gray-400 mt-1">{expanded ? "▲" : "▼"}</span>
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="border-t-2 border-[#1A202C] p-4">
            {/* Action bar */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <PixelButton
                size="sm"
                variant={editing ? "primary" : "secondary"}
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? "取消编辑" : "编辑"}
              </PixelButton>
              {skill.status === "draft" || skill.status === "archived" ? (
                <PixelButton size="sm" variant="secondary" onClick={() => setShowPublishModal(true)}>
                  发布
                </PixelButton>
              ) : skill.status === "reviewing" ? (
                <span className="text-[9px] font-bold text-yellow-600 border border-yellow-400 bg-yellow-50 px-2 py-1">
                  审批中
                </span>
              ) : skill.status === "published" ? (
                <PixelButton size="sm" variant="secondary" onClick={handleArchive}>
                  归档
                </PixelButton>
              ) : null}
              {(skill.status === "draft" || skill.status === "archived") && (
                <PixelButton size="sm" variant="secondary" onClick={handleDelete}>
                  删除
                </PixelButton>
              )}
            </div>

            {editing ? (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-1">
                  System Prompt
                </div>
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
              latestVersion?.system_prompt && (
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-1">
                    System Prompt (v{latestVersion.version})
                  </div>
                  <pre className="text-[9px] text-gray-700 bg-[#F0F4F8] border border-gray-200 p-3 overflow-auto max-h-48 whitespace-pre-wrap font-mono">
                    {latestVersion.system_prompt}
                  </pre>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </>
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
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
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
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border-2 border-[#1A202C] p-4 mb-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">
        新建 Skill
      </div>
      <input
        type="text"
        placeholder="Skill 名称"
        value={name}
        onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((prev) => ({ ...prev, name: undefined })); }}
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
        onChange={(e) => { setPrompt(e.target.value); if (errors.prompt) setErrors((prev) => ({ ...prev, prompt: undefined })); }}
        rows={6}
        className={`w-full border-2 px-3 py-2 text-[10px] font-mono resize-y mb-1 focus:outline-none focus:border-[#00D1FF] ${errors.prompt ? "border-red-500" : "border-[#1A202C]"}`}
      />
      {errors.prompt && <div className="text-[9px] text-red-500 font-bold mb-2">{errors.prompt}</div>}
      <PixelButton type="submit" disabled={submitting}>
        {submitting ? "创建中..." : "创建"}
      </PixelButton>
    </form>
  );
}

// ─── Company Skill Card ───────────────────────────────────────────────────────
function CompanySkillCard({ skill, onUnsave }: { skill: SavedSkill; onUnsave: (id: number) => void }) {
  const [removing, setRemoving] = useState(false);

  async function handleUnsave() {
    setRemoving(true);
    try {
      await apiFetch(`/skills/save-from-market/${skill.id}`, { method: "DELETE" });
      onUnsave(skill.id);
    } catch {
      // ignore
    } finally {
      setRemoving(false);
    }
  }

  const badge = STATUS_BADGE[skill.status] || STATUS_BADGE.draft;

  return (
    <div className="bg-white border-2 border-[#1A202C] p-4 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <ThemedIcon size={12} />
          <span className="text-xs font-bold uppercase">{skill.name}</span>
          <PixelBadge color={badge.color}>{badge.label}</PixelBadge>
          {skill.current_version > 0 && (
            <PixelBadge color="cyan">v{skill.current_version}</PixelBadge>
          )}
          {skill.has_update && <PixelBadge color="yellow">UPDATE</PixelBadge>}
        </div>
        <p className="text-[9px] text-gray-500 line-clamp-2">{skill.description || "无描述"}</p>
        {skill.knowledge_tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {skill.knowledge_tags.map((t) => (
              <span key={t} className="text-[8px] text-[#00A3C4] font-bold uppercase">#{t}</span>
            ))}
          </div>
        )}
      </div>
      <PixelButton size="sm" variant="secondary" onClick={handleUnsave} disabled={removing}>
        {removing ? "移除中..." : "移除"}
      </PixelButton>
    </div>
  );
}

// ─── All Skill Card (super_admin only) ───────────────────────────────────────
function AllSkillCard({ skill, onRefresh }: { skill: SkillDetail; onRefresh: () => void }) {
  const [acting, setActing] = useState(false);
  const [comment, setComment] = useState("");
  const [showReject, setShowReject] = useState(false);
  const badge = STATUS_BADGE[skill.status] || STATUS_BADGE.draft;

  async function findApproval() {
    // 找到该 skill 的 pending 审批单
    const data = await apiFetch<{ items: { id: number; status: string; target_id: number }[] }>(
      `/approvals?type=skill_publish&status=pending`
    );
    return data.items.find((a) => a.target_id === skill.id);
  }

  async function handleApprove() {
    setActing(true);
    try {
      const approval = await findApproval();
      if (!approval) {
        // 超管直接发布（无审批单时的兜底）
        await apiFetch(`/skills/${skill.id}/status?status=published`, { method: "PATCH" });
      } else {
        await apiFetch(`/approvals/${approval.id}/actions`, {
          method: "POST",
          body: JSON.stringify({ action: "approve", comment: comment || "审批通过" }),
        });
      }
      onRefresh();
    } catch {
      // ignore
    } finally {
      setActing(false);
      setComment("");
    }
  }

  async function handleReject() {
    if (!comment.trim()) return;
    setActing(true);
    try {
      const approval = await findApproval();
      if (approval) {
        await apiFetch(`/approvals/${approval.id}/actions`, {
          method: "POST",
          body: JSON.stringify({ action: "reject", comment }),
        });
        // 驳回后把 skill 状态改回 draft
        await apiFetch(`/skills/${skill.id}/status?status=draft`, { method: "PATCH" });
      }
      onRefresh();
    } catch {
      // ignore
    } finally {
      setActing(false);
      setComment("");
      setShowReject(false);
    }
  }

  return (
    <div className="bg-white border-2 border-[#1A202C] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <ThemedIcon size={12} />
            <span className="text-xs font-bold uppercase">{skill.name}</span>
            <PixelBadge color={badge.color}>{badge.label}</PixelBadge>
            {skill.current_version > 0 && <PixelBadge color="cyan">v{skill.current_version}</PixelBadge>}
            <PixelBadge color="gray">{skill.scope}</PixelBadge>
          </div>
          <p className="text-[9px] text-gray-500 line-clamp-2">{skill.description || "无描述"}</p>
        </div>
        {/* 审批操作：仅 reviewing 状态显示 */}
        {skill.status === "reviewing" && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <PixelButton size="sm" onClick={handleApprove} disabled={acting}>
              {acting ? "处理中..." : "通过"}
            </PixelButton>
            <PixelButton size="sm" variant="secondary" onClick={() => setShowReject((v) => !v)} disabled={acting}>
              驳回
            </PixelButton>
          </div>
        )}
      </div>
      {/* 驳回理由输入 */}
      {skill.status === "reviewing" && showReject && (
        <div className="mt-3 flex gap-2 items-center">
          <input
            type="text"
            placeholder="请填写驳回原因"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="flex-1 border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#E53E3E]"
          />
          <PixelButton size="sm" variant="secondary" onClick={handleReject} disabled={acting || !comment.trim()}>
            确认驳回
          </PixelButton>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TAB_TITLE: Record<Tab, string> = {
  mine: "我的 Skill",
  dept: "部门 Skill",
  company: "公司 Skill",
  all: "全部 Skill",
};

export default function SkillsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [tab, setTab] = useState<Tab>("mine");
  const [mySkills, setMySkills] = useState<SkillDetail[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deptSkills, setDeptSkills] = useState<SkillDetail[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [savedSkills, setSavedSkills] = useState<SavedSkill[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [allSkills, setAllSkills] = useState<SkillDetail[]>([]);
  const [allLoading, setAllLoading] = useState(false);

  const fetchMySkills = useCallback(() => {
    setMyLoading(true);
    apiFetch<SkillDetail[]>("/skills?mine=true")
      .then(setMySkills)
      .catch(() => setMySkills([]))
      .finally(() => setMyLoading(false));
  }, []);

  const fetchDeptSkills = useCallback(() => {
    setDeptLoading(true);
    apiFetch<SkillDetail[]>("/skills?scope=department")
      .then(setDeptSkills)
      .catch(() => setDeptSkills([]))
      .finally(() => setDeptLoading(false));
  }, []);

  const fetchSavedSkills = useCallback(() => {
    setSavedLoading(true);
    apiFetch<SavedSkill[]>("/skills/my-saved")
      .then(setSavedSkills)
      .catch(() => setSavedSkills([]))
      .finally(() => setSavedLoading(false));
  }, []);

  const fetchAllSkills = useCallback(() => {
    setAllLoading(true);
    apiFetch<SkillDetail[]>("/skills")
      .then(setAllSkills)
      .catch(() => setAllSkills([]))
      .finally(() => setAllLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "mine") fetchMySkills();
    else if (tab === "dept") fetchDeptSkills();
    else if (tab === "all") fetchAllSkills();
    else fetchSavedSkills();
  }, [tab, fetchMySkills, fetchDeptSkills, fetchSavedSkills, fetchAllSkills]);

  function handleUnsave(skillId: number) {
    setSavedSkills((prev) => prev.filter((s) => s.id !== skillId));
  }

  async function handleUploadMd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      await apiFetch("/skills/upload-md", { method: "POST", body: form });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      e.target.value = "";
      fetchMySkills();
    }
  }

  const MineActions = (
    <div className="flex items-center gap-2">
      {/* MD 上传 */}
      <label className="cursor-pointer">
        <input
          type="file"
          accept=".md"
          className="hidden"
          onChange={handleUploadMd}
        />
        <span className="inline-flex items-center border-2 border-[#1A202C] px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-white hover:bg-[#F0F4F8] transition-colors cursor-pointer">
          {uploading ? "上传中..." : "上传 .md"}
        </span>
      </label>
      <PixelButton onClick={() => setShowNewForm((v) => !v)}>
        {showNewForm ? "取消" : "+ 新建 Skill"}
      </PixelButton>
    </div>
  );

  return (
    <PageShell
      title={TAB_TITLE[tab]}
      icon={ICONS.skills}
      actions={tab === "mine" ? MineActions : undefined}
    >
      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        <PixelButton
          variant={tab === "mine" ? "primary" : "secondary"}
          size="sm"
          onClick={() => { setTab("mine"); setShowNewForm(false); }}
        >
          我的 Skill
        </PixelButton>
        <PixelButton
          variant={tab === "dept" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTab("dept")}
        >
          部门 Skill
        </PixelButton>
        <PixelButton
          variant={tab === "company" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTab("company")}
        >
          公司 Skill
        </PixelButton>
        {isSuperAdmin && (
          <PixelButton
            variant={tab === "all" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setTab("all")}
          >
            全部 Skill
          </PixelButton>
        )}
      </div>

      {/* Tab: 我的 Skill */}
      {tab === "mine" && (
        <>
          {uploadError && (
            <div className="border-2 border-red-400 bg-red-50 px-4 py-2 mb-3 text-[9px] font-bold text-red-500">
              上传失败：{uploadError}
            </div>
          )}
          {showNewForm && (
            <NewSkillForm onCreated={() => { setShowNewForm(false); fetchMySkills(); }} />
          )}
          {myLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
                Loading...
              </div>
            </div>
          ) : mySkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center mb-4">
                <ThemedIcon size={16} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                暂无 Skill，点击新建或上传 .md
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {mySkills.map((skill) => (
                <MySkillCard key={skill.id} skill={skill} onRefresh={fetchMySkills} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab: 部门 Skill */}
      {tab === "dept" && (
        <>
          {deptLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
                Loading...
              </div>
            </div>
          ) : deptSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center mb-4">
                <ThemedIcon size={16} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                暂无部门 Skill
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {deptSkills.map((skill) => {
                const badge = STATUS_BADGE[skill.status] || STATUS_BADGE.draft;
                return (
                  <div key={skill.id} className="bg-white border-2 border-[#1A202C] p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <ThemedIcon size={12} />
                      <span className="text-xs font-bold uppercase">{skill.name}</span>
                      <PixelBadge color={badge.color}>{badge.label}</PixelBadge>
                      {(skill.current_version ?? 0) > 0 && (
                        <PixelBadge color="cyan">v{skill.current_version}</PixelBadge>
                      )}
                      <PixelBadge color="yellow">部门</PixelBadge>
                    </div>
                    <p className="text-[9px] text-gray-500 line-clamp-2">{skill.description || "无描述"}</p>
                    {skill.knowledge_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {skill.knowledge_tags.map((t) => (
                          <span key={t} className="text-[8px] text-[#00A3C4] font-bold uppercase">#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Tab: 公司 Skill */}
      {tab === "company" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              已保存 {savedSkills.length} 个
            </span>
            <PixelButton
              size="sm"
              variant="secondary"
              onClick={() => { window.location.href = "/skills/market"; }}
            >
              + 浏览市场
            </PixelButton>
          </div>
          {savedLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
                Loading...
              </div>
            </div>
          ) : savedSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center mb-4">
                <ThemedIcon size={16} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                尚未保存任何公司 Skill
              </p>
              <PixelButton onClick={() => { window.location.href = "/skills/market"; }}>
                浏览 Skill 市场
              </PixelButton>
            </div>
          ) : (
            <div className="space-y-2">
              {savedSkills.map((skill) => (
                <CompanySkillCard key={skill.id} skill={skill} onUnsave={handleUnsave} />
              ))}
            </div>
          )}
        </>
      )}
      {/* Tab: 全部 Skill（仅超管） */}
      {tab === "all" && isSuperAdmin && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              共 {allSkills.length} 个
            </span>
            <span className="text-[9px] text-yellow-600 font-bold border border-yellow-400 bg-yellow-50 px-2 py-0.5">
              审核中 {allSkills.filter(s => s.status === "reviewing").length} 个待审批
            </span>
          </div>
          {allLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
                Loading...
              </div>
            </div>
          ) : allSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">暂无 Skill</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* 待审批的排最前 */}
              {[...allSkills].sort((a, b) => {
                if (a.status === "reviewing" && b.status !== "reviewing") return -1;
                if (a.status !== "reviewing" && b.status === "reviewing") return 1;
                return 0;
              }).map((skill) => (
                <AllSkillCard key={skill.id} skill={skill} onRefresh={fetchAllSkills} />
              ))}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
