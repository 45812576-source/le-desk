import { describe, expect, it } from "vitest";

import { extractStudioMeta, resolveStudioMetaReply, resolveWorkflowNextActionMessage } from "../studio-meta";

describe("studio-meta", () => {
  const meta = {
    phase: "extract",
    turn: 6,
    quickReplies: ["继续创建 example 文件", "先查看测试问题清单", "修改其他部分"],
  };

  it("parses hidden studio meta comments", () => {
    const extracted = extractStudioMeta(
      "继续推进\n\n<!--STUDIO_META:{\"phase\":\"extract\",\"turn\":6,\"quick_replies\":[\"继续创建 example 文件\",\"先查看测试问题清单\"]}-->",
    );

    expect(extracted.cleanText).toBe("继续推进");
    expect(extracted.meta?.phase).toBe("extract");
    expect(extracted.meta?.quickReplies).toEqual(["继续创建 example 文件", "先查看测试问题清单"]);
  });

  it("maps generic continue replies to the primary quick reply", () => {
    expect(resolveStudioMetaReply("可以，请继续", meta)).toBe("继续创建 example 文件");
    expect(resolveStudioMetaReply("继续创建 example 文件", meta)).toBe("继续创建 example 文件");
    expect(resolveStudioMetaReply("修改其他部分", meta)).toBe("修改其他部分");
    expect(resolveStudioMetaReply("先别动，我想补充背景", meta)).toBeNull();
  });

  it("maps start_editing to the primary quick reply", () => {
    expect(resolveWorkflowNextActionMessage("start_editing", meta)).toBe("继续创建 example 文件");
    expect(resolveWorkflowNextActionMessage("run_preflight", meta)).toBeNull();
  });
});
