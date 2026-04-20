import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ensureSkillGovernanceCache,
  updateSkillGovernanceState,
} from "@/lib/server/skill-governance-db";
import {
  rememberTestFlowBackendResponse,
  resolveTestFlowRequest,
} from "@/lib/server/test-flow-service";

function ok<T>(data: T) {
  return { ok: true, data };
}

describe("test-flow-service", () => {
  beforeEach(() => {
    process.env.SKILL_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), `skill-governance-${Date.now()}-${Math.random()}.json`);
    process.env.TEST_FLOW_STATE_FILE = path.join(os.tmpdir(), `test-flow-${Date.now()}-${Math.random()}.json`);
  });

  it("returns mount_blocked when intent is present but readiness is not ready", async () => {
    await updateSkillGovernanceState((state) => {
      const cache = ensureSkillGovernanceCache(state, 7);
      cache.readiness_response = {
        skill_id: 7,
        readiness: {
          ready: false,
          skill_content_version: 3,
          governance_version: 5,
          permission_declaration_version: null,
          blocking_issues: ["missing_permission_mount"],
        },
      };
      cache.latest_case_plan_response = {
        skill_id: 7,
        readiness: cache.readiness_response.readiness,
        plan: null,
        cases: [],
      };
    });

    const result = await resolveTestFlowRequest(
      "POST",
      "/test-flow/resolve-entry",
      {
        entry_source: "sandbox_chat",
        content: "@销售复盘助手 生成测试用例",
        mentioned_skill_ids: [7],
        candidate_skills: [{ id: 7, name: "销售复盘助手" }],
      },
      { backendUrl: "http://127.0.0.1:9" },
      { fallback: true },
    );

    expect(result?.body).toMatchObject({
      ok: true,
      data: {
        action: "mount_blocked",
        skill: { id: 7, name: "销售复盘助手" },
        blocking_issues: ["missing_permission_mount"],
      },
    });
  });

  it("returns choose_existing_plan when latest case plan exists", async () => {
    await updateSkillGovernanceState((state) => {
      const cache = ensureSkillGovernanceCache(state, 9);
      cache.readiness_response = {
        skill_id: 9,
        readiness: {
          ready: true,
          skill_content_version: 3,
          governance_version: 6,
          permission_declaration_version: 2,
          blocking_issues: [],
        },
      };
      cache.latest_case_plan_response = {
        skill_id: 9,
        readiness: cache.readiness_response.readiness,
        plan: {
          id: 90,
          skill_id: 9,
          bundle_id: 1,
          declaration_id: 2,
          plan_version: 4,
          skill_content_version: 3,
          governance_version: 6,
          permission_declaration_version: 2,
          status: "draft",
          focus_mode: "permission_minimal",
          max_cases: 12,
          case_count: 2,
          blocking_issues: [],
          cases: [],
          materialization: null,
        },
        cases: [],
      };
    });

    const result = await resolveTestFlowRequest(
      "POST",
      "/test-flow/resolve-entry",
      {
        entry_source: "skill_studio_chat",
        content: "@客户案例助手 生成测试用例",
        mentioned_skill_ids: [9],
        candidate_skills: [{ id: 9, name: "客户案例助手" }],
      },
      { backendUrl: "http://127.0.0.1:9" },
      { fallback: true },
    );

    expect(result?.body).toMatchObject({
      ok: true,
      data: {
        action: "choose_existing_plan",
        latest_plan: {
          id: 90,
          plan_version: 4,
          case_count: 2,
        },
      },
    });
  });

  it("records materialized session links and decorates history items", async () => {
    await updateSkillGovernanceState((state) => {
      const cache = ensureSkillGovernanceCache(state, 11);
      cache.latest_case_plan_response = {
        skill_id: 11,
        readiness: {
          ready: true,
          skill_content_version: 8,
          governance_version: 9,
          permission_declaration_version: 4,
          blocking_issues: [],
        },
        plan: {
          id: 120,
          skill_id: 11,
          bundle_id: 3,
          declaration_id: 4,
          plan_version: 5,
          skill_content_version: 8,
          governance_version: 9,
          permission_declaration_version: 4,
          status: "materialized",
          focus_mode: "permission_minimal",
          max_cases: 12,
          case_count: 3,
          blocking_issues: [],
          cases: [],
          materialization: null,
        },
        cases: [],
      };
    });

    await rememberTestFlowBackendResponse({
      method: "POST",
      pathname: "/sandbox-case-plans/120/materialize",
      backendBody: ok({ materialized_count: 3, sandbox_session_id: 501, status: "materialized" }),
      requestPayload: {
        entry_source: "sandbox_chat",
        decision_mode: "revise",
        conversation_id: 77,
      },
    });

    const decorated = await rememberTestFlowBackendResponse({
      method: "GET",
      pathname: "/sandbox/interactive/history",
      backendBody: [{
        session_id: 501,
        target_id: 11,
        target_type: "skill",
        target_name: "合同审批助手",
      }],
    });

    expect(decorated).toEqual([
      expect.objectContaining({
        session_id: 501,
        source_case_plan_id: 120,
        source_case_plan_version: 5,
        source_case_count: 3,
        test_entry_source: "sandbox_chat",
        test_decision_mode: "revise",
        source_conversation_id: 77,
      }),
    ]);
  });
});
