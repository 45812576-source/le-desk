import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MOCK_ORG_MEMORY_PROPOSALS,
  MOCK_ORG_MEMORY_SNAPSHOTS,
  MOCK_ORG_MEMORY_SOURCES,
} from "@/lib/org-memory-mock";
import type {
  ApprovalRequest,
  OrgMemoryClassificationRule,
  OrgMemoryAppliedConfigVersion,
  OrgMemoryProposal,
  OrgMemorySnapshot,
  OrgMemorySkillMount,
  OrgMemorySource,
} from "@/lib/types";

export interface OrgMemoryApprovalLink {
  proposal_id: number;
  approval_request_id: number;
  source: "local" | "remote";
  external_status: string;
  external_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
}

export interface OrgMemoryFormalConfigSource {
  active_proposal_id: number | null;
  applied_config_id: number | null;
  knowledge_paths: string[];
  classification_rules: OrgMemoryClassificationRule[];
  skill_mounts: OrgMemorySkillMount[];
  conditions: unknown[];
  updated_at: string | null;
}

export interface OrgMemoryFormalConfigTimelineEntry {
  id: number;
  proposal_id: number;
  applied_config_id: number | null;
  action: "apply" | "rollback";
  note: string | null;
  created_at: string;
  source_snapshot: OrgMemoryFormalConfigSource | null;
}

export interface OrgMemoryPersistentState {
  schema_version: 1;
  sources: OrgMemorySource[];
  snapshots: OrgMemorySnapshot[];
  proposals: OrgMemoryProposal[];
  approvals: ApprovalRequest[];
  approval_links: OrgMemoryApprovalLink[];
  formal_config_source: OrgMemoryFormalConfigSource | null;
  formal_config_timeline: OrgMemoryFormalConfigTimelineEntry[];
  config_versions_by_proposal_id: Record<string, OrgMemoryAppliedConfigVersion[]>;
}

const DEFAULT_STATE_FILE = path.join(process.cwd(), ".org-memory", "store.json");

let updateQueue: Promise<void> = Promise.resolve();

function stateFilePath() {
  return process.env.ORG_MEMORY_STATE_FILE || DEFAULT_STATE_FILE;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createSeedState(): OrgMemoryPersistentState {
  return {
    schema_version: 1,
    sources: clone(MOCK_ORG_MEMORY_SOURCES),
    snapshots: clone(MOCK_ORG_MEMORY_SNAPSHOTS),
    proposals: clone(MOCK_ORG_MEMORY_PROPOSALS),
    approvals: [],
    approval_links: [],
    formal_config_source: null,
    formal_config_timeline: [],
    config_versions_by_proposal_id: {},
  };
}

function normalizeState(value: unknown): OrgMemoryPersistentState {
  const candidate = typeof value === "object" && value !== null
    ? value as Partial<OrgMemoryPersistentState>
    : {};

  return {
    schema_version: 1,
    sources: Array.isArray(candidate.sources) ? candidate.sources : clone(MOCK_ORG_MEMORY_SOURCES),
    snapshots: Array.isArray(candidate.snapshots) ? candidate.snapshots : clone(MOCK_ORG_MEMORY_SNAPSHOTS),
    proposals: Array.isArray(candidate.proposals) ? candidate.proposals : clone(MOCK_ORG_MEMORY_PROPOSALS),
    approvals: Array.isArray(candidate.approvals) ? candidate.approvals : [],
    approval_links: Array.isArray(candidate.approval_links) ? candidate.approval_links : [],
    formal_config_source:
      typeof candidate.formal_config_source === "object" && candidate.formal_config_source !== null
        ? candidate.formal_config_source
        : null,
    formal_config_timeline: Array.isArray(candidate.formal_config_timeline) ? candidate.formal_config_timeline : [],
    config_versions_by_proposal_id:
      typeof candidate.config_versions_by_proposal_id === "object" && candidate.config_versions_by_proposal_id !== null
        ? candidate.config_versions_by_proposal_id
        : {},
  };
}

async function persistState(state: OrgMemoryPersistentState) {
  const filePath = stateFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export async function readOrgMemoryState(): Promise<OrgMemoryPersistentState> {
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

export async function updateOrgMemoryState<T>(
  updater: (state: OrgMemoryPersistentState) => T | Promise<T>,
): Promise<T> {
  let result!: T;
  const run = updateQueue.then(async () => {
    const state = await readOrgMemoryState();
    result = await updater(state);
    await persistState(state);
  });
  updateQueue = run.then(() => undefined, () => undefined);
  await run;
  return result;
}

export async function resetOrgMemoryPersistentState() {
  await updateOrgMemoryState((state) => {
    const seed = createSeedState();
    state.sources = seed.sources;
    state.snapshots = seed.snapshots;
    state.proposals = seed.proposals;
    state.approvals = seed.approvals;
    state.approval_links = seed.approval_links;
    state.formal_config_source = seed.formal_config_source;
    state.formal_config_timeline = seed.formal_config_timeline;
    state.config_versions_by_proposal_id = seed.config_versions_by_proposal_id;
  });
}
