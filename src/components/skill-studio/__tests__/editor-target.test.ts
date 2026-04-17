import { describe, expect, it } from "vitest";

import { buildAssetLoadingTarget, buildEditorErrorTarget, resolveWorkflowActionEditorTarget, selectedFileFromEditorTarget } from "../editor-target";

describe("resolveWorkflowActionEditorTarget", () => {
  it("routes metadata adoption back to prompt editor", () => {
    const target = resolveWorkflowActionEditorTarget({
      skillId: 7,
      actionResult: {
        action_id: "wf_1",
        ok: true,
        action: "adopt_staged_edit",
        target_type: "metadata",
        target_key: null,
      },
    });

    expect(selectedFileFromEditorTarget(target!)).toEqual({ skillId: 7, fileType: "prompt" });
  });


  it("keeps asset selection addressable while loading", () => {
    const target = buildAssetLoadingTarget({
      skillId: 7,
      fileType: "asset",
      filename: "docs/checklist.md",
    }, { skillId: 7, fileType: "prompt" });

    expect(selectedFileFromEditorTarget(target)).toEqual({
      skillId: 7,
      fileType: "asset",
      filename: "docs/checklist.md",
    });
  });

  it("falls back to prompt when asset loading fails", () => {
    const target = buildEditorErrorTarget("加载失败", { skillId: 7, fileType: "prompt" }, "asset_load_failed");

    expect(selectedFileFromEditorTarget(target)).toEqual({ skillId: 7, fileType: "prompt" });
  });

  it("routes source file adoption to the returned asset target", () => {
    const target = resolveWorkflowActionEditorTarget({
      skillId: 7,
      actionResult: {
        action_id: "wf_2",
        ok: true,
        action: "adopt_staged_edit",
        target_type: "source_file",
        target_key: "examples/checklist.md",
      },
    });

    expect(selectedFileFromEditorTarget(target!)).toEqual({
      skillId: 7,
      fileType: "asset",
      filename: "examples/checklist.md",
    });
  });
});
