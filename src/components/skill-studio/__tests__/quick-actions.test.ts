import { describe, expect, it } from "vitest";

import { buildContextualSystemQuickActions } from "../quick-actions";

describe("buildContextualSystemQuickActions", () => {
  it("returns no system actions when no skill is selected", () => {
    expect(buildContextualSystemQuickActions({
      skillId: null,
      editorExpanded: false,
      selectedSourceFile: null,
      activeCardTarget: null,
    })).toEqual([]);
  });

  it("returns no system actions when editor is already expanded", () => {
    expect(buildContextualSystemQuickActions({
      skillId: 7,
      editorExpanded: true,
      selectedSourceFile: "examples/demo.md",
      activeCardTarget: "examples/demo.md",
    })).toEqual([]);
  });

  it("offers current remediation target and prompt entry when editor is collapsed", () => {
    expect(buildContextualSystemQuickActions({
      skillId: 7,
      editorExpanded: false,
      selectedSourceFile: "examples/demo.md",
      activeCardTarget: "examples/demo.md",
    })).toEqual([
      {
        label: "打开关联文件",
        msg: "打开关联文件：examples/demo.md",
        dispatch: "ui",
        payload: {
          kind: "open_editor_target",
          fileType: "asset",
          filename: "examples/demo.md",
        },
      },
      {
        label: "打开 SKILL.md",
        msg: "打开 SKILL.md",
        dispatch: "ui",
        payload: {
          kind: "open_editor_target",
          fileType: "prompt",
          filename: "SKILL.md",
        },
      },
    ]);
  });

  it("deduplicates prompt entry when the active target is already SKILL.md", () => {
    expect(buildContextualSystemQuickActions({
      skillId: 7,
      editorExpanded: false,
      selectedSourceFile: null,
      activeCardTarget: "SKILL.md",
    })).toEqual([
      {
        label: "打开 SKILL.md",
        msg: "打开 SKILL.md",
        dispatch: "ui",
        payload: {
          kind: "open_editor_target",
          fileType: "prompt",
          filename: "SKILL.md",
        },
      },
    ]);
  });
});
