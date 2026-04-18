import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  resetSkillGovernancePersistentState,
} from "@/lib/server/skill-governance-db";
import {
  rememberSkillGovernanceBackendResponse,
  resolveSkillGovernanceRequest,
} from "@/lib/server/skill-governance-service";

const roleKey = "公司经营发展中心/人力资源部::招聘主管::M0";
const role = {
  org_path: "公司经营发展中心/人力资源部",
  position_name: "招聘主管",
  position_level: "M0",
  role_label: "招聘主管（M0）",
};

function ok<T>(data: T) {
  return { ok: true, data };
}

function buildFixtures() {
  const declaration = {
    id: 11,
    version: 11,
    declaration_version: 11,
    bundle_id: 1,
    role_policy_bundle_version: 1,
    governance_version: 5,
    text: "权限声明",
    generated_text: "权限声明",
    edited_text: null,
    status: "confirmed",
    stale_reason_codes: [],
    mounted_skill_version: null,
    mounted_at: null,
    mounted: false,
    mount_target: null,
    mount_mode: null,
  };

  const readiness = {
    ready: true,
    skill_content_version: 3,
    governance_version: 5,
    permission_declaration_version: 11,
    blocking_issues: [],
  };

  return {
    summary: {
      skill_id: 7,
      governance_version: 5,
      bundle: {
        id: 1,
        bundle_version: 1,
        governance_version: 5,
        status: "confirmed",
        service_role_count: 1,
        bound_asset_count: 2,
      },
      declaration,
      summary: {
        service_role_count: 1,
        bound_asset_count: 2,
        blocking_issues: [],
        stale: false,
      },
    },
    serviceRoles: {
      roles: [
        {
          id: 1,
          ...role,
          status: "active",
        },
      ],
    },
    boundAssets: {
      assets: [
        {
          id: 21,
          asset_type: "data_table",
          asset_ref_type: "table",
          asset_ref_id: 21,
          asset_name: "候选人明细表",
          binding_mode: "table_bound",
          status: "active",
          risk_flags: [],
        },
        {
          id: 31,
          asset_type: "knowledge_base",
          asset_ref_type: "knowledge_base",
          asset_ref_id: 31,
          asset_name: "候选人知识库",
          binding_mode: "knowledge_bound",
          status: "active",
          risk_flags: [],
        },
      ],
    },
    mountContext: {
      skill_id: 7,
      workspace_id: 9,
      source_mode: "governed",
      projection_version: 5,
      skill_content_version: 3,
      roles: [
        {
          id: 1,
          ...role,
          status: "active",
        },
      ],
      assets: [
        {
          id: 21,
          asset_type: "data_table",
          asset_ref_type: "table",
          asset_ref_id: 21,
          asset_name: "候选人明细表",
          binding_mode: "table_bound",
          status: "active",
        },
      ],
      permission_summary: {
        table_count: 1,
        knowledge_count: 1,
        tool_count: 0,
        high_risk_count: 0,
        blocking_issues: [],
      },
      source_refs: [],
      deprecated_bundle: null,
    },
    mountedPermissions: {
      skill_id: 7,
      source_mode: "governed",
      projection_version: 5,
      table_permissions: [
        {
          asset_id: 21,
          asset_name: "候选人明细表",
          asset_ref: "table:21",
          table_id: 21,
          table_name: "candidate_table",
          view_id: null,
          view_name: null,
          role_group_id: null,
          role_group_name: null,
          grant_id: null,
          grant_mode: null,
          allowed_actions: ["read"],
          max_disclosure_level: null,
          approval_required: false,
          audit_level: null,
          row_access_mode: null,
          field_access_mode: null,
          disclosure_level: null,
          allowed_fields: ["candidate_phone"],
          blocked_fields: [],
          sensitive_fields: ["candidate_phone"],
          masked_fields: ["candidate_phone"],
          masking_rule_json: {},
          risk_flags: [],
          blocking_issues: [],
          source_refs: [],
        },
      ],
      knowledge_permissions: [
        {
          asset_id: 31,
          asset_name: "候选人知识库",
          asset_ref: "knowledge_base:31",
          knowledge_id: 31,
          title: "候选人知识库",
          folder_id: 3,
          folder_path: "知识库/招聘",
          publish_version: 2,
          snapshot_desensitization_level: "L2",
          snapshot_data_type_hits: [],
          snapshot_mask_rules: [],
          manager_scope_ok: true,
          grant_actions: ["read"],
          risk_flags: [],
          blocking_issues: [],
          source_refs: [{ type: "knowledge", id: 31 }],
        },
      ],
      tool_permissions: [],
      risk_controls: [],
      blocking_issues: [],
      deprecated_bundle: null,
    },
    policies: {
      bundle_id: 1,
      bundle_version: 1,
      governance_version: 5,
      review_status: "confirmed",
      items: [
        {
          id: 101,
          role: {
            id: 1,
            label: role.role_label,
            position_name: role.position_name,
            position_level: role.position_level,
            org_path: role.org_path,
          },
          asset: {
            id: 21,
            asset_type: "data_table",
            name: "候选人明细表",
            risk_flags: [],
          },
          allowed: true,
          default_output_style: "table",
          insufficient_evidence_behavior: "deny",
          allowed_question_types: [],
          forbidden_question_types: [],
          policy_source: "generated",
          review_status: "confirmed",
          risk_level: "medium",
          granular_rules: [
            {
              id: 301,
              granularity_type: "field",
              target_ref: "candidate_phone",
              target_summary: "候选人手机号",
              suggested_policy: "mask",
              mask_style: "partial",
              confidence: 0.92,
              confirmed: true,
              reason_basis: [],
              author_override_reason: null,
            },
          ],
        },
      ],
      deprecated: false,
      read_only: false,
    },
    declaration,
    readinessResponse: {
      skill_id: 7,
      readiness,
    },
    latest: {
      skill_id: 7,
      readiness,
      plan: {
        id: 90,
        skill_id: 7,
        bundle_id: 1,
        declaration_id: 11,
        plan_version: 2,
        skill_content_version: 3,
        governance_version: 5,
        permission_declaration_version: 11,
        status: "generated",
        focus_mode: "balanced",
        max_cases: 20,
        case_count: 1,
        blocking_issues: [],
        cases: [],
        materialization: null,
      },
      cases: [],
    },
    review: {
      status: "healthy",
      plan_id: 90,
      sandbox_session_id: 301,
      report_id: 401,
      policy_vs_declaration: {
        status: "aligned",
      },
      declaration_vs_behavior: {
        status: "passed",
      },
      overall_permission_contract_health: {
        status: "healthy",
        label: "通过",
      },
      issues: [],
    },
  };
}

async function seedBackendCache() {
  const fixtures = buildFixtures();
  await rememberSkillGovernanceBackendResponse({ method: "GET", pathname: "/skill-governance/7/summary", backendBody: ok(fixtures.summary) });
  await rememberSkillGovernanceBackendResponse({ method: "GET", pathname: "/skill-governance/7/service-roles", backendBody: ok(fixtures.serviceRoles) });
  await rememberSkillGovernanceBackendResponse({ method: "GET", pathname: "/skill-governance/7/bound-assets", backendBody: ok(fixtures.boundAssets) });
  await rememberSkillGovernanceBackendResponse({ method: "GET", pathname: "/skill-governance/7/mount-context", backendBody: ok(fixtures.mountContext) });
  await rememberSkillGovernanceBackendResponse({ method: "GET", pathname: "/skill-governance/7/mounted-permissions", backendBody: ok(fixtures.mountedPermissions) });
  await rememberSkillGovernanceBackendResponse({ method: "GET", pathname: "/skill-governance/7/role-asset-policies", backendBody: ok(fixtures.policies) });
  await rememberSkillGovernanceBackendResponse({ method: "GET", pathname: "/skill-governance/7/declarations/latest", backendBody: ok(fixtures.declaration) });
  await rememberSkillGovernanceBackendResponse({ method: "GET", pathname: "/sandbox-case-plans/7/readiness", backendBody: ok(fixtures.readinessResponse) });
  await rememberSkillGovernanceBackendResponse({ method: "GET", pathname: "/sandbox-case-plans/7/latest", backendBody: ok(fixtures.latest) });
  await rememberSkillGovernanceBackendResponse({ method: "GET", pathname: "/sandbox-case-plans/90/part2-review", backendBody: ok(fixtures.review) });
  return fixtures;
}

describe("skill-governance-service", () => {
  beforeEach(async () => {
    process.env.SKILL_GOVERNANCE_STATE_FILE = path.join(os.tmpdir(), `skill-governance-${Date.now()}-${Math.random()}.json`);
    await resetSkillGovernancePersistentState();
  });

  it("stores local role package writeback and overlays cached governance reads", async () => {
    await seedBackendCache();

    const writeback = await resolveSkillGovernanceRequest("PUT", `/skill-governance/7/role-packages/${encodeURIComponent(roleKey)}`, {
      role_key: roleKey,
      role,
      writeback_mode: "upsert_role_package",
      stale_downstream: ["mounted_permissions", "permission_declaration", "sandbox_case_plan"],
      package: {
        field_rules: [
          {
            policy_id: 101,
            rule_id: 301,
            asset_id: 21,
            target_ref: "candidate_phone",
            suggested_policy: "raw",
            mask_style: null,
            confirmed: true,
            author_override_reason: null,
          },
        ],
        knowledge_permissions: [
          {
            asset_id: 31,
            asset_ref: "knowledge_base:31",
            knowledge_id: 31,
            desensitization_level: "L3",
            grant_actions: ["read"],
            enabled: true,
            source_refs: [{ type: "knowledge", id: 31 }],
          },
        ],
        asset_mounts: [
          {
            asset_id: 21,
            asset_ref_type: "table",
            asset_ref_id: 21,
            binding_mode: "reference_only",
            enabled: false,
          },
        ],
      },
    });

    expect(writeback?.body).toMatchObject({
      ok: true,
      data: {
        role_key: roleKey,
        governance_version: 6,
      },
    });

    const policies = await resolveSkillGovernanceRequest("GET", "/skill-governance/7/role-asset-policies");
    const mountContext = await resolveSkillGovernanceRequest("GET", "/skill-governance/7/mount-context");
    const mountedPermissions = await resolveSkillGovernanceRequest("GET", "/skill-governance/7/mounted-permissions");
    const summary = await resolveSkillGovernanceRequest("GET", "/skill-governance/7/summary");
    const declaration = await resolveSkillGovernanceRequest("GET", "/skill-governance/7/declarations/latest");
    const readiness = await resolveSkillGovernanceRequest("GET", "/sandbox-case-plans/7/readiness");
    const latest = await resolveSkillGovernanceRequest("GET", "/sandbox-case-plans/7/latest");
    const review = await resolveSkillGovernanceRequest("GET", "/sandbox-case-plans/90/part2-review");
    const packages = await resolveSkillGovernanceRequest("GET", "/skill-governance/7/role-packages");

    expect((policies?.body as { data: { items: Array<{ granular_rules: Array<{ suggested_policy: string }> }> } }).data.items[0].granular_rules[0].suggested_policy).toBe("raw");
    expect((mountContext?.body as { data: { assets: Array<{ status: string; binding_mode: string }> } }).data.assets[0]).toMatchObject({
      status: "disabled",
      binding_mode: "reference_only",
    });
    expect((mountedPermissions?.body as { data: { knowledge_permissions: Array<{ snapshot_desensitization_level: string }> } }).data.knowledge_permissions[0].snapshot_desensitization_level).toBe("L3");
    expect((summary?.body as { data: { summary: { stale: boolean } } }).data.summary.stale).toBe(true);
    expect((declaration?.body as { data: { status: string; stale_reason_codes: string[] } }).data).toMatchObject({
      status: "stale",
      stale_reason_codes: expect.arrayContaining(["role_package_changed"]),
    });
    expect((readiness?.body as { data: { readiness: { ready: boolean } } }).data.readiness.ready).toBe(false);
    expect((latest?.body as { data: { plan: { status: string } } }).data.plan.status).toBe("stale");
    expect((review?.body as { data: { issues: string[] } }).data.issues).toContain("role_package_changed");
    expect((packages?.body as { data: { items: Array<{ role_key: string }> } }).data.items[0].role_key).toBe(roleKey);
  });

  it("keeps backend returned versions when writeback succeeds upstream", async () => {
    await seedBackendCache();

    const response = await rememberSkillGovernanceBackendResponse({
      method: "PUT",
      pathname: `/skill-governance/7/role-packages/${encodeURIComponent(roleKey)}`,
      requestPayload: {
        role_key: roleKey,
        role,
        writeback_mode: "upsert_role_package",
        package: {
          field_rules: [],
          knowledge_permissions: [],
          asset_mounts: [],
        },
      },
      backendBody: ok({
        role_key: roleKey,
        package_version: 8,
        governance_version: 13,
        stale_downstream: ["mounted_permissions"],
      }),
    });

    expect(response?.body).toMatchObject({
      ok: true,
      data: {
        role_key: roleKey,
        package_version: 8,
        governance_version: 13,
      },
    });

    const packages = await resolveSkillGovernanceRequest("GET", "/skill-governance/7/role-packages");
    expect((packages?.body as { data: { items: Array<{ package_version: number; governance_version: number }> } }).data.items[0]).toMatchObject({
      package_version: 8,
      governance_version: 13,
    });
  });
});
