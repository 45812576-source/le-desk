import { describe, expect, it } from "vitest";
import type { GovernanceReadiness, PermissionDeclaration } from "../SkillGovernanceCards";
import { deriveGovernanceWorkflowState } from "../skill-governance-workflow-state";

const declaration: PermissionDeclaration = {
  id: 1,
  version: 1,
  declaration_version: 1,
  bundle_id: 1,
  role_policy_bundle_version: 1,
  governance_version: 1,
  text: "权限声明",
  generated_text: "权限声明",
  status: "generated",
  stale_reason_codes: [],
  mounted: false,
};

const readiness: GovernanceReadiness = {
  ready: false,
  skill_content_version: 1,
  governance_version: 1,
  permission_declaration_version: 1,
  blocking_issues: [],
};

describe("deriveGovernanceWorkflowState", () => {
  it("returns missing_assets before other phases", () => {
    const state = deriveGovernanceWorkflowState({
      loading: false,
      error: null,
      roleCount: 0,
      assetCount: 0,
      hasPolicyBundle: false,
      declaration: null,
      readiness: null,
    });

    expect(state.phase).toBe("missing_assets");
    expect(state.primaryAction?.id).toBe("refresh_governance");
    expect(state.blockingIssues[0].code).toBe("missing_bound_assets");
  });

  it("moves from policies to declaration to mount in order", () => {
    expect(deriveGovernanceWorkflowState({
      loading: false,
      error: null,
      roleCount: 1,
      assetCount: 1,
      hasPolicyBundle: false,
      declaration: null,
      readiness,
    }).phase).toBe("policies_required");

    expect(deriveGovernanceWorkflowState({
      loading: false,
      error: null,
      roleCount: 1,
      assetCount: 1,
      hasPolicyBundle: true,
      declaration: null,
      readiness,
    }).phase).toBe("declaration_required");

    expect(deriveGovernanceWorkflowState({
      loading: false,
      error: null,
      roleCount: 1,
      assetCount: 1,
      hasPolicyBundle: true,
      declaration,
      readiness,
    }).phase).toBe("declaration_ready");
  });

  it("marks mounted declarations as test ready when readiness is ready", () => {
    const state = deriveGovernanceWorkflowState({
      loading: false,
      error: null,
      roleCount: 1,
      assetCount: 1,
      hasPolicyBundle: true,
      declaration: { ...declaration, mounted: true, status: "confirmed" },
      readiness: { ...readiness, ready: true },
    });

    expect(state.phase).toBe("test_ready");
    expect(state.blockingIssues).toEqual([]);
    expect(state.primaryAction?.id).toBe("generate_cases");
  });
});
