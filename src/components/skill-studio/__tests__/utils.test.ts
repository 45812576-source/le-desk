import { describe, expect, it } from "vitest";
import { applyOps, normalizeStagedEditPayload } from "../utils";

describe("normalizeStagedEditPayload", () => {
  it("keeps append ops and falls back to SKILL.md for prompt edits", () => {
    const edit = normalizeStagedEditPayload({
      id: "se-1",
      target_type: "prompt",
      diff_ops: [{ op: "append", content: "\n## 描述\n补齐描述" }],
      summary: "补充 description",
    }, "studio-chat:1");

    expect(edit.fileType).toBe("system_prompt");
    expect(edit.filename).toBe("SKILL.md");
    expect(edit.diff).toEqual([{ type: "append", content: "\n## 描述\n补齐描述", new: undefined }]);
    expect(edit.source).toBe("studio-chat:1");
  });

  it("preserves insert_before anchors and content", () => {
    const edit = normalizeStagedEditPayload({
      id: "se-2",
      target_type: "system_prompt",
      diff_ops: [{ op: "insert_before", anchor: "## 输出", content: "## 描述\nxxx\n" }],
    });

    expect(edit.diff[0]).toEqual({
      type: "insert_before",
      anchor: "## 输出",
      content: "## 描述\nxxx\n",
      old: undefined,
      new: undefined,
    });
  });
});

describe("applyOps", () => {
  it("applies append op generated from staged edit payload", () => {
    const next = applyOps("## 角色\n你是助手", [
      { type: "append", content: "## 描述\n用于检索和审核展示" },
    ]);

    expect(next).toContain("## 描述\n用于检索和审核展示");
  });
});
