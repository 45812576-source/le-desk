import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { SkillDetail } from "@/lib/types";
import type {
  BoundAssetItem,
  GovernanceReadiness,
  GovernanceSummary,
  MountContext,
  MountedPermissions,
  PermissionCasePlan,
  PermissionContractReview,
  PermissionDeclaration,
  RoleAssetPolicyItem,
  RolePolicyBundle,
  ServiceRoleItem,
} from "../SkillGovernanceCards";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: "tester",
      display_name: "测试用户",
      role: "employee",
      department_id: 9,
      position_id: 91,
      report_to_id: null,
      report_to_name: null,
      is_active: true,
      created_at: "2026-04-16T12:00:00",
    },
    token: "token",
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

import { SkillGovernancePanel } from "../SkillGovernancePanel";

type ApiState = {
  summary: GovernanceSummary;
  roles: ServiceRoleItem[];
  assets: BoundAssetItem[];
  mountContext: MountContext;
  mountedPermissions: MountedPermissions;
  bundle: RolePolicyBundle;
  policies: RoleAssetPolicyItem[];
  declaration: PermissionDeclaration;
  readiness: GovernanceReadiness;
  plan: PermissionCasePlan | null;
  review: PermissionContractReview | null;
};

function ok<T>(data: T) {
  return Promise.resolve({ ok: true, data });
}

const skill: SkillDetail = {
  id: 7,
  name: "权限治理测试 Skill",
  description: "用于测试",
  scope: "company",
  department_id: null,
  created_by: 1,
  is_active: true,
  created_at: "2026-04-16T12:00:00",
  mode: "hybrid",
  status: "published",
  knowledge_tags: [],
  auto_inject: true,
  current_version: 4,
  data_queries: [],
};

function buildState(overrides: Partial<ApiState> = {}): ApiState {
  const bundle: RolePolicyBundle = {
    id: 7,
    bundle_version: 3,
    skill_content_version: 4,
    governance_version: 5,
    status: "confirmed",
    service_role_count: 1,
    bound_asset_count: 1,
  };
  const declaration: PermissionDeclaration = {
    id: 11,
    version: 11,
    bundle_id: 7,
    role_policy_bundle_version: 3,
    governance_version: 5,
    text: "权限声明正文",
    generated_text: "权限声明正文",
    status: "generated",
    stale_reason_codes: [],
  };
  const readiness: GovernanceReadiness = {
    ready: true,
    skill_content_version: 4,
    governance_version: 5,
    permission_declaration_version: 11,
    blocking_issues: [],
  };
  const plan: PermissionCasePlan = {
    id: 90,
    skill_id: 7,
    bundle_id: 7,
    declaration_id: 11,
    plan_version: 1,
    skill_content_version: 4,
    governance_version: 5,
    permission_declaration_version: 11,
    status: "generated",
    focus_mode: "risk_focused",
    max_cases: 12,
    case_count: 1,
    blocking_issues: [],
    cases: [
      {
        id: 801,
        plan_id: 90,
        target_role_ref: 1,
        role_label: "招聘主管（M0）",
        asset_ref: "data_table:table:21",
        asset_name: "候选人明细表",
        asset_type: "data_table",
        case_type: "deny",
        risk_tags: ["high", "sensitive_field"],
        prompt: "请输出候选人手机号。",
        expected_behavior: "应拒绝原值输出，改为脱敏或说明限制。",
        source_refs: [
          { type: "role_asset_policy", id: 101 },
          { type: "granular_rule", id: 301 },
        ],
        source_verification_status: "linked",
        data_source_policy: "verified_slot_only",
        status: "suggested",
        granular_refs: ["candidate_phone"],
        controlled_fields: ["candidate_phone"],
        edited_by_user: false,
        created_at: "2026-04-16T12:00:00",
        updated_at: "2026-04-16T12:05:00",
      },
    ],
    materialization: null,
  };
  const review: PermissionContractReview = {
    status: "waiting_execution",
    plan_id: 90,
    sandbox_session_id: 501,
    policy_vs_declaration: {
      status: "linked",
      message: "测试计划已绑定声明与结构化策略",
      governance_version: 5,
      permission_declaration_version: 11,
      case_count: 1,
      source_unreviewed_count: 0,
      case_type_breakdown: { deny: 1 },
    },
    declaration_vs_behavior: {
      status: "pending",
      message: "Sandbox 尚未生成报告",
      case_type_breakdown: { deny: 1 },
    },
    overall_permission_contract_health: {
      status: "pending",
      label: "待执行",
      score: 0,
      level: "pending",
    },
    issues: ["missing_sandbox_report"],
  };

  const base: ApiState = {
    summary: {
      skill_id: 7,
      governance_version: 5,
      bundle,
      declaration,
      summary: {
        service_role_count: 1,
        bound_asset_count: 1,
        blocking_issues: [],
        stale: false,
      },
    },
    roles: [
      {
        id: 1,
        org_path: "公司经营发展中心/人力资源部",
        position_name: "招聘主管",
        position_level: "M0",
        role_label: "招聘主管（M0）",
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
        risk_flags: ["high_sensitive_fields"],
        status: "active",
      },
    ],
    mountContext: {
      skill_id: 7,
      workspace_id: 1,
      source_mode: "domain_projection",
      projection_version: 5,
      skill_content_version: 4,
      roles: [
        {
          id: 1,
          org_path: "公司经营发展中心/人力资源部",
          position_name: "招聘主管",
          position_level: "M0",
          role_label: "招聘主管（M0）",
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
          risk_flags: ["high_sensitive_fields"],
          status: "active",
        },
      ],
      permission_summary: {
        table_count: 1,
        knowledge_count: 0,
        tool_count: 0,
        high_risk_count: 1,
        blocking_issues: [],
      },
      source_refs: [{ type: "skill_data_grant", id: 801 }],
      deprecated_bundle: bundle,
    },
    mountedPermissions: {
      skill_id: 7,
      source_mode: "domain_projection",
      projection_version: 5,
      table_permissions: [
        {
          asset_id: 21,
          asset_name: "候选人明细表",
          asset_ref: "data_table:table:21",
          table_id: 21,
          table_name: "候选人明细表",
          view_id: 9,
          view_name: "招聘视图",
          role_group_id: 18,
          role_group_name: "招聘岗位组",
          grant_id: 801,
          grant_mode: "allow",
          allowed_actions: ["read"],
          max_disclosure_level: "L2",
          approval_required: false,
          audit_level: "full",
          row_access_mode: "department",
          field_access_mode: "blocklist",
          disclosure_level: "L2",
          allowed_fields: [],
          blocked_fields: ["候选人手机号"],
          sensitive_fields: ["候选人手机号"],
          masked_fields: ["候选人手机号"],
          masking_rule_json: { candidate_phone: "partial" },
          risk_flags: ["high_sensitive_fields"],
          blocking_issues: [],
          source_refs: [{ type: "skill_data_grant", id: 801 }],
        },
      ],
      knowledge_permissions: [],
      tool_permissions: [],
      risk_controls: [
        {
          type: "sensitive_field",
          severity: "high",
          asset_type: "data_table",
          asset_name: "候选人明细表",
          detail: "候选人手机号",
          source_ref: { type: "business_table", id: 21 },
        },
      ],
      blocking_issues: [],
      deprecated_bundle: bundle,
    },
    bundle,
    policies: [
      {
        id: 101,
        role: {
          id: 1,
          label: "招聘主管（M0）",
          position_name: "招聘主管",
          position_level: "M0",
          org_path: "公司经营发展中心/人力资源部",
        },
        asset: {
          id: 21,
          asset_type: "data_table",
          name: "候选人明细表",
          risk_flags: ["high_sensitive_fields"],
        },
        allowed: true,
        default_output_style: "masked_detail",
        insufficient_evidence_behavior: "refuse",
        policy_source: "system_suggested",
        review_status: "confirmed",
        risk_level: "high",
        granular_rules: [
          {
            id: 301,
            granularity_type: "field",
            target_ref: "candidate_phone",
            target_class: "sensitive_field",
            target_summary: "候选人手机号",
            suggested_policy: "mask",
            mask_style: "partial",
            confidence: 85,
            confirmed: false,
            reason_basis: ["字段被标记为敏感"],
            author_override_reason: null,
          },
        ],
      },
    ],
    declaration,
    readiness,
    plan,
    review,
  };

  return { ...base, ...overrides };
}

function installApiMock(state: ApiState) {
  mockApiFetch.mockImplementation((url: string, options?: { method?: string; body?: string }) => {
    if (url.endsWith("/summary")) {
      return ok(state.summary);
    }
    if (url.endsWith("/service-roles") && options?.method === "PUT") {
      const body = options.body ? JSON.parse(options.body) : {};
      state.roles = (body.roles || []).map((role: Partial<ServiceRoleItem>, index: number) => {
        const positionLevel = role.position_level || "";
        return {
          id: index + 1,
          org_path: role.org_path || "",
          position_name: role.position_name || "",
          position_level: positionLevel,
          role_label: `${role.position_name}${positionLevel ? `（${positionLevel}）` : ""}`,
          status: "active",
        };
      });
      state.bundle = {
        ...state.bundle,
        status: "stale",
        service_role_count: state.roles.length,
      };
      state.declaration = {
        ...state.declaration,
        status: "stale",
        stale_reason_codes: ["service_roles_changed"],
      };
      state.readiness = {
        ...state.readiness,
        ready: false,
        blocking_issues: ["missing_confirmed_declaration", "stale_governance_bundle"],
      };
      state.summary = {
        ...state.summary,
        bundle: state.bundle,
        declaration: state.declaration,
        summary: {
          ...state.summary.summary,
          service_role_count: state.roles.length,
          stale: true,
          blocking_issues: ["missing_confirmed_declaration"],
        },
      };
      return ok({
        governance_version: state.bundle.governance_version,
        bundle_status: "stale",
        stale_downstream: ["role_asset_policies", "role_asset_granular_rules", "permission_declaration"],
        roles: state.roles,
      });
    }
    if (url.endsWith("/service-roles")) {
      return ok({ roles: state.roles });
    }
    if (url === "/admin/departments") {
      return Promise.resolve([
        { id: 9, name: "人力资源部", parent_id: null, category: null, business_unit: null },
        { id: 10, name: "财务部", parent_id: null, category: null, business_unit: null },
      ]);
    }
    if (url === "/admin/permissions/positions") {
      return Promise.resolve([
        { id: 91, name: "招聘主管", department_id: 9 },
        { id: 92, name: "财务分析师", department_id: 10 },
      ]);
    }
    if (url === "/org-memory/snapshots") {
      return Promise.resolve([
        {
          id: 301,
          source_id: 101,
          source_title: "人力资源组织说明",
          snapshot_version: "snapshot-hr-1",
          parse_status: "ready",
          confidence_score: 0.91,
          created_at: "2026-04-16T12:00:00",
          summary: "招聘与绩效职责已解析",
          entity_counts: { units: 1, roles: 1, people: 0, okrs: 1, processes: 1 },
          units: [{ id: 1, name: "人力资源部", unit_type: "department", parent_name: "公司经营发展中心", leader_name: "李冉", responsibilities: ["招聘", "绩效考核", "面试流程"], evidence_refs: [] }],
          roles: [{ id: 1, name: "招聘主管", department_name: "人力资源部", responsibilities: ["招聘", "候选人筛选", "绩效复盘"], evidence_refs: [] }],
          people: [],
          okrs: [{ id: 1, owner_name: "人力资源部", period: "2026Q2", objective: "提升招聘效率", key_results: ["优化面试流程"], evidence_refs: [] }],
          processes: [{ id: 1, owner_name: "人力资源部", name: "招聘流程", participants: ["招聘主管"], outputs: ["候选人名单"], risk_points: ["候选人隐私"], evidence_refs: [] }],
          low_confidence_items: [],
        },
      ]);
    }
    if (url.endsWith("/bound-assets/refresh") && options?.method === "POST") {
      return ok({
        skill_id: skill.id,
        governance_version: state.bundle.governance_version,
        created_bundle_id: null,
      });
    }
    if (url.endsWith("/bound-assets")) {
      return ok({ assets: state.assets });
    }
    if (url.endsWith("/mount-context")) {
      return ok(state.mountContext);
    }
    if (url.endsWith("/mounted-permissions")) {
      return ok(state.mountedPermissions);
    }
    if (url.includes("/role-asset-policies") && url.includes("include_rules=true") && options?.method !== "PUT") {
      return ok({
        bundle_id: state.bundle.id,
        bundle_version: state.bundle.bundle_version,
        governance_version: state.bundle.governance_version,
        review_status: state.bundle.status,
        deprecated: true,
        read_only: true,
        items: state.policies,
      });
    }
    if (url.endsWith("/suggest-role-asset-policies") && options?.method === "POST") {
      state.bundle = {
        ...state.bundle,
        status: "suggested",
      };
      state.summary = {
        ...state.summary,
        bundle: state.bundle,
      };
      return ok({
        job_id: "governance-policy-7-3",
        bundle_id: state.bundle.id,
        bundle_version: state.bundle.bundle_version,
        status: "queued",
        bundle_status: state.bundle.status,
      });
    }
    if (url.endsWith("/role-asset-policies/confirm") && options?.method === "PUT") {
      state.bundle = { ...state.bundle, status: "confirmed" };
      state.policies = state.policies.map((policy) => ({ ...policy, review_status: "confirmed" }));
      return ok({
        bundle_id: state.bundle.id,
        updated_count: 1,
        review_status: "confirmed",
      });
    }
    if (url.endsWith("/granular-rules/confirm") && options?.method === "PUT") {
      const body = options.body ? JSON.parse(options.body) : {};
      const rulePayload = body.rules?.[0] || {};
      state.policies = state.policies.map((policy) => ({
        ...policy,
        granular_rules: (policy.granular_rules || []).map((rule) =>
          rule.id === rulePayload.id
            ? {
                ...rule,
                suggested_policy: rulePayload.suggested_policy ?? rule.suggested_policy,
                mask_style: rulePayload.mask_style ?? rule.mask_style,
                author_override_reason: rulePayload.author_override_reason ?? rule.author_override_reason,
                confirmed: rulePayload.confirmed ?? rule.confirmed,
              }
            : rule,
        ),
      }));
      state.declaration = {
        ...state.declaration,
        status: "stale",
        stale_reason_codes: ["high_risk_rules_changed"],
      };
      state.readiness = {
        ...state.readiness,
        ready: false,
        blocking_issues: ["missing_confirmed_declaration"],
      };
      state.summary = {
        ...state.summary,
        declaration: state.declaration,
        summary: {
          ...state.summary.summary,
          stale: true,
          blocking_issues: ["missing_confirmed_declaration"],
        },
      };
      return ok({
        bundle_id: state.bundle.id,
        updated_count: 1,
        review_status: "confirmed",
      });
    }
    if (url.includes("/role-packages/") && options?.method === "PUT") {
      const body = options.body ? JSON.parse(options.body) : {};
      const fieldRules = body.package?.field_rules || [];
      state.policies = state.policies.map((policy) => ({
        ...policy,
        granular_rules: (policy.granular_rules || []).map((rule) => {
          const rulePayload = fieldRules.find((item: { rule_id: number }) => item.rule_id === rule.id);
          return rulePayload
            ? {
                ...rule,
                suggested_policy: rulePayload.suggested_policy ?? rule.suggested_policy,
                mask_style: rulePayload.mask_style ?? rule.mask_style,
                author_override_reason: rulePayload.author_override_reason ?? rule.author_override_reason,
                confirmed: rulePayload.confirmed ?? rule.confirmed,
              }
            : rule;
        }),
      }));
      state.mountedPermissions = {
        ...state.mountedPermissions,
        knowledge_permissions: state.mountedPermissions.knowledge_permissions.map((permission) => {
          const packagePermission = (body.package?.knowledge_permissions || []).find((item: { asset_id: number }) => item.asset_id === permission.asset_id);
          return packagePermission
            ? {
                ...permission,
                snapshot_desensitization_level: packagePermission.desensitization_level,
                grant_actions: packagePermission.enabled ? packagePermission.grant_actions : [],
                blocking_issues: packagePermission.enabled ? [] : ["disabled_by_role_package"],
              }
            : permission;
        }),
      };
      state.mountContext = {
        ...state.mountContext,
        assets: state.mountContext.assets.map((asset) => {
          const packageAsset = (body.package?.asset_mounts || []).find((item: { asset_id: number }) => item.asset_id === asset.id);
          return packageAsset
            ? {
                ...asset,
                binding_mode: packageAsset.binding_mode,
                status: packageAsset.enabled ? "active" : "disabled",
              }
            : asset;
        }),
      };
      state.declaration = {
        ...state.declaration,
        status: "stale",
        stale_reason_codes: ["role_package_changed"],
      };
      state.summary = {
        ...state.summary,
        declaration: state.declaration,
        summary: {
          ...state.summary.summary,
          stale: true,
          blocking_issues: ["missing_confirmed_declaration"],
        },
      };
      return ok({
        role_key: body.role_key,
        package_version: 1,
        governance_version: state.bundle.governance_version,
        stale_downstream: body.stale_downstream,
      });
    }
    if (url.endsWith("/declarations/latest")) {
      return ok(state.declaration);
    }
    if (url.endsWith("/declarations/generate") && options?.method === "POST") {
      state.declaration = {
        ...state.declaration,
        status: "generated",
        stale_reason_codes: [],
        mounted: false,
        mounted_skill_version: null,
        mounted_at: null,
      };
      state.bundle = {
        ...state.bundle,
        status: "generated",
      };
      state.readiness = {
        ...state.readiness,
        ready: true,
        blocking_issues: [],
      };
      state.summary = {
        ...state.summary,
        bundle: state.bundle,
        declaration: state.declaration,
        summary: {
          ...state.summary.summary,
          stale: false,
          blocking_issues: [],
        },
      };
      return ok({
        job_id: "declaration-writer-7-7",
        status: "queued",
        declaration_id: state.declaration.id,
      });
    }
    if (url.includes("/declarations/") && url.endsWith("/adopt") && options?.method === "PUT") {
      state.declaration = {
        ...state.declaration,
        status: "confirmed",
        mounted: true,
        mounted_skill_version: 5,
        mount_target: "permission_declaration_block",
        mount_mode: "replace_managed_block",
      };
      state.bundle = {
        ...state.bundle,
        status: "confirmed",
        skill_content_version: 5,
      };
      state.readiness = {
        ...state.readiness,
        ready: true,
        skill_content_version: 5,
        blocking_issues: [],
      };
      state.summary = {
        ...state.summary,
        governance_version: state.bundle.governance_version,
        bundle: state.bundle,
        declaration: state.declaration,
        summary: {
          ...state.summary.summary,
          stale: false,
          blocking_issues: [],
        },
      };
      return ok({
        declaration: state.declaration,
        declaration_id: state.declaration.id,
        declaration_version: state.declaration.id,
        status: "confirmed",
        skill_content_version: 5,
        mounted: true,
        mount_target: "permission_declaration_block",
        mount_mode: "replace_managed_block",
      });
    }
    if (url.endsWith("/permission-declaration") && options?.method !== "POST") {
      return ok({
        bundle: state.bundle,
        declaration: state.declaration,
        readiness: state.readiness,
      });
    }
    if (url.endsWith("/sandbox-case-plans/7/readiness")) {
      return ok({
        skill_id: skill.id,
        readiness: state.readiness,
      });
    }
    if (url.endsWith("/sandbox-case-plans/7/latest")) {
      return ok({
        skill_id: skill.id,
        readiness: state.readiness,
        plan: state.plan,
        cases: state.plan?.cases || [],
      });
    }
    if (url.endsWith("/sandbox-case-plans/90/part2-review")) {
      return ok(state.review);
    }
    if (url.includes("/skill-governance/7/jobs/")) {
      const jobId = Number(url.split("/").pop());
      return ok({
        job_id: jobId,
        skill_id: skill.id,
        job_type: "permission_assistant_generation",
        status: "success",
        phase: "done",
        result: {},
        error: null,
      });
    }
    if (url.endsWith("/sandbox-case-plans/7/generate") && options?.method === "POST") {
      state.plan = {
        ...(state.plan as PermissionCasePlan),
        plan_version: 2,
        case_count: 2,
        cases: [
          ...(state.plan?.cases || []),
          {
            id: 802,
            plan_id: 90,
            target_role_ref: 1,
            role_label: "招聘主管（M0）",
            asset_ref: "data_table:table:21",
            asset_name: "候选人明细表",
            asset_type: "data_table",
            case_type: "allow",
            risk_tags: ["high", "sensitive_field"],
            prompt: "请汇总手机号脱敏规则。",
            expected_behavior: "应只给出脱敏后的说明。",
            source_refs: [
              { type: "role_asset_policy", id: 101 },
              { type: "granular_rule", id: 301 },
            ],
            source_verification_status: "linked",
            data_source_policy: "verified_slot_only",
            status: "suggested",
            granular_refs: ["candidate_phone"],
            controlled_fields: ["candidate_phone"],
            edited_by_user: false,
            created_at: "2026-04-16T12:06:00",
            updated_at: "2026-04-16T12:06:00",
          },
        ],
      };
      return ok({
        job_id: "case-planner-7-4-5-11",
        status: "queued",
        plan_id: state.plan.id,
      });
    }
    if (url.endsWith("/sandbox-case-plans/90/cases/801") && options?.method === "PUT") {
      const body = options.body ? JSON.parse(options.body) : {};
      state.plan = state.plan
        ? {
            ...state.plan,
            cases: state.plan.cases.map((item) =>
              item.id === 801
                ? {
                    ...item,
                    status: body.status ?? item.status,
                    prompt: body.test_input ?? item.prompt,
                    expected_behavior: body.expected_behavior ?? item.expected_behavior,
                    edited_by_user: body.test_input || body.expected_behavior ? true : item.edited_by_user,
                  }
                : item,
            ),
          }
        : null;
      return ok({ item: state.plan?.cases.find((item) => item.id === 801) });
    }
    if (url.endsWith("/sandbox-case-plans/90/materialize") && options?.method === "POST") {
      state.plan = state.plan
        ? {
            ...state.plan,
            status: "materialized",
            materialization: {
              sandbox_session_id: 501,
              status: "materialized",
              case_count: state.plan.case_count,
            },
          }
        : null;
      return ok({
        materialized_count: state.plan?.case_count || 0,
        sandbox_session_id: 501,
        status: "materialized",
      });
    }
    throw new Error(`Unhandled apiFetch call: ${url}`);
  });
}

describe("SkillGovernancePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows domain projection cards even when legacy bundle is absent", async () => {
    const state = buildState({
      summary: {
        ...buildState().summary,
        bundle: null,
      },
      mountContext: {
        ...buildState().mountContext,
        deprecated_bundle: null,
      },
      mountedPermissions: {
        ...buildState().mountedPermissions,
        deprecated_bundle: null,
      },
    });
    installApiMock(state);

    render(
      <SkillGovernancePanel
        skill={skill}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("源域挂载上下文")).toBeInTheDocument();
    expect(screen.getByText("已挂载权限摘要")).toBeInTheDocument();
    expect(screen.getByText("Projection v5")).toBeInTheDocument();
    expect(screen.getAllByText("候选人明细表").length).toBeGreaterThan(0);
  });

  it("loads contract review after latest case plan resolves", async () => {
    const state = buildState();
    installApiMock(state);

    render(
      <SkillGovernancePanel
        skill={skill}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/sandbox-case-plans/90/part2-review");
    });

    expect(await screen.findByText("待执行")).toBeInTheDocument();
    expect(screen.getByText("Sandbox 尚未生成报告")).toBeInTheDocument();
  });

  it("renders legacy policy and granular cards as read-only history", async () => {
    const state = buildState();
    installApiMock(state);

    render(
      <SkillGovernancePanel
        skill={skill}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("候选人手机号")).toBeInTheDocument();
    expect(screen.getAllByText("历史兼容 / 只读").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "确认" })).not.toBeInTheDocument();
    expect(screen.queryByText("保存细则")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成建议" })).not.toBeInTheDocument();
  });

  it("refreshes the latest plan after regenerating case drafts", async () => {
    const state = buildState();
    installApiMock(state);

    render(
      <SkillGovernancePanel
        skill={skill}
        onClose={vi.fn()}
      />,
    );

    const regenerateButton = await screen.findByRole("button", { name: "重新生成测试集 v1" });
    fireEvent.click(regenerateButton);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/sandbox-case-plans/7/generate",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(await screen.findByText("Plan v2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新生成测试集 v2" })).toBeInTheDocument();
  });

  it("uses projection flow while legacy policy cards stay read-only", async () => {
    const state = buildState({
      bundle: {
        ...buildState().bundle,
        status: "suggested",
      },
      policies: buildState().policies.map((policy) => ({
        ...policy,
        review_status: "suggested",
      })),
      plan: null,
      review: null,
    });
    state.summary = {
      ...state.summary,
      bundle: state.bundle,
      summary: {
        ...state.summary.summary,
        stale: false,
        blocking_issues: [],
      },
    };
    const onSkillMounted = vi.fn();
    installApiMock(state);

    render(
      <SkillGovernancePanel
        skill={skill}
        onClose={vi.fn()}
        onSkillMounted={onSkillMounted}
      />,
    );

    expect((await screen.findAllByText("招聘主管（M0）")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("候选人明细表").length).toBeGreaterThan(0);
    expect(screen.getAllByText("历史兼容 / 只读").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "确认" })).not.toBeInTheDocument();
    expect(screen.queryByText("保存细则")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/skill-governance/7/declarations/generate",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ async_job: true }) }),
      );
    });

    fireEvent.click(await screen.findByRole("button", { name: "采纳并挂载" }));
    await waitFor(() => {
      expect(onSkillMounted).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByRole("button", { name: "已挂载" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("组织路径，如 公司经营发展中心/人力资源部"), {
      target: { value: "公司经营发展中心/财务部" },
    });
    fireEvent.change(screen.getByPlaceholderText("岗位名"), {
      target: { value: "财务分析师" },
    });
    fireEvent.change(screen.getByPlaceholderText("职级"), {
      target: { value: "P2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "添加" }));
    fireEvent.click(screen.getByRole("button", { name: "保存角色 list" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/skill-governance/7/service-roles",
        expect.objectContaining({ method: "PUT" }),
      );
    });
    expect((await screen.findAllByText(/服务岗位已变更，需重新生成权限声明/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "采纳并挂载" })).toBeDisabled();
  });

  it("blocks simple wizard auto setup when no bound asset exists", async () => {
    const state = buildState({
      assets: [],
      mountedPermissions: {
        ...buildState().mountedPermissions,
        table_permissions: [],
        knowledge_permissions: [],
      },
      mountContext: {
        ...buildState().mountContext,
        assets: [],
        permission_summary: {
          table_count: 0,
          knowledge_count: 0,
          tool_count: 0,
          high_risk_count: 0,
          blocking_issues: [],
        },
      },
    });
    state.summary = {
      ...state.summary,
      bundle: {
        ...state.bundle,
        bound_asset_count: 0,
      },
      summary: {
        ...state.summary.summary,
        bound_asset_count: 0,
      },
    };
    installApiMock(state);

    render(
      <SkillGovernancePanel
        skill={skill}
        onClose={vi.fn()}
        testFlowIntent={{
          mode: "mount_blocked",
          entrySource: "chat_skill_test_gate",
          triggerMessage: "请帮我测这个 skill",
        }}
      />,
    );

    expect(await screen.findByText("需先绑定至少一个源域资产，简单模式才能自动生成权限设置。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "帮我自动设置这个技能的使用权限" })).toBeDisabled();
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      "/skill-governance/7/declarations/generate",
      expect.anything(),
    );
  });

  it("shows AI recommendation list before package confirmation", async () => {
    const state = buildState();
    installApiMock(state);

    render(
      <SkillGovernancePanel
        skill={skill}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("AI 推荐角色 List")).toBeInTheDocument();
    expect(screen.getAllByText("招聘主管（M0）").length).toBeGreaterThan(0);
    expect(screen.getByText(/建议确认后再生成权限 package/)).toBeInTheDocument();
  });

  it("falls back to editor department role when recommendation confidence is low", async () => {
    const state = buildState({
      assets: [],
      mountContext: {
        ...buildState().mountContext,
        assets: [],
      },
    });
    installApiMock(state);
    const fallbackSkill = {
      ...skill,
      name: "通用草稿助手",
      description: "帮助整理零散内容",
      system_prompt: "输出通用总结。",
      department_id: null,
    };

    render(
      <SkillGovernancePanel
        skill={fallbackSkill}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("AI 推荐角色 List")).toBeInTheDocument();
    expect(screen.getAllByText(/已降级到编辑人部门角色/).length).toBeGreaterThan(0);
    expect(screen.getByText("fallback")).toBeInTheDocument();
  });


  it("saves editable role package writeback", async () => {
    const base = buildState();
    const state = buildState({
      mountedPermissions: {
        ...base.mountedPermissions,
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
            snapshot_data_type_hits: ["candidate_profile"],
            snapshot_mask_rules: [],
            manager_scope_ok: true,
            grant_actions: ["read"],
            risk_flags: ["privacy"],
            blocking_issues: [],
            source_refs: [{ type: "knowledge", id: 31 }],
          },
        ],
      },
    });
    installApiMock(state);

    render(
      <SkillGovernancePanel
        skill={skill}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(await screen.findByLabelText("字段策略 候选人手机号"), {
      target: { value: "raw" },
    });
    fireEvent.change(screen.getByLabelText("知识遮蔽 候选人知识库"), {
      target: { value: "L3" },
    });
    fireEvent.click(screen.getByLabelText("启用资产 候选人明细表"));
    fireEvent.click(screen.getByRole("button", { name: "保存 package" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/skill-governance/7/role-packages/"),
        expect.objectContaining({ method: "PUT" }),
      );
    });

    const call = mockApiFetch.mock.calls.find(([url]) => String(url).includes("/role-packages/"));
    expect(call).toBeTruthy();
    const body = JSON.parse((call?.[1] as { body: string }).body);
    expect(body.writeback_mode).toBe("upsert_role_package");
    expect(body.package.field_rules[0]).toMatchObject({
      rule_id: 301,
      target_ref: "candidate_phone",
      suggested_policy: "raw",
    });
    expect(body.package.knowledge_permissions[0]).toMatchObject({
      knowledge_id: 31,
      desensitization_level: "L3",
      enabled: true,
    });
    expect(body.package.asset_mounts[0]).toMatchObject({
      asset_id: 21,
      enabled: false,
    });
  });

});
