import type {
  MountContext,
  MountedKnowledgePermission,
  MountedPermissions,
  RoleAssetPolicyItem,
  ServiceRoleItem,
} from "./SkillGovernanceCards";
import { serviceRoleKey } from "./role-recommendation";

export type RolePackageFieldRuleDraft = {
  policy_id: number;
  rule_id: number;
  asset_id: number;
  asset_name: string;
  asset_type: string;
  target_ref: string;
  target_summary: string;
  granularity_type: string;
  suggested_policy: string;
  mask_style: string | null;
  confirmed: boolean;
  author_override_reason: string | null;
};

export type RolePackageKnowledgeDraft = {
  asset_id: number;
  asset_name: string;
  asset_ref: string;
  knowledge_id: number;
  title: string;
  folder_path: string | null;
  desensitization_level: string;
  grant_actions: string[];
  enabled: boolean;
  source_refs: Array<Record<string, unknown>>;
};

export type RolePackageAssetDraft = {
  asset_id: number;
  asset_type: string;
  asset_ref_type: string;
  asset_ref_id: number;
  asset_name: string;
  binding_mode: string;
  enabled: boolean;
};

export type RolePackageDraft = {
  role_key: string;
  role: {
    org_path: string;
    position_name: string;
    position_level: string;
    role_label: string;
  };
  field_rules: RolePackageFieldRuleDraft[];
  knowledge_permissions: RolePackageKnowledgeDraft[];
  asset_mounts: RolePackageAssetDraft[];
  source_projection_version?: number | null;
};

export type RolePackageWritebackPayload = {
  role_key: string;
  role: RolePackageDraft["role"];
  writeback_mode: "upsert_role_package";
  stale_downstream: string[];
  package: {
    field_rules: Array<{
      policy_id: number;
      rule_id: number;
      asset_id: number;
      target_ref: string;
      suggested_policy: string;
      mask_style: string | null;
      confirmed: boolean;
      author_override_reason: string | null;
    }>;
    knowledge_permissions: Array<{
      asset_id: number;
      asset_ref: string;
      knowledge_id: number;
      desensitization_level: string;
      grant_actions: string[];
      enabled: boolean;
      source_refs: Array<Record<string, unknown>>;
    }>;
    asset_mounts: Array<{
      asset_id: number;
      asset_ref_type: string;
      asset_ref_id: number;
      binding_mode: string;
      enabled: boolean;
    }>;
  };
};

function policyMatchesRole(policy: RoleAssetPolicyItem, role: ServiceRoleItem) {
  return policy.role.position_name === role.position_name
    || policy.role.label === role.role_label
    || serviceRoleKey({
      org_path: policy.role.org_path,
      position_name: policy.role.position_name,
      position_level: policy.role.position_level,
    }) === serviceRoleKey(role);
}

function toKnowledgeDraft(item: MountedKnowledgePermission): RolePackageKnowledgeDraft {
  return {
    asset_id: item.asset_id,
    asset_name: item.asset_name,
    asset_ref: item.asset_ref,
    knowledge_id: item.knowledge_id,
    title: item.title,
    folder_path: item.folder_path || null,
    desensitization_level: item.snapshot_desensitization_level || "inherit",
    grant_actions: item.grant_actions || [],
    enabled: item.blocking_issues.length === 0,
    source_refs: item.source_refs || [],
  };
}

export function buildRolePackageDraft({
  role,
  policies,
  mountContext,
  mountedPermissions,
}: {
  role: ServiceRoleItem;
  policies: RoleAssetPolicyItem[];
  mountContext: MountContext | null;
  mountedPermissions: MountedPermissions | null;
}): RolePackageDraft {
  const rolePolicies = policies.filter((policy) => policyMatchesRole(policy, role));
  return {
    role_key: serviceRoleKey(role),
    role: {
      org_path: role.org_path,
      position_name: role.position_name,
      position_level: role.position_level || "",
      role_label: role.role_label,
    },
    field_rules: rolePolicies.flatMap((policy) =>
      (policy.granular_rules || [])
        .filter((rule) => rule.granularity_type === "field")
        .map((rule) => ({
          policy_id: policy.id,
          rule_id: rule.id,
          asset_id: policy.asset.id,
          asset_name: policy.asset.name,
          asset_type: policy.asset.asset_type,
          target_ref: rule.target_ref,
          target_summary: rule.target_summary || rule.target_ref,
          granularity_type: rule.granularity_type,
          suggested_policy: rule.suggested_policy,
          mask_style: rule.mask_style || null,
          confirmed: rule.confirmed,
          author_override_reason: rule.author_override_reason || null,
        })),
    ),
    knowledge_permissions: (mountedPermissions?.knowledge_permissions || []).map(toKnowledgeDraft),
    asset_mounts: (mountContext?.assets || []).map((asset) => ({
      asset_id: asset.id,
      asset_type: asset.asset_type,
      asset_ref_type: asset.asset_ref_type,
      asset_ref_id: asset.asset_ref_id,
      asset_name: asset.asset_name,
      binding_mode: asset.binding_mode,
      enabled: asset.status !== "disabled",
    })),
    source_projection_version: mountedPermissions?.projection_version || mountContext?.projection_version || null,
  };
}

export function serializeRolePackageWriteback(draft: RolePackageDraft): RolePackageWritebackPayload {
  return {
    role_key: draft.role_key,
    role: draft.role,
    writeback_mode: "upsert_role_package",
    stale_downstream: [
      "mounted_permissions",
      "permission_declaration",
      "sandbox_case_plan",
    ],
    package: {
      field_rules: draft.field_rules.map((rule) => ({
        policy_id: rule.policy_id,
        rule_id: rule.rule_id,
        asset_id: rule.asset_id,
        target_ref: rule.target_ref,
        suggested_policy: rule.suggested_policy,
        mask_style: rule.mask_style || null,
        confirmed: rule.confirmed,
        author_override_reason: rule.author_override_reason?.trim() || null,
      })),
      knowledge_permissions: draft.knowledge_permissions.map((item) => ({
        asset_id: item.asset_id,
        asset_ref: item.asset_ref,
        knowledge_id: item.knowledge_id,
        desensitization_level: item.desensitization_level,
        grant_actions: item.grant_actions,
        enabled: item.enabled,
        source_refs: item.source_refs,
      })),
      asset_mounts: draft.asset_mounts.map((asset) => ({
        asset_id: asset.asset_id,
        asset_ref_type: asset.asset_ref_type,
        asset_ref_id: asset.asset_ref_id,
        binding_mode: asset.binding_mode,
        enabled: asset.enabled,
      })),
    },
  };
}
