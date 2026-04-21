import type { WorkflowStateData } from "./workflow-protocol";
import { parseStructuredStudioMessage } from "./message-parser";
import type { StudioMetaDirective } from "./studio-meta";
import type {
  ArchitectOodaDecision,
  ArchitectPhaseSummary,
  ArchitectPriorityMatrix,
  ArchitectQuestion,
  ArchitectReadyForDraft,
  ArchitectStructure,
  AuditResult,
  ChatMessage,
  GovernanceActionCard,
  PhaseProgress,
  StudioDraft,
  StudioFileSplit,
  StudioSummary,
  StudioToolSuggestion,
} from "./types";

export interface PersistedStudioMessage {
  id: number;
  role: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RecoveredStudioHistory {
  messages: ChatMessage[];
  pendingSummary: StudioSummary | null;
  pendingDraft: StudioDraft | null;
  pendingToolSuggestion: StudioToolSuggestion | null;
  pendingFileSplit: StudioFileSplit | null;
  auditResult: AuditResult | null;
  pendingGovernanceActions: GovernanceActionCard[];
  phaseProgress: PhaseProgress[];
  architectQuestions: ArchitectQuestion[];
  architectStructures: ArchitectStructure[];
  architectPriorities: ArchitectPriorityMatrix | null;
  oodaDecisions: ArchitectOodaDecision[];
  pendingPhaseSummary: ArchitectPhaseSummary | null;
  architectReady: ArchitectReadyForDraft | null;
  studioMeta: StudioMetaDirective | null;
  answeredQuestionIdx: number;
  confirmedPhases: string[];
}

const COMPLETED_PHASE_TO_ARCHITECT_PHASE: Record<string, string> = {
  phase1: "phase_1_why",
  phase2: "phase_2_what",
  phase3: "phase_3_how",
};

const NEXT_PHASE_TO_ARCHITECT_PHASE: Record<string, string> = {
  phase1: "phase_1_why",
  phase2: "phase_2_what",
  phase3: "phase_3_how",
};

function architectPhaseToConfirmedPhase(phase: string | null | undefined): string | null {
  if (phase === "phase_1_why") return "phase_1_why";
  if (phase === "phase_2_what") return "phase_2_what";
  if (phase === "phase_3_how") return "phase_3_how";
  return null;
}

function uniquePush(values: string[], nextValue: string | null | undefined) {
  if (!nextValue || values.includes(nextValue)) return;
  values.push(nextValue);
}

function clearActiveArchitectState() {
  return {
    architectQuestions: [] as ArchitectQuestion[],
    architectStructures: [] as ArchitectStructure[],
    architectPriorities: null as ArchitectPriorityMatrix | null,
    pendingPhaseSummary: null as ArchitectPhaseSummary | null,
    architectReady: null as ArchitectReadyForDraft | null,
    answeredQuestionIdx: -1,
    currentArchitectPhase: null as string | null,
  };
}

export function recoverStudioHistory(
  persistedMessages: PersistedStudioMessage[],
  workflowState?: WorkflowStateData | null,
): RecoveredStudioHistory {
  let pendingSummary: StudioSummary | null = null;
  let pendingDraft: StudioDraft | null = null;
  let pendingToolSuggestion: StudioToolSuggestion | null = null;
  let pendingFileSplit: StudioFileSplit | null = null;
  let auditResult: AuditResult | null = null;
  let pendingGovernanceActions: GovernanceActionCard[] = [];
  let phaseProgress: PhaseProgress[] = [];
  let architectQuestions: ArchitectQuestion[] = [];
  let architectStructures: ArchitectStructure[] = [];
  let architectPriorities: ArchitectPriorityMatrix | null = null;
  let oodaDecisions: ArchitectOodaDecision[] = [];
  let pendingPhaseSummary: ArchitectPhaseSummary | null = null;
  let architectReady: ArchitectReadyForDraft | null = null;
  let studioMeta: StudioMetaDirective | null = null;
  let answeredQuestionIdx = -1;
  let currentArchitectPhase: string | null = null;
  const confirmedPhases: string[] = [];

  const messages = persistedMessages.map((message) => {
    if (message.role !== "assistant") {
      studioMeta = null;
      const trimmedContent = message.content.trim();
      if (trimmedContent === "确认，进入下一阶段") {
        if (pendingPhaseSummary) {
          uniquePush(confirmedPhases, architectPhaseToConfirmedPhase(pendingPhaseSummary.phase));
        }
        ({
          architectQuestions,
          architectStructures,
          architectPriorities,
          pendingPhaseSummary,
          architectReady,
          answeredQuestionIdx,
          currentArchitectPhase,
        } = clearActiveArchitectState());
      } else if (trimmedContent === "继续推进") {
        architectStructures = [];
        architectPriorities = null;
        pendingPhaseSummary = null;
      } else if (trimmedContent === "生成 Skill 草稿") {
        ({
          architectQuestions,
          architectStructures,
          architectPriorities,
          pendingPhaseSummary,
          architectReady,
          answeredQuestionIdx,
          currentArchitectPhase,
        } = clearActiveArchitectState());
      } else if (architectQuestions.length > 0 && currentArchitectPhase && !pendingPhaseSummary && !architectReady) {
        answeredQuestionIdx = architectQuestions.length - 1;
      }

      return {
        role: message.role as "user" | "assistant",
        text: message.content,
        loading: false,
      };
    }

    const parsed = parseStructuredStudioMessage(message.content);
    studioMeta = parsed.studioMeta;
    const latestQuestion = parsed.architectQuestions[parsed.architectQuestions.length - 1] || null;
    const messageArchitectPhase = parsed.pendingPhaseSummary?.phase || latestQuestion?.phase || currentArchitectPhase;

    if (parsed.summary) pendingSummary = parsed.summary;
    if (parsed.draft) {
      pendingDraft = parsed.draft;
      ({
        architectQuestions,
        architectStructures,
        architectPriorities,
        pendingPhaseSummary,
        architectReady,
        answeredQuestionIdx,
        currentArchitectPhase,
      } = clearActiveArchitectState());
    }
    if (parsed.toolSuggestion) pendingToolSuggestion = parsed.toolSuggestion;
    if (parsed.fileSplit) pendingFileSplit = parsed.fileSplit;
    if (parsed.auditResult) auditResult = parsed.auditResult;
    if (parsed.pendingGovernanceActions.length > 0) {
      pendingGovernanceActions = [...pendingGovernanceActions, ...parsed.pendingGovernanceActions];
    }
    if (parsed.phaseProgress.length > 0) {
      phaseProgress = [...phaseProgress, ...parsed.phaseProgress];
      for (const progress of parsed.phaseProgress) {
        uniquePush(
          confirmedPhases,
          COMPLETED_PHASE_TO_ARCHITECT_PHASE[progress.completed_phase],
        );
        if (progress.next_phase) {
          currentArchitectPhase = NEXT_PHASE_TO_ARCHITECT_PHASE[progress.next_phase] || currentArchitectPhase;
        }
      }
      architectQuestions = [];
      architectStructures = [];
      architectPriorities = null;
      pendingPhaseSummary = null;
      answeredQuestionIdx = -1;
    }

    if (parsed.architectQuestions.length > 0) {
      const nextPhase = latestQuestion?.phase || currentArchitectPhase;
      if (nextPhase && currentArchitectPhase && nextPhase !== currentArchitectPhase) {
        architectQuestions = [];
        architectStructures = [];
        architectPriorities = null;
        pendingPhaseSummary = null;
        answeredQuestionIdx = -1;
      }
      currentArchitectPhase = nextPhase;
      architectQuestions = [...architectQuestions, ...parsed.architectQuestions];
      answeredQuestionIdx = architectQuestions.length - 2;
    }

    if (parsed.architectStructures.length > 0) {
      if (messageArchitectPhase && currentArchitectPhase && messageArchitectPhase !== currentArchitectPhase) {
        architectStructures = [];
      }
      architectStructures = [...architectStructures, ...parsed.architectStructures];
    }

    if (parsed.architectPriorities.length > 0) {
      architectPriorities = parsed.architectPriorities[parsed.architectPriorities.length - 1] || null;
    }

    if (parsed.oodaDecisions.length > 0) {
      oodaDecisions = [...oodaDecisions, ...parsed.oodaDecisions];
    }

    if (parsed.pendingPhaseSummary) {
      if (currentArchitectPhase && parsed.pendingPhaseSummary.phase !== currentArchitectPhase) {
        architectQuestions = [];
        architectStructures = [];
        architectPriorities = null;
      }
      currentArchitectPhase = parsed.pendingPhaseSummary.phase;
      pendingPhaseSummary = parsed.pendingPhaseSummary;
      answeredQuestionIdx = architectQuestions.length - 1;
    }

    if (parsed.architectReady) {
      architectReady = parsed.architectReady;
      architectQuestions = [];
      architectStructures = [];
      architectPriorities = null;
      pendingPhaseSummary = null;
      answeredQuestionIdx = -1;
      currentArchitectPhase = "ready_for_draft";
    }

    return {
      role: message.role as "user" | "assistant",
      text: parsed.cleanText,
      loading: false,
    };
  });

  if (workflowState?.workflow_mode && workflowState.workflow_mode !== "architect_mode") {
    architectQuestions = [];
    architectStructures = [];
    architectPriorities = null;
    pendingPhaseSummary = null;
    architectReady = null;
    answeredQuestionIdx = -1;
  }

  return {
    messages,
    pendingSummary,
    pendingDraft,
    pendingToolSuggestion,
    pendingFileSplit,
    auditResult,
    pendingGovernanceActions,
    phaseProgress,
    architectQuestions,
    architectStructures,
    architectPriorities,
    oodaDecisions,
    pendingPhaseSummary,
    architectReady,
    studioMeta,
    answeredQuestionIdx,
    confirmedPhases,
  };
}
