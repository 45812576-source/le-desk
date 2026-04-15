import { beforeEach, describe, expect, it } from "vitest";

import { useStudioStore } from "../studio-store";

describe("studio-store run tracking", () => {
  beforeEach(() => {
    useStudioStore.getState().reset();
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
