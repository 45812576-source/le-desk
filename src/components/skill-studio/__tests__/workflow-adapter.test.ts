import { describe, expect, it } from "vitest";

import { normalizeAuditSummaryPayload, parseStudioPatchEnvelope } from "../workflow-adapter";

describe("workflow-adapter", () => {
  it("normalizes audit summary payloads for the fixed audit panel", () => {
    const audit = normalizeAuditSummaryPayload({
      verdict: "needs_work",
      issues: [{ dimension: "structure", score: 40, detail: "缺少角色定义" }],
      recommended_path: "major_rewrite",
      phase_entry: "phase_1_why",
    });

    expect(audit.severity).toBe("medium");
    expect(audit.quality_score).toBe(55);
    expect(audit.recommended_path).toBe("restructure");
    expect(audit.issues).toHaveLength(1);
    expect(audit.phase_entry).toBe("phase_1_why");
  });

  it("parses audit patch envelope", () => {
    const envelope = parseStudioPatchEnvelope({
      run_id: "run_1",
      run_version: 2,
      patch_seq: 3,
      patch_type: "audit_patch",
      payload: { verdict: "poor" },
    });

    expect(envelope?.run_id).toBe("run_1");
    expect(envelope?.patch_type).toBe("audit_patch");
  });
});
