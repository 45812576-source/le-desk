import { existsSync } from "node:fs";
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
import { readTestFlowState } from "@/lib/server/test-flow-db";

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
        workflow_cards: [
          expect.objectContaining({
            id: "governance:test-flow:7:mount-blocked",
            contract_id: "governance.panel",
            kind: "validation",
            mode: "governance",
          }),
        ],
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
        workflow_cards: [
          expect.objectContaining({
            id: "validation:case-plan:90:decision",
            contract_id: "validation.test_ready",
          }),
        ],
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

    const materialized = await rememberTestFlowBackendResponse({
      method: "POST",
      pathname: "/sandbox-case-plans/120/materialize",
      backendBody: ok({ materialized_count: 3, sandbox_session_id: 501, status: "materialized" }),
      requestPayload: {
        entry_source: "sandbox_chat",
        decision_mode: "revise",
        conversation_id: 77,
      },
    });

    expect(materialized).toMatchObject({
      ok: true,
      data: {
        workflow_cards: [
          expect.objectContaining({
            id: "validation:sandbox-session:501:run",
            contract_id: "validation.test_ready",
          }),
        ],
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

    const failedReport = await rememberTestFlowBackendResponse({
      method: "GET",
      pathname: "/sandbox/interactive/501/report",
      backendBody: {
        session_id: 501,
        report_id: 9001,
        approval_eligible: false,
        summary: "Prompt 未正确拒绝越权请求",
      },
    });

    expect(failedReport).toMatchObject({
      workflow_cards: [
        expect.objectContaining({
          id: "fixing:report:9001:overview",
          contract_id: "fixing.overview",
        }),
        expect.objectContaining({
          id: "fixing:targeted-retest:9001",
          contract_id: "fixing.targeted_retest",
          source_card_id: "fixing:report:9001:overview",
        }),
      ],
    });
  });

  it("does not create local test-flow state file on passive read", async () => {
    const stateFile = process.env.TEST_FLOW_STATE_FILE!;
    expect(existsSync(stateFile)).toBe(false);

    const state = await readTestFlowState();

    expect(state.run_links_by_session_id).toEqual({});
    expect(existsSync(stateFile)).toBe(false);
  });
});
