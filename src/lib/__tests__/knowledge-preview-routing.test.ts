import { describe, expect, it } from "vitest";

import { shouldPreferDetachedCopySourcePreview } from "@/lib/knowledge-preview-routing";

describe("shouldPreferDetachedCopySourcePreview", () => {
  it("prefers preview for detached lark pdf copies", () => {
    expect(
      shouldPreferDetachedCopySourcePreview({
        source_type: "lark_doc",
        external_edit_mode: "detached_copy",
        oss_key: "knowledge/test.pdf",
        file_ext: ".pdf",
        can_open_onlyoffice: false,
      }),
    ).toBe(true);
  });

  it("prefers preview for detached lark office copies", () => {
    expect(
      shouldPreferDetachedCopySourcePreview({
        source_type: "lark_doc",
        external_edit_mode: "detached_copy",
        oss_key: "knowledge/test.docx",
        file_ext: ".docx",
        can_open_onlyoffice: true,
      }),
    ).toBe(true);
  });

  it("does not force preview for editable detached text copies", () => {
    expect(
      shouldPreferDetachedCopySourcePreview({
        source_type: "lark_doc",
        external_edit_mode: "detached_copy",
        oss_key: "knowledge/test.txt",
        file_ext: ".txt",
        can_open_onlyoffice: false,
      }),
    ).toBe(false);
  });

  it("does not affect non-lark uploads", () => {
    expect(
      shouldPreferDetachedCopySourcePreview({
        source_type: "upload",
        external_edit_mode: null,
        oss_key: "knowledge/test.xlsx",
        file_ext: ".xlsx",
        can_open_onlyoffice: true,
      }),
    ).toBe(false);
  });

  it("does not prefer preview when original file is missing", () => {
    expect(
      shouldPreferDetachedCopySourcePreview({
        source_type: "lark_doc",
        external_edit_mode: "detached_copy",
        oss_key: null,
        file_ext: ".pptx",
        can_open_onlyoffice: true,
      }),
    ).toBe(false);
  });
});
