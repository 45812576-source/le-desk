"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { apiFetch } from "@/lib/api";
import type { Department, PermissionChangeRequest } from "@/lib/types";
import type { FeatureFlags } from "./constants";

import { UserList, type UserRow } from "./components/UserList";
import { UserHeader } from "./components/UserHeader";
import { FeatureFlagsSection } from "./components/FeatureFlagsSection";
import { ModelGrantsSection } from "./components/ModelGrantsSection";
import { ApprovalCapabilitiesSection } from "./components/KnowledgePermissions";
import { CapabilityGrantsSection } from "./components/CapabilityGrantsSection";


// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelGrant {
  id: number;
  user_id: number;
  model_key: string;
  granted_at: string | null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UserPermissionsPage() {
  // User list
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDept, setFilterDept] = useState("");

  // Selected user
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  // Model grants
  const [grants, setGrants] = useState<ModelGrant[]>([]);
  const [allGrants, setAllGrants] = useState<ModelGrant[]>([]);
  const [grantLoading, setGrantLoading] = useState(false);

  // Feature flags
  const [features, setFeatures] = useState<FeatureFlags | null>(null);
  const [featuresLoading, setFeaturesLoading] = useState(false);

  // Pending permission changes
  const [pendingChanges, setPendingChanges] = useState<PermissionChangeRequest[]>([]);

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

  const fetchPendingChanges = useCallback((uid: number) => {
    apiFetch<PermissionChangeRequest[]>(`/admin/permission-changes?target_user_id=${uid}&status=pending`)
      .then(setPendingChanges)
      .catch(() => setPendingChanges([]));
  }, []);

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

    // Pending changes
    fetchPendingChanges(uid);
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
      const updated = await apiFetch<ModelGrant[]>("/admin/model-grants");
      setAllGrants(updated);
      setGrants(updated.filter((g) => g.user_id === selectedUser.id));
    } catch {
      // ignore
    } finally {
      setGrantLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <PageShell title="用户权限" icon={ICONS.users}>
      <div className="flex h-full gap-4">
        {/* ── Left: User List ─────────────────────────────────────────────── */}
        <UserList
          users={users}
          departments={departments}
          loading={loadingUsers}
          selectedId={selectedUser?.id ?? null}
          search={search}
          filterRole={filterRole}
          filterDept={filterDept}
          onSearchChange={setSearch}
          onFilterRole={setFilterRole}
          onFilterDept={setFilterDept}
          onSelect={setSelectedUser}
        />

        {/* ── Right: Permission Detail ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {!selectedUser ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              ← 从左侧选择一个用户
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <UserHeader user={selectedUser} />

              {/* ① 系统功能权限 */}
              <FeatureFlagsSection
                userId={selectedUser.id}
                features={features}
                loading={featuresLoading}
                pendingChanges={pendingChanges}
                onFeaturesChange={setFeatures}
                onPendingCreated={() => fetchPendingChanges(selectedUser.id)}
              />

              {/* ② 特殊 AI 模型授权 */}
              <ModelGrantsSection
                grants={grants}
                loading={grantLoading}
                onToggle={toggleModel}
              />

              {/* ③ 审批体系资格 */}
              <ApprovalCapabilitiesSection userId={selectedUser.id} />

              {/* ④ 资产管理资格等级 */}
              <CapabilityGrantsSection userId={selectedUser.id} />
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
