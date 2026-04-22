export type OrgMemoryProxyMode = "local" | "hybrid" | "remote";

export type OrgMemoryProxyConfig = {
  mode: OrgMemoryProxyMode;
  localFallbackEnabled: boolean;
  rolloutPercentage: number;
  nodeEnv: string | undefined;
};

export type OrgMemoryResponseSource =
  | "backend"
  | "local-primary"
  | "local-fallback";

export const ORG_MEMORY_PROXY_MODE_HEADER = "X-Org-Memory-Proxy-Mode";
export const ORG_MEMORY_ROLLOUT_KEY_HEADER = "X-Org-Memory-Rollout-Key";
export const ORG_MEMORY_ROLLOUT_PERCENT_HEADER = "X-Org-Memory-Rollout-Percent";
export const ORG_MEMORY_ROLLOUT_BUCKET_HEADER = "X-Org-Memory-Rollout-Bucket";
export const ORG_MEMORY_LOCAL_FALLBACK_HEADER = "X-Org-Memory-Local-Fallback-Enabled";
export const ORG_MEMORY_RESPONSE_SOURCE_HEADER = "X-Org-Memory-Response-Source";
export const ORG_MEMORY_FALLBACK_USED_HEADER = "X-Org-Memory-Fallback-Used";
export const ORG_MEMORY_ROUTE_TARGET_HEADER = "X-Org-Memory-Route-Target";

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

function normalizeMode(value: unknown, _nodeEnv: string | undefined): OrgMemoryProxyMode {
  if (value === "local" || value === "hybrid" || value === "remote") return value;
  return "remote";
}

function normalizeRolloutPercentage(value: unknown, fallback: number) {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value)
      : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function readOrgMemoryProxyConfig(
  env: NodeJS.ProcessEnv = process.env,
): OrgMemoryProxyConfig {
  const nodeEnv = env.NODE_ENV;
  const mode = normalizeMode(env.ORG_MEMORY_PROXY_MODE, nodeEnv);
  const fallbackFlag = coerceBoolean(env.ORG_MEMORY_LOCAL_FALLBACK_ENABLED);
  const localFallbackEnabled = mode === "local"
    ? true
    : mode === "hybrid"
      ? (fallbackFlag ?? false)
      : false;
  const rolloutPercentage = mode === "local"
    ? 0
    : mode === "remote"
      ? 100
      : normalizeRolloutPercentage(
          env.ORG_MEMORY_REMOTE_ROLLOUT_PERCENT,
          100,
        );

  return {
    mode,
    localFallbackEnabled,
    rolloutPercentage,
    nodeEnv,
  };
}

export function readOrgMemoryClientConfig(
  env: NodeJS.ProcessEnv = process.env,
): OrgMemoryProxyConfig {
  const nodeEnv = env.NODE_ENV;
  const mode = normalizeMode(env.NEXT_PUBLIC_ORG_MEMORY_PROXY_MODE, nodeEnv);
  const fallbackFlag = coerceBoolean(env.NEXT_PUBLIC_ORG_MEMORY_LOCAL_FALLBACK_ENABLED);
  const localFallbackEnabled = mode === "local"
    ? true
    : mode === "hybrid"
      ? (fallbackFlag ?? false)
      : false;
  const rolloutPercentage = mode === "local"
    ? 0
    : mode === "remote"
      ? 100
      : normalizeRolloutPercentage(
          env.NEXT_PUBLIC_ORG_MEMORY_REMOTE_ROLLOUT_PERCENT,
          100,
        );

  return {
    mode,
    localFallbackEnabled,
    rolloutPercentage,
    nodeEnv,
  };
}

export function isOrgMemoryPath(path: string): boolean {
  return path === "/org-memory" || path.startsWith("/org-memory/");
}

export function isLocalOrgMemoryPrimary(config: OrgMemoryProxyConfig): boolean {
  return config.mode === "local";
}

export function canUseLocalOrgMemoryFallback(config: OrgMemoryProxyConfig): boolean {
  return config.mode === "local" || (config.mode === "hybrid" && config.localFallbackEnabled);
}

export function canUseLocalApprovalFallback(config: OrgMemoryProxyConfig): boolean {
  return canUseLocalOrgMemoryFallback(config);
}

export function shouldMergeLocalApprovals(config: OrgMemoryProxyConfig): boolean {
  return canUseLocalApprovalFallback(config);
}

export function shouldUseLocalFallbackForStatus(status: number): boolean {
  return [404, 405, 501, 502, 503, 504].includes(status);
}

export function allowDirectOrgMemoryLocalRoute(config: OrgMemoryProxyConfig): boolean {
  return config.mode === "local";
}

export function shouldEnableOrgMemoryClientFallback(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return canUseLocalOrgMemoryFallback(readOrgMemoryClientConfig(env));
}

function stableBucket(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 100;
}

export function buildOrgMemoryRolloutSubject(input: {
  authorization?: string | null;
  userAgent?: string | null;
  path?: string;
}) {
  const auth = input.authorization?.trim();
  if (auth) return `auth:${auth}`;
  const ua = input.userAgent?.trim() || "unknown";
  const path = input.path || "/org-memory";
  return `anon:${ua}:${path}`;
}

export function getOrgMemoryRolloutBucket(subject: string) {
  return stableBucket(subject);
}

export function shouldRouteOrgMemoryToBackend(
  config: OrgMemoryProxyConfig,
  subject: string,
  method = "GET",
): boolean {
  const normalizedMethod = method.toUpperCase();
  const isRead = normalizedMethod === "GET" || normalizedMethod === "HEAD";

  if (config.mode === "remote") return true;
  if (config.mode === "local") return false;
  if (!isRead) return true;
  return getOrgMemoryRolloutBucket(subject) < config.rolloutPercentage;
}

export function canUseLocalWriteFallback(config: OrgMemoryProxyConfig): boolean {
  return config.mode === "local";
}

export function buildOrgMemoryRolloutKey(config: OrgMemoryProxyConfig): string {
  return `${config.mode}-${config.rolloutPercentage}-${config.localFallbackEnabled ? "fallback-on" : "fallback-off"}`;
}

export function buildOrgMemoryRequestHeaders(
  config: OrgMemoryProxyConfig,
): Record<string, string> {
  return {
    [ORG_MEMORY_PROXY_MODE_HEADER]: config.mode,
    [ORG_MEMORY_ROLLOUT_KEY_HEADER]: buildOrgMemoryRolloutKey(config),
    [ORG_MEMORY_ROLLOUT_PERCENT_HEADER]: String(config.rolloutPercentage),
    [ORG_MEMORY_LOCAL_FALLBACK_HEADER]: String(config.localFallbackEnabled),
  };
}

export function buildOrgMemoryResponseHeaders(
  config: OrgMemoryProxyConfig,
  source: OrgMemoryResponseSource,
  extras: {
    bucket?: number | null;
    routeTarget?: "backend" | "local";
  } = {},
): Record<string, string> {
  return {
    ...buildOrgMemoryRequestHeaders(config),
    [ORG_MEMORY_RESPONSE_SOURCE_HEADER]: source,
    [ORG_MEMORY_FALLBACK_USED_HEADER]: String(source === "local-fallback"),
    ...(typeof extras.bucket === "number" ? { [ORG_MEMORY_ROLLOUT_BUCKET_HEADER]: String(extras.bucket) } : {}),
    ...(extras.routeTarget ? { [ORG_MEMORY_ROUTE_TARGET_HEADER]: extras.routeTarget } : {}),
  };
}
