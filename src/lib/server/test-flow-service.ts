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
    return ok<TestFlowResolveResponse>({
      action: "mount_blocked",
      reason: "skill_mount_not_ready",
      skill,
      blocking_issues: readiness?.readiness?.blocking_issues || ["missing_permission_mount"],
      latest_plan: summarizePlan(latest?.plan || null),
    });
  }

  if (latest?.plan?.id) {
    return ok<TestFlowResolveResponse>({
      action: "choose_existing_plan",
      reason: "existing_case_plan_found",
      skill,
      latest_plan: summarizePlan(latest.plan),
    });
  }

  return ok<TestFlowResolveResponse>({
    action: "generate_cases",
    reason: "ready_without_existing_plan",
    skill,
  });
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
    return decorateWithRunLink(session, state.run_links_by_session_id[String(route.sessionId)]);
  }

  if (route.kind === "report" && typeof input.backendBody === "object" && input.backendBody !== null) {
    const report = input.backendBody as Record<string, unknown>;
    if ("source_case_plan_id" in report) {
      return input.backendBody; // 后端已装饰
    }
    const reportId = typeof report.report_id === "number" ? report.report_id : null;
    await syncObservedReportLink(route.sessionId, reportId);
    const state = await readTestFlowState();
    return decorateWithRunLink(report, state.run_links_by_session_id[String(route.sessionId)]);
  }

  return input.backendBody;
}
