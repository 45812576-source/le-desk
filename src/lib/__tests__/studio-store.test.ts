import { beforeEach, describe, expect, it } from "vitest";

import type { GovernanceCardData, StagedEdit } from "@/components/skill-studio/types";
import type { WorkbenchCard } from "@/components/skill-studio/workbench-types";
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

  it("prefers validation card as active focus when replacing workbench cards", () => {
    const cards: WorkbenchCard[] = [
      {
        id: "file-1",
        title: "Prompt 修改",
        summary: "处理 prompt",
        status: "pending",
        kind: "governance",
        mode: "file",
        phase: "governance_execution",
        source: "test",
        priority: 80,
        target: { type: "prompt", key: "SKILL.md" },
      },
      {
        id: "validation-1",
        title: "Sandbox 验证",
        summary: "先看阻断原因",
        status: "pending",
        kind: "validation",
        mode: "report",
        phase: "validation",
        source: "test",
        priority: 70,
        target: { type: "report", key: "301" },
        validationSource: { reportId: 301, sessionId: 22 },
      },
    ];

    useStudioStore.getState().replaceWorkbenchCards(cards);

    const state = useStudioStore.getState();
    expect(state.activeCardId).toBe("validation-1");
    expect(state.workspace.mode).toBe("report");
    expect(state.workspace.validationSource).toMatchObject({ reportId: 301, sessionId: 22 });
  });

  it("returns focus to recently resolved staged edit card before moving on", () => {
    const cards: WorkbenchCard[] = [
      {
        id: "edit-1",
        title: "文件修改",
        summary: "待采纳",
        status: "pending",
        kind: "governance",
        mode: "file",
        phase: "governance_execution",
        source: "test",
        priority: 80,
        target: { type: "source_file", key: "notes.md" },
        stagedEditId: "se-1",
      },
      {
        id: "edit-2",
        title: "另一个修改",
        summary: "排队中",
        status: "pending",
        kind: "governance",
        mode: "file",
        phase: "governance_execution",
        source: "test",
        priority: 60,
        target: { type: "source_file", key: "other.md" },
        stagedEditId: "se-2",
      },
    ];

    useStudioStore.getState().replaceWorkbenchCards(cards, "edit-1");
    useStudioStore.getState().syncStagedEdits("runtime", [
      { id: "se-1", source: "runtime", fileType: "source_file", filename: "notes.md", diff: [], status: "pending" },
      { id: "se-2", source: "runtime", fileType: "source_file", filename: "other.md", diff: [], status: "pending" },
    ]);

    useStudioStore.getState().adoptStagedEdit("se-1");

    const state = useStudioStore.getState();
    expect(state.cardsById["edit-1"]?.status).toBe("adopted");
    expect(state.activeCardId).toBe("edit-1");
  });

  it("preserves backend card order during recovery hydration", () => {
    const cards: WorkbenchCard[] = [
      {
        id: "low-priority-first",
        title: "后端指定第一张",
        summary: "低优先级但应排第一",
        status: "pending",
        kind: "governance",
        mode: "file",
        phase: "governance_execution",
        source: "memo-recovery",
        priority: 10,
        target: { type: "source_file", key: "first.md" },
      },
      {
        id: "high-priority-second",
        title: "后端指定第二张",
        summary: "高优先级但应排第二",
        status: "pending",
        kind: "governance",
        mode: "file",
        phase: "governance_execution",
        source: "memo-recovery",
        priority: 90,
        target: { type: "source_file", key: "second.md" },
      },
    ];

    useStudioStore.getState().replaceWorkbenchCards(cards);

    expect(useStudioStore.getState().cardOrder).toEqual(["low-priority-first", "high-priority-second"]);
  });
});
