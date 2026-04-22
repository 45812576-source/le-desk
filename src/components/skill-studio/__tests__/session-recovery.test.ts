import { describe, expect, it } from "vitest";

import { hydrateStudioSessionRecovery } from "../session-recovery";
import type { StudioSessionPayload } from "@/lib/types";

describe("hydrateStudioSessionRecovery", () => {
  it("hydrates cards, queue ledger and card artifacts from studio session", () => {
    const session: StudioSessionPayload = {
      skill_id: 7,
      recovery_revision: 3,
      workflow_state: {
        session_mode: "create_new_skill",
        workflow_mode: "architect_mode",
        phase: "phase_2_what",
        next_action: "review_cards",
      },
      card_order: ["card-b", "card-a"],
      cards: [
        {
          id: "card-a",
          contract_id: "architect.why.jtbd",
          title: "Why 卡",
          status: "pending",
          content: { summary: "识别真实问题" },
        },
        {
          id: "card-b",
          contract_id: "architect.what.mece",
          title: "What 卡",
          status: "stale",
          content: { summary: "拆解关键维度" },
        },
      ],
      staged_edits: [{
        id: "edit-1",
        target_type: "system_prompt",
        target_key: "SKILL.md",
        summary: "补充约束",
        diff_ops: [],
        status: "pending",
      }],
      queue_window: {
        active_card_id: "card-b",
        visible_card_ids: ["card-b", "card-a"],
        backlog_count: 0,
        phase: "phase_2_what",
        max_visible: 5,
        reveal_policy: "stage_gated",
      },
      card_artifacts: {
        "architect.what.mece": {
          dimension_tree: { root: "客户跟进策略" },
        },
      },
      stale_card_ids: ["card-b"],
      card_queue_ledger: {
        completed: ["card-a"],
        stale: ["card-b"],
        artifacts_by_contract: { "architect.what.mece": ["dimension_tree"] },
        exit_log: [{ card_id: "card-a", exit_reason: "adopted" }],
        stats: { total: 2, completed: 1, stale: 1, active: 0, pending: 1, done: 1 },
      },
    };

    const hydrated = hydrateStudioSessionRecovery(7, session);

    expect(hydrated.recoverySignature).toBe("7:3");
    expect(hydrated.workflowState?.phase).toBe("phase_2_what");
    expect(hydrated.governanceCards.map((card) => card.id)).toEqual(["card-b", "card-a"]);
    expect(hydrated.governanceCards[0].status).toBe("stale");
    expect(hydrated.stagedEdits).toHaveLength(1);
    expect(hydrated.queueWindow?.active_card_id).toBe("card-b");
    expect(hydrated.cardQueueLedger?.stats?.stale).toBe(1);
    expect(hydrated.architectArtifacts[0]).toMatchObject({
      artifactKey: "dimension_tree",
      contractId: "architect.what.mece",
      stale: true,
    });
  });
});
