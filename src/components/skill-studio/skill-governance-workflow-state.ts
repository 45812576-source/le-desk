import type {
  GovernanceReadiness,
  PermissionDeclaration,
} from "./SkillGovernanceCards";

export type GovernanceWorkflowPhase =
  | "loading"
  | "failed"
  | "empty"
  | "missing_assets"
  | "missing_roles"
  | "policies_required"
  | "declaration_required"
  | "declaration_ready"
  | "mounted"
  | "test_ready";

export type GovernanceWorkflowActionId =
  | "refresh_governance"
  | "bind_assets"
  | "save_roles"
  | "generate_policies"
  | "generate_declaration"
  | "mount_declaration"
  | "generate_cases";

export type GovernanceWorkflowIssue = {
  code: string;
  title: string;
  detail: string;
};

export type GovernanceWorkflowAction = {
  id: GovernanceWorkflowActionId;
  label: string;
  enabled: boolean;
  reason?: string | null;
};

export type GovernanceWorkflowState = {
  phase: GovernanceWorkflowPhase;
  title: string;
  blockingIssues: GovernanceWorkflowIssue[];
  availableActions: GovernanceWorkflowAction[];
  primaryAction: GovernanceWorkflowAction | null;
};

function action(
  id: GovernanceWorkflowActionId,
  label: string,
  enabled = true,
  reason?: string | null,
): GovernanceWorkflowAction {
  return { id, label, enabled, reason };
}

function issue(code: string, title: string, detail: string): GovernanceWorkflowIssue {
  return { code, title, detail };
}

function pickPrimary(actions: GovernanceWorkflowAction[]) {
  return actions.find((item) => item.enabled) || actions[0] || null;
}

function declarationMounted(declaration: PermissionDeclaration | null) {
  if (!declaration) return false;
  return Boolean(declaration.mounted || declaration.mounted_at || declaration.status === "confirmed");
}

function declarationStale(declaration: PermissionDeclaration | null) {
  if (!declaration) return false;
  return declaration.status === "stale" || Boolean(declaration.stale_reason_codes?.length);
}

export function deriveGovernanceWorkflowState(input: {
  loading: boolean;
  error: string | null;
  roleCount: number;
  assetCount: number;
  hasPolicyBundle: boolean;
  declaration: PermissionDeclaration | null;
  readiness: GovernanceReadiness | null;
}): GovernanceWorkflowState {
  if (input.loading) {
    const actions = [action("refresh_governance", "刷新治理状态", false, "正在加载治理信息")];
    return {
      phase: "loading",
      title: "正在加载治理状态",
      blockingIssues: [],
      availableActions: actions,
      primaryAction: pickPrimary(actions),
    };
  }

  if (input.error) {
    const actions = [action("refresh_governance", "重试刷新")];
    return {
      phase: "failed",
      title: "治理状态加载失败",
      blockingIssues: [issue("governance_load_failed", "治理状态加载失败", input.error)],
      availableActions: actions,
      primaryAction: pickPrimary(actions),
    };
  }

  if (input.assetCount <= 0) {
    const actions = [
      action("refresh_governance", "刷新源域资产"),
      action("bind_assets", "绑定源域资产"),
    ];
    return {
      phase: "missing_assets",
      title: "需先绑定源域资产",
      blockingIssues: [
        issue("missing_bound_assets", "未绑定源域资产", "至少绑定一个知识库、数据表或工具资产后，才能自动生成权限设置。"),
      ],
      availableActions: actions,
      primaryAction: pickPrimary(actions),
    };
  }

  if (input.roleCount <= 0) {
    const actions = [action("save_roles", "保存服务岗位")];
    return {
      phase: "missing_roles",
      title: "需先配置服务岗位",
      blockingIssues: [
        issue("missing_service_roles", "未配置服务岗位", "至少配置一个会使用该 Skill 的岗位后，才能生成岗位 × 资产策略。"),
      ],
      availableActions: actions,
      primaryAction: pickPrimary(actions),
    };
  }

  if (!input.hasPolicyBundle) {
    const actions = [action("generate_policies", "生成岗位 × 资产策略")];
    return {
      phase: "policies_required",
      title: "需生成岗位 × 资产策略",
      blockingIssues: [
        issue("missing_policy_bundle", "缺少岗位 × 资产策略", "权限声明必须基于服务岗位和源域资产策略生成。"),
      ],
      availableActions: actions,
      primaryAction: pickPrimary(actions),
    };
  }

  if (!input.declaration || declarationStale(input.declaration)) {
    const actions = [action("generate_declaration", input.declaration ? "重新生成权限声明" : "生成权限声明")];
    return {
      phase: "declaration_required",
      title: "需生成权限声明",
      blockingIssues: [
        issue("missing_confirmed_declaration", "权限声明未确认", "生成并确认权限声明后，测试流程才能进入 case 生成。"),
      ],
      availableActions: actions,
      primaryAction: pickPrimary(actions),
    };
  }

  if (!declarationMounted(input.declaration)) {
    const actions = [action("mount_declaration", "采纳并挂载权限声明")];
    return {
      phase: "declaration_ready",
      title: "权限声明待挂载",
      blockingIssues: [
        issue("declaration_not_mounted", "权限声明尚未挂载", "声明需要写入 Skill 内容版本后，后续测试才有稳定权限依据。"),
      ],
      availableActions: actions,
      primaryAction: pickPrimary(actions),
    };
  }

  if (input.readiness?.ready) {
    const actions = [action("generate_cases", "生成或执行权限测试集")];
    return {
      phase: "test_ready",
      title: "治理已就绪，可以测试",
      blockingIssues: [],
      availableActions: actions,
      primaryAction: pickPrimary(actions),
    };
  }

  const readinessIssues = input.readiness?.blocking_issues || [];
  const actions = [
    action("refresh_governance", "刷新治理状态"),
    action("generate_cases", "生成权限测试集", readinessIssues.length === 0, readinessIssues.join("、") || null),
  ];
  return {
    phase: "mounted",
    title: "权限已挂载，等待测试就绪",
    blockingIssues: readinessIssues.map((code) =>
      issue(code, code, "治理声明已挂载，但测试前置条件仍未全部满足。")
    ),
    availableActions: actions,
    primaryAction: pickPrimary(actions),
  };
}
