const DEFAULT_TERMINAL_JOB_STATUSES = new Set([
  "success",
  "succeeded",
  "partial_success",
  "partial",
  "failed",
  "error",
  "completed",
  "cancelled",
  "canceled",
  "expired",
  "timeout",
]);

export function isTerminalJobStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return DEFAULT_TERMINAL_JOB_STATUSES.has(status.toLowerCase());
}
