import type { GovernanceCardData, StagedEdit } from "@/components/skill-studio/types";

type GovernanceCardStatus = GovernanceCardData["status"];
type StagedEditStatus = StagedEdit["status"];
type ResolutionStatus = GovernanceCardStatus | StagedEditStatus;

type StatusLedger<TStatus extends ResolutionStatus> = Record<string, { status: TStatus; updatedAt: number }>;
type SourceCollection<T extends { id: string; source?: string }> = Record<string, T[]>;

export interface StudioReconcileResult {
  governanceCards: GovernanceCardData[];
  stagedEdits: StagedEdit[];
}

const SOURCE_PRIORITY_RULES: Array<{ prefix: string; priority: number }> = [
  { prefix: "studio-chat:", priority: 500 },
  { prefix: "preflight:", priority: 400 },
  { prefix: "sandbox-report:", priority: 350 },
  { prefix: "memo-recovery", priority: 100 },
];

function getSourcePriority(source?: string): number {
  if (!source) return 200;
  const matched = SOURCE_PRIORITY_RULES.find((rule) => source.startsWith(rule.prefix));
  return matched?.priority ?? 200;
}

function hasResolvedStatus(status: string): boolean {
  return status !== "pending";
}

function pickPreferredEntity<T extends { source?: string; status: string }>(current: T | undefined, incoming: T): T {
  if (!current) return incoming;
  const currentPriority = getSourcePriority(current.source);
  const incomingPriority = getSourcePriority(incoming.source);
  if (incomingPriority !== currentPriority) {
    return incomingPriority > currentPriority ? incoming : current;
  }
  const currentResolved = hasResolvedStatus(current.status);
  const incomingResolved = hasResolvedStatus(incoming.status);
  if (incomingResolved !== currentResolved) {
    return incomingResolved ? incoming : current;
  }
  return incoming;
}

function reconcileEntityCollection<TStatus extends ResolutionStatus, T extends { id: string; source?: string; status: TStatus }>(
  collections: SourceCollection<T>,
  ledger: StatusLedger<TStatus>,
): T[] {
  const entitiesById = new Map<string, T>();
  Object.entries(collections).forEach(([source, items]) => {
    items.forEach((item) => {
      const normalizedItem = item.source === source ? item : { ...item, source };
      entitiesById.set(item.id, pickPreferredEntity(entitiesById.get(item.id), normalizedItem));
    });
  });

  return Array.from(entitiesById.values()).map((item) => {
    const ledgerEntry = ledger[item.id];
    if (!ledgerEntry || item.status === ledgerEntry.status) return item;
    return { ...item, status: ledgerEntry.status };
  });
}

export function reconcileStudioArtifacts(params: {
  governanceCardSources: SourceCollection<GovernanceCardData>;
  stagedEditSources: SourceCollection<StagedEdit>;
  governanceCardLedger: StatusLedger<GovernanceCardStatus>;
  stagedEditLedger: StatusLedger<StagedEditStatus>;
}): StudioReconcileResult {
  return {
    governanceCards: reconcileEntityCollection(params.governanceCardSources, params.governanceCardLedger),
    stagedEdits: reconcileEntityCollection(params.stagedEditSources, params.stagedEditLedger),
  };
}
