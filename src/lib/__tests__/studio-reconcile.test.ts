import { describe, expect, it } from "vitest";

import type { GovernanceCardData, StagedEdit } from "@/components/skill-studio/types";
import { reconcileStudioArtifacts } from "../studio-reconcile";

describe("reconcileStudioArtifacts", () => {
  it("prefers local resolved ledger over memo recovery pending replay", () => {
    const card: GovernanceCardData = {
      id: "gov-1",
      source: "memo-recovery",
      type: "staged_edit",
      title: "补齐描述",
      content: {},
      status: "pending",
      actions: [],
    };
    const edit: StagedEdit = {
      id: "edit-1",
      source: "memo-recovery",
      fileType: "metadata",
      filename: "metadata",
      diff: [],
      status: "pending",
    };

    const resolved = reconcileStudioArtifacts({
      governanceCardSources: { "memo-recovery": [card] },
      stagedEditSources: { "memo-recovery": [edit] },
      governanceCardLedger: { "gov-1": { status: "adopted", updatedAt: Date.now() } },
      stagedEditLedger: { "edit-1": { status: "adopted", updatedAt: Date.now() } },
    });

    expect(resolved.governanceCards[0]?.status).toBe("adopted");
    expect(resolved.stagedEdits[0]?.status).toBe("adopted");
  });

  it("prefers studio chat source content over memo recovery duplicates", () => {
    const resolved = reconcileStudioArtifacts({
      governanceCardSources: {
        "memo-recovery": [{
          id: "gov-2",
          source: "memo-recovery",
          type: "staged_edit",
          title: "旧标题",
          content: { summary: "旧摘要" },
          status: "pending",
          actions: [],
        }],
        "studio-chat:1:2": [{
          id: "gov-2",
          source: "studio-chat:1:2",
          type: "staged_edit",
          title: "新标题",
          content: { summary: "新摘要" },
          status: "pending",
          actions: [],
        }],
      },
      stagedEditSources: {},
      governanceCardLedger: {},
      stagedEditLedger: {},
    });

    expect(resolved.governanceCards[0]?.title).toBe("新标题");
    expect(resolved.governanceCards[0]?.source).toBe("studio-chat:1:2");
  });
});
