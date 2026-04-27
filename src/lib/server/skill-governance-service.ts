import type {
  BoundAssetItem,
  GovernanceReadiness,
  GovernanceSummary,
  GranularRuleItem,
  MountContext,
  MountedKnowledgePermission,
  MountedPermissions,
  PermissionCasePlan,
  PermissionContractReview,
  PermissionDeclaration,
  RoleAssetPolicyItem,
  ServiceRoleItem,
} from "@/components/skill-studio/SkillGovernanceCards";
import {
  checkCurrentSkillKnowledgeAccess,
  checkCurrentSkillTableAccess,
  getCurrentEffectiveOrgMemoryGovernanceVersion,
} from "@/lib/server/org-memory-runtime";
import {
  cloneSkillGovernanceValue,
  ensureSkillGovernanceCache,
  readSkillGovernanceState,
  type SkillGovernancePoliciesResponse,
  type SkillGovernanceRolePackagePayload,
  type SkillGovernanceRolePackageRecord,
  type SkillGovernanceSkillCache,
  updateSkillGovernanceState,
} from "@/lib/server/skill-governance-db";

export type SkillGovernanceApiResult = {
  body: unknown;
  status?: number;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
};

type ParsedRoute =
  | { kind: "skill"; skillId: number; resource: string; roleKey?: string; declarationId?: number; jobId?: string }
  | { kind: "sandbox"; skillId: number; resource: "readiness" | "latest" }
  | { kind: "contract_review"; planId: number }
  | { kind: "unknown" };

const DEFAULT_STALE_DOWNSTREAM = [
  "mounted_permissions",
  "permission_declaration",
  "sandbox_case_plan",
];

function nowIso() {
  return new Date().toISOString();
}

function ok<T>(data: T): SkillGovernanceApiResult {
  return { body: { ok: true, data }, status: 200 };
}

function fail(status: number, code: string, message: string): SkillGovernanceApiResult {
  return {
    status,
    body: {
      ok: false,
      error: { code, message },
    },
  };
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function asRoleLabel(role: { position_name?: string | null; position_level?: string | null; role_label?: string | null }) {
  if (role.role_label) return role.role_label;
  return `${role.position_name || "服务岗位"}${role.position_level ? `（${role.position_level}）` : ""}`;
}

function cacheRoles(cache: SkillGovernanceSkillCache): ServiceRoleItem[] {
  return cache.service_roles || cache.mount_context?.roles || [];
}

function cacheAssets(cache: SkillGovernanceSkillCache): BoundAssetItem[] {
  return cache.bound_assets || cache.mount_context?.assets || [];
}

function nextGovernanceVersion(cache: SkillGovernanceSkillCache) {
  return currentGovernanceVersion(cache) + 1;
}

function buildRolePackageWorkflowCards(input: {
  skillId: number;
  roleKey: string;
  staleDownstream: string[];
}) {
  return [
    {
      id: `governance:role-package:${input.skillId}:${input.roleKey}`,
      contract_id: "governance.panel",
      title: "角色权限包已更新",
      summary: `角色 ${input.roleKey} 的权限包已变更，需要刷新声明、挂载和测试方案。`,
      status: "pending",
      kind: "governance",
      mode: "governance",
      phase: "governance",
      priority: 114,
      target: { type: "governance_panel", key: String(input.skillId) },
      artifact_refs: input.staleDownstream.map((item) => `stale:${item}`),
    },
    {
      id: `validation:case-plan:${input.skillId}:stale-after-role-package`,
      contract_id: "validation.test_ready",
      title: "测试方案需重审",
      summary: "权限包变更后，Sandbox case plan 需要重新确认或生成。",
      status: "pending",
      kind: "validation",
      mode: "governance",
      phase: "validation",
      priority: 108,
      target: { type: "governance_panel", key: String(input.skillId) },
      validation_source: {
        skill_id: input.skillId,
        blocked_stage: "case_generation_gate",
        blocked_before: "case_generation",
      },
      blocked_by: [`governance:role-package:${input.skillId}:${input.roleKey}`],
    },
  ];
}

function asEnvelope(value: unknown): ApiEnvelope<unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as ApiEnvelope<unknown>;
  if (typeof candidate.ok !== "boolean") return null;
  return candidate;
}

function roleKeyFromParts(role: { org_path?: string | null; position_name?: string | null; position_level?: string | null }) {
  return `${role.org_path || ""}::${role.position_name || ""}::${role.position_level || ""}`;
}

function parseRoute(pathname: string): ParsedRoute {
  const rolePackage = pathname.match(/^\/skill-governance\/(\d+)\/role-packages\/(.+)$/);
  if (rolePackage) {
    return {
      kind: "skill",
      skillId: Number(rolePackage[1]),
      resource: "role-package",
      roleKey: decodeURIComponent(rolePackage[2]),
    };
  }

  const rolePackages = pathname.match(/^\/skill-governance\/(\d+)\/role-packages$/);
  if (rolePackages) {
    return { kind: "skill", skillId: Number(rolePackages[1]), resource: "role-packages" };
  }

  const job = pathname.match(/^\/skill-governance\/(\d+)\/jobs\/([^/]+)$/);
  if (job) {
    return { kind: "skill", skillId: Number(job[1]), resource: "job", jobId: decodeURIComponent(job[2]) };
  }

  const declarationAdopt = pathname.match(/^\/skill-governance\/(\d+)\/declarations\/(\d+)\/adopt$/);
  if (declarationAdopt) {
    return {
      kind: "skill",
      skillId: Number(declarationAdopt[1]),
      resource: "declaration-adopt",
      declarationId: Number(declarationAdopt[2]),
    };
  }

  const permissionDeclaration = pathname.match(/^\/skill-governance\/(\d+)\/permission-declaration\/(\d+)$/);
  if (permissionDeclaration) {
    return {
      kind: "skill",
      skillId: Number(permissionDeclaration[1]),
      resource: "permission-declaration",
      declarationId: Number(permissionDeclaration[2]),
    };
  }

  const skill = pathname.match(/^\/skill-governance\/(\d+)\/(summary|service-roles|bound-assets|bound-assets\/refresh|mount-context|mounted-permissions|role-asset-policies|role-asset-policies\/confirm|granular-rules\/confirm|suggest-role-asset-policies|declarations\/latest|declarations\/generate)$/);
  if (skill) {
    return { kind: "skill", skillId: Number(skill[1]), resource: skill[2] };
  }

  const sandbox = pathname.match(/^\/sandbox-case-plans\/(\d+)\/(readiness|latest)$/);
  if (sandbox) {
    return { kind: "sandbox", skillId: Number(sandbox[1]), resource: sandbox[2] as "readiness" | "latest" };
  }

  const review = pathname.match(/^\/sandbox-case-plans\/(\d+)\/part2-review$/);
  if (review) {
    return { kind: "contract_review", planId: Number(review[1]) };
  }

  return { kind: "unknown" };
}

function packagesForCache(cache: SkillGovernanceSkillCache) {
  return Object.values(cache.role_packages).sort((left, right) => left.updated_at.localeCompare(right.updated_at));
}

function hasPackages(cache: SkillGovernanceSkillCache) {
  return packagesForCache(cache).length > 0;
}

function currentGovernanceVersion(cache: SkillGovernanceSkillCache) {
  return Math.max(
    0,
    cache.summary?.governance_version || 0,
    cache.summary?.bundle?.governance_version || 0,
    cache.declaration?.governance_version || 0,
    cache.readiness_response?.readiness.governance_version || 0,
    cache.latest_case_plan_response?.readiness.governance_version || 0,
    cache.latest_case_plan_response?.plan?.governance_version || 0,
    ...packagesForCache(cache).map((item) => item.governance_version || 0),
  );
}

function latestPackageGovernanceVersion(cache: SkillGovernanceSkillCache, fallback = 0) {
  return Math.max(fallback, currentGovernanceVersion(cache));
}

function latestRecordByAsset<T extends { asset_id?: unknown }>(packages: SkillGovernanceRolePackageRecord[], selector: (record: SkillGovernanceRolePackageRecord) => T[] | undefined) {
  const grouped = new Map<number, T>();
  packages.forEach((record) => {
    (selector(record) || []).forEach((item) => {
      const assetId = typeof item.asset_id === "number" ? item.asset_id : null;
      if (assetId !== null) grouped.set(assetId, item);
    });
  });
  return grouped;
}

function roleMatchesPackage(policy: RoleAssetPolicyItem, record: SkillGovernanceRolePackageRecord) {
  const policyRoleKey = roleKeyFromParts({
    org_path: policy.role.org_path,
    position_name: policy.role.position_name,
    position_level: policy.role.position_level || "",
  });
  return policyRoleKey === record.role_key
    || policy.role.position_name === record.role.position_name
    || policy.role.label === record.role.role_label;
}

function applyFieldRuleOverrides(
  policiesResponse: SkillGovernancePoliciesResponse,
  packages: SkillGovernanceRolePackageRecord[],
) {
  const next = cloneSkillGovernanceValue(policiesResponse);
  next.items = next.items.map((policy) => {
    const matchingPackages = packages.filter((record) => roleMatchesPackage(policy, record));
    if (matchingPackages.length === 0) return policy;

    const fieldRules = matchingPackages.flatMap((record) => record.payload.package?.field_rules || []);
    if (fieldRules.length === 0) return policy;

    return {
      ...policy,
      granular_rules: (policy.granular_rules || []).map((rule) => applyGranularRuleOverride(rule, fieldRules)),
    };
  });
  return next;
}

function applyGranularRuleOverride(rule: GranularRuleItem, fieldRules: Array<Record<string, unknown>>) {
  const rulePayload = fieldRules.find((item) => item.rule_id === rule.id || item.target_ref === rule.target_ref);
  if (!rulePayload) return rule;
  return {
    ...rule,
    suggested_policy: typeof rulePayload.suggested_policy === "string" ? rulePayload.suggested_policy : rule.suggested_policy,
    mask_style: typeof rulePayload.mask_style === "string" || rulePayload.mask_style === null ? rulePayload.mask_style : rule.mask_style,
    confirmed: typeof rulePayload.confirmed === "boolean" ? rulePayload.confirmed : rule.confirmed,
    author_override_reason:
      typeof rulePayload.author_override_reason === "string" || rulePayload.author_override_reason === null
        ? rulePayload.author_override_reason
        : rule.author_override_reason,
  };
}

function mergeDeclaration(
  declaration: PermissionDeclaration | null,
  governanceVersion: number,
): PermissionDeclaration | null {
  if (!declaration) return declaration;
  return {
    ...declaration,
    status: "stale",
    governance_version: governanceVersion,
    stale_reason_codes: unique([...(declaration.stale_reason_codes || []), "role_package_changed"]),
  };
}

function mergeSummary(summary: GovernanceSummary, cache: SkillGovernanceSkillCache) {
  if (!hasPackages(cache)) return summary;
  const governanceVersion = latestPackageGovernanceVersion(cache, summary.governance_version);
  return {
    ...summary,
    governance_version: governanceVersion,
    bundle: summary.bundle ? { ...summary.bundle, governance_version: governanceVersion } : summary.bundle,
    declaration: mergeDeclaration(summary.declaration, governanceVersion),
    summary: {
      ...summary.summary,
      stale: true,
      blocking_issues: unique([...summary.summary.blocking_issues, "missing_confirmed_declaration"]),
    },
  };
}

function mergeMountContext(context: MountContext, cache: SkillGovernanceSkillCache) {
  const packages = packagesForCache(cache);
  if (packages.length === 0) return context;
  const governanceVersion = latestPackageGovernanceVersion(cache, context.projection_version);
  const assetOverrides = latestRecordByAsset(packages, (record) => record.payload.package?.asset_mounts);
  return {
    ...context,
    projection_version: Math.max(context.projection_version || 0, governanceVersion),
    assets: context.assets.map((asset) => {
      const override = assetOverrides.get(asset.id);
      if (!override) return asset;
      return {
        ...asset,
        binding_mode: typeof override.binding_mode === "string" ? override.binding_mode : asset.binding_mode,
        status: override.enabled === false ? "disabled" : override.enabled === true ? "active" : asset.status,
      } satisfies BoundAssetItem;
    }),
  };
}

function mergeMountedPermissions(permissions: MountedPermissions, cache: SkillGovernanceSkillCache) {
  const packages = packagesForCache(cache);
  if (packages.length === 0) return permissions;
  const governanceVersion = latestPackageGovernanceVersion(cache, permissions.projection_version);
  const knowledgeOverrides = latestRecordByAsset(packages, (record) => record.payload.package?.knowledge_permissions);
  const assetOverrides = latestRecordByAsset(packages, (record) => record.payload.package?.asset_mounts);
  return {
    ...permissions,
    projection_version: Math.max(permissions.projection_version || 0, governanceVersion),
    knowledge_permissions: permissions.knowledge_permissions.map((permission) => mergeKnowledgePermission(permission, knowledgeOverrides, assetOverrides)),
    table_permissions: permissions.table_permissions.map((permission) => mergeMountedAssetBlocking(permission, assetOverrides)),
    tool_permissions: permissions.tool_permissions.map((permission) => mergeMountedAssetBlocking(permission, assetOverrides)),
  };
}

function mergeKnowledgePermission(
  permission: MountedKnowledgePermission,
  knowledgeOverrides: Map<number, Record<string, unknown>>,
  assetOverrides: Map<number, Record<string, unknown>>,
): MountedKnowledgePermission {
  const knowledgeOverride = knowledgeOverrides.get(permission.asset_id);
  const assetOverride = assetOverrides.get(permission.asset_id);
  const enabled = knowledgeOverride?.enabled !== undefined
    ? knowledgeOverride.enabled !== false
    : assetOverride?.enabled !== false;
  const baseIssues = (permission.blocking_issues || []).filter((issue) => issue !== "disabled_by_role_package");
  return {
    ...permission,
    snapshot_desensitization_level: typeof knowledgeOverride?.desensitization_level === "string"
      ? knowledgeOverride.desensitization_level
      : permission.snapshot_desensitization_level,
    grant_actions: Array.isArray(knowledgeOverride?.grant_actions)
      ? knowledgeOverride.grant_actions.filter((item): item is string => typeof item === "string")
      : enabled ? permission.grant_actions : [],
    blocking_issues: enabled ? baseIssues : unique([...baseIssues, "disabled_by_role_package"]),
  };
}

function mergeMountedAssetBlocking<T extends { asset_id: number; blocking_issues: string[] }>(
  permission: T,
  assetOverrides: Map<number, Record<string, unknown>>,
): T {
  const assetOverride = assetOverrides.get(permission.asset_id);
  if (!assetOverride) return permission;
  const baseIssues = (permission.blocking_issues || []).filter((issue) => issue !== "disabled_by_role_package");
  return {
    ...permission,
    blocking_issues: assetOverride.enabled === false ? unique([...baseIssues, "disabled_by_role_package"]) : baseIssues,
  };
}

function mergeReadiness(readiness: GovernanceReadiness, cache: SkillGovernanceSkillCache) {
  if (!hasPackages(cache)) return readiness;
  return {
    ...readiness,
    ready: false,
    governance_version: latestPackageGovernanceVersion(cache, readiness.governance_version),
    blocking_issues: unique([...readiness.blocking_issues, "missing_confirmed_declaration"]),
  };
}

function mergeLatestCasePlan(
  latest: { skill_id: number; readiness: GovernanceReadiness; plan: PermissionCasePlan | null; cases?: unknown[] },
  cache: SkillGovernanceSkillCache,
) {
  if (!hasPackages(cache)) return latest;
  const governanceVersion = latestPackageGovernanceVersion(cache, latest.readiness.governance_version);
  return {
    ...latest,
    readiness: mergeReadiness(latest.readiness, cache),
    plan: latest.plan
      ? {
          ...latest.plan,
          status: "stale",
          governance_version: governanceVersion,
          blocking_issues: unique([...latest.plan.blocking_issues, "missing_confirmed_declaration"]),
        }
      : latest.plan,
  };
}

function mergeContractReview(review: PermissionContractReview | null, cache: SkillGovernanceSkillCache) {
  if (!review || !hasPackages(cache)) return review;
  return {
    ...review,
    status: "stale",
    overall_permission_contract_health: {
      ...review.overall_permission_contract_health,
      status: "warning",
      label: "角色 package 已变更，需重审",
    },
    issues: unique([...(review.issues || []), "role_package_changed"]),
  };
}

function mergeRolePackageOverlay<T>(skillId: number, route: ParsedRoute, data: T, cache: SkillGovernanceSkillCache): T {
  if (route.kind === "skill") {
    if (route.resource === "summary") return mergeSummary(data as GovernanceSummary, cache) as T;
    if (route.resource === "mount-context") return mergeMountContext(data as MountContext, cache) as T;
    if (route.resource === "mounted-permissions") return mergeMountedPermissions(data as MountedPermissions, cache) as T;
    if (route.resource === "role-asset-policies") return applyFieldRuleOverrides(data as SkillGovernancePoliciesResponse, packagesForCache(cache)) as T;
    if (route.resource === "declarations/latest") return mergeDeclaration(data as PermissionDeclaration | null, latestPackageGovernanceVersion(cache)) as T;
  }
  if (route.kind === "sandbox" && route.resource === "readiness") {
    const response = data as { skill_id: number; readiness: GovernanceReadiness };
    return { ...response, skill_id: skillId, readiness: mergeReadiness(response.readiness, cache) } as T;
  }
  if (route.kind === "sandbox" && route.resource === "latest") {
    return mergeLatestCasePlan(data as { skill_id: number; readiness: GovernanceReadiness; plan: PermissionCasePlan | null; cases?: unknown[] }, cache) as T;
  }
  if (route.kind === "contract_review") return mergeContractReview(data as PermissionContractReview | null, cache) as T;
  return data;
}

async function applyOrgMemoryGovernanceOverlay(skillId: number, permissions: MountedPermissions) {
  const governanceVersion = await getCurrentEffectiveOrgMemoryGovernanceVersion();
  const hasSkillRule = governanceVersion?.skill_access_rules.some((item) => item.skill_id === skillId) || false;
  if (!governanceVersion || !hasSkillRule) return permissions;

  const knowledgePermissions = await Promise.all(
    permissions.knowledge_permissions.map(async (permission) => {
      const access = await checkCurrentSkillKnowledgeAccess(skillId, {
        folder_path: permission.folder_path,
        title: permission.title,
        asset_name: permission.asset_name,
      });
      const baseIssues = (permission.blocking_issues || []).filter((issue) => issue !== "blocked_by_org_memory_governance_version");
      return {
        ...permission,
        grant_actions: access.allowed ? permission.grant_actions : [],
        snapshot_desensitization_level: access.required_redaction_mode
          ? access.required_redaction_mode.toUpperCase()
          : permission.snapshot_desensitization_level,
        blocking_issues: access.allowed ? baseIssues : unique([...baseIssues, "blocked_by_org_memory_governance_version"]),
      };
    }),
  );

  const tablePermissions = await Promise.all(
    permissions.table_permissions.map(async (permission) => {
      const access = await checkCurrentSkillTableAccess(skillId, {
        table_name: permission.table_name,
        asset_name: permission.asset_name,
        asset_ref: permission.asset_ref,
      });
      const baseIssues = (permission.blocking_issues || []).filter((issue) => issue !== "blocked_by_org_memory_governance_version");
      return {
        ...permission,
        allowed_actions: access.allowed ? permission.allowed_actions : [],
        blocking_issues: access.allowed ? baseIssues : unique([...baseIssues, "blocked_by_org_memory_governance_version"]),
      };
    }),
  );

  return {
    ...permissions,
    projection_version: Math.max(permissions.projection_version || 0, governanceVersion.version),
    knowledge_permissions: knowledgePermissions,
    table_permissions: tablePermissions,
    blocking_issues: unique([
      ...(permissions.blocking_issues || []),
      ...(knowledgePermissions.some((item) => item.blocking_issues.includes("blocked_by_org_memory_governance_version"))
        || tablePermissions.some((item) => item.blocking_issues.includes("blocked_by_org_memory_governance_version"))
        ? ["blocked_by_org_memory_governance_version"]
        : []),
    ]),
  };
}


function cacheBackendData(cache: SkillGovernanceSkillCache, route: ParsedRoute, data: unknown) {
  if (route.kind === "skill") {
    if (route.resource === "summary") cache.summary = cloneSkillGovernanceValue(data as GovernanceSummary);
    if (route.resource === "service-roles") cache.service_roles = cloneSkillGovernanceValue((data as { roles?: unknown[] }).roles || []) as never;
    if (route.resource === "bound-assets") cache.bound_assets = cloneSkillGovernanceValue((data as { assets?: unknown[] }).assets || []) as never;
    if (route.resource === "mount-context") cache.mount_context = cloneSkillGovernanceValue(data as MountContext);
    if (route.resource === "mounted-permissions") cache.mounted_permissions = cloneSkillGovernanceValue(data as MountedPermissions);
    if (route.resource === "role-asset-policies") cache.policies_response = cloneSkillGovernanceValue(data as SkillGovernancePoliciesResponse);
    if (route.resource === "declarations/latest") cache.declaration = cloneSkillGovernanceValue(data as PermissionDeclaration | null);
  }
  if (route.kind === "sandbox" && route.resource === "readiness") {
    cache.readiness_response = cloneSkillGovernanceValue(data as { skill_id: number; readiness: GovernanceReadiness });
  }
  if (route.kind === "sandbox" && route.resource === "latest") {
    cache.latest_case_plan_response = cloneSkillGovernanceValue(data as SkillGovernanceSkillCache["latest_case_plan_response"]);
  }
  if (route.kind === "contract_review") {
    cache.contract_reviews_by_plan_id[String(route.planId)] = cloneSkillGovernanceValue(data as PermissionContractReview | null);
  }
}

function cachedDataForRoute(cache: SkillGovernanceSkillCache, route: ParsedRoute): unknown | null {
  if (route.kind === "skill") {
    if (route.resource === "summary") return cache.summary;
    if (route.resource === "service-roles") return cache.service_roles ? { roles: cache.service_roles } : null;
    if (route.resource === "bound-assets") return cache.bound_assets ? { assets: cache.bound_assets } : null;
    if (route.resource === "mount-context") return cache.mount_context;
    if (route.resource === "mounted-permissions") return cache.mounted_permissions;
    if (route.resource === "role-asset-policies") return cache.policies_response;
    if (route.resource === "declarations/latest") return cache.declaration;
    if (route.resource === "role-packages") {
      return {
        items: packagesForCache(cache),
      };
    }
  }
  if (route.kind === "sandbox" && route.resource === "readiness") return cache.readiness_response;
  if (route.kind === "sandbox" && route.resource === "latest") return cache.latest_case_plan_response;
  if (route.kind === "contract_review") return cache.contract_reviews_by_plan_id[String(route.planId)] || null;
  return null;
}

function emptyReadiness(skillId: number): { skill_id: number; readiness: GovernanceReadiness } {
  return {
    skill_id: skillId,
    readiness: {
      ready: false,
      skill_content_version: 0,
      governance_version: 0,
      permission_declaration_version: null,
      blocking_issues: ["missing_permission_mount"],
    },
  };
}

function defaultDataForRoute(skillId: number, route: ParsedRoute): unknown | null {
  if (route.kind === "skill") {
    if (route.resource === "summary") {
      return {
        skill_id: skillId,
        governance_version: 0,
        bundle: null,
        declaration: null,
        summary: {
          service_role_count: 0,
          bound_asset_count: 0,
          blocking_issues: ["missing_permission_mount"],
          stale: true,
        },
      } satisfies GovernanceSummary;
    }
    if (route.resource === "service-roles") return { roles: [] };
    if (route.resource === "bound-assets") return { assets: [] };
    if (route.resource === "mount-context") {
      return {
        skill_id: skillId,
        workspace_id: 0,
        source_mode: "local_fallback_empty",
        projection_version: 0,
        skill_content_version: 0,
        roles: [],
        assets: [],
        permission_summary: {
          table_count: 0,
          knowledge_count: 0,
          tool_count: 0,
          high_risk_count: 0,
          blocking_issues: ["missing_bound_assets"],
        },
        source_refs: [],
        deprecated_bundle: null,
      } satisfies MountContext;
    }
    if (route.resource === "mounted-permissions") {
      return {
        skill_id: skillId,
        source_mode: "local_fallback_empty",
        projection_version: 0,
        table_permissions: [],
        knowledge_permissions: [],
        tool_permissions: [],
        risk_controls: [],
        blocking_issues: ["missing_permission_mount"],
        deprecated_bundle: null,
      } satisfies MountedPermissions;
    }
    if (route.resource === "role-asset-policies") {
      return {
        bundle_version: 0,
        governance_version: 0,
        review_status: "draft",
        items: [],
        deprecated: false,
        read_only: false,
      } satisfies SkillGovernancePoliciesResponse;
    }
    if (route.resource === "declarations/latest") return null;
    if (route.resource === "role-packages") return { items: [] };
  }
  if (route.kind === "sandbox" && route.resource === "readiness") return emptyReadiness(skillId);
  if (route.kind === "sandbox" && route.resource === "latest") {
    return {
      ...emptyReadiness(skillId),
      plan: null,
      cases: [],
    };
  }
  if (route.kind === "contract_review") return null;
  return null;
}

function hasDefaultDataForRoute(route: ParsedRoute) {
  if (route.kind === "skill") {
    return [
      "summary",
      "service-roles",
      "bound-assets",
      "mount-context",
      "mounted-permissions",
      "role-asset-policies",
      "declarations/latest",
      "role-packages",
    ].includes(route.resource);
  }
  return route.kind === "sandbox" || route.kind === "contract_review";
}

function normalizeRolePackageRecord(
  cache: SkillGovernanceSkillCache,
  roleKey: string,
  payload: SkillGovernanceRolePackagePayload,
  backendData?: Record<string, unknown>,
): SkillGovernanceRolePackageRecord {
  const previous = cache.role_packages[roleKey];
  const packageVersion = typeof backendData?.package_version === "number"
    ? backendData.package_version
    : (previous?.package_version || 0) + 1;
  const governanceVersion = typeof backendData?.governance_version === "number"
    ? backendData.governance_version
    : Math.max(currentGovernanceVersion(cache), 0) + 1;
  const staleDownstream = Array.isArray(payload.stale_downstream) && payload.stale_downstream.every((item) => typeof item === "string")
    ? payload.stale_downstream
    : DEFAULT_STALE_DOWNSTREAM;
  const role = payload.role || {};
  return {
    role_key: payload.role_key || roleKey,
    role: {
      org_path: role.org_path || "",
      position_name: role.position_name || "",
      position_level: role.position_level || "",
      role_label: role.role_label || role.position_name || roleKey,
    },
    package_version: packageVersion,
    governance_version: governanceVersion,
    stale_downstream: staleDownstream,
    payload,
    updated_at: nowIso(),
  };
}

async function saveRolePackage(
  skillId: number,
  roleKey: string,
  payload: SkillGovernanceRolePackagePayload,
  backendData?: Record<string, unknown>,
) {
  return updateSkillGovernanceState((state) => {
    const cache = ensureSkillGovernanceCache(state, skillId);
    const record = normalizeRolePackageRecord(cache, roleKey, payload, backendData);
    cache.role_packages[record.role_key] = record;
    return {
      role_key: record.role_key,
      package_version: record.package_version,
      governance_version: record.governance_version,
      stale_downstream: record.stale_downstream,
    };
  });
}

function updateSummaryFromCache(cache: SkillGovernanceSkillCache, skillId: number, governanceVersion: number) {
  const roles = cacheRoles(cache);
  const assets = cacheAssets(cache);
  const bundle = cache.policies_response
    ? {
        id: cache.policies_response.bundle_id || cache.summary?.bundle?.id || governanceVersion,
        bundle_version: cache.policies_response.bundle_version,
        governance_version: cache.policies_response.governance_version || governanceVersion,
        status: cache.policies_response.review_status,
        service_role_count: roles.length,
        bound_asset_count: assets.length,
        deprecated: cache.policies_response.deprecated,
        read_only: cache.policies_response.read_only,
      }
    : cache.summary?.bundle || null;
  cache.summary = {
    skill_id: skillId,
    governance_version: Math.max(governanceVersion, cache.summary?.governance_version || 0),
    bundle,
    declaration: cache.declaration,
    summary: {
      service_role_count: roles.length,
      bound_asset_count: assets.length,
      stale: Boolean(cache.declaration?.status === "stale"),
      blocking_issues: cache.declaration?.mounted
        ? []
        : unique([...(cache.summary?.summary.blocking_issues || []), "missing_confirmed_declaration"]),
    },
  };
}

function buildFallbackPolicies(cache: SkillGovernanceSkillCache, skillId: number, governanceVersion: number): SkillGovernancePoliciesResponse {
  const roles = cacheRoles(cache);
  const assets = cacheAssets(cache);
  const existing = cache.policies_response;
  const bundleVersion = (existing?.bundle_version || cache.summary?.bundle?.bundle_version || 0) + 1;
  const bundleId = existing?.bundle_id || cache.summary?.bundle?.id || governanceVersion;
  const items = roles.flatMap((role, roleIndex) =>
    assets.map((asset, assetIndex) => {
      const existingPolicy = existing?.items.find((item) => item.role.id === role.id && item.asset.id === asset.id);
      if (existingPolicy) {
        return {
          ...existingPolicy,
          review_status: "suggested",
          policy_source: existingPolicy.policy_source || "local_fallback",
        };
      }
      const riskFlags = asset.risk_flags || [];
      const isHighRisk = riskFlags.some((flag) => /high|sensitive|敏感/i.test(flag));
      return {
        id: governanceVersion * 1000 + roleIndex * 100 + assetIndex + 1,
        role: {
          id: role.id || roleIndex + 1,
          label: asRoleLabel(role),
          position_name: role.position_name,
          position_level: role.position_level || "",
          org_path: role.org_path,
        },
        asset: {
          id: asset.id,
          asset_type: asset.asset_type,
          name: asset.asset_name,
          risk_flags: riskFlags,
        },
        allowed: true,
        default_output_style: isHighRisk ? "masked_detail" : "summary",
        insufficient_evidence_behavior: "refuse",
        allowed_question_types: ["analysis", "summary", "lookup"],
        forbidden_question_types: isHighRisk ? ["raw_sensitive_export"] : [],
        policy_source: "local_fallback",
        review_status: "suggested",
        risk_level: isHighRisk ? "high" : "medium",
        granular_rules: [],
      } satisfies RoleAssetPolicyItem;
    }),
  );

  return {
    bundle_id: bundleId,
    bundle_version: bundleVersion,
    governance_version: governanceVersion,
    review_status: "suggested",
    items,
    deprecated: false,
    read_only: false,
  };
}

function buildFallbackDeclaration(cache: SkillGovernanceSkillCache, skillId: number, governanceVersion: number): PermissionDeclaration {
  const roles = cacheRoles(cache);
  const assets = cacheAssets(cache);
  const policyResponse = cache.policies_response;
  const declarationVersion = Math.max(cache.declaration?.version || cache.declaration?.declaration_version || 0, 0) + 1;
  const generatedText = [
    "## Skill 使用权限声明",
    "",
    "### 适用服务岗位",
    ...(roles.length
      ? roles.map((role) => `- ${asRoleLabel(role)}：${role.org_path || "未标注组织路径"}`)
      : ["- 待补充服务岗位"]),
    "",
    "### 已绑定源域资产",
    ...(assets.length
      ? assets.map((asset) => `- ${asset.asset_name}（${asset.asset_type}）：${(asset.risk_flags || []).join("、") || "未标注风险"}`)
      : ["- 待绑定源域资产"]),
    "",
    "### 运行边界",
    "- 仅允许围绕已绑定资产进行摘要、检索和分析。",
    "- 缺少证据或来源未覆盖时必须先要求用户补充来源，不得编造。",
    "- 涉及敏感字段时默认脱敏输出，禁止直接导出原始明细。",
  ].join("\n");

  return {
    id: cache.declaration?.id || governanceVersion,
    version: declarationVersion,
    declaration_version: declarationVersion,
    bundle_id: policyResponse?.bundle_id || cache.summary?.bundle?.id || null,
    role_policy_bundle_version: policyResponse?.bundle_version || cache.summary?.bundle?.bundle_version || 0,
    governance_version: governanceVersion,
    text: generatedText,
    generated_text: generatedText,
    edited_text: null,
    status: "generated",
    stale_reason_codes: [],
    mounted_skill_version: null,
    mounted_at: null,
    mounted: false,
    mount_target: "SKILL.md",
    mount_mode: "local_fallback",
  };
}

function markReadiness(cache: SkillGovernanceSkillCache, skillId: number, ready: boolean, governanceVersion: number) {
  cache.readiness_response = {
    skill_id: skillId,
    readiness: {
      ready,
      skill_content_version: Math.max(cache.readiness_response?.readiness.skill_content_version || 0, 1),
      governance_version: governanceVersion,
      permission_declaration_version: cache.declaration?.version || cache.declaration?.declaration_version || null,
      blocking_issues: ready ? [] : ["missing_confirmed_declaration"],
    },
  };
  if (cache.latest_case_plan_response) {
    cache.latest_case_plan_response = {
      ...cache.latest_case_plan_response,
      readiness: cache.readiness_response.readiness,
      plan: cache.latest_case_plan_response.plan
        ? {
            ...cache.latest_case_plan_response.plan,
            status: ready ? cache.latest_case_plan_response.plan.status : "stale",
            governance_version: governanceVersion,
            permission_declaration_version: cache.readiness_response.readiness.permission_declaration_version,
            blocking_issues: ready ? [] : unique([...cache.latest_case_plan_response.plan.blocking_issues, "missing_confirmed_declaration"]),
          }
        : cache.latest_case_plan_response.plan,
    };
  }
}

async function saveServiceRolesFallback(skillId: number, payload: Record<string, unknown>) {
  return updateSkillGovernanceState((state) => {
    const cache = ensureSkillGovernanceCache(state, skillId);
    const governanceVersion = nextGovernanceVersion(cache);
    const rawRoles = Array.isArray(payload.roles) ? payload.roles as Array<Record<string, unknown>> : [];
    const roles = rawRoles.map((role, index) => {
      const positionName = typeof role.position_name === "string" ? role.position_name : "";
      const positionLevel = typeof role.position_level === "string" ? role.position_level : "";
      return {
        id: typeof role.id === "number" ? role.id : index + 1,
        org_path: typeof role.org_path === "string" ? role.org_path : "",
        position_name: positionName,
        position_level: positionLevel,
        role_label: typeof role.role_label === "string" ? role.role_label : asRoleLabel({ position_name: positionName, position_level: positionLevel }),
        status: "active",
      } satisfies ServiceRoleItem;
    });
    cache.service_roles = roles;
    if (cache.mount_context) cache.mount_context = { ...cache.mount_context, roles, projection_version: governanceVersion };
    cache.declaration = cache.declaration ? mergeDeclaration(cache.declaration, governanceVersion) : cache.declaration;
    markReadiness(cache, skillId, false, governanceVersion);
    updateSummaryFromCache(cache, skillId, governanceVersion);
    return ok({
      governance_version: governanceVersion,
      bundle_status: "stale",
      stale_downstream: DEFAULT_STALE_DOWNSTREAM,
      roles,
    });
  });
}

async function suggestPoliciesFallback(skillId: number) {
  return updateSkillGovernanceState((state) => {
    const cache = ensureSkillGovernanceCache(state, skillId);
    const roles = cacheRoles(cache);
    const assets = cacheAssets(cache);
    if (roles.length === 0) return fail(400, "missing_service_roles", "需先配置至少一个服务岗位。");
    if (assets.length === 0) return fail(400, "missing_bound_assets", "需先绑定至少一个源域资产。");
    const governanceVersion = nextGovernanceVersion(cache);
    cache.policies_response = buildFallbackPolicies(cache, skillId, governanceVersion);
    cache.declaration = cache.declaration ? mergeDeclaration(cache.declaration, governanceVersion) : cache.declaration;
    markReadiness(cache, skillId, false, governanceVersion);
    updateSummaryFromCache(cache, skillId, governanceVersion);
    return ok({
      job_id: `local-governance-policy-${skillId}-${governanceVersion}`,
      bundle_id: cache.policies_response.bundle_id,
      bundle_version: cache.policies_response.bundle_version,
      status: "queued",
      bundle_status: cache.policies_response.review_status,
    });
  });
}

async function generateDeclarationFallback(skillId: number) {
  return updateSkillGovernanceState((state) => {
    const cache = ensureSkillGovernanceCache(state, skillId);
    if (!cache.policies_response?.items.length) {
      return fail(400, "missing_policy_bundle", "需先生成岗位 × 资产策略，再生成权限声明。");
    }
    const governanceVersion = nextGovernanceVersion(cache);
    cache.declaration = buildFallbackDeclaration(cache, skillId, governanceVersion);
    markReadiness(cache, skillId, false, governanceVersion);
    updateSummaryFromCache(cache, skillId, governanceVersion);
    return ok({
      job_id: `local-permission-declaration-${skillId}-${governanceVersion}`,
      status: "queued",
      declaration_id: cache.declaration.id,
    });
  });
}

async function adoptDeclarationFallback(skillId: number, declarationId: number | undefined, payload: Record<string, unknown>) {
  return updateSkillGovernanceState((state) => {
    const cache = ensureSkillGovernanceCache(state, skillId);
    if (!cache.declaration || (declarationId && cache.declaration.id !== declarationId)) {
      return fail(404, "declaration_not_found", "未找到可挂载的权限声明");
    }
    const governanceVersion = nextGovernanceVersion(cache);
    const editedText = typeof payload.edited_text === "string" && payload.edited_text.trim()
      ? payload.edited_text
      : cache.declaration.edited_text;
    const text = editedText || cache.declaration.generated_text;
    cache.declaration = {
      ...cache.declaration,
      text,
      edited_text: editedText || null,
      status: "confirmed",
      governance_version: governanceVersion,
      stale_reason_codes: [],
      mounted: true,
      mounted_skill_version: governanceVersion,
      mounted_at: nowIso(),
      mount_target: "SKILL.md",
      mount_mode: "local_fallback",
    };
    markReadiness(cache, skillId, true, governanceVersion);
    updateSummaryFromCache(cache, skillId, governanceVersion);
    return ok({
      declaration: cache.declaration,
      skill_content_version: governanceVersion,
    });
  });
}

async function updateDeclarationTextFallback(skillId: number, declarationId: number | undefined, payload: Record<string, unknown>) {
  return updateSkillGovernanceState((state) => {
    const cache = ensureSkillGovernanceCache(state, skillId);
    if (!cache.declaration || (declarationId && cache.declaration.id !== declarationId)) {
      return fail(404, "declaration_not_found", "未找到可编辑的权限声明");
    }
    const text = typeof payload.text === "string" ? payload.text : cache.declaration.text;
    cache.declaration = {
      ...cache.declaration,
      text,
      edited_text: text,
      status: typeof payload.status === "string" ? payload.status : "edited",
      mounted: false,
    };
    updateSummaryFromCache(cache, skillId, cache.declaration.governance_version);
    return ok({ declaration: cache.declaration });
  });
}

async function confirmRoleAssetPoliciesFallback(skillId: number, payload: Record<string, unknown>) {
  return updateSkillGovernanceState((state) => {
    const cache = ensureSkillGovernanceCache(state, skillId);
    if (!cache.policies_response) return fail(400, "missing_policy_bundle", "没有可确认的岗位 × 资产策略。");
    const updates = Array.isArray(payload.policies) ? payload.policies as Array<Record<string, unknown>> : [];
    const byId = new Map(updates.map((item) => [item.id, item]));
    cache.policies_response = {
      ...cache.policies_response,
      review_status: "confirmed",
      items: cache.policies_response.items.map((policy) => {
        const update = byId.get(policy.id);
        return {
          ...policy,
          allowed: typeof update?.allowed === "boolean" ? update.allowed : policy.allowed,
          default_output_style: typeof update?.default_output_style === "string" ? update.default_output_style : policy.default_output_style,
          insufficient_evidence_behavior: typeof update?.insufficient_evidence_behavior === "string" ? update.insufficient_evidence_behavior : policy.insufficient_evidence_behavior,
          allowed_question_types: Array.isArray(update?.allowed_question_types) ? update.allowed_question_types as string[] : policy.allowed_question_types,
          forbidden_question_types: Array.isArray(update?.forbidden_question_types) ? update.forbidden_question_types as string[] : policy.forbidden_question_types,
          review_status: "confirmed",
        };
      }),
    };
    updateSummaryFromCache(cache, skillId, cache.policies_response.governance_version || currentGovernanceVersion(cache));
    return ok({
      bundle_id: cache.policies_response.bundle_id,
      updated_count: updates.length || cache.policies_response.items.length,
      review_status: "confirmed",
    });
  });
}

async function confirmGranularRulesFallback(skillId: number, payload: Record<string, unknown>) {
  return updateSkillGovernanceState((state) => {
    const cache = ensureSkillGovernanceCache(state, skillId);
    if (!cache.policies_response) return fail(400, "missing_policy_bundle", "没有可确认的细粒度规则。");
    const updates = Array.isArray(payload.rules) ? payload.rules as Array<Record<string, unknown>> : [];
    const byId = new Map(updates.map((item) => [item.id, item]));
    cache.policies_response = {
      ...cache.policies_response,
      items: cache.policies_response.items.map((policy) => ({
        ...policy,
        granular_rules: (policy.granular_rules || []).map((rule) => {
          const update = byId.get(rule.id);
          if (!update) return rule;
          return {
            ...rule,
            suggested_policy: typeof update.suggested_policy === "string" ? update.suggested_policy : rule.suggested_policy,
            mask_style: typeof update.mask_style === "string" || update.mask_style === null ? update.mask_style : rule.mask_style,
            confirmed: typeof update.confirmed === "boolean" ? update.confirmed : rule.confirmed,
            author_override_reason:
              typeof update.author_override_reason === "string" || update.author_override_reason === null
                ? update.author_override_reason
                : rule.author_override_reason,
          };
        }),
      })),
    };
    const governanceVersion = nextGovernanceVersion(cache);
    cache.declaration = cache.declaration ? mergeDeclaration(cache.declaration, governanceVersion) : cache.declaration;
    markReadiness(cache, skillId, false, governanceVersion);
    updateSummaryFromCache(cache, skillId, governanceVersion);
    return ok({
      bundle_id: cache.policies_response.bundle_id,
      updated_count: updates.length,
      review_status: cache.policies_response.review_status,
    });
  });
}

async function refreshBoundAssetsFallback(skillId: number) {
  return updateSkillGovernanceState((state) => {
    const cache = ensureSkillGovernanceCache(state, skillId);
    const governanceVersion = currentGovernanceVersion(cache) || 1;
    if (!cache.bound_assets && cache.mount_context?.assets) {
      cache.bound_assets = cloneSkillGovernanceValue(cache.mount_context.assets);
    }
    updateSummaryFromCache(cache, skillId, governanceVersion);
    return ok({
      skill_id: skillId,
      governance_version: governanceVersion,
      created_bundle_id: cache.policies_response?.bundle_id || cache.summary?.bundle?.id || null,
    });
  });
}

function resolveJobFallback(skillId: number, jobId?: string) {
  return ok({
    job_id: jobId || `local-governance-${skillId}`,
    skill_id: skillId,
    job_type: "local_fallback",
    status: "success",
    phase: "done",
    result: {},
    error: null,
  });
}

export function isSkillGovernanceManagedPath(pathname: string) {
  return parseRoute(pathname).kind !== "unknown";
}

export async function rememberSkillGovernanceBackendResponse(input: {
  method: string;
  pathname: string;
  backendBody: unknown;
  requestPayload?: Record<string, unknown>;
}): Promise<SkillGovernanceApiResult | null> {
  const route = parseRoute(input.pathname);
  if (route.kind === "unknown") return null;
  const envelope = asEnvelope(input.backendBody);
  if (!envelope?.ok) return null;

  if (route.kind === "skill" && route.resource === "role-package" && input.method.toUpperCase() === "PUT") {
    const data = envelope.data && typeof envelope.data === "object" ? envelope.data as Record<string, unknown> : undefined;
    const saved = await saveRolePackage(
      route.skillId,
      route.roleKey || String(input.requestPayload?.role_key || ""),
      input.requestPayload as SkillGovernanceRolePackagePayload,
      data,
    );
    return ok({
      ...(data || {}),
      ...saved,
      workflow_cards: buildRolePackageWorkflowCards({
        skillId: route.skillId,
        roleKey: saved.role_key,
        staleDownstream: saved.stale_downstream,
      }),
    });
  }

  if (input.method.toUpperCase() !== "GET") return null;

  return updateSkillGovernanceState((state) => {
    const skillId = route.kind === "contract_review"
      ? Number(Object.entries(state.skills).find(([, cache]) => cache.latest_case_plan_response?.plan?.id === route.planId)?.[0])
      : route.skillId;
    if (!Number.isFinite(skillId)) return null;
    const cache = ensureSkillGovernanceCache(state, skillId);
    cacheBackendData(cache, route, envelope.data);
    return Promise.resolve(mergeRolePackageOverlay(skillId, route, envelope.data, cache))
      .then(async (result) => {
        if (route.kind === "skill" && route.resource === "mounted-permissions") {
          return ok(await applyOrgMemoryGovernanceOverlay(skillId, result as MountedPermissions));
        }
        return ok(result);
      });
  });
}

export async function resolveSkillGovernanceRequest(
  method: string,
  pathname: string,
  payload: Record<string, unknown> = {},
): Promise<SkillGovernanceApiResult | null> {
  const route = parseRoute(pathname);
  if (route.kind === "unknown") return null;
  const normalizedMethod = method.toUpperCase();

  if (route.kind === "skill" && route.resource === "role-package" && normalizedMethod === "PUT") {
    const roleKey = route.roleKey || String(payload.role_key || "");
    if (!roleKey) return fail(400, "role_key_required", "缺少 role_key，无法保存角色 package");
    const saved = await saveRolePackage(route.skillId, roleKey, payload as SkillGovernanceRolePackagePayload);
    return ok({
      ...saved,
      workflow_cards: buildRolePackageWorkflowCards({
        skillId: route.skillId,
        roleKey: saved.role_key,
        staleDownstream: saved.stale_downstream,
      }),
    });
  }

  if (route.kind === "skill" && route.resource === "service-roles" && normalizedMethod === "PUT") {
    return saveServiceRolesFallback(route.skillId, payload);
  }
  if (route.kind === "skill" && route.resource === "bound-assets/refresh" && normalizedMethod === "POST") {
    return refreshBoundAssetsFallback(route.skillId);
  }
  if (route.kind === "skill" && route.resource === "suggest-role-asset-policies" && normalizedMethod === "POST") {
    return suggestPoliciesFallback(route.skillId);
  }
  if (route.kind === "skill" && route.resource === "declarations/generate" && normalizedMethod === "POST") {
    return generateDeclarationFallback(route.skillId);
  }
  if (route.kind === "skill" && route.resource === "declaration-adopt" && normalizedMethod === "PUT") {
    return adoptDeclarationFallback(route.skillId, route.declarationId, payload);
  }
  if (route.kind === "skill" && route.resource === "permission-declaration" && normalizedMethod === "PUT") {
    return updateDeclarationTextFallback(route.skillId, route.declarationId, payload);
  }
  if (route.kind === "skill" && route.resource === "role-asset-policies/confirm" && normalizedMethod === "PUT") {
    return confirmRoleAssetPoliciesFallback(route.skillId, payload);
  }
  if (route.kind === "skill" && route.resource === "granular-rules/confirm" && normalizedMethod === "PUT") {
    return confirmGranularRulesFallback(route.skillId, payload);
  }
  if (route.kind === "skill" && route.resource === "job" && normalizedMethod === "GET") {
    return resolveJobFallback(route.skillId, route.jobId);
  }

  if (normalizedMethod !== "GET") return null;

  const state = await readSkillGovernanceState();
  const skillId = route.kind === "contract_review"
    ? Number(Object.entries(state.skills).find(([, cache]) => cache.latest_case_plan_response?.plan?.id === route.planId)?.[0])
    : route.skillId;
  if (!Number.isFinite(skillId)) return hasDefaultDataForRoute(route) ? ok(defaultDataForRoute(0, route)) : null;
  const cache = state.skills[String(skillId)] || null;
  if (!cache) {
    return hasDefaultDataForRoute(route) ? ok(defaultDataForRoute(skillId, route)) : null;
  }
  const cached = cachedDataForRoute(cache, route);
  if (cached === null || cached === undefined) {
    return hasDefaultDataForRoute(route) ? ok(defaultDataForRoute(skillId, route)) : null;
  }
  const merged = mergeRolePackageOverlay(skillId, route, cached, cache);
  if (route.kind === "skill" && route.resource === "mounted-permissions") {
    return ok(await applyOrgMemoryGovernanceOverlay(skillId, merged as MountedPermissions));
  }
  return ok(merged);
}
