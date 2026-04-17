import { beforeEach, describe, expect, it } from "vitest";

import type { GovernanceCardData, StagedEdit } from "@/components/skill-studio/types";
import { useStudioStore } from "../studio-store";

function resetStore() {
  useStudioStore.getState().reset();
}

describe("studio-store run tracking", () => {
  beforeEach(() => {
    resetStore();
  });

  it("tracks active run and archives superseded run", () => {
    const store = useStudioStore.getState();

    store.setActiveRun("run_1", 1);
    expect(useStudioStore.getState().activeRunId).toBe("run_1");
    expect(useStudioStore.getState().activeRunVersion).toBe(1);

    store.archiveRun({
      runId: "run_1",
      runVersion: 1,
      status: "superseded",
      supersededBy: "run_2",
      archivedAt: "2026-04-15T12:00:00Z",
    });

    const nextState = useStudioStore.getState();
    expect(nextState.activeRunId).toBeNull();
    expect(nextState.archivedRuns[0]).toMatchObject({
      runId: "run_1",
      runVersion: 1,
      status: "superseded",
      supersededBy: "run_2",
    });
  });

  it("deduplicates applied patch seq and resets run tracking", () => {
    const store = useStudioStore.getState();

    store.rememberPatchSeq(1);
    store.rememberPatchSeq(1);
    store.rememberPatchSeq(2);

    expect(useStudioStore.getState().appliedPatchSeqs).toEqual([1, 2]);

    store.resetRunTracking();
    expect(useStudioStore.getState().activeRunId).toBeNull();
    expect(useStudioStore.getState().archivedRuns).toEqual([]);
    expect(useStudioStore.getState().appliedPatchSeqs).toEqual([]);
  });
});

describe("studio-store reconciliation", () => {
  beforeEach(() => {
    resetStore();
  });

  it("keeps an adopted governance card resolved when recovery replays it as pending", () => {
    const card: GovernanceCardData = {
      id: "gov-1",
      source: "memo-recovery",
      type: "staged_edit",
      title: "修复 prompt 描述",
      content: {},
      status: "pending",
      actions: [],
    };

    useStudioStore.getState().syncGovernanceCards("memo-recovery", [card]);
    useStudioStore.getState().updateCardStatus("gov-1", "adopted");
    useStudioStore.getState().syncGovernanceCards("memo-recovery", [{
      ...card,
      status: "pending",
    }]);

    expect(useStudioStore.getState().governanceCards[0]?.status).toBe("adopted");
  });

  it("keeps an adopted staged edit resolved when recovery replays it as pending", () => {
    const edit: StagedEdit = {
      id: "se-1",
      source: "memo-recovery",
      fileType: "metadata",
      filename: "metadata",
      diff: [],
      status: "pending",
    };

    useStudioStore.getState().syncStagedEdits("memo-recovery", [edit]);
    useStudioStore.getState().adoptStagedEdit("se-1");
    useStudioStore.getState().syncStagedEdits("memo-recovery", [{
      ...edit,
      status: "pending",
    }]);

    expect(useStudioStore.getState().stagedEdits[0]?.status).toBe("adopted");
  });
});
