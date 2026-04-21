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
  | { kind: "skill"; skillId: number; resource: string; roleKey?: string }
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

  const skill = pathname.match(/^\/skill-governance\/(\d+)\/(summary|service-roles|bound-assets|mount-context|mounted-permissions|role-asset-policies|declarations\/latest)$/);
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
    return ok({ ...(data || {}), ...saved });
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
    return ok(saved);
  }

  if (normalizedMethod !== "GET") return null;

  const state = await readSkillGovernanceState();
  const skillId = route.kind === "contract_review"
    ? Number(Object.entries(state.skills).find(([, cache]) => cache.latest_case_plan_response?.plan?.id === route.planId)?.[0])
    : route.skillId;
  if (!Number.isFinite(skillId)) return null;
  const cache = state.skills[String(skillId)] || null;
  if (!cache) return null;
  const cached = cachedDataForRoute(cache, route);
  if (cached === null || cached === undefined) return null;
  const merged = mergeRolePackageOverlay(skillId, route, cached, cache);
  if (route.kind === "skill" && route.resource === "mounted-permissions") {
    return ok(await applyOrgMemoryGovernanceOverlay(skillId, merged as MountedPermissions));
  }
  return ok(merged);
}
