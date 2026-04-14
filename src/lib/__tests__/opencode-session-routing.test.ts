import { describe, expect, it } from "vitest";

import { normalizeSessionApiPath } from "@/lib/opencode-session-routing";

describe("normalizeSessionApiPath", () => {
  it("keeps native session tail when opencode injects workspace prefix", () => {
    expect(
      normalizeSessionApiPath("/home/mo/codes/project/session/ses_123/messages?cursor=abc"),
    ).toBe("/session/ses_123/messages?cursor=abc");
  });

  it("does not rewrite non-session paths", () => {
    expect(normalizeSessionApiPath("/assets/index.js")).toBe("/assets/index.js");
    expect(normalizeSessionApiPath("/api/opencode-rpc/session/list")).toBe("/api/opencode-rpc/session/list");
  });
});
