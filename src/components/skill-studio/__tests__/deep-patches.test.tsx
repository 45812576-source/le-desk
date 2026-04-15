import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { GovernanceTimeline } from "../GovernanceTimeline";
import { normalizeDeepPatchEnvelope } from "../workflow-adapter";

const noop = vi.fn();

describe("Deep Lane patches", () => {
  it("normalizes and renders deep summary patches", () => {
    const patch = normalizeDeepPatchEnvelope({
      run_id: "run_1",
      run_version: 2,
      patch_seq: 4,
      patch_type: "deep_summary_patch",
      payload: {
        title: "审计补完",
        summary: "Deep Lane 已补齐完整审计结论。",
      },
    });

    expect(patch).toBeTruthy();

    render(
      <GovernanceTimeline
        messages={[]}
        streaming={false}
        streamStage={null}
        governanceCards={[]}
        auditResult={null}
        pendingGovernanceActions={[]}
        deepPatches={patch ? [patch] : []}
        onGovernanceAction={noop}
        onDismissGovernance={noop}
        onDismissAudit={noop}
        onAdoptGovernanceAction={noop}
        onQuickAction={noop}
      />,
    );

    expect(screen.getByText("Deep Lane 补完")).toBeTruthy();
    expect(screen.getByText("审计补完")).toBeTruthy();
    expect(screen.getByText("Deep Lane 已补齐完整审计结论。")).toBeTruthy();
  });

  it("normalizes evidence patches with evidence items", () => {
    const patch = normalizeDeepPatchEnvelope({
      run_id: "run_1",
      run_version: 2,
      patch_seq: 5,
      patch_type: "evidence_patch",
      payload: {
        evidence: ["命中整改卡片", "已生成 staged edit"],
      },
    });

    expect(patch?.title).toBe("证据补充");
    expect(patch?.evidence).toEqual(["命中整改卡片", "已生成 staged edit"]);
  });
});
