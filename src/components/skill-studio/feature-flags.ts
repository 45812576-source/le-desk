import type { WorkflowStateData } from "./workflow-protocol";

export type StudioRolloutFlagKey =
  | "dual_lane_enabled"
  | "fast_lane_enabled"
  | "deep_lane_enabled"
  | "sla_degrade_enabled"
  | "patch_protocol_enabled"
  | "frontend_run_protocol_enabled";

export type StudioRolloutFlags = Partial<Record<StudioRolloutFlagKey, boolean>>;

const FRONTEND_RUN_PROTOCOL_ENV = process.env.NEXT_PUBLIC_SKILL_STUDIO_FRONTEND_RUN_PROTOCOL_ENABLED;
const PATCH_PROTOCOL_ENV = process.env.NEXT_PUBLIC_SKILL_STUDIO_PATCH_PROTOCOL_ENABLED;

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return null;
}

function envFlag(value: string | undefined, defaultValue: boolean): boolean {
  return coerceBoolean(value) ?? defaultValue;
}

export function readStudioRolloutFlags(
  workflowState?: WorkflowStateData | null,
): StudioRolloutFlags {
  const rollout = workflowState?.metadata?.rollout;
  if (!rollout || typeof rollout !== "object") return {};
  const flags = (rollout as { flags?: unknown }).flags;
  if (!flags || typeof flags !== "object") return {};
  return flags as StudioRolloutFlags;
}

export function isFrontendRunProtocolEnabled(
  workflowState?: WorkflowStateData | null,
): boolean {
  const envEnabled = envFlag(FRONTEND_RUN_PROTOCOL_ENV, true);
  const serverEnabled = readStudioRolloutFlags(workflowState).frontend_run_protocol_enabled;
  return envEnabled && serverEnabled !== false;
}

export function isPatchProtocolEnabled(
  workflowState?: WorkflowStateData | null,
): boolean {
  const envEnabled = envFlag(PATCH_PROTOCOL_ENV, true);
  const serverEnabled = readStudioRolloutFlags(workflowState).patch_protocol_enabled;
  return envEnabled && serverEnabled !== false && isFrontendRunProtocolEnabled(workflowState);
}
