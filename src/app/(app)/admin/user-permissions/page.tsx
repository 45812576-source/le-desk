"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelSelect } from "@/components/pixel/PixelSelect";
import { apiFetch } from "@/lib/api";
import type { Department } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: string;
  department_id: number | null;
  department_name: string | null;
  is_active: boolean;
}

interface ModelGrant {
  id: number;
  user_id: number;
  model_key: string;
  granted_at: string | null;
}

interface FeatureFlags {
  dev_studio: boolean;
  asr: boolean;
  webapp_publish: boolean;
  batch_upload_skill: boolean;
  feishu_sync: boolean;
}

interface BusinessTableRaw {
  id: number;
  display_name: string;
  description: string | null;
  validation_rules: {
    row_scope?: string;
    row_department_ids?: number[];
  };
}

interface BusinessTable {
  id: number;
  name: string;
  description: string | null;
  row_scope: string;
  row_department_ids: number[];
}

interface SkillPolicyRow {
  id: number;
  skill_id: number;
  publish_scope: string;
  view_scope: string;
}

const RESTRICTED_MODELS = ["lemondata/gpt-5.4"];
const MODEL_LABELS: Record<string, string> = {
  "lemondata/gpt-5.4": "GPT-5.4（LemonData）",
};

const FEATURE_LABELS: Record<keyof FeatureFlags, string> = {
  dev_studio: "Dev Studio（OpenCode）",
  asr: "语音转写（ASR）",
  webapp_publish: "发布 WebApp",
  batch_upload_skill: "批量上传 Skill",
  feishu_sync: "飞书多维表格同步",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "超管",
  dept_admin: "部门管理员",
  employee: "员工",
};
const ROLE_COLORS: Record<string, "red" | "yellow" | "cyan"> = {
  super_admin: "red",
  dept_admin: "yellow",
  employee: "cyan",
};

const SCOPE_LABELS: Record<string, string> = {
  private: "私有",
  department: "部门",
  all: "全员",
};

const PUBLISH_SCOPE_LABELS: Record<string, string> = {
  self_only: "仅自己",
  same_role: "同角色",
  cross_role: "跨角色",
  org_wide: "全公司",
};

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="bg-[#EBF4F7] border-b-2 border-[#1A202C] px-4 py-2 flex items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-widest text-[#00A3C4]">{title}</span>
      {subtitle && <span className="text-[10px] text-gray-400 font-mono">{subtitle}</span>}
    </div>
  );
}

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer border-2 border-[#1A202C] transition-colors focus:outline-none ${
        checked ? "bg-[#00D1FF]" : "bg-gray-200"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-3 w-3 transform bg-[#1A202C] transition-transform mt-0.5 ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function UserPermissionsPage() {
  const router = useRouter();

  // User list
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDept, setFilterDept] = useState("");

  // Selected user
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  // Model grants for selected user
  const [grants, setGrants] = useState<ModelGrant[]>([]);
  const [allGrants, setAllGrants] = useState<ModelGrant[]>([]);
  const [grantLoading, setGrantLoading] = useState(false);

  // Feature flags for selected user
  const [features, setFeatures] = useState<FeatureFlags | null>(null);
  const [featuresLoading, setFeaturesLoading] = useState(false);

  // Business tables for selected user
  const [bizTables, setBizTables] = useState<BusinessTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);

  // Skill policies for selected user
  const [skillPolicies, setSkillPolicies] = useState<SkillPolicyRow[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);

  // ── Load user list ──────────────────────────────────────────────────────────

  const fetchUsers = useCallback(() => {
    setLoadingUsers(true);
    Promise.all([
      apiFetch<UserRow[]>("/admin/users"),
      apiFetch<Department[]>("/admin/departments"),
    ])
      .then(([u, d]) => {
        setUsers(u);
        setDepartments(d);
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Load all grants once ────────────────────────────────────────────────────

  useEffect(() => {
    apiFetch<ModelGrant[]>("/admin/model-grants")
      .then(setAllGrants)
      .catch(() => {});
  }, []);

  // ── Load per-user data when selection changes ───────────────────────────────

  useEffect(() => {
    if (!selectedUser) return;
    const uid = selectedUser.id;

    // Filter grants for this user
    setGrants(allGrants.filter((g) => g.user_id === uid));

    // Features
    setFeaturesLoading(true);
    apiFetch<{ feature_flags: FeatureFlags }>(`/admin/users/${uid}/features`)
      .then((r) => setFeatures(r.feature_flags))
      .catch(() => setFeatures(null))
      .finally(() => setFeaturesLoading(false));

    // Business tables
    setTablesLoading(true);
    apiFetch<BusinessTableRaw[]>(`/business-tables?owner_id=${uid}`)
      .then((rows) =>
        setBizTables(
          rows.map((r) => ({
            id: r.id,
            name: r.display_name,
            description: r.description,
            row_scope: r.validation_rules?.row_scope || "private",
            row_department_ids: r.validation_rules?.row_department_ids || [],
          }))
        )
      )
      .catch(() => setBizTables([]))
      .finally(() => setTablesLoading(false));

    // Skill policies
    setPoliciesLoading(true);
    apiFetch<SkillPolicyRow[]>("/admin/skill-policies")
      .then(setSkillPolicies)
      .catch(() => setSkillPolicies([]))
      .finally(() => setPoliciesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?.id, allGrants]);

  // ── Grant / Revoke model ────────────────────────────────────────────────────

  async function toggleModel(modelKey: string, currentlyGranted: boolean) {
    if (!selectedUser) return;
    setGrantLoading(true);
    try {
      if (currentlyGranted) {
        await apiFetch(
          `/admin/model-grants/${selectedUser.id}?model_key=${encodeURIComponent(modelKey)}`,
          { method: "DELETE" }
        );
      } else {
        await apiFetch(
          `/admin/model-grants/${selectedUser.id}?model_key=${encodeURIComponent(modelKey)}`,
          { method: "POST" }
        );
      }
      // Refresh all grants
      const updated = await apiFetch<ModelGrant[]>("/admin/model-grants");
      setAllGrants(updated);
      setGrants(updated.filter((g) => g.user_id === selectedUser.id));
    } catch {
      // ignore
    } finally {
      setGrantLoading(false);
    }
  }

  // ── Toggle feature flag ─────────────────────────────────────────────────────

  async function toggleFeature(key: keyof FeatureFlags, value: boolean) {
    if (!selectedUser || !features) return;
    const updated = { ...features, [key]: value };
    setFeatures(updated);
    try {
      await apiFetch(`/admin/users/${selectedUser.id}/features`, {
        method: "PUT",
        body: JSON.stringify({ feature_flags: updated }),
      });
    } catch {
      // revert
      setFeatures(features);
    }
  }

  // ── Change row_scope on a business table ───────────────────────────────────

  async function changeTableScope(tableId: number, newScope: string) {
    try {
      await apiFetch(`/business-tables/${tableId}`, {
        method: "PATCH",
        body: JSON.stringify({ row_scope: newScope }),
      });
      setBizTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, row_scope: newScope } : t))
      );
    } catch {
      // ignore
    }
  }

  // ── Filtered user list ──────────────────────────────────────────────────────

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      !search ||
      u.display_name.includes(search) ||
      u.username.includes(search);
    const matchRole = !filterRole || u.role === filterRole;
    const matchDept =
      !filterDept || String(u.department_id) === filterDept;
    return matchSearch && matchRole && matchDept;
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <PageShell title="用户权限" icon={ICONS.users}>
      <div className="flex h-full gap-4">
        {/* ── Left: User List ─────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 flex flex-col border-2 border-[#1A202C] bg-white">
          <div className="bg-[#EBF4F7] border-b-2 border-[#1A202C] p-3 flex flex-col gap-2">
            <input
              type="text"
              placeholder="搜索姓名或用户名…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-2 border-[#1A202C] px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#00D1FF] w-full"
            />
            <div className="flex gap-2">
              <PixelSelect
                pixelSize="sm"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="flex-1 text-[10px]"
              >
                <option value="">全部角色</option>
                <option value="super_admin">超管</option>
                <option value="dept_admin">部门管理员</option>
                <option value="employee">员工</option>
              </PixelSelect>
              <PixelSelect
                pixelSize="sm"
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="flex-1 text-[10px]"
              >
                <option value="">全部部门</option>
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                  </option>
                ))}
              </PixelSelect>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingUsers ? (
              <p className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse p-4">
                加载中…
              </p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-xs text-gray-400 p-4 text-center">无匹配用户</p>
            ) : (
              filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full text-left px-3 py-2.5 border-b border-[#E2E8F0] hover:bg-[#F0F9FF] transition-colors ${
                    selectedUser?.id === u.id
                      ? "bg-[#E0F7FF] border-l-4 border-l-[#00D1FF]"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold font-mono text-[#1A202C] truncate">
                      {u.display_name}
                    </span>
                    <PixelBadge color={ROLE_COLORS[u.role] || "cyan"}>
                      {ROLE_LABELS[u.role] || u.role}
                    </PixelBadge>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                    {u.username}
                    {u.department_name ? ` · ${u.department_name}` : ""}
                  </div>
                  {!u.is_active && (
                    <span className="text-[9px] text-red-500 font-bold">已停用</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right: Permission Detail ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {!selectedUser ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              ← 从左侧选择一个用户
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* User Header */}
              <div className="bg-white border-2 border-[#1A202C] p-4 flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm font-mono text-[#1A202C]">
                      {selectedUser.display_name}
                    </span>
                    <PixelBadge color={ROLE_COLORS[selectedUser.role] || "cyan"}>
                      {ROLE_LABELS[selectedUser.role] || selectedUser.role}
                    </PixelBadge>
                    {!selectedUser.is_active && (
                      <PixelBadge color="red">已停用</PixelBadge>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                    @{selectedUser.username}
                    {selectedUser.department_name
                      ? ` · ${selectedUser.department_name}`
                      : ""}
                  </div>
                </div>
                <div className="ml-auto">
                  <PixelButton
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/admin/users`)}
                  >
                    去编辑用户
                  </PixelButton>
                </div>
              </div>

              {/* ① 模型授权 */}
              <div className="bg-white border-2 border-[#1A202C]">
                <SectionHeader
                  title="① 模型授权"
                  subtitle="控制该用户可访问的受限 AI 模型"
                />
                <div className="p-4 flex flex-col gap-3">
                  {RESTRICTED_MODELS.map((modelKey) => {
                    const granted = grants.some((g) => g.model_key === modelKey);
                    return (
                      <div
                        key={modelKey}
                        className="flex items-center justify-between py-2 border-b border-[#E2E8F0] last:border-0"
                      >
                        <div>
                          <div className="text-xs font-bold font-mono text-[#1A202C]">
                            {MODEL_LABELS[modelKey] || modelKey}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">{modelKey}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-[10px] font-bold uppercase ${
                              granted ? "text-[#00A3C4]" : "text-gray-400"
                            }`}
                          >
                            {granted ? "已授权" : "未授权"}
                          </span>
                          <Toggle
                            checked={granted}
                            onChange={() => toggleModel(modelKey, granted)}
                            disabled={grantLoading}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ② 功能模块开关 */}
              <div className="bg-white border-2 border-[#1A202C]">
                <SectionHeader
                  title="② 功能模块开关"
                  subtitle="控制该用户可访问的功能模块"
                />
                <div className="p-4 flex flex-col gap-3">
                  {featuresLoading ? (
                    <p className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse">
                      加载中…
                    </p>
                  ) : !features ? (
                    <p className="text-xs text-gray-400">加载失败</p>
                  ) : (
                    (Object.keys(FEATURE_LABELS) as (keyof FeatureFlags)[]).map((key) => (
                      <div
                        key={key}
                        className="flex items-center justify-between py-2 border-b border-[#E2E8F0] last:border-0"
                      >
                        <div>
                          <div className="text-xs font-bold font-mono text-[#1A202C]">
                            {FEATURE_LABELS[key]}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">{key}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-[10px] font-bold uppercase ${
                              features[key] ? "text-[#00A3C4]" : "text-gray-400"
                            }`}
                          >
                            {features[key] ? "开启" : "关闭"}
                          </span>
                          <Toggle
                            checked={features[key]}
                            onChange={(v) => toggleFeature(key, v)}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ③ 业务表行级权限 */}
              <div className="bg-white border-2 border-[#1A202C]">
                <SectionHeader
                  title="③ 业务表行级权限"
                  subtitle="该用户创建的业务表的行可见范围"
                />
                <div className="p-4">
                  {tablesLoading ? (
                    <p className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse">
                      加载中…
                    </p>
                  ) : bizTables.length === 0 ? (
                    <p className="text-xs text-gray-400">该用户暂无业务表</p>
                  ) : (
                    <table className="w-full border-2 border-[#1A202C] text-xs font-mono">
                      <thead>
                        <tr className="bg-[#EBF4F7]">
                          <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-[#1A202C]">
                            表名
                          </th>
                          <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-[#1A202C] w-36">
                            行可见范围
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bizTables.map((t) => (
                          <tr
                            key={t.id}
                            className="border-b border-[#E2E8F0] hover:bg-[#F0F9FF]"
                          >
                            <td className="px-3 py-2">
                              <div className="font-bold text-[#1A202C]">{t.name}</div>
                              {t.description && (
                                <div className="text-[10px] text-gray-400 truncate max-w-xs">
                                  {t.description}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <PixelSelect
                                pixelSize="sm"
                                value={t.row_scope}
                                onChange={(e) => changeTableScope(t.id, e.target.value)}
                              >
                                <option value="private">私有</option>
                                <option value="department">部门</option>
                                <option value="all">全员</option>
                              </PixelSelect>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* ④ Skill 访问策略 */}
              <div className="bg-white border-2 border-[#1A202C]">
                <SectionHeader
                  title="④ Skill 访问策略"
                  subtitle="按岗位配置的 Skill 发布/查看范围（只读）"
                />
                <div className="p-4">
                  {policiesLoading ? (
                    <p className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse">
                      加载中…
                    </p>
                  ) : skillPolicies.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      暂无与该用户岗位相关的 Skill 策略，或该用户非员工角色。
                    </p>
                  ) : (
                    <table className="w-full border-2 border-[#1A202C] text-xs font-mono mb-3">
                      <thead>
                        <tr className="bg-[#EBF4F7]">
                          <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-[#1A202C]">
                            Skill
                          </th>
                          <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-[#1A202C]">
                            发布范围
                          </th>
                          <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-[#1A202C]">
                            查看范围
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {skillPolicies.map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-[#E2E8F0] hover:bg-[#F0F9FF]"
                          >
                            <td className="px-3 py-2 font-bold text-[#1A202C]">
                              Skill #{p.skill_id}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {PUBLISH_SCOPE_LABELS[p.publish_scope] || p.publish_scope}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {PUBLISH_SCOPE_LABELS[p.view_scope] || p.view_scope}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <PixelButton
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push("/admin/skill-policies")}
                  >
                    去配置 Skill 策略 →
                  </PixelButton>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
