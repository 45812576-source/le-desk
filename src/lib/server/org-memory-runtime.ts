import { readOrgMemoryState } from "@/lib/server/org-memory-db";
import type {
  OrgMemoryGovernanceVersion,
  OrgMemoryRedactionMode,
  OrgMemoryScope,
} from "@/lib/types";

export interface OrgMemoryRuntimeAccessCheckResult {
  allowed: boolean;
  governance_version_id: number | null;
  governance_version: number | null;
  rule_id: number | null;
  reason:
    | "no_effective_governance_version"
    | "skill_not_governed"
    | "target_not_in_rule"
    | "approval_required"
    | "explicitly_denied"
    | "allowed";
  required_redaction_mode: OrgMemoryRedactionMode | null;
  access_scope: OrgMemoryScope | null;
  matched_target: string | null;
}

function normalizeText(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function listRuleTargets(targets: string[]) {
  return targets.map((item) => normalizeText(item)).filter(Boolean);
}

function matchTarget(ruleTargets: string[], candidates: string[]) {
  const normalizedRuleTargets = listRuleTargets(ruleTargets);
  const normalizedCandidates = candidates.map((item) => normalizeText(item)).filter(Boolean);
  for (const candidate of normalizedCandidates) {
    const found = normalizedRuleTargets.find((target) => {
      return candidate === target
        || candidate.startsWith(`${target}/`)
        || target.startsWith(`${candidate}/`)
        || candidate.includes(target)
        || target.includes(candidate);
    });
    if (found) return found;
  }
  return null;
}

function getRuleForSkill(governanceVersion: OrgMemoryGovernanceVersion, skillId: number) {
  return governanceVersion.skill_access_rules.find((item) => item.skill_id === skillId) || null;
}

export function findCurrentEffectiveGovernanceVersion(
  versions: OrgMemoryGovernanceVersion[],
): OrgMemoryGovernanceVersion | null {
  return [...versions]
    .filter((item) => item.status === "effective")
    .sort((left, right) => (right.activated_at || "").localeCompare(left.activated_at || ""))
    [0] || null;
}

export function checkSkillKnowledgeAccess(
  skillId: number,
  governanceVersion: OrgMemoryGovernanceVersion | null,
  target: {
    folder_path?: string | null;
    title?: string | null;
    asset_name?: string | null;
  },
): OrgMemoryRuntimeAccessCheckResult {
  if (!governanceVersion) {
    return {
      allowed: false,
      governance_version_id: null,
      governance_version: null,
      rule_id: null,
      reason: "no_effective_governance_version",
      required_redaction_mode: null,
      access_scope: null,
      matched_target: null,
    };
  }

  const rule = getRuleForSkill(governanceVersion, skillId);
  if (!rule) {
    return {
      allowed: false,
      governance_version_id: governanceVersion.id,
      governance_version: governanceVersion.version,
      rule_id: null,
      reason: "skill_not_governed",
      required_redaction_mode: null,
      access_scope: null,
      matched_target: null,
    };
  }

  const matchedTarget = matchTarget(rule.knowledge_bases, [
    target.folder_path || "",
    target.title || "",
    target.asset_name || "",
  ]);
  if (!matchedTarget) {
    return {
      allowed: false,
      governance_version_id: governanceVersion.id,
      governance_version: governanceVersion.version,
      rule_id: rule.id,
      reason: "target_not_in_rule",
      required_redaction_mode: rule.redaction_mode,
      access_scope: rule.access_scope,
      matched_target: null,
    };
  }

  if (rule.decision === "deny") {
    return {
      allowed: false,
      governance_version_id: governanceVersion.id,
      governance_version: governanceVersion.version,
      rule_id: rule.id,
      reason: "explicitly_denied",
      required_redaction_mode: rule.redaction_mode,
      access_scope: rule.access_scope,
      matched_target: matchedTarget,
    };
  }

  if (rule.decision === "require_approval") {
    return {
      allowed: false,
      governance_version_id: governanceVersion.id,
      governance_version: governanceVersion.version,
      rule_id: rule.id,
      reason: "approval_required",
      required_redaction_mode: rule.redaction_mode,
      access_scope: rule.access_scope,
      matched_target: matchedTarget,
    };
  }

  return {
    allowed: true,
    governance_version_id: governanceVersion.id,
    governance_version: governanceVersion.version,
    rule_id: rule.id,
    reason: "allowed",
    required_redaction_mode: rule.redaction_mode,
    access_scope: rule.access_scope,
    matched_target: matchedTarget,
  };
}

export function checkSkillTableAccess(
  skillId: number,
  governanceVersion: OrgMemoryGovernanceVersion | null,
  target: {
    table_name?: string | null;
    asset_name?: string | null;
    asset_ref?: string | null;
  },
): OrgMemoryRuntimeAccessCheckResult {
  if (!governanceVersion) {
    return {
      allowed: false,
      governance_version_id: null,
      governance_version: null,
      rule_id: null,
      reason: "no_effective_governance_version",
      required_redaction_mode: null,
      access_scope: null,
      matched_target: null,
    };
  }

  const rule = getRuleForSkill(governanceVersion, skillId);
  if (!rule) {
    return {
      allowed: false,
      governance_version_id: governanceVersion.id,
      governance_version: governanceVersion.version,
      rule_id: null,
      reason: "skill_not_governed",
      required_redaction_mode: null,
      access_scope: null,
      matched_target: null,
    };
  }

  const matchedTarget = matchTarget(rule.data_tables, [
    target.table_name || "",
    target.asset_name || "",
    target.asset_ref || "",
  ]);
  if (!matchedTarget) {
    return {
      allowed: false,
      governance_version_id: governanceVersion.id,
      governance_version: governanceVersion.version,
      rule_id: rule.id,
      reason: "target_not_in_rule",
      required_redaction_mode: rule.redaction_mode,
      access_scope: rule.access_scope,
      matched_target: null,
    };
  }

  if (rule.decision === "deny") {
    return {
      allowed: false,
      governance_version_id: governanceVersion.id,
      governance_version: governanceVersion.version,
      rule_id: rule.id,
      reason: "explicitly_denied",
      required_redaction_mode: rule.redaction_mode,
      access_scope: rule.access_scope,
      matched_target: matchedTarget,
    };
  }

  if (rule.decision === "require_approval") {
    return {
      allowed: false,
      governance_version_id: governanceVersion.id,
      governance_version: governanceVersion.version,
      rule_id: rule.id,
      reason: "approval_required",
      required_redaction_mode: rule.redaction_mode,
      access_scope: rule.access_scope,
      matched_target: matchedTarget,
    };
  }

  return {
    allowed: true,
    governance_version_id: governanceVersion.id,
    governance_version: governanceVersion.version,
    rule_id: rule.id,
    reason: "allowed",
    required_redaction_mode: rule.redaction_mode,
    access_scope: rule.access_scope,
    matched_target: matchedTarget,
  };
}

export async function getCurrentEffectiveOrgMemoryGovernanceVersion() {
  const state = await readOrgMemoryState();
  return findCurrentEffectiveGovernanceVersion(state.governance_versions);
}

export async function checkCurrentSkillKnowledgeAccess(
  skillId: number,
  target: {
    folder_path?: string | null;
    title?: string | null;
    asset_name?: string | null;
  },
) {
  return checkSkillKnowledgeAccess(skillId, await getCurrentEffectiveOrgMemoryGovernanceVersion(), target);
}

export async function checkCurrentSkillTableAccess(
  skillId: number,
  target: {
    table_name?: string | null;
    asset_name?: string | null;
    asset_ref?: string | null;
  },
) {
  return checkSkillTableAccess(skillId, await getCurrentEffectiveOrgMemoryGovernanceVersion(), target);
}
