export type OrgMemoryApprovalAdapterMode = "local" | "hybrid" | "remote";

export interface OrgMemoryApprovalAdapterConfig {
  mode: OrgMemoryApprovalAdapterMode;
  backendUrl: string;
  createPath: string;
  timeoutMs: number;
}

export interface OrgMemoryApprovalCreatePayload {
  request_type: string;
  target_id: number;
  target_type: string;
  target_detail: Record<string, unknown>;
  evidence_pack: Record<string, unknown>;
  risk_level: string | null;
  impact_summary: string | null;
}

export interface OrgMemoryApprovalCreateContext {
  authorization?: string | null;
}

export interface OrgMemoryApprovalCreateResult {
  approval_request_id: number;
  status: string;
  raw: Record<string, unknown> | null;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function normalizeMode(value: unknown): OrgMemoryApprovalAdapterMode {
  return value === "remote" || value === "hybrid" || value === "local" ? value : "local";
}

function normalizeCreatePath(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "/api/approvals";
}

function normalizeApprovalRequestId(payload: Record<string, unknown> | null): number | null {
  const value = payload?.approval_request_id ?? payload?.request_id ?? payload?.id;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function readOrgMemoryApprovalAdapterConfig(
  env: NodeJS.ProcessEnv = process.env,
): OrgMemoryApprovalAdapterConfig {
  return {
    mode: normalizeMode(env.ORG_MEMORY_APPROVAL_MODE),
    backendUrl: env.BACKEND_URL || "http://localhost:8000",
    createPath: normalizeCreatePath(env.ORG_MEMORY_APPROVAL_CREATE_PATH),
    timeoutMs: Math.max(Number(env.ORG_MEMORY_APPROVAL_TIMEOUT_MS || "15000") || 15000, 1000),
  };
}

export async function createRemoteOrgMemoryApproval(
  payload: OrgMemoryApprovalCreatePayload,
  context: OrgMemoryApprovalCreateContext = {},
  config: OrgMemoryApprovalAdapterConfig = readOrgMemoryApprovalAdapterConfig(),
): Promise<OrgMemoryApprovalCreateResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (context.authorization) {
    headers.Authorization = context.authorization;
  }

  const targetUrl = `${config.backendUrl}${config.createPath}`;
  const response = await fetch(targetUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const text = await response.text();
  const parsed = parseJsonObject(text);
  if (!response.ok) {
    throw new Error(
      `审批创建失败（${response.status}）${parsed?.detail ? `: ${String(parsed.detail)}` : ""}`,
    );
  }

  const approvalRequestId = normalizeApprovalRequestId(parsed);
  if (!approvalRequestId) {
    throw new Error("审批创建成功但未返回 approval_request_id");
  }

  return {
    approval_request_id: approvalRequestId,
    status: typeof parsed?.status === "string" && parsed.status.trim() ? parsed.status : "pending",
    raw: parsed,
  };
}
