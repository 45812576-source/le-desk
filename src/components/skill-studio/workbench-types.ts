import type { TestFlowEntrySource } from "@/lib/test-flow-types";
import type { GovernanceAction } from "./types";

export type WorkbenchMode = "analysis" | "file" | "report" | "governance";

export type WorkbenchCardKind = "architect" | "governance" | "validation" | "system";

export type WorkbenchCardStatus = "pending" | "active" | "reviewing" | "adopted" | "rejected" | "dismissed";

export interface WorkbenchTarget {
  type: "prompt" | "source_file" | "report" | "governance_panel" | "analysis" | null;
  key: string | null;
}

export interface WorkbenchValidationSource {
  skillId?: number | null;
  planId?: number | null;
  planVersion?: number | null;
  caseCount?: number | null;
  sessionId?: number | null;
  reportId?: number | null;
  entrySource?: TestFlowEntrySource | string | null;
  decisionMode?: string | null;
  blockedStage?: string | null;
  blockedBefore?: string | null;
  sourceCasePlanId?: number | null;
  sourceCasePlanVersion?: number | null;
}

export interface WorkbenchCard {
  id: string;
  title: string;
  summary: string;
  status: WorkbenchCardStatus;
  kind: WorkbenchCardKind;
  mode: WorkbenchMode;
  phase: string;
  source: string;
  priority: number;
  target: WorkbenchTarget;
  sourceCardId?: string | null;
  stagedEditId?: string | null;
  actions?: GovernanceAction[];
  validationSource?: WorkbenchValidationSource | null;
  raw?: Record<string, unknown>;
}

export interface StudioWorkspaceState {
  mode: WorkbenchMode;
  currentTarget: WorkbenchTarget;
  currentCardId: string | null;
  validationSource?: WorkbenchValidationSource | null;
}

export const EMPTY_WORKBENCH_TARGET: WorkbenchTarget = { type: null, key: null };
