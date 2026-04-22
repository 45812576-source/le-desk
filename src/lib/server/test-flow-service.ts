import type { PermissionCasePlan } from "@/components/skill-studio/SkillGovernanceCards";
import { readSkillGovernanceState, type SkillGovernanceSkillCache } from "@/lib/server/skill-governance-db";
import {
  readTestFlowState,
  saveTestFlowRunLink,
  updateTestFlowRunLink,
} from "@/lib/server/test-flow-db";
import { hasGenerateCaseIntent } from "@/lib/test-flow-client";
import type {
  TestFlowResolveRequest,
  TestFlowResolveResponse,
  TestFlowRunLink,
  TestFlowSkillCandidate,
  TestFlowGateReason,
  TestFlowGuidedStep,
  TestFlowPlanSummary,
  TestFlowWorkflowCard,
} from "@/lib/test-flow-types";

export type TestFlowApiResult = {
  body: unknown;
  status?: number;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
};

type ParsedRoute =
  | { kind: "resolve_entry" }
  | { kind: "materialize"; planId: number }
  | { kind: "history" }
  | { kind: "session"; sessionId: number }
  | { kind: "report"; sessionId: number }
  | { kind: "unknown" };

function ok<T>(data: T): TestFlowApiResult {
  return { body: { ok: true, data }, status: 200 };
}

function fail(status: number, code: string, message: string): TestFlowApiResult {
  return {
    status,
    body: {
      ok: false,
      error: { code, message },
    },
  };
}

function parseRoute(pathname: string): ParsedRoute {
  if (pathname === "/test-flow/resolve-entry") return { kind: "resolve_entry" };
  const materialize = pathname.match(/^\/sandbox-case-plans\/(\d+)\/materialize$/);
  if (materialize) return { kind: "materialize", planId: Number(materialize[1]) };
  if (pathname === "/sandbox/interactive/history") return { kind: "history" };
  const report = pathname.match(/^\/sandbox\/interactive\/(\d+)\/report$/);
  if (report) return { kind: "report", sessionId: Number(report[1]) };
  const session = pathname.match(/^\/sandbox\/interactive\/(\d+)$/);
  if (session) return { kind: "session", sessionId: Number(session[1]) };
  return { kind: "unknown" };
}

function asEnvelope(value: unknown): ApiEnvelope<unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as ApiEnvelope<unknown>;
  if (typeof candidate.ok !== "boolean") return null;
  return candidate;
}

function summarizePlan(plan: PermissionCasePlan | null) {
  if (!plan) return null;
  return {
    id: plan.id,
    skill_id: plan.skill_id,
    plan_version: plan.plan_version,
    status: plan.status,
    case_count: plan.case_count,
    focus_mode: plan.focus_mode,
    materialized_session_id: plan.materialization?.sandbox_session_id ?? null,
  };
}

function buildValidationSource(input: {
  skillId?: number | null;
  plan?: TestFlowPlanSummary | null;
  sessionId?: number | null;
  reportId?: number | null;
  entrySource?: string | null;
  decisionMode?: string | null;
  blockedStage?: string | null;
  blockedBefore?: string | null;
}): Record<string, unknown> {
  return {
    skill_id: input.skillId ?? input.plan?.skill_id ?? null,
    plan_id: input.plan?.id ?? null,
    plan_version: input.plan?.plan_version ?? null,
    case_count: input.plan?.case_count ?? null,
    session_id: input.sessionId ?? input.plan?.materialized_session_id ?? null,
    report_id: input.reportId ?? null,
    entry_source: input.entrySource ?? null,
    decision_mode: input.decisionMode ?? null,
    blocked_stage: input.blockedStage ?? null,
    blocked_before: input.blockedBefore ?? null,
  };
}

function compactCard(card: TestFlowWorkflowCard): TestFlowWorkflowCard {
  return Object.fromEntries(
    Object.entries(card).filter(([, value]) => value !== undefined),
  ) as TestFlowWorkflowCard;
}

function buildTestFlowCards(response: TestFlowResolveResponse, entrySource?: string | null): TestFlowWorkflowCard[] {
  const skillId = response.skill?.id ?? response.latest_plan?.skill_id ?? null;
  if (!skillId) return [];
  if (response.action === "mount_blocked") {
    return [
      compactCard({
        id: `governance:test-flow:${skillId}:mount-blocked`,
        contract_id: "governance.panel",
        title: "测试流被治理门禁阻断",
        summary: response.gate_summary || response.verdict_reason || "需要先补齐治理前置条件，才能生成测试用例。",
        status: "pending",
        kind: "validation",
        mode: "governance",
        phase: "validation",
        priority: 125,
        target: { type: "governance_panel", key: String(skillId) },
        validation_source: buildValidationSource({
          skillId,
          plan: response.latest_plan ?? null,
          entrySource,
          blockedStage: response.blocked_stage ?? null,
          blockedBefore: response.blocked_before ?? null,
        }),
        artifact_refs: (response.gate_reasons || []).map((reason) => `gate:${reason.code}`),
      }),
    ];
  }
  if (response.action === "choose_existing_plan" && response.latest_plan) {
    return [
      compactCard({
        id: `validation:case-plan:${response.latest_plan.id}:decision`,
        contract_id: "validation.test_ready",
        title: "存在历史测试方案待决策",
        summary: `Plan v${response.latest_plan.plan_version} · ${response.latest_plan.case_count} 个用例，可复用、修改或重新生成。`,
        status: "active",
        kind: "validation",
        mode: "governance",
        phase: "validation",
        priority: 118,
        target: { type: "governance_panel", key: String(skillId) },
        validation_source: buildValidationSource({
          skillId,
          plan: response.latest_plan,
          entrySource,
          decisionMode: "choose_existing_plan",
        }),
      }),
    ];
  }
  if (response.action === "generate_cases") {
    return [
      compactCard({
        id: `validation:case-plan:${skillId}:generate`,
        contract_id: "validation.test_ready",
        title: "生成测试用例卡",
        summary: "治理前置已满足，可以生成测试用例并创建 Sandbox Session。",
        status: "active",
        kind: "validation",
        mode: "governance",
        phase: "validation",
        priority: 116,
        target: { type: "governance_panel", key: String(skillId) },
        validation_source: buildValidationSource({
          skillId,
          entrySource,
          decisionMode: "generate_cases",
        }),
      }),
    ];
  }
  return [];
}

function withWorkflowCards<T extends TestFlowResolveResponse>(
  response: T,
  entrySource?: string | null,
): T {
  const workflowCards = buildTestFlowCards(response, entrySource);
  return workflowCards.length > 0
    ? { ...response, workflow_cards: workflowCards }
    : response;
}

function buildMaterializeCards(input: {
  skillId: number;
  plan: PermissionCasePlan;
  sessionId: number;
  entrySource?: string | null;
  decisionMode?: string | null;
}): TestFlowWorkflowCard[] {
  return [
    compactCard({
      id: `validation:sandbox-session:${input.sessionId}:run`,
      contract_id: "validation.test_ready",
      title: `Sandbox Session #${input.sessionId}`,
      summary: `已从 Plan v${input.plan.plan_version} 创建 ${input.plan.case_count} 个测试用例，下一步执行测试。`,
      status: "active",
      kind: "validation",
      mode: "report",
      phase: "validation",
      priority: 122,
      target: { type: "report", key: String(input.sessionId) },
      validation_source: buildValidationSource({
        skillId: input.skillId,
        plan: summarizePlan(input.plan),
        sessionId: input.sessionId,
        entrySource: input.entrySource,
        decisionMode: input.decisionMode,
      }),
    }),
  ];
}

function decorateEnvelopeDataWithCards(
  backendBody: unknown,
  cards: TestFlowWorkflowCard[],
): unknown {
  if (cards.length === 0) return backendBody;
  const envelope = asEnvelope(backendBody);
  if (!envelope?.ok || typeof envelope.data !== "object" || envelope.data === null) return backendBody;
  return {
    ...backendBody as Record<string, unknown>,
    data: {
      ...envelope.data as Record<string, unknown>,
      workflow_cards: cards,
    },
  };
}

function reportPassed(report: Record<string, unknown>): boolean {
  if (typeof report.approval_eligible === "boolean") return report.approval_eligible;
  if (typeof report.passed === "boolean") return report.passed;
  const status = typeof report.status === "string" ? report.status : typeof report.verdict === "string" ? report.verdict : "";
  return status === "passed" || status === "success" || status === "approved";
}

function buildReportCards(report: Record<string, unknown>, link?: TestFlowRunLink): TestFlowWorkflowCard[] {
  const reportId = typeof report.report_id === "number" ? report.report_id : link?.report_id ?? null;
  const sessionId = typeof report.session_id === "number" ? report.session_id : link?.session_id ?? null;
  const skillId = typeof report.skill_id === "number" ? report.skill_id : link?.skill_id ?? null;
  const planSummary = link
    ? {
        id: link.plan_id,
        skill_id: link.skill_id,
        plan_version: link.plan_version,
        status: "materialized",
        case_count: link.case_count,
        focus_mode: "permission_minimal",
        materialized_session_id: link.session_id,
      }
    : null;
  if (!skillId && !sessionId && !reportId) return [];
  if (reportPassed(report)) {
    return [
      compactCard({
        id: `release:test-passed:${reportId ?? sessionId ?? "latest"}`,
        contract_id: "release.test_passed",
        title: "测试通过",
        summary: "Sandbox 报告已通过，可以进入发布前复核或提交审批。",
        status: "active",
        kind: "release",
        mode: "report",
        phase: "release",
        priority: 124,
        target: { type: "report", key: reportId ? String(reportId) : sessionId ? String(sessionId) : null },
        validation_source: buildValidationSource({
          skillId,
          plan: planSummary,
          sessionId,
          reportId,
          entrySource: link?.entry_source,
          decisionMode: link?.decision_mode ?? null,
        }),
      }),
    ];
  }
  const overviewCardId = `fixing:report:${reportId ?? sessionId ?? "latest"}:overview`;
  return [
    compactCard({
      id: overviewCardId,
      contract_id: "fixing.overview",
      title: "Sandbox 失败报告解读",
      summary: typeof report.summary === "string" ? report.summary : "Sandbox 未通过，需要生成整改任务并局部重测。",
      status: "active",
      kind: "fixing",
      mode: "report",
      phase: "fixing",
      priority: 126,
      target: { type: "report", key: reportId ? String(reportId) : sessionId ? String(sessionId) : null },
      validation_source: buildValidationSource({
        skillId,
        plan: planSummary,
        sessionId,
        reportId,
        entrySource: link?.entry_source,
        decisionMode: link?.decision_mode ?? null,
      }),
    }),
    compactCard({
      id: `fixing:targeted-retest:${reportId ?? sessionId ?? "latest"}`,
      contract_id: "fixing.targeted_retest",
      title: "局部重测",
      summary: "整改完成后，针对失败报告执行局部重测。",
      status: "pending",
      kind: "fixing",
      mode: "report",
      phase: "fixing",
      priority: 112,
      target: { type: "report", key: reportId ? String(reportId) : sessionId ? String(sessionId) : null },
      source_card_id: overviewCardId,
      validation_source: buildValidationSource({
        skillId,
        plan: planSummary,
        sessionId,
        reportId,
        entrySource: link?.entry_source,
        decisionMode: link?.decision_mode ?? null,
      }),
    }),
  ];
}

function normalizeCandidates(
  mentionedSkillIds: number[] | undefined,
): number[] {
  // 只使用显式 @ 提及的 skill — 不隐式合并 selected_skill_id
  const merged = [
    ...(mentionedSkillIds || []),
  ].filter((value) => Number.isFinite(value) && value > 0);
  return Array.from(new Set(merged));
}

function candidateMap(candidates: TestFlowSkillCandidate[] | undefined) {
  return new Map((candidates || []).map((skill) => [skill.id, skill]));
}

function findSkillCacheByPlanId(
  caches: Record<string, SkillGovernanceSkillCache>,
  planId: number,
): { skillId: number; cache: SkillGovernanceSkillCache } | null {
  for (const [skillId, cache] of Object.entries(caches)) {
    if (cache.latest_case_plan_response?.plan?.id === planId) {
      return { skillId: Number(skillId), cache };
    }
  }
  return null;
}

async function loadReadinessAndPlanFromBackend(input: {
  backendUrl: string;
  authorization?: string | null;
  skillId: number;
}) {
  const headers: Record<string, string> = {};
  if (input.authorization) headers.Authorization = input.authorization;
  const [readinessResp, latestResp] = await Promise.all([
    fetch(`${input.backendUrl}/api/sandbox-case-plans/${input.skillId}/readiness`, { headers, cache: "no-store" }),
    fetch(`${input.backendUrl}/api/sandbox-case-plans/${input.skillId}/latest`, { headers, cache: "no-store" }),
  ]);
  const readinessPayload = readinessResp.ok ? asEnvelope(await readinessResp.json().catch(() => null)) : null;
  const latestPayload = latestResp.ok ? asEnvelope(await latestResp.json().catch(() => null)) : null;
  return {
    readiness: readinessPayload?.ok ? readinessPayload.data as {
      skill_id: number;
      readiness: { ready: boolean; blocking_issues?: string[] };
    } : null,
    latest: latestPayload?.ok ? latestPayload.data as { skill_id: number; plan: PermissionCasePlan | null } : null,
  };
}

const GATE_REASON_MAP: Record<string, { title: string; detail: string; severity: "critical" | "warning" | "info"; step_id: string; action: string; order: number }> = {
  missing_bound_assets: { title: "未绑定可测试数据资产", detail: "Skill 未绑定任何数据表，无法生成测试用例。请先在治理面板绑定数据资产。", severity: "critical", step_id: "bind_assets", action: "go_bound_assets", order: 1 },
  missing_confirmed_declaration: { title: "未确认权限声明", detail: "权限声明尚未生成或确认。请先生成并采纳权限声明。", severity: "critical", step_id: "confirm_declaration", action: "generate_declaration", order: 2 },
  missing_skill_data_grant: { title: "数据表授权未配置", detail: "Skill 的数据表授权尚未配置，请在治理面板补齐。", severity: "critical", step_id: "complete_table_governance", action: "go_readiness", order: 3 },
  grant_missing_view_binding: { title: "数据表视图未绑定", detail: "数据表视图尚未绑定到 Skill，请在治理面板补齐。", severity: "critical", step_id: "complete_table_governance", action: "go_readiness", order: 4 },
  missing_role_group_binding: { title: "角色组未绑定", detail: "Skill 的角色组尚未绑定，请在治理面板补齐。", severity: "critical", step_id: "complete_table_governance", action: "go_readiness", order: 5 },
  missing_table_permission_policy: { title: "表权限策略未配置", detail: "数据表的权限策略尚未配置，请在治理面板补齐。", severity: "critical", step_id: "complete_table_governance", action: "go_readiness", order: 6 },
  skill_content_version_mismatch: { title: "Skill 内容版本已变化", detail: "Skill 内容在上次治理之后发生了变化，需要刷新治理状态。", severity: "warning", step_id: "refresh_governance", action: "refresh_governance", order: 7 },
  governance_version_mismatch: { title: "治理版本已变化", detail: "治理版本与当前状态不一致，需要刷新。", severity: "warning", step_id: "refresh_governance", action: "refresh_governance", order: 8 },
  stale_governance_bundle: { title: "治理包已过期", detail: "治理包版本已过期，需要刷新治理状态。", severity: "warning", step_id: "refresh_governance", action: "refresh_governance", order: 9 },
};

const GUIDED_STEP_DEFS: Record<string, { order: number; title: string; detail: string; action: string; action_label: string }> = {
  bind_assets: { order: 1, title: "绑定数据资产", detail: "在治理面板中为 Skill 绑定需要测试的数据表。", action: "go_bound_assets", action_label: "去绑定" },
  confirm_declaration: { order: 2, title: "生成并确认权限声明", detail: "生成权限声明文本并采纳挂载到 Skill。", action: "generate_declaration", action_label: "生成声明" },
  complete_table_governance: { order: 3, title: "补齐表治理配置", detail: "完成数据表授权、视图绑定、角色组绑定、权限策略等配置。", action: "go_readiness", action_label: "去配置" },
  refresh_governance: { order: 4, title: "刷新治理状态", detail: "Skill 内容或治理版本发生变化，需要刷新以同步最新状态。", action: "refresh_governance", action_label: "刷新" },
};

function buildLocalGateDetails(issues: string[]): Omit<TestFlowResolveResponse, "action" | "reason" | "skill" | "blocking_issues" | "mount_cta" | "latest_plan"> {
  const gateReasons: TestFlowGateReason[] = issues.map((code) => {
    const info = GATE_REASON_MAP[code];
    if (!info) return { code, title: code.replace(/_/g, " "), detail: `阻断原因：${code}`, severity: "warning" as const, step_id: "unknown", action: "go_readiness" };
    return { code, title: info.title, detail: info.detail, severity: info.severity, step_id: info.step_id, action: info.action };
  }).sort((a, b) => (GATE_REASON_MAP[a.code]?.order ?? 99) - (GATE_REASON_MAP[b.code]?.order ?? 99));

  const seenStepIds = new Set(gateReasons.map((r) => r.step_id));
  const rawSteps = Object.entries(GUIDED_STEP_DEFS)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([stepId, def]) => ({
      id: stepId,
      order: def.order,
      title: def.title,
      detail: def.detail,
      isBlocked: seenStepIds.has(stepId),
      action: def.action,
      action_label: def.action_label,
    }));
  // blocked 之前为 done，第一个 blocked 高亮，之后全部 todo
  let firstBlockedSeen = false;
  const guidedSteps: TestFlowGuidedStep[] = rawSteps.map(({ isBlocked, ...step }) => {
    if (!firstBlockedSeen) {
      if (isBlocked) { firstBlockedSeen = true; return { ...step, status: "blocked" as const }; }
      return { ...step, status: "done" as const };
    }
    return { ...step, status: "todo" as const };
  });

  const reasonTitles = gateReasons.slice(0, 3).map((r) => r.title).join("、");
  return {
    blocked_stage: "case_generation_gate",
    blocked_before: "case_generation",
    case_generation_allowed: false,
    quality_evaluation_started: false,
    verdict_label: "尚未开始质量检测",
    verdict_reason: reasonTitles ? `前置条件未完成：${reasonTitles}` : "前置条件未完成",
    gate_summary: reasonTitles ? `需要先完成：${reasonTitles}` : "前置条件未满足",
    gate_reasons: gateReasons,
    guided_steps: guidedSteps,
    primary_action: gateReasons[0]?.action ?? null,
  };
}

async function resolveEntry(
  payload: TestFlowResolveRequest,
  context: { backendUrl: string; authorization?: string | null },
): Promise<TestFlowApiResult> {
  if (!hasGenerateCaseIntent(payload.content || "")) {
    return ok<TestFlowResolveResponse>({ action: "chat_default", reason: "missing_generate_case_intent" });
  }

  const matchedSkillIds = normalizeCandidates(payload.mentioned_skill_ids);
  const candidates = candidateMap(payload.candidate_skills);
  if (matchedSkillIds.length === 0) {
    return ok<TestFlowResolveResponse>({ action: "chat_default", reason: "missing_skill_target" });
  }
  if (matchedSkillIds.length > 1) {
    return ok<TestFlowResolveResponse>({
      action: "pick_skill",
      reason: "multiple_skill_targets",
      candidates: matchedSkillIds.map((skillId) => candidates.get(skillId) || { id: skillId, name: `Skill #${skillId}` }),
    });
  }

  const skillId = matchedSkillIds[0];
  const state = await readSkillGovernanceState();
  const cache = state.skills[String(skillId)] || null;
  let readiness: { skill_id: number; readiness: { ready: boolean; blocking_issues?: string[] } } | null = cache?.readiness_response?.readiness
    ? {
        skill_id: skillId,
        readiness: {
          ready: cache.readiness_response.readiness.ready,
          blocking_issues: cache.readiness_response.readiness.blocking_issues,
        },
      }
    : null;
  let latest = cache?.latest_case_plan_response
    ? {
        skill_id: skillId,
        plan: cache.latest_case_plan_response.plan,
      }
    : null;

  if (!readiness || !latest) {
    const backendData = await loadReadinessAndPlanFromBackend({
      backendUrl: context.backendUrl,
      authorization: context.authorization,
      skillId,
    }).catch(() => ({ readiness: null, latest: null }));
    readiness = readiness || backendData.readiness;
    latest = latest || backendData.latest;
  }

  const skill = candidates.get(skillId) || { id: skillId, name: `Skill #${skillId}` };
  if (!readiness?.readiness?.ready) {
    const issues = readiness?.readiness?.blocking_issues || ["missing_permission_mount"];
    const gateDetails = buildLocalGateDetails(issues);
    return ok<TestFlowResolveResponse>(withWorkflowCards({
      action: "mount_blocked",
      reason: "case_generation_gate_blocked",
      skill,
      blocking_issues: issues,
      latest_plan: summarizePlan(latest?.plan || null),
      ...gateDetails,
    }, payload.entry_source));
  }

  if (latest?.plan?.id) {
    return ok<TestFlowResolveResponse>(withWorkflowCards({
      action: "choose_existing_plan",
      reason: "existing_case_plan_found",
      skill,
      latest_plan: summarizePlan(latest.plan),
    }, payload.entry_source));
  }

  return ok<TestFlowResolveResponse>(withWorkflowCards({
    action: "generate_cases",
    reason: "ready_without_existing_plan",
    skill,
  }, payload.entry_source));
}

function decorateWithRunLink(value: Record<string, unknown>, link: TestFlowRunLink | undefined) {
  if (!link) return value;
  return {
    ...value,
    source_case_plan_id: link.plan_id,
    source_case_plan_version: link.plan_version,
    source_case_count: link.case_count,
    test_entry_source: link.entry_source,
    test_decision_mode: link.decision_mode ?? null,
    source_conversation_id: link.conversation_id ?? null,
  };
}

async function decorateHistoryItems(items: unknown[]) {
  const state = await readTestFlowState();
  return items.map((item) => {
    if (typeof item !== "object" || item === null) return item;
    const candidate = item as Record<string, unknown>;
    const sessionId = typeof candidate.session_id === "number" ? candidate.session_id : null;
    if (!sessionId) return candidate;
    return decorateWithRunLink(candidate, state.run_links_by_session_id[String(sessionId)]);
  });
}

async function syncObservedReportLink(sessionId: number, reportId: number | null | undefined) {
  if (!reportId) return;
  await updateTestFlowRunLink(sessionId, { report_id: reportId });
}

export function isTestFlowManagedPath(pathname: string) {
  return parseRoute(pathname).kind !== "unknown";
}

export async function resolveTestFlowRequest(
  method: string,
  pathname: string,
  payload: Record<string, unknown> = {},
  context: { backendUrl: string; authorization?: string | null },
  options?: { fallback?: boolean },
): Promise<TestFlowApiResult | null> {
  const route = parseRoute(pathname);
  if (route.kind !== "resolve_entry") return null;
  // 正常请求返回 null 让 proxy 透传到后端；仅 fallback 场景走本地
  if (!options?.fallback) return null;
  if (method.toUpperCase() !== "POST") return fail(405, "method_not_allowed", "仅支持 POST");
  return resolveEntry(payload as unknown as TestFlowResolveRequest, context);
}

export async function rememberTestFlowBackendResponse(input: {
  method: string;
  pathname: string;
  backendBody: unknown;
  requestPayload?: Record<string, unknown>;
}): Promise<unknown> {
  const route = parseRoute(input.pathname);
  const envelope = asEnvelope(input.backendBody);

  // materialize: 后端已创建 run link，仅作后端不可用时的 fallback 保存
  if (route.kind === "materialize" && input.method.toUpperCase() === "POST" && envelope?.ok) {
    const state = await readSkillGovernanceState();
    const matched = findSkillCacheByPlanId(state.skills, route.planId);
    const materializeData = envelope.data as { sandbox_session_id?: number; status?: string } | undefined;
    const sessionId = typeof materializeData?.sandbox_session_id === "number" ? materializeData.sandbox_session_id : null;
    const plan = matched?.cache.latest_case_plan_response?.plan || null;
    if (matched && sessionId && plan) {
      await saveTestFlowRunLink({
        session_id: sessionId,
        report_id: null,
        skill_id: matched.skillId,
        plan_id: plan.id,
        plan_version: plan.plan_version,
        case_count: plan.case_count,
        entry_source: (input.requestPayload?.entry_source as TestFlowRunLink["entry_source"]) || "skill_governance_panel",
        decision_mode: (input.requestPayload?.decision_mode as TestFlowRunLink["decision_mode"]) || null,
        conversation_id: typeof input.requestPayload?.conversation_id === "number" ? input.requestPayload.conversation_id : null,
        created_at: new Date().toISOString(),
      });
      return decorateEnvelopeDataWithCards(input.backendBody, buildMaterializeCards({
        skillId: matched.skillId,
        plan,
        sessionId,
        entrySource: (input.requestPayload?.entry_source as string) || "skill_governance_panel",
        decisionMode: (input.requestPayload?.decision_mode as string) || null,
      }));
    }
  }

  // 后端 history/session/report 已包含 source_case_plan_id 时跳过本地装饰
  if (route.kind === "history" && Array.isArray(input.backendBody)) {
    const firstItem = input.backendBody[0] as Record<string, unknown> | undefined;
    if (firstItem && "source_case_plan_id" in firstItem) {
      return input.backendBody; // 后端已装饰
    }
    return decorateHistoryItems(input.backendBody);
  }

  if (route.kind === "session" && typeof input.backendBody === "object" && input.backendBody !== null) {
    const session = input.backendBody as Record<string, unknown>;
    if ("source_case_plan_id" in session) {
      return input.backendBody; // 后端已装饰
    }
    const reportId = typeof session.report_id === "number" ? session.report_id : null;
    await syncObservedReportLink(route.sessionId, reportId);
    const state = await readTestFlowState();
    const link = state.run_links_by_session_id[String(route.sessionId)];
    const decorated = decorateWithRunLink(session, link);
    return {
      ...decorated,
      workflow_cards: link
        ? buildMaterializeCards({
            skillId: link.skill_id,
            plan: {
              id: link.plan_id,
              skill_id: link.skill_id,
              bundle_id: 0,
              declaration_id: 0,
              plan_version: link.plan_version,
              skill_content_version: 0,
              governance_version: 0,
              permission_declaration_version: null,
              status: "materialized",
              focus_mode: "permission_minimal",
              max_cases: link.case_count,
              case_count: link.case_count,
              blocking_issues: [],
              cases: [],
              materialization: {
                sandbox_session_id: link.session_id,
                status: "materialized",
                case_count: link.case_count,
                created_at: link.created_at,
              },
            } as PermissionCasePlan,
            sessionId: link.session_id,
            entrySource: link.entry_source,
            decisionMode: link.decision_mode ?? null,
          })
        : [],
    };
  }

  if (route.kind === "report" && typeof input.backendBody === "object" && input.backendBody !== null) {
    const report = input.backendBody as Record<string, unknown>;
    if ("source_case_plan_id" in report) {
      return input.backendBody; // 后端已装饰
    }
    const reportId = typeof report.report_id === "number" ? report.report_id : null;
    await syncObservedReportLink(route.sessionId, reportId);
    const state = await readTestFlowState();
    const link = state.run_links_by_session_id[String(route.sessionId)];
    const decorated = decorateWithRunLink(report, link);
    return {
      ...decorated,
      workflow_cards: buildReportCards(decorated, link),
    };
  }

  return input.backendBody;
}
