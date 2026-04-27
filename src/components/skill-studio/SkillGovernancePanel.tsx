"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, RefreshCcw, ShieldCheck, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loadOrgMemorySnapshots } from "@/lib/org-memory";
import { useStudioStore } from "@/lib/studio-store";
import type { Department, OrgMemorySnapshot, SkillDetail } from "@/lib/types";
import type { TestFlowDecisionMode, TestFlowEntrySource, TestFlowPlanSummary, TestFlowBlockedStage, TestFlowBlockedBefore, TestFlowGateReason, TestFlowGuidedStep } from "@/lib/test-flow-types";
import { CaseGenerationGateCard } from "./CaseGenerationGateCard";
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
import { SimpleGovernanceWizard } from "./SimpleGovernanceWizard";
import type { PositionLite } from "./role-recommendation";
import {
  serializeRolePackageWriteback,
  type RolePackageDraft,
} from "./role-package";
import { normalizeWorkflowCardPayload } from "./workflow-adapter";
import { deriveGovernanceWorkflowState } from "./skill-governance-workflow-state";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
};

type WorkflowCardPayload = Record<string, unknown>;

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

function getPolicyGenerationIssue(input: {
  roleCount: number;
  assetCount: number;
}) {
  if (input.roleCount <= 0) {
    return "需先配置至少一个服务岗位。";
  }
  if (input.assetCount <= 0) {
    return "需先绑定至少一个源域资产。";
  }
  return null;
}

function getDeclarationGenerationIssue(input: {
  roleCount: number;
  assetCount: number;
  hasPolicyBundle: boolean;
}) {
  const policyIssue = getPolicyGenerationIssue(input);
  if (policyIssue) return policyIssue;
  if (!input.hasPolicyBundle) {
    return "需先生成岗位 × 资产策略，再生成权限声明。";
  }
  return null;
}

export function SkillGovernancePanel({
  skill,
  onClose,
  onSkillMounted,
  testFlowIntent,
  onMaterializedSession,
}: {
  skill: SkillDetail;
  onClose: () => void;
  onSkillMounted?: () => Promise<void> | void;
  testFlowIntent?: {
    mode: "mount_blocked" | "choose_existing_plan" | "generate_cases";
    entrySource: TestFlowEntrySource;
    conversationId?: number | null;
    triggerMessage?: string | null;
    latestPlan?: TestFlowPlanSummary | null;
    mountCta?: string | null;
    blockedStage?: TestFlowBlockedStage | null;
    blockedBefore?: TestFlowBlockedBefore | null;
    caseGenerationAllowed?: boolean;
    qualityEvaluationStarted?: boolean;
    verdictLabel?: string | null;
    verdictReason?: string | null;
    gateSummary?: string | null;
    gateReasons?: TestFlowGateReason[];
    guidedSteps?: TestFlowGuidedStep[];
    primaryAction?: string | null;
  } | null;
  onMaterializedSession?: (sessionId: number) => void;
}) {
  const { user } = useAuth();
  const addGovernanceCard = useStudioStore((s) => s.addGovernanceCard);
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
  const [testFlowDecisionMode, setTestFlowDecisionMode] = useState<TestFlowDecisionMode | null>(null);
  const [testFlowAutoHandled, setTestFlowAutoHandled] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<PositionLite[]>([]);
  const [orgMemorySnapshots, setOrgMemorySnapshots] = useState<OrgMemorySnapshot[]>([]);
  const [orgMemoryFallback, setOrgMemoryFallback] = useState(false);
  const rolesRef = useRef<ServiceRoleItem[]>([]);
  const assetsRef = useRef<BoundAssetItem[]>([]);
  const mountContextRef = useRef<MountContext | null>(null);
  const bundleRef = useRef<RolePolicyBundle | null>(null);
  const policiesRef = useRef<RoleAssetPolicyItem[]>([]);
  const [wizardMode, setWizardMode] = useState<"simple" | "advanced">(
    testFlowIntent?.mode === "mount_blocked" ? "simple" : "advanced",
  );

  const roleCount = Math.max(mountContext?.roles?.length || 0, roles.length);
  const assetCount = Math.max(mountContext?.assets?.length || 0, assets.length);
  const hasPolicyBundle = Boolean(bundle?.id || policies.length);
  const declarationStaleReasons = useMemo(
    () => buildDeclarationStaleReasons(declaration),
    [declaration],
  );
  const governanceWorkflowState = useMemo(
    () => deriveGovernanceWorkflowState({
      loading,
      error,
      roleCount,
      assetCount,
      hasPolicyBundle,
      declaration,
      readiness,
    }),
    [assetCount, declaration, error, hasPolicyBundle, loading, readiness, roleCount],
  );
  const simpleWizardBlockedReason = useMemo(
    () => governanceWorkflowState.phase === "missing_assets"
      ? "需先绑定至少一个源域资产，简单模式才能自动生成权限设置。"
      : null,
    [governanceWorkflowState],
  );
  const canGenerateDeclaration = useMemo(
    () => !getDeclarationGenerationIssue({ roleCount, assetCount, hasPolicyBundle }),
    [assetCount, hasPolicyBundle, roleCount],
  );
  const testFlowIntentKey = useMemo(
    () =>
      testFlowIntent
        ? `${skill.id}:${testFlowIntent.mode}:${testFlowIntent.latestPlan?.id ?? "none"}:${testFlowIntent.triggerMessage ?? ""}`
        : null,
    [skill.id, testFlowIntent],
  );

  useEffect(() => {
    if (testFlowIntent?.mode === "mount_blocked") {
      setWizardMode("simple");
    }
  }, [testFlowIntent?.mode]);

  useEffect(() => {
    rolesRef.current = roles;
  }, [roles]);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    mountContextRef.current = mountContext;
  }, [mountContext]);

  useEffect(() => {
    bundleRef.current = bundle;
  }, [bundle]);

  useEffect(() => {
    policiesRef.current = policies;
  }, [policies]);

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
      const nextRoles = rolesResp.roles || [];
      const nextAssets = assetsResp.assets || [];
      const nextMountContext = mountContextResp || null;
      const hasLegacyBundle = Boolean(policiesResp.bundle_id);
      const nextBundle =
        summaryResp.bundle
        || (policiesResp.bundle_id
          ? {
              id: policiesResp.bundle_id,
              bundle_version: policiesResp.bundle_version,
              governance_version: policiesResp.governance_version || policiesResp.bundle_version,
              status: policiesResp.review_status,
              service_role_count: nextRoles.length || 0,
              bound_asset_count: nextAssets.length || 0,
              deprecated: policiesResp.deprecated,
              read_only: policiesResp.read_only,
            }
          : null);
      const nextPolicies = policiesResp.items || [];
      rolesRef.current = nextRoles;
      assetsRef.current = nextAssets;
      mountContextRef.current = nextMountContext;
      bundleRef.current = nextBundle;
      policiesRef.current = nextPolicies;
      setSummary(summaryResp);
      setRoles(nextRoles);
      setAssets(nextAssets);
      setMountContext(nextMountContext);
      setMountedPermissions(mountedPermissionsResp || null);
      setLegacyPolicyReadOnly(Boolean(policiesResp.read_only || policiesResp.deprecated || hasLegacyBundle));
      setBundle(nextBundle);
      setPolicies(nextPolicies);
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

  const waitGovernanceJob = useCallback(async (jobId: number | string, label: string) => {
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
  }, [skill.id]);

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
    const resp = await apiFetch<ApiEnvelope<{
      role_key: string;
      package_version?: number;
      governance_version?: number;
      stale_downstream?: string[];
      workflow_cards?: WorkflowCardPayload[];
    }>>(
      `/skill-governance/${skill.id}/role-packages/${encodeURIComponent(draft.role_key)}`,
      {
        method: "PUT",
        body: JSON.stringify(serializeRolePackageWriteback(draft)),
      },
    );
    const saved = unwrap(resp);
    for (const card of saved.workflow_cards || []) {
      addGovernanceCard(normalizeWorkflowCardPayload(card, `governance:${skill.id}:role-package`));
    }
    await load();
  }

  async function generatePolicies() {
    const label = policies.length ? "重新生成岗位 × 资产策略" : "生成岗位 × 资产策略";
    const currentRoleCount = Math.max(mountContextRef.current?.roles?.length || 0, rolesRef.current.length);
    const currentAssetCount = Math.max(mountContextRef.current?.assets?.length || 0, assetsRef.current.length);
    const issue = getPolicyGenerationIssue({ roleCount: currentRoleCount, assetCount: currentAssetCount });
    if (issue) {
      setError(issue);
      setActiveJob({ label, status: "failed", detail: issue });
      throw new Error(issue);
    }
    setRunningPolicyJob(true);
    setError(null);
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
      throw err;
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
    const label = declaration ? "重新生成权限声明" : "生成权限声明";
    const currentRoleCount = Math.max(mountContextRef.current?.roles?.length || 0, rolesRef.current.length);
    const currentAssetCount = Math.max(mountContextRef.current?.assets?.length || 0, assetsRef.current.length);
    const currentHasPolicyBundle = Boolean(bundleRef.current?.id || policiesRef.current.length);
    const issue = getDeclarationGenerationIssue({
      roleCount: currentRoleCount,
      assetCount: currentAssetCount,
      hasPolicyBundle: currentHasPolicyBundle,
    });
    if (issue) {
      setError(issue);
      setActiveJob({ label, status: "failed", detail: issue });
      throw new Error(issue);
    }
    setRunningDeclarationJob(true);
    setError(null);
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
      throw err;
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

  const generateCasePlan = useCallback(async () => {
    if (!readiness?.ready) {
      setError("前置条件未满足，请先完成治理配置后再生成测试用例。");
      return;
    }
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
            generation_mode: testFlowDecisionMode === "regenerate" ? "regenerate" : casePlan ? "regenerate" : "generate",
            source_plan_id: casePlan?.id ?? null,
            entry_source: testFlowIntent?.entrySource || "skill_governance_panel",
            conversation_id: testFlowIntent?.conversationId ?? null,
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
  }, [casePlan, load, readiness?.ready, skill.id, testFlowDecisionMode, testFlowIntent?.conversationId, testFlowIntent?.entrySource, waitGovernanceJob]);

  useEffect(() => {
    if (!testFlowIntent) {
      setTestFlowDecisionMode(null);
      setTestFlowAutoHandled(null);
      return;
    }
    if (testFlowIntent.mode === "choose_existing_plan") {
      setTestFlowDecisionMode(null);
      return;
    }
    if (!loading && testFlowIntent.mode === "generate_cases" && readiness?.ready && testFlowIntent.caseGenerationAllowed !== false && !runningCasePlanJob && testFlowAutoHandled !== testFlowIntentKey) {
      setTestFlowDecisionMode("regenerate");
      setTestFlowAutoHandled(testFlowIntentKey);
      void generateCasePlan();
    }
  }, [generateCasePlan, loading, readiness?.ready, runningCasePlanJob, testFlowAutoHandled, testFlowIntent, testFlowIntentKey]);

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

  async function handleReviseClick() {
    if (!casePlan) return;
    setError(null);
    const label = "Fork 测试用例为新版本";
    setActiveJob({ label, status: "running", detail: "基于现有 Plan 创建可编辑副本" });
    try {
      const forkResp = await apiFetch<ApiEnvelope<{ plan_id: number; plan_version: number }>>(
        `/test-flow/sandbox-case-plans/${casePlan.id}/fork`,
        {
          method: "POST",
          body: JSON.stringify({
            mode: "revise",
            entry_source: testFlowIntent?.entrySource || "skill_governance_panel",
            conversation_id: testFlowIntent?.conversationId ?? null,
          }),
        },
      ).then(unwrap);
      setTestFlowDecisionMode("revise");
      await load();
      setActiveJob({ label, status: "done", detail: `已 Fork 到 Plan v${forkResp.plan_version}，可自由编辑` });
    } catch (err) {
      setActiveJob({ label, status: "failed", detail: err instanceof Error ? err.message : "Fork 失败" });
      setError(err instanceof Error ? err.message : "Fork 测试用例失败");
    }
  }

  async function materializeCasePlan() {
    if (!casePlan) return;
    if (testFlowIntent?.mode === "choose_existing_plan" && !testFlowDecisionMode) {
      setError("请先选择「复用 / 基于现有修改 / 重新生成」中的一种策略，再执行测试。");
      return;
    }
    setMaterializingCases(true);
    setError(null);
    const label = "Materialize 到 Sandbox";
    setActiveJob({ label, status: "running", detail: "创建 Sandbox 会话与测试用例" });
    try {
      const targetPlanId = casePlan.id;

      // confirm 后再 materialize
      await apiFetch<ApiEnvelope<{ plan_id: number; status: string }>>(
        `/test-flow/sandbox-case-plans/${targetPlanId}/confirm`,
        { method: "POST" },
      ).then(unwrap);

      const resp = await apiFetch<ApiEnvelope<{
        materialized_count: number;
        sandbox_session_id: number;
        status: string;
        workflow_cards?: WorkflowCardPayload[];
      }>>(
        `/sandbox-case-plans/${targetPlanId}/materialize`,
        {
          method: "POST",
          body: JSON.stringify({
            sandbox_session_id: null,
            entry_source: testFlowIntent?.entrySource || "skill_governance_panel",
            conversation_id: testFlowIntent?.conversationId ?? null,
            decision_mode: testFlowDecisionMode,
            trigger_message: testFlowIntent?.triggerMessage ?? null,
          }),
        },
      );
      const materialized = unwrap(resp);
      for (const card of materialized.workflow_cards || []) {
        addGovernanceCard(normalizeWorkflowCardPayload(card, `test-flow:${skill.id}:materialize`));
      }
      setActiveJob({ label, status: "refreshing", jobId: `sandbox-session-${materialized.sandbox_session_id}`, detail: "Sandbox 会话已创建，刷新复核状态" });
      await load();
      onMaterializedSession?.(materialized.sandbox_session_id);
      setActiveJob({ label, status: "done", jobId: `sandbox-session-${materialized.sandbox_session_id}`, detail: `已落地到 Sandbox Session #${materialized.sandbox_session_id}` });
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
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#1A202C]">使用权限设置</div>
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

      {testFlowIntent && !(wizardMode === "simple" && testFlowIntent.mode === "mount_blocked") && (
        <div className="px-3 py-2 border-b border-[#00A3C4]/20 bg-[#F0FAFF] space-y-2">
          <div className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4]">
            聊天触发测试流程
          </div>
          {testFlowIntent.mode === "mount_blocked" && (
            <CaseGenerationGateCard
              verdictLabel={testFlowIntent.verdictLabel}
              verdictReason={testFlowIntent.verdictReason}
              gateSummary={testFlowIntent.gateSummary}
              gateReasons={testFlowIntent.gateReasons}
              guidedSteps={testFlowIntent.guidedSteps}
              primaryAction={testFlowIntent.primaryAction}
              onAction={(action) => {
                if (action === "go_bound_assets") {
                  void refreshGovernance();
                  document.getElementById("gov-bound-assets")?.scrollIntoView({ behavior: "smooth", block: "center" });
                } else if (action === "generate_declaration") {
                  void generateDeclaration();
                  document.getElementById("gov-declaration")?.scrollIntoView({ behavior: "smooth", block: "center" });
                } else if (action === "go_readiness") {
                  document.getElementById("gov-readiness")?.scrollIntoView({ behavior: "smooth", block: "center" });
                } else if (action === "refresh_governance") {
                  void refreshGovernance();
                }
              }}
            />
          )}
          {testFlowIntent.mode === "choose_existing_plan" && (
            <>
              <div className="text-[9px] text-slate-600 leading-relaxed">
                检测到最近一版测试用例。先选择处理方式，再继续编辑或执行。
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setTestFlowDecisionMode("reuse")}
                  className={`px-2 py-1 text-[8px] font-bold border ${
                    testFlowDecisionMode === "reuse"
                      ? "border-[#00A3C4] bg-[#00A3C4] text-white"
                      : "border-[#00A3C4]/40 text-[#00A3C4] bg-white"
                  }`}
                >
                  复用
                </button>
                <button
                  type="button"
                  onClick={() => void handleReviseClick()}
                  className={`px-2 py-1 text-[8px] font-bold border ${
                    testFlowDecisionMode === "revise"
                      ? "border-[#00A3C4] bg-[#00A3C4] text-white"
                      : "border-[#00A3C4]/40 text-[#00A3C4] bg-white"
                  }`}
                >
                  基于现有修改
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTestFlowDecisionMode("regenerate");
                    void generateCasePlan();
                  }}
                  className={`px-2 py-1 text-[8px] font-bold border ${
                    testFlowDecisionMode === "regenerate"
                      ? "border-[#1A202C] bg-[#1A202C] text-white"
                      : "border-[#1A202C] text-[#1A202C] bg-white"
                  }`}
                >
                  重新生成
                </button>
              </div>
            </>
          )}
          {testFlowIntent.mode === "generate_cases" && (
            <div className="text-[9px] text-slate-600 leading-relaxed">
              已切到执行型测试流程。面板会直接产出测试用例草案，你确认后再执行测试。
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto p-3 space-y-3 bg-[#F8FBFD]">
        <GovernanceJobProgressStrip job={activeJob} />

        {wizardMode === "simple" ? (
          <>
            <SimpleGovernanceWizard
              skill={skill}
              user={user}
              roles={roles}
              assets={assets}
              policies={policies}
              mountedPermissions={mountedPermissions}
              loading={loading}
              snapshots={orgMemorySnapshots}
              departments={departments}
              positions={positions}
              onSaveRoles={saveRoles}
              onGeneratePolicies={generatePolicies}
              onGenerateDeclaration={generateDeclaration}
              onMountDeclaration={mountDeclaration}
              onSaveGranularRule={saveGranularRule}
              canAutoSetup={!simpleWizardBlockedReason}
              autoSetupBlockedReason={simpleWizardBlockedReason}
              autoStart={testFlowIntent?.mode === "mount_blocked"}
              autoStartReason={
                testFlowIntent?.mode === "mount_blocked"
                  ? "需要先完成权限设置才能启动检测，系统正在自动帮你配置"
                  : null
              }
            />
            <button
              type="button"
              onClick={() => setWizardMode("advanced")}
              className="flex items-center gap-1 text-[8px] font-bold text-slate-400 hover:text-slate-600 w-full justify-center py-2"
            >
              <ChevronRight size={10} />
              查看详细设置
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setWizardMode("simple")}
              className="flex items-center gap-1 text-[8px] font-bold text-[#00A3C4] hover:text-[#008BA6] w-full justify-center py-1"
            >
              ← 返回简单模式
            </button>
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
            <div id="gov-bound-assets">
              <BoundAssetsCard assets={assets} loading={loading} />
            </div>
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
            <div id="gov-declaration">
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
            </div>
            <div id="gov-readiness">
              <CasePlanReadinessCard
                readiness={readiness}
                declaration={declaration}
                plan={casePlan}
                generating={runningCasePlanJob}
                staleReasons={declarationStaleReasons}
                onGenerate={generateCasePlan}
              />
            </div>
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
          </>
        )}
      </div>
    </aside>
  );
}
