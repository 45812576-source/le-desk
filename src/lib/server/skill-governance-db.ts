import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
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
  ServiceRoleItem,
  TestCaseDraftItem,
} from "@/components/skill-studio/SkillGovernanceCards";

export type SkillGovernancePoliciesResponse = {
  bundle_id?: number;
  bundle_version: number;
  governance_version?: number;
  review_status: string;
  items: RoleAssetPolicyItem[];
  deprecated?: boolean;
  read_only?: boolean;
};

export type SkillGovernanceRolePackagePayload = {
  role_key?: string;
  role?: {
    org_path?: string;
    position_name?: string;
    position_level?: string | null;
    role_label?: string;
  };
  writeback_mode?: string;
  stale_downstream?: string[];
  package?: {
    field_rules?: Array<Record<string, unknown>>;
    knowledge_permissions?: Array<Record<string, unknown>>;
    asset_mounts?: Array<Record<string, unknown>>;
  };
};

export interface SkillGovernanceRolePackageRecord {
  role_key: string;
  role: {
    org_path: string;
    position_name: string;
    position_level: string;
    role_label: string;
  };
  package_version: number;
  governance_version: number;
  stale_downstream: string[];
  payload: SkillGovernanceRolePackagePayload;
  updated_at: string;
}

export interface SkillGovernanceSkillCache {
  summary: GovernanceSummary | null;
  service_roles: ServiceRoleItem[] | null;
  bound_assets: BoundAssetItem[] | null;
  mount_context: MountContext | null;
  mounted_permissions: MountedPermissions | null;
  policies_response: SkillGovernancePoliciesResponse | null;
  declaration: PermissionDeclaration | null;
  readiness_response: { skill_id: number; readiness: GovernanceReadiness } | null;
  latest_case_plan_response: {
    skill_id: number;
    readiness: GovernanceReadiness;
    plan: PermissionCasePlan | null;
    cases?: TestCaseDraftItem[];
  } | null;
  contract_reviews_by_plan_id: Record<string, PermissionContractReview | null>;
  role_packages: Record<string, SkillGovernanceRolePackageRecord>;
}

export interface SkillGovernancePersistentState {
  schema_version: 1;
  skills: Record<string, SkillGovernanceSkillCache>;
}

const DEFAULT_STATE_FILE = path.join(process.cwd(), ".skill-governance", "store.json");

let updateQueue: Promise<void> = Promise.resolve();

function stateFilePath() {
  return process.env.SKILL_GOVERNANCE_STATE_FILE || DEFAULT_STATE_FILE;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createEmptySkillCache(): SkillGovernanceSkillCache {
  return {
    summary: null,
    service_roles: null,
    bound_assets: null,
    mount_context: null,
    mounted_permissions: null,
    policies_response: null,
    declaration: null,
    readiness_response: null,
    latest_case_plan_response: null,
    contract_reviews_by_plan_id: {},
    role_packages: {},
  };
}

function createSeedState(): SkillGovernancePersistentState {
  return {
    schema_version: 1,
    skills: {},
  };
}

function normalizeSkillCache(value: unknown): SkillGovernanceSkillCache {
  const candidate = typeof value === "object" && value !== null
    ? value as Partial<SkillGovernanceSkillCache>
    : {};

  return {
    ...createEmptySkillCache(),
    ...candidate,
    contract_reviews_by_plan_id:
      typeof candidate.contract_reviews_by_plan_id === "object" && candidate.contract_reviews_by_plan_id !== null
        ? candidate.contract_reviews_by_plan_id
        : {},
    role_packages:
      typeof candidate.role_packages === "object" && candidate.role_packages !== null
        ? candidate.role_packages
        : {},
  };
}

function normalizeState(value: unknown): SkillGovernancePersistentState {
  const candidate = typeof value === "object" && value !== null
    ? value as Partial<SkillGovernancePersistentState>
    : {};
  const rawSkills = typeof candidate.skills === "object" && candidate.skills !== null
    ? candidate.skills
    : {};

  return {
    schema_version: 1,
    skills: Object.fromEntries(
      Object.entries(rawSkills).map(([skillId, cache]) => [skillId, normalizeSkillCache(cache)]),
    ),
  };
}

async function persistState(state: SkillGovernancePersistentState) {
  const filePath = stateFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export async function readSkillGovernanceState(): Promise<SkillGovernancePersistentState> {
  try {
    const raw = await readFile(stateFilePath(), "utf8");
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      const seed = createSeedState();
      await persistState(seed);
      return seed;
    }
    throw error;
  }
}

export async function updateSkillGovernanceState<T>(
  updater: (state: SkillGovernancePersistentState) => T | Promise<T>,
): Promise<T> {
  let result!: T;
  const run = updateQueue.then(async () => {
    const state = await readSkillGovernanceState();
    result = await updater(state);
    await persistState(state);
  });
  updateQueue = run.then(() => undefined, () => undefined);
  await run;
  return result;
}

export function ensureSkillGovernanceCache(
  state: SkillGovernancePersistentState,
  skillId: number,
): SkillGovernanceSkillCache {
  const key = String(skillId);
  if (!state.skills[key]) {
    state.skills[key] = createEmptySkillCache();
  }
  return state.skills[key];
}

export function cloneSkillGovernanceValue<T>(value: T): T {
  return clone(value);
}

export async function resetSkillGovernancePersistentState() {
  await updateSkillGovernanceState((state) => {
    state.schema_version = 1;
    state.skills = {};
  });
}
