import { describe, expect, it } from "vitest";
import { isVisibleInMyOrganize } from "@/lib/knowledge-visibility";

describe("isVisibleInMyOrganize", () => {
  it("includes documents created by current user", () => {
    expect(isVisibleInMyOrganize({ created_by: 7, is_in_my_knowledge: false }, 7)).toBe(true);
  });

  it("includes documents explicitly marked as in my knowledge", () => {
    expect(isVisibleInMyOrganize({ created_by: 9, is_in_my_knowledge: true }, 7)).toBe(true);
  });

  it("includes documents shared with editable access", () => {
    expect(isVisibleInMyOrganize({ created_by: 9, is_in_my_knowledge: false }, 7, true)).toBe(true);
  });

  it("excludes merely visible documents from other users", () => {
    expect(isVisibleInMyOrganize({ created_by: 9, is_in_my_knowledge: false }, 7)).toBe(false);
  });
});
