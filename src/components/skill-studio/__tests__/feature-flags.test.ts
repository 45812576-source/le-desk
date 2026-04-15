import { describe, expect, it } from "vitest";

import {
  isFrontendRunProtocolEnabled,
  isPatchProtocolEnabled,
  readStudioRolloutFlags,
} from "../feature-flags";
import type { WorkflowStateData } from "../workflow-protocol";

function workflowState(flags: Record<string, boolean>): WorkflowStateData {
  return {
    workflow_id: "run_1",
    session_mode: "optimize_existing_skill",
    workflow_mode: "none",
    phase: "review",
    next_action: "continue_chat",
    metadata: {
      rollout: {
        flags,
      },
    },
  };
}

describe("Skill Studio feature flags", () => {
  it("reads rollout flags from workflow metadata", () => {
    const flags = readStudioRolloutFlags(workflowState({
      frontend_run_protocol_enabled: false,
      patch_protocol_enabled: true,
    }));

    expect(flags.frontend_run_protocol_enabled).toBe(false);
    expect(flags.patch_protocol_enabled).toBe(true);
  });

  it("disables frontend run protocol when server rollout says off", () => {
    expect(isFrontendRunProtocolEnabled(workflowState({
      frontend_run_protocol_enabled: false,
    }))).toBe(false);
  });

  it("disables patch consumption when frontend protocol is off", () => {
    expect(isPatchProtocolEnabled(workflowState({
      frontend_run_protocol_enabled: false,
      patch_protocol_enabled: true,
    }))).toBe(false);
  });
});
