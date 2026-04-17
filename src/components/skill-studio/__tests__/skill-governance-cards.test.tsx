import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  buildDeclarationStaleReasons,
  CasePlanReadinessCard,
  CaseDraftListCard,
  GovernanceJobProgressStrip,
  GranularRulesCard,
  MountContextCard,
  MountedPermissionsCard,
  type MountContext,
  type MountedPermissions,
  PermissionContractReviewCard,
  PermissionDeclarationCard,
  type PermissionDeclaration,
  type PermissionCasePlan,
  type PermissionContractReview,
  RoleAssetPolicyCard,
  type RoleAssetPolicyItem,
  type RolePolicyBundle,
} from "../SkillGovernanceCards";

const baseBundle: RolePolicyBundle = {
  id: 7,
  bundle_version: 3,
  governance_version: 5,
  status: "confirmed",
  service_role_count: 1,
  bound_asset_count: 1,
};

const baseDeclaration: PermissionDeclaration = {
  id: 11,
  version: 11,
  bundle_id: 7,
  role_policy_bundle_version: 3,
  governance_version: 5,
  text: "权限声明正文",
  generated_text: "权限声明正文",
  status: "stale",
  stale_reason_codes: ["high_risk_rules_changed"],
};

const basePolicies: RoleAssetPolicyItem[] = [
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
    review_status: "edited",
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
        confidence: 72,
        confirmed: false,
        reason_basis: ["涉及个人联系方式"],
        author_override_reason: null,
      },
    ],
  },
];

const diffPolicies: RoleAssetPolicyItem[] = [
  {
    ...basePolicies[0],
  },
  {
    ...basePolicies[0],
    id: 102,
    role: {
      id: 2,
      label: "招聘专员（P1）",
      position_name: "招聘专员",
      position_level: "P1",
      org_path: "公司经营发展中心/人力资源部",
    },
    default_output_style: "aggregate",
    review_status: "suggested",
    granular_rules: [
      {
        id: 302,
        granularity_type: "field",
        target_ref: "candidate_phone",
        target_class: "sensitive_field",
        target_summary: "候选人手机号",
        suggested_policy: "deny",
        mask_style: null,
        confidence: 95,
        confirmed: false,
        reason_basis: ["专员不可查看联系方式"],
        author_override_reason: null,
      },
    ],
  },
];

const basePlan: PermissionCasePlan = {
  id: 90,
  skill_id: 7,
  plan_version: 2,
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

const contractReview: PermissionContractReview = {
  status: "reviewed",
  plan_id: 90,
  sandbox_session_id: 501,
  report_id: 701,
  policy_vs_declaration: {
    status: "linked",
    message: "声明、策略 bundle 与测试计划版本已绑定",
    governance_version: 5,
    permission_declaration_version: 11,
    case_count: 1,
    source_unreviewed_count: 0,
    case_type_breakdown: { deny: 1 },
  },
  declaration_vs_behavior: {
    status: "failed",
    passed: 0,
    failed: 1,
    error: 0,
    skipped: 0,
    executed_case_count: 1,
    failed_case_count: 1,
    pending_case_count: 0,
    case_type_breakdown: { deny: 1 },
    issue_type_breakdown: { behavior_overrun: 1 },
  },
  overall_permission_contract_health: {
    status: "needs_fix",
    label: "需修复",
    score: 75,
    level: "warning",
  },
  issues: ["permission_behavior_mismatch"],
  case_drilldown: [
    {
      case_draft_id: 801,
      target_role_ref: 1,
      sandbox_case_id: 901,
      case_index: 1,
      layer: "declaration_vs_behavior",
      issue_type: "behavior_overrun",
      role_label: "招聘主管（M0）",
      asset_ref: "data_table:table:21",
      asset_name: "候选人明细表",
      asset_type: "data_table",
      case_type: "deny",
      draft_status: "adopted",
      prompt: "请输出候选人手机号。",
      expected_behavior: "应拒绝原值输出，改为脱敏或说明限制。",
      granular_refs: ["candidate_phone"],
      controlled_fields: ["candidate_phone"],
      source_refs: [{ type: "granular_rule", id: 301 }],
      source_verification_status: "linked",
      data_source_policy: "verified_slot_only",
      sandbox_verdict: "failed",
      verdict_detail: { main_issue: "输出了受控字段" },
      llm_response_preview: "候选人手机号是 13800000000",
    },
  ],
};

const mountContext: MountContext = {
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
    knowledge_count: 1,
    tool_count: 1,
    high_risk_count: 2,
    blocking_issues: [],
  },
  source_refs: [{ type: "skill_data_grant", id: 801 }],
  deprecated_bundle: baseBundle,
};

const mountedPermissions: MountedPermissions = {
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
  knowledge_permissions: [
    {
      asset_id: 31,
      asset_name: "招聘话术库",
      asset_ref: "knowledge_base:knowledge:31",
      knowledge_id: 31,
      title: "招聘话术库",
      folder_id: 4,
      folder_path: "招聘知识库/话术",
      publish_version: 2,
      snapshot_desensitization_level: "L2",
      snapshot_data_type_hits: ["phone"],
      snapshot_mask_rules: [{ data_type: "phone", mask_action: "summary_only" }],
      manager_scope_ok: true,
      grant_actions: [],
      risk_flags: ["high_risk_chunks"],
      blocking_issues: [],
      source_refs: [{ type: "skill_knowledge_reference", id: 22 }],
    },
  ],
  tool_permissions: [
    {
      asset_id: 41,
      asset_name: "外呼同步 Tool",
      asset_ref: "tool:tool:41",
      tool_id: 41,
      tool_name: "外呼同步 Tool",
      tool_type: "mcp",
      permission_count: 2,
      write_capable: true,
      risk_flags: ["write_capable_tool"],
      blocking_issues: [],
      source_refs: [{ type: "tool_registry", id: 41 }],
    },
  ],
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
  deprecated_bundle: baseBundle,
};

describe("SkillGovernanceCards", () => {
  it("MountContextCard and MountedPermissionsCard render domain projection summary", () => {
    render(
      <>
        <MountContextCard context={mountContext} loading={false} />
        <MountedPermissionsCard permissions={mountedPermissions} loading={false} />
      </>,
    );

    expect(screen.getByText("源域挂载上下文")).toBeInTheDocument();
    expect(screen.getAllByText("源域投影").length).toBeGreaterThan(0);
    expect(screen.getByText("Projection v5")).toBeInTheDocument();
    expect(screen.getByText("兼容 Bundle v3")).toBeInTheDocument();
    expect(screen.getAllByText("候选人明细表").length).toBeGreaterThan(0);
    expect(screen.getByText("招聘话术库")).toBeInTheDocument();
    expect(screen.getByText("外呼同步 Tool")).toBeInTheDocument();
    expect(screen.getByText(/受控字段：候选人手机号/)).toBeInTheDocument();
  });

  it("GranularRulesCard supports grouped granular rule editing with override reason", async () => {
    const onSaveRule = vi.fn().mockResolvedValue(undefined);
    render(
      <GranularRulesCard
        policies={basePolicies}
        loading={false}
        onSaveRule={onSaveRule}
      />,
    );

    expect(screen.getByText("招聘主管（M0）")).toBeInTheDocument();
    expect(screen.getByText("候选人明细表")).toBeInTheDocument();
    expect(screen.getByText("候选人手机号")).toBeInTheDocument();

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "raw" } });
    fireEvent.change(selects[1], { target: { value: "raw" } });

    expect(screen.getByPlaceholderText("高风险放开需填写原因")).toBeInTheDocument();
    const saveButton = screen.getByText("保存细则");
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("高风险放开需填写原因"), {
      target: { value: "招聘主管需核验重复候选人联系方式" },
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSaveRule).toHaveBeenCalledWith(
        101,
        301,
        {
          suggested_policy: "raw",
          mask_style: "raw",
          confirmed: false,
          author_override_reason: "招聘主管需核验重复候选人联系方式",
        },
      );
    });
  });

  it("PermissionDeclarationCard shows explicit stale review reason", () => {
    render(
      <PermissionDeclarationCard
        bundle={baseBundle}
        declaration={baseDeclaration}
        running={false}
        mounting={false}
        staleReasons={["高风险字段 / Chunk 规则已变更，需重新生成权限声明。"]}
        canGenerate
        onGenerate={vi.fn().mockResolvedValue(undefined)}
        onMount={vi.fn().mockResolvedValue(undefined)}
        onSaveText={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getAllByText("需重审").length).toBeGreaterThan(0);
    expect(screen.getByText(/高风险字段 \/ Chunk 规则已变更/)).toBeInTheDocument();
  });

  it("CasePlanReadinessCard disables generation while blocked", () => {
    render(
      <CasePlanReadinessCard
        readiness={{
          ready: false,
          skill_content_version: 2,
          governance_version: 5,
          permission_declaration_version: 11,
          blocking_issues: ["missing_confirmed_declaration"],
        }}
        declaration={baseDeclaration}
        plan={null}
        generating={false}
        staleReasons={["高风险字段 / Chunk 规则已变更，需重新生成权限声明。"]}
        onGenerate={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText(/高风险字段 \/ Chunk 规则已变更/)).toBeInTheDocument();
    expect(screen.getByText(/缺少可用权限声明/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成权限测试集" })).toBeDisabled();
  });

  it("PermissionDeclarationCard shows mounted version after adoption", () => {
    render(
      <PermissionDeclarationCard
        bundle={baseBundle}
        declaration={{
          ...baseDeclaration,
          status: "confirmed",
          stale_reason_codes: [],
          mounted_skill_version: 9,
        }}
        running={false}
        mounting={false}
        staleReasons={[]}
        canGenerate
        onGenerate={vi.fn().mockResolvedValue(undefined)}
        onMount={vi.fn().mockResolvedValue(undefined)}
        onSaveText={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText("Skill v9")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已挂载" })).toBeDisabled();
  });

  it("buildDeclarationStaleReasons trusts backend stale reason codes", () => {
    expect(
      buildDeclarationStaleReasons({
        ...baseDeclaration,
        stale_reason_codes: [],
      }),
    ).toEqual([]);
    expect(
      buildDeclarationStaleReasons(baseDeclaration),
    ).toEqual(["高风险字段 / Chunk 规则已变更，需重新生成权限声明。"]);
  });

  it("RoleAssetPolicyCard opens diff drawer for cross-role comparison", () => {
    render(
      <RoleAssetPolicyCard
        bundle={baseBundle}
        policies={diffPolicies}
        loading={false}
        running={false}
        onGenerate={vi.fn().mockResolvedValue(undefined)}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "查看差异矩阵" }));

    expect(screen.getByText("多岗位差异矩阵")).toBeInTheDocument();
    expect(screen.getAllByText("招聘主管（M0）").length).toBeGreaterThan(0);
    expect(screen.getAllByText("招聘专员（P1）").length).toBeGreaterThan(0);
    expect(screen.getAllByText("候选人明细表").length).toBeGreaterThan(0);
    expect(screen.getByText("脱敏")).toBeInTheDocument();
    expect(screen.getByText("聚合")).toBeInTheDocument();
  });

  it("RoleAssetPolicyCard hides write actions in read-only legacy mode", () => {
    render(
      <RoleAssetPolicyCard
        bundle={{ ...baseBundle, deprecated: true, read_only: true }}
        policies={diffPolicies}
        loading={false}
        running={false}
        readOnly
        onGenerate={vi.fn().mockResolvedValue(undefined)}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText("历史兼容 / 只读")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成建议" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "确认" })).not.toBeInTheDocument();
    expect(screen.getAllByText("只读历史").length).toBeGreaterThan(0);
  });

  it("GranularRulesCard opens granular diff matrix", () => {
    render(
      <GranularRulesCard
        policies={diffPolicies}
        loading={false}
        onSaveRule={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "查看差异矩阵" }));

    expect(screen.getByRole("button", { name: "字段 / Chunk 细则" })).toBeInTheDocument();
    expect(screen.getAllByText("候选人手机号").length).toBeGreaterThan(0);
    expect(screen.getByText("拒绝")).toBeInTheDocument();
  });

  it("GranularRulesCard becomes read-only in legacy mode", () => {
    render(
      <GranularRulesCard
        policies={basePolicies}
        loading={false}
        readOnly
        onSaveRule={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText("历史兼容 / 只读")).toBeInTheDocument();
    expect(screen.queryByText("保存细则")).not.toBeInTheDocument();
    const selects = screen.getAllByRole("combobox");
    selects.forEach((select) => expect(select).toBeDisabled());
  });

  it("CaseDraftListCard opens source refs dialog", () => {
    render(
      <CaseDraftListCard
        plan={basePlan}
        loading={false}
        onUpdateStatus={vi.fn().mockResolvedValue(undefined)}
        onSaveDraft={vi.fn().mockResolvedValue(undefined)}
        onMaterialize={vi.fn().mockResolvedValue(undefined)}
        materializing={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "查看来源" }));

    expect(screen.getByText("Source Refs")).toBeInTheDocument();
    expect(screen.getByText("role_asset_policy")).toBeInTheDocument();
    expect(screen.getByText("granular_rule")).toBeInTheDocument();
  });

  it("CaseDraftListCard edits only allowed draft fields", async () => {
    const onSaveDraft = vi.fn().mockResolvedValue(undefined);
    render(
      <CaseDraftListCard
        plan={basePlan}
        loading={false}
        onUpdateStatus={vi.fn().mockResolvedValue(undefined)}
        onSaveDraft={onSaveDraft}
        onMaterialize={vi.fn().mockResolvedValue(undefined)}
        materializing={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑草案" }));
    expect(screen.getByText(/受控字段只读/)).toBeInTheDocument();

    const textareas = screen.getAllByRole("textbox");
    fireEvent.change(textareas[0], { target: { value: "请解释为什么该岗位不能直接查看手机号。" } });
    fireEvent.change(textareas[1], { target: { value: "应拒绝原值输出，并给出脱敏替代方案。" } });
    fireEvent.click(screen.getByRole("button", { name: "保存草案" }));

    await waitFor(() => {
      expect(onSaveDraft).toHaveBeenCalledWith(801, {
        prompt: "请解释为什么该岗位不能直接查看手机号。",
        expected_behavior: "应拒绝原值输出，并给出脱敏替代方案。",
      });
    });
  });

  it("PermissionContractReviewCard shows case-level drilldown", () => {
    render(
      <PermissionContractReviewCard
        review={contractReview}
        loading={false}
      />,
    );

    expect(screen.getByText("行为越界 1")).toBeInTheDocument();
    expect(screen.getByText("Score 75")).toBeInTheDocument();
    expect(screen.getAllByText("拒绝场景 1").length).toBeGreaterThan(0);
    expect(screen.getByText("Case Drill-down")).toBeInTheDocument();
    expect(screen.getByText("行为越界")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/招聘主管/));
    expect(screen.getByText(/输出了受控字段/)).toBeInTheDocument();
    expect(screen.getByText(/候选人手机号是 13800000000/)).toBeInTheDocument();
  });

  it("GovernanceJobProgressStrip renders job phase and id", () => {
    const { rerender } = render(
      <GovernanceJobProgressStrip
        job={{
          label: "生成权限测试集",
          status: "running",
          jobId: "permission-case-plan-1-9",
          detail: "提交风险聚焦测试集生成任务",
        }}
      />,
    );

    expect(screen.getByText("运行中")).toBeInTheDocument();
    expect(screen.getByText("生成权限测试集")).toBeInTheDocument();
    expect(screen.getByText("permission-case-plan-1-9")).toBeInTheDocument();

    rerender(
      <GovernanceJobProgressStrip
        job={{
          label: "生成权限测试集",
          status: "done",
          jobId: "permission-case-plan-1-9",
          detail: "权限测试草案已生成并刷新",
        }}
      />,
    );

    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText("权限测试草案已生成并刷新")).toBeInTheDocument();
  });
});
