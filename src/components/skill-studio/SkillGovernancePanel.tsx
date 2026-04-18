"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, ShieldCheck, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loadOrgMemorySnapshots } from "@/lib/org-memory";
import type { Department, OrgMemorySnapshot, SkillDetail } from "@/lib/types";
import {
  BoundAssetsCard,
  buildDeclarationStaleReasons,
  CaseDraftListCard,
  CasePlanReadinessCard,
  type BoundAssetItem,
  type GovernanceReadiness,
  type GovernanceSummary,
  GovernanceStatusBadge,
  GovernanceJobProgressStrip,
  type GovernanceJobProgress,
  GranularRulesCard,
  type MountContext,
  MountContextCard,
  type MountedPermissions,
  MountedPermissionsCard,
  PermissionContractReviewCard,
  type PermissionContractReview,
  PermissionDeclarationCard,
  type PermissionCasePlan,
  type PermissionDeclaration,
  type RoleAssetPolicyItem,
  RoleAssetPolicyCard,
  type RolePolicyBundle,
  type ServiceRoleItem,
  type TestCaseDraftItem,
} from "./SkillGovernanceCards";
import { RoleRecommendationWorkbench } from "./RoleRecommendationWorkbench";
import type { PositionLite } from "./role-recommendation";
import {
  serializeRolePackageWriteback,
  type RolePackageDraft,
} from "./role-package";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
};

type LegacyPoliciesResponse = {
  bundle_id?: number;
  bundle_version: number;
  governance_version?: number;
  review_status: string;
  items: RoleAssetPolicyItem[];
  deprecated?: boolean;
  read_only?: boolean;
};

type GovernanceAsyncJob = {
  job_id: number;
  skill_id: number;
  job_type: string;
  status: "queued" | "running" | "success" | "failed" | string;
  phase?: string | null;
  result?: Record<string, unknown>;
  error?: { code?: string | null; message?: string | null; details?: Record<string, unknown> } | null;
};

function unwrap<T>(resp: ApiEnvelope<T>): T {
  if (!resp.ok) {
    throw new Error(resp.error?.message || "请求失败");
  }
  return resp.data;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function SkillGovernancePanel({
  skill,
  onClose,
  onSkillMounted,
}: {
  skill: SkillDetail;
  onClose: () => void;
  onSkillMounted?: () => Promise<void> | void;
}) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<GovernanceSummary | null>(null);
  const [roles, setRoles] = useState<ServiceRoleItem[]>([]);
  const [assets, setAssets] = useState<BoundAssetItem[]>([]);
  const [mountContext, setMountContext] = useState<MountContext | null>(null);
  const [mountedPermissions, setMountedPermissions] = useState<MountedPermissions | null>(null);
  const [bundle, setBundle] = useState<RolePolicyBundle | null>(null);
  const [policies, setPolicies] = useState<RoleAssetPolicyItem[]>([]);
  const [legacyPolicyReadOnly, setLegacyPolicyReadOnly] = useState(false);
  const [declaration, setDeclaration] = useState<PermissionDeclaration | null>(null);
  const [readiness, setReadiness] = useState<GovernanceReadiness | null>(null);
  const [casePlan, setCasePlan] = useState<PermissionCasePlan | null>(null);
  const [contractReview, setContractReview] = useState<PermissionContractReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningPolicyJob, setRunningPolicyJob] = useState(false);
  const [runningDeclarationJob, setRunningDeclarationJob] = useState(false);
  const [mountingDeclaration, setMountingDeclaration] = useState(false);
  const [runningCasePlanJob, setRunningCasePlanJob] = useState(false);
  const [materializingCases, setMaterializingCases] = useState(false);
  const [activeJob, setActiveJob] = useState<GovernanceJobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<PositionLite[]>([]);
  const [orgMemorySnapshots, setOrgMemorySnapshots] = useState<OrgMemorySnapshot[]>([]);
  const [orgMemoryFallback, setOrgMemoryFallback] = useState(false);

  const declarationStaleReasons = useMemo(
    () => buildDeclarationStaleReasons(declaration),
    [declaration],
  );
  const canGenerateDeclaration = useMemo(
    () => Boolean((mountContext?.roles?.length || roles.length) && (mountContext?.assets?.length || assets.length)),
    [assets.length, mountContext?.assets?.length, mountContext?.roles?.length, roles.length],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        summaryResp,
        rolesResp,
        assetsResp,
        mountContextResp,
        mountedPermissionsResp,
        policiesResp,
        declarationResp,
        readinessResp,
        casePlanResp,
        departmentsResp,
        positionsResp,
        orgMemoryResp,
      ] = await Promise.all([
        apiFetch<ApiEnvelope<GovernanceSummary>>(`/skill-governance/${skill.id}/summary`).then(unwrap),
        apiFetch<ApiEnvelope<{ roles: ServiceRoleItem[] }>>(`/skill-governance/${skill.id}/service-roles`).then(unwrap),
        apiFetch<ApiEnvelope<{ assets: BoundAssetItem[] }>>(`/skill-governance/${skill.id}/bound-assets`).then(unwrap),
        apiFetch<ApiEnvelope<MountContext>>(`/skill-governance/${skill.id}/mount-context`).then(unwrap),
        apiFetch<ApiEnvelope<MountedPermissions>>(`/skill-governance/${skill.id}/mounted-permissions`).then(unwrap),
        apiFetch<ApiEnvelope<LegacyPoliciesResponse>>(
          `/skill-governance/${skill.id}/role-asset-policies?include_rules=true`,
        ).then(unwrap),
        apiFetch<ApiEnvelope<PermissionDeclaration>>(
          `/skill-governance/${skill.id}/declarations/latest`,
        ).then(unwrap),
        apiFetch<ApiEnvelope<{ skill_id: number; readiness: GovernanceReadiness }>>(
          `/sandbox-case-plans/${skill.id}/readiness`,
        ).then(unwrap),
        apiFetch<ApiEnvelope<{ skill_id: number; readiness: GovernanceReadiness; plan: PermissionCasePlan | null; cases?: TestCaseDraftItem[] }>>(
          `/sandbox-case-plans/${skill.id}/latest`,
        ).then(unwrap),
        apiFetch<Department[]>("/admin/departments").catch(() => []),
        apiFetch<PositionLite[]>("/admin/permissions/positions").catch(() => []),
        loadOrgMemorySnapshots().catch(() => ({ data: [], fallback: false })),
      ]);
      setSummary(summaryResp);
      setRoles(rolesResp.roles || []);
      setAssets(assetsResp.assets || []);
      setMountContext(mountContextResp || null);
      setMountedPermissions(mountedPermissionsResp || null);
      const hasLegacyBundle = Boolean(policiesResp.bundle_id);
      setLegacyPolicyReadOnly(Boolean(policiesResp.read_only || policiesResp.deprecated || hasLegacyBundle));
      setBundle(
        summaryResp.bundle
        || (policiesResp.bundle_id
          ? {
              id: policiesResp.bundle_id,
              bundle_version: policiesResp.bundle_version,
              governance_version: policiesResp.governance_version || policiesResp.bundle_version,
              status: policiesResp.review_status,
              service_role_count: rolesResp.roles?.length || 0,
              bound_asset_count: assetsResp.assets?.length || 0,
              deprecated: policiesResp.deprecated,
              read_only: policiesResp.read_only,
            }
          : null),
      );
      setPolicies(policiesResp.items || []);
      setDeclaration(declarationResp?.id ? declarationResp : null);
      setReadiness(casePlanResp.readiness || readinessResp.readiness || null);
      setCasePlan(casePlanResp.plan ? { ...casePlanResp.plan, cases: casePlanResp.cases || casePlanResp.plan.cases || [] } : null);
      setDepartments(departmentsResp || []);
      setPositions(positionsResp || []);
      setOrgMemorySnapshots(orgMemoryResp.data || []);
      setOrgMemoryFallback(Boolean(orgMemoryResp.fallback));
      if (casePlanResp.plan?.id) {
        const reviewResp = await apiFetch<ApiEnvelope<PermissionContractReview>>(
          `/sandbox-case-plans/${casePlanResp.plan.id}/part2-review`,
        ).then(unwrap);
        setContractReview(reviewResp || null);
      } else {
        setContractReview(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "权限治理信息加载失败");
    } finally {
      setLoading(false);
    }
  }, [skill.id]);

  const refreshGovernance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch<ApiEnvelope<{ skill_id: number }>>(`/skill-governance/${skill.id}/bound-assets/refresh`, {
        method: "POST",
      }).then(unwrap);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "治理刷新失败");
      setLoading(false);
    }
  }, [load, skill.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function waitGovernanceJob(jobId: number | string, label: string) {
    const maxAttempts = 80;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const job = await apiFetch<ApiEnvelope<GovernanceAsyncJob>>(
        `/skill-governance/${skill.id}/jobs/${jobId}`,
      ).then(unwrap);
      if (job.status === "success") {
        setActiveJob({ label, status: "refreshing", jobId: String(job.job_id), detail: "后台任务完成，刷新治理视图" });
        return job;
      }
      if (job.status === "failed") {
        throw new Error(job.error?.message || "后台任务失败");
      }
      setActiveJob({
        label,
        status: "running",
        jobId: String(job.job_id),
        detail: job.phase ? `后台任务 ${job.status} · ${job.phase}` : `后台任务 ${job.status}`,
      });
      await delay(750);
    }
    throw new Error("后台任务轮询超时");
  }

  async function saveRoles(nextRoles: ServiceRoleItem[]) {
    await apiFetch<ApiEnvelope<{ roles: ServiceRoleItem[] }>>(`/skill-governance/${skill.id}/service-roles`, {
      method: "PUT",
      body: JSON.stringify({
        roles: nextRoles.map((role) => ({
          org_path: role.org_path,
          position_name: role.position_name,
          position_level: role.position_level || "",
        })),
      }),
    }).then(unwrap);
    await load();
  }

  async function saveRolePackage(draft: RolePackageDraft) {
    setError(null);
    await apiFetch<ApiEnvelope<{
      role_key: string;
      package_version?: number;
      governance_version?: number;
      stale_downstream?: string[];
    }>>(
      `/skill-governance/${skill.id}/role-packages/${encodeURIComponent(draft.role_key)}`,
      {
        method: "PUT",
        body: JSON.stringify(serializeRolePackageWriteback(draft)),
      },
    ).then(unwrap);
    await load();
  }

  async function generatePolicies() {
    setRunningPolicyJob(true);
    setError(null);
    const label = policies.length ? "重新生成岗位 × 资产策略" : "生成岗位 × 资产策略";
    setActiveJob({ label, status: "running", detail: "提交策略建议任务" });
    try {
      const resp = await apiFetch<ApiEnvelope<{ job_id: string | number; bundle_id?: number }>>(`/skill-governance/${skill.id}/suggest-role-asset-policies`, {
        method: "POST",
        body: JSON.stringify({ mode: policies.length ? "regenerate" : "initial", async_job: true }),
      }).then(unwrap);
      await waitGovernanceJob(resp.job_id, label);
      await load();
      setActiveJob({ label, status: "done", jobId: String(resp.job_id), detail: "策略建议已生成并刷新" });
    } catch (err) {
      setActiveJob({ label, status: "failed", detail: err instanceof Error ? err.message : "策略建议生成失败" });
      setError(err instanceof Error ? err.message : "策略建议生成失败");
    } finally {
      setRunningPolicyJob(false);
    }
  }

  async function confirmPolicy(policy: RoleAssetPolicyItem) {
    if (!bundle?.id) return;
    await apiFetch<ApiEnvelope<{ bundle_id: number; updated_count: number; review_status: string }>>(
      `/skill-governance/${skill.id}/role-asset-policies/confirm`,
      {
        method: "PUT",
        body: JSON.stringify({
          bundle_id: bundle.id,
          policies: [{
            id: policy.id,
            allowed: policy.allowed,
            default_output_style: policy.default_output_style,
            insufficient_evidence_behavior: policy.insufficient_evidence_behavior,
            allowed_question_types: policy.allowed_question_types || [],
            forbidden_question_types: policy.forbidden_question_types || [],
          }],
        }),
      },
    ).then(unwrap);
    await load();
  }

  async function generateDeclaration() {
    setRunningDeclarationJob(true);
    setError(null);
    const label = declaration ? "重新生成权限声明" : "生成权限声明";
    setActiveJob({ label, status: "running", detail: "提交声明生成任务" });
    try {
      const resp = await apiFetch<ApiEnvelope<{ job_id: string | number; status: string; declaration_id?: number }>>(`/skill-governance/${skill.id}/declarations/generate`, {
        method: "POST",
        body: JSON.stringify({ async_job: true }),
      }).then(unwrap);
      await waitGovernanceJob(resp.job_id, label);
      await load();
      setActiveJob({ label, status: "done", jobId: String(resp.job_id), detail: "权限声明已生成并刷新" });
    } catch (err) {
      setActiveJob({ label, status: "failed", detail: err instanceof Error ? err.message : "声明生成失败" });
      setError(err instanceof Error ? err.message : "声明生成失败");
    } finally {
      setRunningDeclarationJob(false);
    }
  }

  async function saveDeclarationText(declarationId: number, text: string) {
    await apiFetch<ApiEnvelope<{ declaration: PermissionDeclaration }>>(
      `/skill-governance/${skill.id}/permission-declaration/${declarationId}`,
      {
        method: "PUT",
        body: JSON.stringify({ text, status: "edited" }),
      },
    ).then(unwrap);
    await load();
  }

  async function mountDeclaration() {
    if (!declaration) return;
    setMountingDeclaration(true);
    setError(null);
    const label = "采纳并挂载权限声明";
    setActiveJob({ label, status: "running", detail: "写入 Skill 文本并创建版本" });
    try {
      const action = declaration.edited_text && declaration.edited_text.trim() !== declaration.generated_text.trim()
        ? "edit"
        : "confirm";
      const resp = await apiFetch<ApiEnvelope<{ declaration: PermissionDeclaration; skill_content_version: number }>>(
        `/skill-governance/${skill.id}/declarations/${declaration.id}/adopt`,
        {
          method: "PUT",
          body: JSON.stringify({
            action,
            edited_text: action === "edit" ? declaration.edited_text : null,
          }),
        },
      ).then(unwrap);
      setActiveJob({ label, status: "refreshing", jobId: `skill-version-${resp.skill_content_version}`, detail: "声明已挂载，刷新 Skill 文本" });
      await onSkillMounted?.();
      await load();
      setActiveJob({ label, status: "done", jobId: `skill-version-${resp.skill_content_version}`, detail: `已挂载到 Skill v${resp.skill_content_version}` });
    } catch (err) {
      setActiveJob({ label, status: "failed", detail: err instanceof Error ? err.message : "声明挂载失败" });
      setError(err instanceof Error ? err.message : "声明挂载失败");
    } finally {
      setMountingDeclaration(false);
    }
  }

  async function saveGranularRule(
    policyId: number,
    ruleId: number,
    payload: {
      suggested_policy?: string;
      mask_style?: string | null;
      confirmed?: boolean;
      author_override_reason?: string | null;
    },
  ) {
    if (!bundle?.id) return;
    await apiFetch<ApiEnvelope<{ bundle_id: number; updated_count: number; review_status: string }>>(
      `/skill-governance/${skill.id}/granular-rules/confirm`,
      {
        method: "PUT",
        body: JSON.stringify({
          bundle_id: bundle.id,
          rules: [{
            id: ruleId,
            suggested_policy: payload.suggested_policy,
            mask_style: payload.mask_style,
            confirmed: payload.confirmed,
            author_override_reason: payload.author_override_reason,
          }],
        }),
      },
    ).then(unwrap);
    await load();
  }

  async function generateCasePlan() {
    setRunningCasePlanJob(true);
    setError(null);
    const label = casePlan ? "重新生成权限测试集" : "生成权限测试集";
    setActiveJob({ label, status: "running", detail: "提交风险聚焦测试集生成任务" });
    try {
      const resp = await apiFetch<ApiEnvelope<{ job_id: string | number; status: string; plan_id?: number }>>(
        `/sandbox-case-plans/${skill.id}/generate`,
        {
          method: "POST",
          body: JSON.stringify({
            mode: "permission_minimal",
            risk_focus: ["overreach", "high_sensitive_field", "high_risk_chunk"],
            max_case_count: 12,
            async_job: true,
          }),
        },
      ).then(unwrap);
      await waitGovernanceJob(resp.job_id, label);
      await load();
      setActiveJob({ label, status: "done", jobId: String(resp.job_id), detail: "权限测试草案已生成并刷新" });
    } catch (err) {
      setActiveJob({ label, status: "failed", detail: err instanceof Error ? err.message : "测试集生成失败" });
      setError(err instanceof Error ? err.message : "测试集生成失败");
    } finally {
      setRunningCasePlanJob(false);
    }
  }

  async function updateCaseDraftStatus(caseId: number, status: string) {
    if (!casePlan) return;
    await apiFetch<ApiEnvelope<{ item: TestCaseDraftItem }>>(
      `/sandbox-case-plans/${casePlan.id}/cases/${caseId}`,
      {
        method: "PUT",
        body: JSON.stringify({ status }),
      },
    ).then(unwrap);
    await load();
  }

  async function saveCaseDraft(
    caseId: number,
    payload: {
      prompt?: string;
      expected_behavior?: string;
      status?: string;
    },
  ) {
    if (!casePlan) return;
    await apiFetch<ApiEnvelope<{ item: TestCaseDraftItem }>>(
      `/sandbox-case-plans/${casePlan.id}/cases/${caseId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          test_input: payload.prompt,
          expected_behavior: payload.expected_behavior,
          status: payload.status,
        }),
      },
    ).then(unwrap);
    await load();
  }

  async function materializeCasePlan() {
    if (!casePlan) return;
    setMaterializingCases(true);
    setError(null);
    const label = "Materialize 到 Sandbox";
    setActiveJob({ label, status: "running", detail: "创建 Sandbox 会话与测试用例" });
    try {
      const resp = await apiFetch<ApiEnvelope<{ materialized_count: number; sandbox_session_id: number; status: string }>>(
        `/sandbox-case-plans/${casePlan.id}/materialize`,
        {
          method: "POST",
          body: JSON.stringify({ sandbox_session_id: null }),
        },
      ).then(unwrap);
      setActiveJob({ label, status: "refreshing", jobId: `sandbox-session-${resp.sandbox_session_id}`, detail: "Sandbox 会话已创建，刷新复核状态" });
      await load();
      setActiveJob({ label, status: "done", jobId: `sandbox-session-${resp.sandbox_session_id}`, detail: `已落地到 Sandbox Session #${resp.sandbox_session_id}` });
    } catch (err) {
      setActiveJob({ label, status: "failed", detail: err instanceof Error ? err.message : "Sandbox materialize 失败" });
      setError(err instanceof Error ? err.message : "Sandbox materialize 失败");
    } finally {
      setMaterializingCases(false);
    }
  }

  return (
    <aside className="w-[420px] h-full flex flex-col bg-white">
      <div className="px-3 py-2 border-b-2 border-[#1A202C] bg-[#EBF4F7] flex items-center gap-2">
        <ShieldCheck size={13} className="text-[#00A3C4]" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#1A202C]">权限快捷挂载助手</div>
          <div className="text-[8px] text-slate-500 truncate">{skill.name}</div>
        </div>
        <GovernanceStatusBadge summary={summary} />
        <button type="button" onClick={refreshGovernance} className="text-slate-400 hover:text-[#00A3C4]" title="刷新">
          <RefreshCcw size={12} />
        </button>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" title="关闭">
          <X size={14} />
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-200 text-[9px] text-red-600 font-bold">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-3 space-y-3 bg-[#F8FBFD]">
        <GovernanceJobProgressStrip job={activeJob} />
        <RoleRecommendationWorkbench
          skill={skill}
          user={user}
          roles={roles}
          assets={assets}
          policies={policies}
          mountContext={mountContext}
          mountedPermissions={mountedPermissions}
          loading={loading}
          orgMemoryFallback={orgMemoryFallback}
          snapshots={orgMemorySnapshots}
          departments={departments}
          positions={positions}
          onSave={saveRoles}
          onSavePackage={saveRolePackage}
        />
        <BoundAssetsCard assets={assets} loading={loading} />
        <MountContextCard context={mountContext} loading={loading} />
        <MountedPermissionsCard permissions={mountedPermissions} loading={loading} />
        {(policies.length > 0 || bundle?.id) && (
          <RoleAssetPolicyCard
            bundle={bundle}
            policies={policies}
            loading={loading}
            running={runningPolicyJob}
            readOnly={legacyPolicyReadOnly}
            onGenerate={generatePolicies}
            onConfirm={confirmPolicy}
          />
        )}
        {policies.some((policy) => (policy.granular_rules || []).length > 0) && (
          <GranularRulesCard
            policies={policies}
            loading={loading}
            readOnly={legacyPolicyReadOnly}
            onSaveRule={saveGranularRule}
          />
        )}
        <PermissionDeclarationCard
          declaration={declaration}
          running={runningDeclarationJob}
          mounting={mountingDeclaration}
          staleReasons={declarationStaleReasons}
          canGenerate={canGenerateDeclaration}
          onGenerate={generateDeclaration}
          onMount={mountDeclaration}
          onSaveText={saveDeclarationText}
        />
        <CasePlanReadinessCard
          readiness={readiness}
          declaration={declaration}
          plan={casePlan}
          generating={runningCasePlanJob}
          staleReasons={declarationStaleReasons}
          onGenerate={generateCasePlan}
        />
        <CaseDraftListCard
          plan={casePlan}
          loading={loading}
          onUpdateStatus={updateCaseDraftStatus}
          onSaveDraft={saveCaseDraft}
          onMaterialize={materializeCasePlan}
          materializing={materializingCases}
        />
        <PermissionContractReviewCard
          review={contractReview}
          loading={loading}
        />
      </div>
    </aside>
  );
}
