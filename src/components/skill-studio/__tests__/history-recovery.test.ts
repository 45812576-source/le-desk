import { describe, expect, it } from "vitest";

import { recoverStudioHistory } from "../history-recovery";
import type { WorkflowStateData } from "../workflow-protocol";

function assistantBlock(eventName: string, payload: Record<string, unknown>) {
  return {
    id: Math.floor(Math.random() * 100000),
    role: "assistant",
    content: ["```" + eventName, JSON.stringify(payload), "```"].join("\n"),
  };
}

function userMessage(content: string) {
  return {
    id: Math.floor(Math.random() * 100000),
    role: "user",
    content,
  };
}

describe("recoverStudioHistory", () => {
  it("keeps only the active architect phase artifacts after phase transition", () => {
    const workflowState: WorkflowStateData = {
      session_mode: "create_new_skill",
      workflow_mode: "architect_mode",
      phase: "phase_2_what",
      next_action: "collect_requirements",
    };

    const recovered = recoverStudioHistory([
      assistantBlock("architect_question", {
        phase: "phase_1_why",
        framework: "jtbd",
        question: "Phase 1 问题？",
      }),
      userMessage("先回答第一阶段"),
      assistantBlock("architect_phase_summary", {
        phase: "phase_1_why",
        summary: "阶段一完成",
        deliverables: ["根因"],
        ready_for_next: true,
      }),
      userMessage("确认，进入下一阶段"),
      assistantBlock("studio_phase_progress", {
        completed_phase: "phase1",
        phase_label: "问题定义",
        deliverables: ["根因"],
        next_phase: "phase2",
        next_label: "要素拆解",
      }),
      assistantBlock("architect_question", {
        phase: "phase_2_what",
        framework: "mece",
        question: "Phase 2 问题？",
      }),
      assistantBlock("architect_structure", {
        type: "issue_tree",
        title: "Phase 2 结构",
        data: {
          nodes: [{ id: "root", label: "Phase 2 结构", parent: null, children: [] }],
        },
      }),
    ], workflowState);

    expect(recovered.phaseProgress).toHaveLength(1);
    expect(recovered.confirmedPhases).toEqual(["phase_1_why"]);
    expect(recovered.architectQuestions).toHaveLength(1);
    expect(recovered.architectQuestions[0].question).toBe("Phase 2 问题？");
    expect(recovered.architectStructures).toHaveLength(1);
    expect(recovered.architectStructures[0].root).toBe("Phase 2 结构");
    expect(recovered.pendingPhaseSummary).toBeNull();
    expect(recovered.answeredQuestionIdx).toBe(-1);
  });

  it("marks the current architect question as answered after a user reply", () => {
    const recovered = recoverStudioHistory([
      assistantBlock("architect_question", {
        phase: "phase_1_why",
        framework: "jtbd",
        question: "当前阶段问题？",
      }),
      userMessage("这是我的回答"),
    ]);

    expect(recovered.architectQuestions).toHaveLength(1);
    expect(recovered.answeredQuestionIdx).toBe(0);
  });

  it("clears architect readiness once the draft phase starts", () => {
    const workflowState: WorkflowStateData = {
      session_mode: "create_new_skill",
      workflow_mode: "optimize_existing_skill",
      phase: "revise",
      next_action: "continue_chat",
    };

    const recovered = recoverStudioHistory([
      assistantBlock("architect_ready_for_draft", {
        summary: {
          key_elements: [{ name: "目标", priority: "P1", source_phase: "phase_3_how" }],
          failure_prevention: [],
          draft_approach: "generate_draft",
        },
      }),
      userMessage("生成 Skill 草稿"),
      assistantBlock("studio_draft", {
        system_prompt: "## Skill\n内容",
        change_note: "初版草稿",
      }),
    ], workflowState);

    expect(recovered.architectReady).toBeNull();
    expect(recovered.architectQuestions).toHaveLength(0);
    expect(recovered.pendingDraft?.system_prompt).toContain("## Skill");
  });
});
