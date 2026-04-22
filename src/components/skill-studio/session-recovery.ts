import type { StudioCardQueueLedger, StudioSessionPayload } from "@/lib/types";
import type { ArchitectArtifact, GovernanceCardData, StagedEdit } from "./types";
import type { WorkflowStateData } from "./workflow-protocol";
import type { CardQueueWindow } from "./workbench-types";
import { normalizeWorkflowCardPayload, parseWorkflowStatePayload } from "./workflow-adapter";
import { normalizeStagedEditPayload } from "./utils";

export interface HydratedStudioSessionRecovery {
  workflowState: WorkflowStateData | null;
  governanceCards: GovernanceCardData[];
  stagedEdits: StagedEdit[];
  queueWindow: CardQueueWindow | null;
  cardQueueLedger: StudioCardQueueLedger | null;
  architectArtifacts: ArchitectArtifact[];
  recoverySignature: string;
}

export function orderRecoveryRecords<T extends Record<string, unknown>>(
  items: T[],
  orderedIds: string[],
): T[] {
  if (!orderedIds.length) return items;
  const itemMap = new Map(
    items
      .filter((item) => item.id != null)
      .map((item) => [String(item.id), item] as const),
  );
  const ordered = orderedIds.map((id) => itemMap.get(id)).filter((item): item is T => Boolean(item));
  const remaining = items.filter((item) => !orderedIds.includes(String(item.id ?? "")));
  return [...ordered, ...remaining];
}

function formatArtifactTitle(artifactKey: string) {
  return artifactKey.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildStaleContractIdSet(data: StudioSessionPayload): Set<string> {
  const staleCardIds = new Set(data.stale_card_ids ?? data.card_queue_ledger?.stale ?? []);
  const cards = Array.isArray(data.cards)
    ? data.cards
    : Array.isArray(data.workflow_cards)
      ? data.workflow_cards
      : [];
  const staleContractIds = new Set<string>();
  for (const card of cards) {
    if (!card || typeof card !== "object") continue;
    const raw = card as Record<string, unknown>;
    const cardId = typeof raw.card_id === "string"
      ? raw.card_id
      : typeof raw.id === "string"
        ? raw.id
        : typeof raw.content === "object" && raw.content && typeof (raw.content as Record<string, unknown>).card_id === "string"
          ? String((raw.content as Record<string, unknown>).card_id)
          : null;
    if (!cardId || !staleCardIds.has(cardId)) continue;
    const contractId = typeof raw.contract_id === "string"
      ? raw.contract_id
      : typeof raw.content === "object" && raw.content && typeof (raw.content as Record<string, unknown>).contract_id === "string"
        ? String((raw.content as Record<string, unknown>).contract_id)
        : null;
    if (contractId) staleContractIds.add(contractId);
  }
  return staleContractIds;
}

export function buildArchitectArtifactsFromSession(data: StudioSessionPayload): ArchitectArtifact[] {
  const rawArtifacts = data.card_artifacts;
  if (!rawArtifacts || typeof rawArtifacts !== "object") return [];
  const staleContractIds = buildStaleContractIdSet(data);
  const artifacts: ArchitectArtifact[] = [];
  for (const [contractId, artifactMap] of Object.entries(rawArtifacts)) {
    if (!artifactMap || typeof artifactMap !== "object") continue;
    const phase = contractId.split(".")[1] ?? null;
    for (const [artifactKey, artifactData] of Object.entries(artifactMap as Record<string, unknown>)) {
      artifacts.push({
        id: `session-artifact:${contractId}:${artifactKey}`,
        artifactKey,
        title: formatArtifactTitle(artifactKey),
        summary: contractId,
        phase,
        contractId,
        stale: staleContractIds.has(contractId),
        data: artifactData,
      });
    }
  }
  return artifacts;
}

export function hydrateStudioSessionRecovery(
  skillId: number,
  data: StudioSessionPayload,
  source = "memo-recovery",
): HydratedStudioSessionRecovery {
  const workflowState = data.workflow_state
    ? parseWorkflowStatePayload(data.workflow_state as Record<string, unknown>)
    : null;
  const recoveryCards = Array.isArray(data.cards)
    ? data.cards
    : Array.isArray(data.workflow_cards)
      ? data.workflow_cards
      : [];
  const recoveryEdits = Array.isArray(data.staged_edits) ? data.staged_edits : [];
  const explicitCardOrder = Array.isArray(data.card_order)
    ? data.card_order.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  const governanceCards = orderRecoveryRecords(recoveryCards, explicitCardOrder)
    .map((card) => normalizeWorkflowCardPayload(card, source));
  const stagedEdits = recoveryEdits.map((edit) => normalizeStagedEditPayload(edit, source));
  const queueWindow = (
    data.queue_window
    ?? data.card_queue_window
    ?? workflowState?.queue_window
    ?? null
  ) as CardQueueWindow | null;
  const cardQueueLedger = data.card_queue_ledger ?? null;
  const architectArtifacts = buildArchitectArtifactsFromSession(data);
  const signatureToken = data.recovery_revision ?? data.recovery_updated_at ?? data.memo_version ?? "none";
  return {
    workflowState,
    governanceCards,
    stagedEdits,
    queueWindow,
    cardQueueLedger,
    architectArtifacts,
    recoverySignature: `${skillId}:${signatureToken}`,
  };
}
