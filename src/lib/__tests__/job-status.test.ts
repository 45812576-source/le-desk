import { describe, expect, it } from "vitest";
import { isTerminalJobStatus } from "@/lib/job-status";

describe("isTerminalJobStatus", () => {
  it("accepts common terminal aliases", () => {
    expect(isTerminalJobStatus("success")).toBe(true);
    expect(isTerminalJobStatus("completed")).toBe(true);
    expect(isTerminalJobStatus("expired")).toBe(true);
    expect(isTerminalJobStatus("CANCELLED")).toBe(true);
  });

  it("keeps active statuses polling", () => {
    expect(isTerminalJobStatus("queued")).toBe(false);
    expect(isTerminalJobStatus("running")).toBe(false);
    expect(isTerminalJobStatus("syncing")).toBe(false);
    expect(isTerminalJobStatus(undefined)).toBe(false);
  });
});
