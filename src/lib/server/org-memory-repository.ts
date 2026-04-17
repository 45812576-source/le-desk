import type { OrgMemoryPersistentState } from "@/lib/server/org-memory-db";
import type {
  ApprovalRequest,
  OrgMemoryAppliedConfigVersion,
  OrgMemoryProposal,
  OrgMemorySnapshot,
  OrgMemorySource,
} from "@/lib/types";

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function nextId(items: Array<{ id: number }>) {
  return Math.max(0, ...items.map((item) => item.id)) + 1;
}

export function listSources(state: OrgMemoryPersistentState) {
  return clone(state.sources);
}

export function listSnapshots(state: OrgMemoryPersistentState) {
  return clone(state.snapshots);
}

export function listProposals(state: OrgMemoryPersistentState) {
  return clone(state.proposals);
}

export function findSource(state: OrgMemoryPersistentState, id: number) {
  return state.sources.find((item) => item.id === id) || null;
}

export function findSnapshot(state: OrgMemoryPersistentState, id: number) {
  return state.snapshots.find((item) => item.id === id) || null;
}

export function findProposal(state: OrgMemoryPersistentState, id: number) {
  return state.proposals.find((item) => item.id === id) || null;
}

export function prependSource(state: OrgMemoryPersistentState, source: OrgMemorySource) {
  state.sources.unshift(source);
}

export function prependSnapshot(state: OrgMemoryPersistentState, snapshot: OrgMemorySnapshot) {
  state.snapshots.unshift(snapshot);
}

export function prependProposal(state: OrgMemoryPersistentState, proposal: OrgMemoryProposal) {
  state.proposals.unshift(proposal);
}

export function listApprovals(state: OrgMemoryPersistentState) {
  return [...state.approvals].sort((left, right) => {
    return (right.created_at || "").localeCompare(left.created_at || "");
  });
}

export function findApproval(state: OrgMemoryPersistentState, id: number) {
  return state.approvals.find((item) => item.id === id) || null;
}

export function findApprovalByProposalId(state: OrgMemoryPersistentState, proposalId: number) {
  return state.approvals.find((item) => {
    return item.target_type === "org_memory_proposal" && item.target_id === proposalId;
  }) || null;
}

export function findApprovalLinkByProposalId(state: OrgMemoryPersistentState, proposalId: number) {
  return state.approval_links.find((item) => item.proposal_id === proposalId) || null;
}

export function findApprovalLinkByRequestId(state: OrgMemoryPersistentState, approvalRequestId: number) {
  return state.approval_links.find((item) => item.approval_request_id === approvalRequestId) || null;
}

export function upsertApprovalLink(state: OrgMemoryPersistentState, link: OrgMemoryPersistentState["approval_links"][number]) {
  const index = state.approval_links.findIndex((item) => item.proposal_id === link.proposal_id);
  if (index >= 0) {
    state.approval_links[index] = link;
  } else {
    state.approval_links.unshift(link);
  }
}

export function upsertApproval(state: OrgMemoryPersistentState, approval: ApprovalRequest) {
  const index = state.approvals.findIndex((item) => item.id === approval.id);
  if (index >= 0) {
    state.approvals[index] = approval;
  } else {
    state.approvals.unshift(approval);
  }
}

export function getConfigVersions(state: OrgMemoryPersistentState, proposalId: number) {
  return state.config_versions_by_proposal_id[String(proposalId)] || [];
}

export function setConfigVersions(
  state: OrgMemoryPersistentState,
  proposalId: number,
  versions: OrgMemoryAppliedConfigVersion[],
) {
  state.config_versions_by_proposal_id[String(proposalId)] = versions;
}
