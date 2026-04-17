import type {
  OrgMemoryFormalConfigSource,
  OrgMemoryFormalConfigTimelineEntry,
  OrgMemoryPersistentState,
} from "@/lib/server/org-memory-db";
import { clone, nextId } from "@/lib/server/org-memory-repository";
import type { OrgMemoryAppliedConfig, OrgMemoryProposal } from "@/lib/types";

function nowIso() {
  return new Date().toISOString();
}

function buildFormalConfigSource(
  proposal: OrgMemoryProposal,
  appliedConfig: OrgMemoryAppliedConfig,
): OrgMemoryFormalConfigSource {
  return {
    active_proposal_id: proposal.id,
    applied_config_id: appliedConfig.id,
    knowledge_paths: clone(appliedConfig.knowledge_paths),
    classification_rules: clone(proposal.classification_rules),
    skill_mounts: clone(proposal.skill_mounts),
    conditions: clone(appliedConfig.conditions),
    updated_at: nowIso(),
  };
}

function appendTimelineEntry(
  state: OrgMemoryPersistentState,
  entry: Omit<OrgMemoryFormalConfigTimelineEntry, "id" | "created_at">,
) {
  state.formal_config_timeline.unshift({
    id: nextId(state.formal_config_timeline),
    created_at: nowIso(),
    ...entry,
  });
}

export function applyProposalToFormalConfig(
  state: OrgMemoryPersistentState,
  proposal: OrgMemoryProposal,
  appliedConfig: OrgMemoryAppliedConfig,
) {
  const source = buildFormalConfigSource(proposal, appliedConfig);
  state.formal_config_source = source;
  appendTimelineEntry(state, {
    proposal_id: proposal.id,
    applied_config_id: appliedConfig.id,
    action: "apply",
    note: null,
    source_snapshot: clone(source),
  });
  return source;
}

export function rollbackFormalConfigForProposal(
  state: OrgMemoryPersistentState,
  proposalId: number,
  appliedConfigId: number | null,
) {
  const ordered = [...state.formal_config_timeline].sort((left, right) => {
    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  });
  const targetIndex = ordered.findLastIndex((entry) => {
    return entry.proposal_id === proposalId && entry.action === "apply";
  });

  let restoredSource: OrgMemoryFormalConfigSource | null = null;
  if (targetIndex > 0) {
    for (let index = targetIndex - 1; index >= 0; index -= 1) {
      const candidate = ordered[index];
      if (candidate.source_snapshot) {
        restoredSource = clone(candidate.source_snapshot);
        break;
      }
    }
  }

  state.formal_config_source = restoredSource
    ? {
        ...restoredSource,
        updated_at: nowIso(),
      }
    : null;

  appendTimelineEntry(state, {
    proposal_id: proposalId,
    applied_config_id: appliedConfigId,
    action: "rollback",
    note: "已按版本链路回滚正式配置",
    source_snapshot: state.formal_config_source ? clone(state.formal_config_source) : null,
  });

  return state.formal_config_source;
}
