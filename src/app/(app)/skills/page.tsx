"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Zap, Wrench } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS, PixelIcon } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { OrgMemoryProposal, SkillDetail, ToolEntry } from "@/lib/types";
import { SandboxTestModal } from "@/components/skill/SandboxTestModal";
import { SKILL_STATUS_BADGE, isWorkspaceMountableSkillStatus } from "@/lib/skill-status";
import { buildOwnWorkspaceSkillItems } from "@/lib/workspace-skill-config";
import { loadOrgMemoryProposals } from "@/lib/org-memory";

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

function approvalStageLabel(stage?: string | null): string | null {
  if (!stage) return null;
  if (stage === "dept_pending") return "待部门审批";
  if (stage === "super_pending") return "待超管终审";
  if (stage === "needs_info") return "待补充材料";
  return stage;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface WorkspaceConfigItem {
  id: number;
  name: string;
  description?: string;
  status?: string;
  approval_stage?: string | null;
  scope?: string;
  source: string;
  mounted: boolean;
  display_name?: string;
  tool_type?: string;
}

interface WorkspaceConfig {
  id: number;
  user_id: number;
  mounted_skills: WorkspaceConfigItem[];
  mounted_tools: WorkspaceConfigItem[];
  needs_prompt_refresh: boolean;
  updated_at: string | null;
}

function sanitizeMountedSkills(
  mountedSkills: Map<number, WorkspaceConfigItem>,
  mySkills: SkillDetail[],
): Map<number, WorkspaceConfigItem> {
  const ownSkillStatusMap = new Map(mySkills.map((skill) => [skill.id, skill.status]));
  const next = new Map<number, WorkspaceConfigItem>();
  for (const [id, item] of mountedSkills.entries()) {
    if (item.source !== "own") {
      next.set(id, item);
      continue;
    }
    const latestStatus = ownSkillStatusMap.get(id);
    if (!latestStatus || !isWorkspaceMountableSkillStatus(latestStatus)) {
      continue;
    }
    next.set(id, { ...item, status: latestStatus });
  }
  return next;
}

function workspacePublishBlockReason(skill: SkillDetail, scope: "department" | "company"): string {
  const targetLabel = scope === "department" ? "部门标准工作台" : "公司标准工作台";
  const stageLabel = approvalStageLabel(skill.approval_stage);
  const skillName = `Skill「${skill.name}」`;
  if (stageLabel) {
    return `${skillName}当前${stageLabel}，暂不可发布为${targetLabel}；只有已发布 Skill 才能挂载到标准工作台。`;
  }
  if (skill.status === "reviewing") {
    return `${skillName}当前审核中，暂不可发布为${targetLabel}；只有已发布 Skill 才能挂载到标准工作台。`;
  }
  if (skill.status === "draft") {
    return `${skillName}当前仍是草稿，暂不可发布为${targetLabel}；请先提交审批并完成发布。`;
  }
  if (skill.status === "rejected") {
    return `${skillName}已被打回，暂不可发布为${targetLabel}；请修改后重新提交审批。`;
  }
  return `${skillName}尚未发布，暂不可发布为${targetLabel}；只有已发布 Skill 才能挂载到标准工作台。`;
}

function mergeHelperText(base?: string, extra?: string): string | undefined {
  if (base && extra) return `${base}；${extra}`;
  return base || extra;
}

function buildOrgMemorySkillHints(proposals: OrgMemoryProposal[]): Map<number, string> {
  const hints = new Map<number, string>();
  for (const proposal of proposals) {
    for (const item of proposal.skill_mounts) {
      const decisionLabel =
        item.decision === "allow"
          ? "组织 Memory 建议可挂载"
          : item.decision === "require_approval"
            ? "组织 Memory 建议挂载前审批"
            : "组织 Memory 建议暂不挂载";
      const helper = `${decisionLabel}：${item.target_scope}，共享上限 ${item.max_allowed_scope}，内容形态 ${item.required_redaction_mode}`;
      const prev = hints.get(item.skill_id);
      hints.set(item.skill_id, prev ? `${prev}；${helper}` : helper);
    }
  }
  return hints;
}

// ─── Section Group ────────────────────────────────────────────────────────────
function SectionGroup({ label, count, children, collapsible, actions }: {
  label: string; count: number; children: React.ReactNode; collapsible?: boolean; actions?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`flex items-center gap-2 flex-1 ${collapsible ? "cursor-pointer select-none" : ""}`}
          onClick={() => collapsible && setCollapsed((v) => !v)}
        >
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">{label}</span>
          <span className="text-[9px] text-muted-foreground">({count})</span>
          <div className="flex-1 h-px bg-border" />
          {collapsible && (
            <span className="text-[9px] text-muted-foreground">{collapsed ? "▼" : "▲"}</span>
          )}
        </div>
        {actions}
      </div>
      {!collapsed && <div className="space-y-2">{children}</div>}
    </div>
  );
}

// ─── Checkbox Mount Item ────────────────────────────────────────────────────
function CheckItem({
  type,
  name,
  description,
  statusBadge,
  extraBadges,
  checked,
  disabled = false,
  helperText,
  onToggle,
  actions,
}: {
  type: "skill" | "tool";
  name: string;
  description?: string;
  statusBadge?: { color: "cyan" | "green" | "yellow" | "gray" | "red"; label: string };
  extraBadges?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  helperText?: string;
  onToggle: (checked: boolean) => void;
  actions?: React.ReactNode;
}) {
  return (
    <label className={`flex items-center gap-3 border-2 p-3 transition-colors ${
      disabled
        ? "cursor-not-allowed opacity-75 border-border bg-card"
        : checked
          ? "cursor-pointer border-[#00A3C4] bg-[#F0FDFA] dark:bg-[#0A2F2A]"
          : "cursor-pointer border-border bg-card hover:border-muted-foreground"
    }`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-4 h-4 accent-[#00CC99] flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          {type === "skill" ? <SkillIcon size={10} /> : <ToolIcon size={10} />}
          <span className="text-[10px] font-bold uppercase truncate">{name}</span>
          {statusBadge && (
            <PixelBadge color={statusBadge.color}>{statusBadge.label}</PixelBadge>
          )}
          {extraBadges}
        </div>
        {description && (
          <p className="text-[8px] text-muted-foreground line-clamp-1">{description}</p>
        )}
        {helperText && (
          <p className="text-[8px] text-amber-600 mt-1">{helperText}</p>
        )}
      </div>
      {actions && (
        <div
          className="flex items-center gap-1.5 flex-shrink-0"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {actions}
        </div>
      )}
    </label>
  );
}

// ─── My Skill Actions (发布/归档/删除) ────────────────────────────────────
function MySkillActions({ skill, onRefresh }: { skill: SkillDetail; onRefresh: () => void }) {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);

  async function handleDelete() {
    const isPublished = skill.status === "published";
    const msg = isPublished
      ? `此 Skill「${skill.name}」已发布，删除后将从你的账户移除，Skill 所有权将转给公司。确认？`
      : `确认删除 Skill「${skill.name}」？`;
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      await apiFetch(`/skills/${skill.id}`, { method: "DELETE" });
      onRefresh();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  }

  async function handleArchive() {
    try {
      await apiFetch(`/skills/${skill.id}/status?status=archived`, { method: "PATCH" });
      onRefresh();
    } catch { /* ignore */ }
  }

  return (
    <>
      {showSandbox && (
        <SandboxTestModal
          type="skill"
          id={skill.id}
          name={skill.name}
          passedLabel={user?.role === "super_admin" ? "OK 通过，继续发布" : "OK 通过，继续提交审批"}
          onPassed={() => { setShowSandbox(false); onRefresh(); }}
          onCancel={() => setShowSandbox(false)}
          onImportToStudio={() => {
            setShowSandbox(false);
            window.location.href = `/skill-studio?skill_id=${skill.id}`;
          }}
        />
      )}
      {(skill.status === "draft" || skill.status === "archived") && (
        <PixelButton size="sm" variant="secondary" onClick={() => setShowSandbox(true)}>
          {user?.role === "super_admin" ? "发布" : "提交审批"}
        </PixelButton>
      )}
      {skill.status === "reviewing" && (
        <span className="text-[9px] font-bold text-yellow-600 dark:text-yellow-400 border border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-950 px-2 py-1">
          {approvalStageLabel(skill.approval_stage) || "审批中"}
        </span>
      )}
      {skill.status === "published" && (
        <PixelButton size="sm" variant="secondary" onClick={handleArchive}>归档</PixelButton>
      )}
      <PixelButton size="sm" variant="secondary" onClick={handleDelete} disabled={deleting}>
        {deleting ? "..." : "删除"}
      </PixelButton>
    </>
  );
}

// ─── My Tool Actions ────────────────────────────────────────────────────────
function MyToolActions({ tool, onRefresh }: { tool: ToolEntry; onRefresh: () => void }) {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);

  async function handleDelete() {
    if (!confirm(`确认删除工具「${tool.display_name}」？`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/tools/${tool.id}`, { method: "DELETE" });
      onRefresh();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
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

  return (
    <>
      {showSandbox && (
        <SandboxTestModal
          type="tool"
          id={tool.id}
          name={tool.display_name || tool.name}
          passedLabel={user?.role === "super_admin" ? "OK 通过，继续发布" : "OK 通过，继续提交审批"}
          onPassed={() => { setShowSandbox(false); onRefresh(); }}
          onCancel={() => setShowSandbox(false)}
        />
      )}
      {(tool.status === "draft" || tool.status === "archived") && (
        <PixelButton size="sm" variant="secondary" onClick={() => setShowSandbox(true)}>
          {user?.role === "super_admin" ? "发布" : "提交审批"}
        </PixelButton>
      )}
      {tool.status === "reviewing" && (
        <span className="text-[9px] font-bold text-yellow-600 dark:text-yellow-400 border border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-950 px-2 py-1">审批中</span>
      )}
      {tool.status === "published" && (
        <PixelButton size="sm" variant="secondary" onClick={handleArchive}>归档</PixelButton>
      )}
      {(tool.status === "draft" || tool.status === "archived") && (
        <PixelButton size="sm" variant="secondary" onClick={handleDelete} disabled={deleting}>
          {deleting ? "..." : "删除"}
        </PixelButton>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SkillsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "dept_admin";

  // Workspace config state
  const [configLoading, setConfigLoading] = useState(true);
  const [configDirty, setConfigDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Own skills/tools (all statuses)
  const [mySkills, setMySkills] = useState<SkillDetail[]>([]);
  const [myTools, setMyTools] = useState<ToolEntry[]>([]);
  const [skillLoading, setSkillLoading] = useState(false);
  const [toolLoading, setToolLoading] = useState(false);

  // Local mount state (tracked separately for dirty checking)
  const [mountedSkills, setMountedSkills] = useState<Map<number, WorkspaceConfigItem>>(new Map());
  const [mountedTools, setMountedTools] = useState<Map<number, WorkspaceConfigItem>>(new Map());
  const [orgMemoryProposals, setOrgMemoryProposals] = useState<OrgMemoryProposal[]>([]);
  const [orgMemoryFallback, setOrgMemoryFallback] = useState(false);

  // ─── Fetchers ──────────────────────────────────────────────────────────

  const fetchConfig = useCallback(() => {
    setConfigLoading(true);
    apiFetch<WorkspaceConfig>("/workspace-config")
      .then((c) => {
        const sm = new Map<number, WorkspaceConfigItem>();
        for (const s of c.mounted_skills) sm.set(s.id, s);
        setMountedSkills(sm);
        const tm = new Map<number, WorkspaceConfigItem>();
        for (const t of c.mounted_tools) tm.set(t.id, t);
        setMountedTools(tm);
        setConfigDirty(false);
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, []);

  const fetchSkills = useCallback(() => {
    setSkillLoading(true);
    apiFetch<SkillDetail[]>("/skills?mine=true").catch(() => [] as SkillDetail[])
      .then(setMySkills)
      .finally(() => setSkillLoading(false));
  }, []);

  const fetchTools = useCallback(() => {
    setToolLoading(true);
    apiFetch<ToolEntry[]>("/tools?mine=true").catch(() => [] as ToolEntry[])
      .then(setMyTools)
      .finally(() => setToolLoading(false));
  }, []);

  const fetchOrgMemoryProposals = useCallback(() => {
    loadOrgMemoryProposals()
      .then((result) => {
        setOrgMemoryProposals(result.data);
        setOrgMemoryFallback(result.fallback);
      })
      .catch(() => {
        setOrgMemoryProposals([]);
        setOrgMemoryFallback(false);
      });
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchSkills();
    fetchTools();
    fetchOrgMemoryProposals();
  }, [fetchConfig, fetchSkills, fetchTools, fetchOrgMemoryProposals]);

  // 合并个人 Skill 到 mountedSkills（source=own）
  useEffect(() => {
    if (configLoading || skillLoading) return;
    setMountedSkills((prev) => {
      const next = sanitizeMountedSkills(prev, mySkills);
      let changed = false;
      if (next.size !== prev.size) changed = true;
      for (const s of mySkills) {
        if (!isWorkspaceMountableSkillStatus(s.status)) continue;
        if (!next.has(s.id)) {
          next.set(s.id, {
            id: s.id,
            name: s.name,
            description: s.description,
            status: s.status,
            scope: s.scope,
            source: "own",
            mounted: true,
          });
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [mySkills, configLoading, skillLoading]);

  // 合并个人 Tool 到 mountedTools（source=own）
  useEffect(() => {
    if (configLoading || toolLoading) return;
    setMountedTools((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const t of myTools) {
        if (!next.has(t.id)) {
          next.set(t.id, {
            id: t.id,
            name: t.name,
            display_name: t.display_name,
            description: t.description ?? undefined,
            status: t.status,
            tool_type: t.tool_type,
            source: "own",
            mounted: true,
          });
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [myTools, configLoading, toolLoading]);

  // ─── Mount toggle ──────────────────────────────────────────────────────

  function toggleSkillMount(id: number, mounted: boolean) {
    setMountedSkills((prev) => {
      const next = new Map(prev);
      const item = next.get(id);
      if (item) next.set(id, { ...item, mounted });
      return next;
    });
    setConfigDirty(true);
  }

  function toggleToolMount(id: number, mounted: boolean) {
    setMountedTools((prev) => {
      const next = new Map(prev);
      const item = next.get(id);
      if (item) next.set(id, { ...item, mounted });
      return next;
    });
    setConfigDirty(true);
  }

  // ─── Save config ──────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const sanitizedMountedSkills = sanitizeMountedSkills(mountedSkills, mySkills);
      const skillItems = Array.from(sanitizedMountedSkills.values()).map((s) => ({
        id: s.id, source: s.source, mounted: s.mounted,
      }));
      const toolItems = Array.from(mountedTools.values()).map((t) => ({
        id: t.id, source: t.source, mounted: t.mounted,
      }));
      await apiFetch("/workspace-config", {
        method: "PUT",
        body: JSON.stringify({ mounted_skills: skillItems, mounted_tools: toolItems }),
      });
      setMountedSkills(sanitizedMountedSkills);
      setSaveMsg("已保存");
      setConfigDirty(false);
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishWorkspace(scope: "department" | "company") {
    setPublishing(true);
    setSaveMsg(null);
    try {
      const blockedSkill = mySkills.find((skill) => {
        const mounted = mountedSkills.get(skill.id);
        return mounted?.mounted && !isWorkspaceMountableSkillStatus(skill.status);
      });
      if (blockedSkill) {
        setSaveMsg(workspacePublishBlockReason(blockedSkill, scope));
        return;
      }

      const sanitizedMountedSkills = sanitizeMountedSkills(mountedSkills, mySkills);
      const skillItems = Array.from(sanitizedMountedSkills.values()).map((s) => ({
        id: s.id, source: s.source, mounted: s.mounted,
      }));
      const toolItems = Array.from(mountedTools.values()).map((t) => ({
        id: t.id, source: t.source, mounted: t.mounted,
      }));
      await apiFetch("/workspace-config", {
        method: "PUT",
        body: JSON.stringify({ mounted_skills: skillItems, mounted_tools: toolItems }),
      });
      await apiFetch("/workspace-config/publish", {
        method: "POST",
        body: JSON.stringify({ scope }),
      });
      setMountedSkills(sanitizedMountedSkills);
      setSaveMsg(`已发布为${scope === "department" ? "部门" : "公司"}标准工作台`);
      setConfigDirty(false);
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "发布失败");
    } finally {
      setPublishing(false);
    }
  }

  // ─── Derived data ─────────────────────────────────────────────────────

  const visibleMountedSkills = useMemo(
    () => sanitizeMountedSkills(mountedSkills, mySkills),
    [mountedSkills, mySkills],
  );

  const ownSkills = useMemo(
    () => buildOwnWorkspaceSkillItems(mySkills, visibleMountedSkills),
    [mySkills, visibleMountedSkills],
  );
  const deptSkills = Array.from(mountedSkills.values()).filter((s) => s.source === "dept");
  const marketSkills = Array.from(mountedSkills.values()).filter((s) => s.source === "market");
  const ownTools = Array.from(mountedTools.values()).filter((t) => t.source === "own");
  const deptTools = Array.from(mountedTools.values()).filter((t) => t.source === "dept");
  const marketTools = Array.from(mountedTools.values()).filter((t) => t.source === "market");

  const unpublishedCount = mySkills.filter((s) => s.status === "draft" || s.status === "reviewing").length;
  const isLoading = configLoading || skillLoading || toolLoading;
  const orgMemorySkillHints = useMemo(
    () => buildOrgMemorySkillHints(orgMemoryProposals),
    [orgMemoryProposals],
  );
  const orgMemoryPendingCount = useMemo(
    () => orgMemoryProposals.filter((item) => item.proposal_status === "pending_approval").length,
    [orgMemoryProposals],
  );

  // ─── Render ──────────────────────────────────────────────────────

  const Actions = (
    <div className="flex items-center gap-2">
      <PixelButton variant="secondary" onClick={() => { window.location.href = "/app-market"; }}>
        应用市场
      </PixelButton>
    </div>
  );

  return (
    <PageShell
      title="工作台配置"
      icon={ICONS.skills}
      actions={Actions}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">Loading...</div>
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4]">
                  组织 Memory 挂载提醒
                </div>
                <div className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  如果某个 Skill 需要读取客户案例、复盘材料或部门知识域，则其挂载建议以组织 Memory 草案的共享范围和匿名化要求为准。
                  当前有 {orgMemoryPendingCount} 份草案待审批。
                </div>
              </div>
              {orgMemoryFallback && (
                <PixelBadge color="yellow">演示数据</PixelBadge>
              )}
            </div>
          </div>

          {/* ══ 我的 Skill ══ */}
          <SectionGroup
            label="我的 Skill"
            count={ownSkills.length}
            collapsible
            actions={
              <PixelButton size="sm" onClick={() => { window.location.href = "/skill-studio"; }}>
                + Skill Studio
              </PixelButton>
            }
          >
            {unpublishedCount >= 3 && (
              <div className="border-2 border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-950 px-4 py-2 mb-2 text-[9px] font-bold text-yellow-700 dark:text-yellow-300">
                未发布的 Skill 已达上限（3个），请先发布或删除后再创建
              </div>
            )}
            {ownSkills.length > 0 ? (
              ownSkills.map((s) => {
                const skill = mySkills.find((ms) => ms.id === s.id);
                const badge = SKILL_STATUS_BADGE[s.status ?? "draft"] ?? SKILL_STATUS_BADGE.draft;
                const stageLabel = approvalStageLabel(skill?.approval_stage ?? s.approval_stage);
                return (
                  <CheckItem
                    key={s.id}
                    type="skill"
                    name={s.name}
                    description={s.description}
                    statusBadge={badge}
                    extraBadges={
                      <>
                        {skill?.current_version != null && skill.current_version > 0 && (
                          <PixelBadge color="cyan">v{skill.current_version}</PixelBadge>
                        )}
                        {s.scope && <PixelBadge color="gray">{SCOPE_LABEL[s.scope] || s.scope}</PixelBadge>}
                        {stageLabel && <PixelBadge color={stageLabel.includes("超管") ? "purple" : "yellow"}>{stageLabel}</PixelBadge>}
                      </>
                    }
                    checked={s.mounted}
                    disabled={!s.mountable}
                    helperText={mergeHelperText(
                      s.mountable
                        ? undefined
                        : stageLabel
                          ? `${stageLabel}，暂不可在工作台中配置使用`
                          : "Skill需通过审核发布后，可在工作台中配置使用",
                      orgMemorySkillHints.get(s.id),
                    )}
                    onToggle={(checked) => {
                      if (!s.mountable) return;
                      toggleSkillMount(s.id, checked);
                    }}
                    actions={skill ? <MySkillActions skill={skill} onRefresh={() => { fetchSkills(); fetchConfig(); }} /> : undefined}
                  />
                );
              })
            ) : (
              <div className="text-[10px] text-muted-foreground text-center py-6">
                暂无自己开发的 Skill，前往 Skill Studio 创建；Skill需通过审核发布后，可在工作台中配置使用
              </div>
            )}
          </SectionGroup>

          {/* ══ 部门发布的 Skill ══ */}
          {deptSkills.length > 0 && (
            <SectionGroup label="部门发布的 Skill" count={deptSkills.length} collapsible>
              {deptSkills.map((s) => (
                <CheckItem
                  key={s.id}
                  type="skill"
                  name={s.name}
                  description={s.description}
                  statusBadge={SKILL_STATUS_BADGE[s.status ?? "published"]}
                  checked={s.mounted}
                  helperText={orgMemorySkillHints.get(s.id)}
                  onToggle={(checked) => toggleSkillMount(s.id, checked)}
                />
              ))}
            </SectionGroup>
          )}

          {/* ══ 市场收藏的 Skill ══ */}
          {marketSkills.length > 0 && (
            <SectionGroup label="市场收藏的 Skill" count={marketSkills.length} collapsible>
              {marketSkills.map((s) => (
                <CheckItem
                  key={s.id}
                  type="skill"
                  name={s.name}
                  description={s.description}
                  statusBadge={SKILL_STATUS_BADGE[s.status ?? "published"]}
                  checked={s.mounted}
                  helperText={orgMemorySkillHints.get(s.id)}
                  onToggle={(checked) => toggleSkillMount(s.id, checked)}
                />
              ))}
            </SectionGroup>
          )}

          {/* ══ 我的工具 ══ */}
          <SectionGroup
            label="我的工具"
            count={ownTools.length}
            collapsible
            actions={
              <PixelButton size="sm" onClick={() => { window.location.href = "/dev-studio"; }}>
                + Dev Studio
              </PixelButton>
            }
          >
            {ownTools.length > 0 ? (
              ownTools.map((t) => {
                const tool = myTools.find((mt) => mt.id === t.id);
                const badge = TOOL_STATUS_BADGE[t.status ?? "draft"] ?? TOOL_STATUS_BADGE.draft;
                const typeColor = TOOL_TYPE_COLOR[t.tool_type ?? ""] ?? "gray";
                const typeLabel = TOOL_TYPE_LABEL[t.tool_type ?? ""] ?? t.tool_type ?? "";
                return (
                  <CheckItem
                    key={t.id}
                    type="tool"
                    name={t.display_name || t.name}
                    description={t.description}
                    statusBadge={badge}
                    extraBadges={typeLabel ? <PixelBadge color={typeColor}>{typeLabel}</PixelBadge> : undefined}
                    checked={t.mounted}
                    onToggle={(checked) => toggleToolMount(t.id, checked)}
                    actions={tool ? <MyToolActions tool={tool} onRefresh={() => { fetchTools(); fetchConfig(); }} /> : undefined}
                  />
                );
              })
            ) : (
              <div className="text-[10px] text-muted-foreground text-center py-6">
                暂无工具，前往 Dev Studio 创建
              </div>
            )}
          </SectionGroup>

          {/* ══ 部门发布的工具 ══ */}
          {deptTools.length > 0 && (
            <SectionGroup label="部门发布的工具" count={deptTools.length} collapsible>
              {deptTools.map((t) => (
                <CheckItem
                  key={t.id}
                  type="tool"
                  name={t.display_name || t.name}
                  description={t.description}
                  statusBadge={TOOL_STATUS_BADGE[t.status ?? "published"]}
                  extraBadges={
                    t.tool_type ? (
                      <PixelBadge color={TOOL_TYPE_COLOR[t.tool_type] ?? "gray"}>
                        {TOOL_TYPE_LABEL[t.tool_type] ?? t.tool_type}
                      </PixelBadge>
                    ) : undefined
                  }
                  checked={t.mounted}
                  onToggle={(checked) => toggleToolMount(t.id, checked)}
                />
              ))}
            </SectionGroup>
          )}

          {/* ══ 市场收藏的工具 ══ */}
          {marketTools.length > 0 && (
            <SectionGroup label="市场收藏的工具" count={marketTools.length} collapsible>
              {marketTools.map((t) => (
                <CheckItem
                  key={t.id}
                  type="tool"
                  name={t.display_name || t.name}
                  description={t.description}
                  statusBadge={TOOL_STATUS_BADGE[t.status ?? "published"]}
                  extraBadges={
                    t.tool_type ? (
                      <PixelBadge color={TOOL_TYPE_COLOR[t.tool_type] ?? "gray"}>
                        {TOOL_TYPE_LABEL[t.tool_type] ?? t.tool_type}
                      </PixelBadge>
                    ) : undefined
                  }
                  checked={t.mounted}
                  onToggle={(checked) => toggleToolMount(t.id, checked)}
                />
              ))}
            </SectionGroup>
          )}

          {/* ══ 底部操作栏 ══ */}
          <div className="sticky bottom-0 bg-background border-t-2 border-border px-4 py-3 -mx-4 mt-4 flex items-center gap-3">
            <PixelButton onClick={handleSave} disabled={saving || !configDirty}>
              {saving ? "保存中..." : "保存配置"}
            </PixelButton>
            {isAdmin && (
              <>
                <PixelButton
                  variant="secondary"
                  onClick={() => handlePublishWorkspace("department")}
                  disabled={publishing}
                >
                  {publishing ? "发布中..." : "发布为部门标准"}
                </PixelButton>
                {user?.role === "super_admin" && (
                  <PixelButton
                    variant="secondary"
                    onClick={() => handlePublishWorkspace("company")}
                    disabled={publishing}
                  >
                    发布为公司标准
                  </PixelButton>
                )}
              </>
            )}
            {saveMsg && (
              <span className={`text-[9px] font-bold ${saveMsg.includes("失败") || saveMsg.includes("暂不可") ? "text-red-500" : "text-[#00CC99]"}`}>
                {saveMsg}
              </span>
            )}
            <span className="ml-auto text-[8px] text-muted-foreground">
              挂载：{Array.from(mountedSkills.values()).filter((s) => s.mounted).length} Skill + {Array.from(mountedTools.values()).filter((t) => t.mounted).length} 工具
            </span>
          </div>
        </>
      )}
    </PageShell>
  );
}
