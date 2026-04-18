import { NextRequest, NextResponse } from "next/server";
import { resolveDataAssetSummary } from "@/lib/data-asset-summary";
import {
  isApprovalListPath,
  mergeLocalApprovals,
  resolveApprovalRequest,
  resolveOrgMemoryRequest,
} from "@/lib/org-memory-api-store";
import {
  buildOrgMemoryRolloutSubject,
  buildOrgMemoryRequestHeaders,
  buildOrgMemoryResponseHeaders,
  canUseLocalWriteFallback,
  canUseLocalApprovalFallback,
  canUseLocalOrgMemoryFallback,
  getOrgMemoryRolloutBucket,
  isOrgMemoryPath,
  readOrgMemoryProxyConfig,
  shouldRouteOrgMemoryToBackend,
  shouldMergeLocalApprovals,
  shouldUseLocalFallbackForStatus,
} from "@/lib/org-memory-proxy";
import {
  isSkillGovernanceManagedPath,
  rememberSkillGovernanceBackendResponse,
  resolveSkillGovernanceRequest,
} from "@/lib/server/skill-governance-service";
import {
  isTestFlowManagedPath,
  rememberTestFlowBackendResponse,
  resolveTestFlowRequest,
} from "@/lib/server/test-flow-service";

export const maxDuration = 1800;

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

function parseSummaryRoute(targetPath: string): { tableId: number; mode: "summary" | "summarize" } | null {
  const matched = targetPath.match(/^\/data-assets\/tables\/(\d+)\/(summary|summarize)$/);
  if (!matched) return null;

  const tableId = Number(matched[1]);
  if (!Number.isFinite(tableId)) return null;

  return {
    tableId,
    mode: matched[2] as "summary" | "summarize",
  };
}

function parseJsonObject(text: string | undefined): Record<string, unknown> {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function buildTextHeaders(input: {
  respContentType: string;
  isOrgMemoryRequest: boolean;
  orgMemoryProxyConfig: ReturnType<typeof readOrgMemoryProxyConfig>;
  rolloutBucket: number | null;
  routeTarget: "backend" | "local" | null;
}) {
  const headers: Record<string, string> = {
    "Content-Type": input.respContentType || "application/json",
  };
  if (input.isOrgMemoryRequest) {
    Object.assign(headers, buildOrgMemoryResponseHeaders(input.orgMemoryProxyConfig, "backend", {
      bucket: input.rolloutBucket,
      routeTarget: input.routeTarget || "backend",
    }));
  }
  return headers;
}

export async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = "/" + path.join("/");
  const url = new URL(request.url);
  const targetUrl = `${BACKEND_URL}/api${targetPath}${url.search}`;

  const contentType = request.headers.get("Content-Type") || "";
  const isMultipart = contentType.includes("multipart/form-data");

  const headers: Record<string, string> = {};
  const auth = request.headers.get("Authorization");
  if (auth) {
    headers["Authorization"] = auth;
  }

  const summaryRoute = parseSummaryRoute(targetPath);
  if (summaryRoute && (request.method === "GET" || request.method === "POST")) {
    try {
      const summary = await resolveDataAssetSummary({
        tableId: summaryRoute.tableId,
        backendUrl: BACKEND_URL,
        authorization: auth,
      });
      return NextResponse.json(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ detail: `资产摘要生成失败: ${message}` }, { status: 502 });
    }
  }

  let body: BodyInit | undefined;

  if (request.method === "GET" || request.method === "HEAD") {
    body = undefined;
  } else if (isMultipart) {
    headers["Content-Type"] = contentType;
    body = await request.arrayBuffer();
  } else {
    headers["Content-Type"] = contentType || "application/json";
    body = await request.text();
  }

  const requestPayload = parseJsonObject(typeof body === "string" ? body : undefined);
  const orgMemoryProxyConfig = readOrgMemoryProxyConfig();
  const isOrgMemoryRequest = isOrgMemoryPath(targetPath);
  const isSkillGovernanceRequest = isSkillGovernanceManagedPath(targetPath);
  const isTestFlowRequest = isTestFlowManagedPath(targetPath);
  const rolloutSubject = buildOrgMemoryRolloutSubject({
    authorization: auth,
    userAgent: request.headers.get("user-agent"),
    path: targetPath,
  });
  const rolloutBucket = isOrgMemoryRequest ? getOrgMemoryRolloutBucket(rolloutSubject) : null;
  const routeTarget = isOrgMemoryRequest
    ? (shouldRouteOrgMemoryToBackend(orgMemoryProxyConfig, rolloutSubject, request.method) ? "backend" : "local")
    : null;
  const allowLocalWriteFallback = canUseLocalWriteFallback(orgMemoryProxyConfig);
  if (isOrgMemoryRequest) {
    Object.assign(headers, buildOrgMemoryRequestHeaders(orgMemoryProxyConfig));
  }

  const localOrgMemoryResult = isOrgMemoryRequest && routeTarget === "local"
    ? await resolveOrgMemoryRequest(request.method, targetPath, requestPayload, {
        authorization: auth,
      })
    : null;
  if (localOrgMemoryResult) {
    return NextResponse.json(localOrgMemoryResult.body, {
      status: localOrgMemoryResult.status || 200,
      headers: buildOrgMemoryResponseHeaders(orgMemoryProxyConfig, "local-primary", {
        bucket: rolloutBucket,
        routeTarget: "local",
      }),
    });
  }

  if (isTestFlowRequest && targetPath.startsWith("/test-flow/")) {
    const localTestFlowResult = await resolveTestFlowRequest(request.method, targetPath, requestPayload, {
      backendUrl: BACKEND_URL,
      authorization: auth,
    });
    if (localTestFlowResult) {
      return NextResponse.json(localTestFlowResult.body, {
        status: localTestFlowResult.status || 200,
        headers: buildTextHeaders({
          respContentType: "application/json",
          isOrgMemoryRequest,
          orgMemoryProxyConfig,
          rolloutBucket,
          routeTarget,
        }),
      });
    }
  }

  const isStreamEndpoint = targetPath.includes("/stream") || targetPath.includes("/upload-stream");
  const isLongRunEndpoint = targetPath.includes("/sandbox/interactive/") && (
    targetPath.endsWith("/run") ||
    targetPath.endsWith("/run-stream") ||
    targetPath.endsWith("/retry-from-step") ||
    targetPath.endsWith("/retry-from-step-stream") ||
    targetPath.endsWith("/targeted-rerun") ||
    targetPath.endsWith("/targeted-rerun-stream")
  );
  const isPreflightEndpoint = targetPath.includes("/sandbox/preflight/");
  const isIngestEndpoint = targetPath.includes("/ingest-paste");
  const timeout = isLongRunEndpoint
    ? 1_800_000
    : (isStreamEndpoint || isPreflightEndpoint || isIngestEndpoint) ? 300_000 : 115_000;

  let resp: Response;
  try {
    resp = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    const localOrgMemoryFallback = isOrgMemoryRequest
      && routeTarget === "backend"
      && canUseLocalOrgMemoryFallback(orgMemoryProxyConfig)
      && (allowLocalWriteFallback || request.method === "GET" || request.method === "HEAD")
      ? await resolveOrgMemoryRequest(request.method, targetPath, requestPayload, {
          authorization: auth,
        })
      : null;
    if (localOrgMemoryFallback) {
      return NextResponse.json(localOrgMemoryFallback.body, {
        status: localOrgMemoryFallback.status || 200,
        headers: buildOrgMemoryResponseHeaders(orgMemoryProxyConfig, "local-fallback", {
          bucket: rolloutBucket,
          routeTarget: "backend",
        }),
      });
    }
    const localApprovalFallback = canUseLocalApprovalFallback(orgMemoryProxyConfig)
      && (allowLocalWriteFallback || request.method === "GET" || request.method === "HEAD")
      ? await resolveApprovalRequest(
          request.method,
          targetPath,
          url,
          requestPayload,
        )
      : null;
    if (localApprovalFallback) {
      return NextResponse.json(localApprovalFallback.body, {
        status: localApprovalFallback.status || 200,
      });
    }
    const localSkillGovernanceFallback = isSkillGovernanceRequest
      ? await resolveSkillGovernanceRequest(request.method, targetPath, requestPayload)
      : null;
    if (localSkillGovernanceFallback) {
      return NextResponse.json(localSkillGovernanceFallback.body, {
        status: localSkillGovernanceFallback.status || 200,
        headers: buildTextHeaders({
          respContentType: "application/json",
          isOrgMemoryRequest,
          orgMemoryProxyConfig,
          rolloutBucket,
          routeTarget,
        }),
      });
    }
    const localTestFlowFallback = isTestFlowRequest && targetPath.startsWith("/test-flow/")
      ? await resolveTestFlowRequest(request.method, targetPath, requestPayload, {
          backendUrl: BACKEND_URL,
          authorization: auth,
        })
      : null;
    if (localTestFlowFallback) {
      return NextResponse.json(localTestFlowFallback.body, {
        status: localTestFlowFallback.status || 200,
        headers: buildTextHeaders({
          respContentType: "application/json",
          isOrgMemoryRequest,
          orgMemoryProxyConfig,
          rolloutBucket,
          routeTarget,
        }),
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { detail: `后端服务不可达: ${message}` },
      { status: 502 },
    );
  }

  if (!resp.ok && shouldUseLocalFallbackForStatus(resp.status)) {
    const localOrgMemoryFallback = isOrgMemoryRequest
      && routeTarget === "backend"
      && canUseLocalOrgMemoryFallback(orgMemoryProxyConfig)
      && (allowLocalWriteFallback || request.method === "GET" || request.method === "HEAD")
      ? await resolveOrgMemoryRequest(request.method, targetPath, requestPayload, {
          authorization: auth,
        })
      : null;
    if (localOrgMemoryFallback) {
      return NextResponse.json(localOrgMemoryFallback.body, {
        status: localOrgMemoryFallback.status || 200,
        headers: buildOrgMemoryResponseHeaders(orgMemoryProxyConfig, "local-fallback", {
          bucket: rolloutBucket,
          routeTarget: "backend",
        }),
      });
    }

    const localApprovalFallback = canUseLocalApprovalFallback(orgMemoryProxyConfig)
      && (allowLocalWriteFallback || request.method === "GET" || request.method === "HEAD")
      ? await resolveApprovalRequest(
          request.method,
          targetPath,
          url,
          requestPayload,
        )
      : null;
    if (localApprovalFallback) {
      return NextResponse.json(localApprovalFallback.body, {
        status: localApprovalFallback.status || 200,
      });
    }

    const localSkillGovernanceFallback = isSkillGovernanceRequest
      ? await resolveSkillGovernanceRequest(request.method, targetPath, requestPayload)
      : null;
    if (localSkillGovernanceFallback) {
      return NextResponse.json(localSkillGovernanceFallback.body, {
        status: localSkillGovernanceFallback.status || 200,
        headers: buildTextHeaders({
          respContentType: "application/json",
          isOrgMemoryRequest,
          orgMemoryProxyConfig,
          rolloutBucket,
          routeTarget,
        }),
      });
    }
    const localTestFlowFallback = isTestFlowRequest && targetPath.startsWith("/test-flow/")
      ? await resolveTestFlowRequest(request.method, targetPath, requestPayload, {
          backendUrl: BACKEND_URL,
          authorization: auth,
        })
      : null;
    if (localTestFlowFallback) {
      return NextResponse.json(localTestFlowFallback.body, {
        status: localTestFlowFallback.status || 200,
        headers: buildTextHeaders({
          respContentType: "application/json",
          isOrgMemoryRequest,
          orgMemoryProxyConfig,
          rolloutBucket,
          routeTarget,
        }),
      });
    }
  }

  const respContentType = resp.headers.get("Content-Type") || "";
  if (respContentType.includes("text/event-stream")) {
    const streamHeaders: Record<string, string> = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    };
    if (isOrgMemoryRequest) {
      Object.assign(streamHeaders, buildOrgMemoryResponseHeaders(orgMemoryProxyConfig, "backend", {
        bucket: rolloutBucket,
        routeTarget: routeTarget || "backend",
      }));
    }
    return new Response(resp.body, {
      status: resp.status,
      headers: streamHeaders,
    });
  }

  const isBinary = respContentType.startsWith("image/")
    || respContentType.startsWith("video/")
    || respContentType.startsWith("audio/")
    || respContentType.includes("octet-stream")
    || respContentType.includes("pdf")
    || respContentType.includes("spreadsheetml")
    || respContentType.includes("text/csv");

  if (isBinary) {
    const respBody = await resp.arrayBuffer();
    const binaryHeaders: Record<string, string> = { "Content-Type": respContentType };
    const disposition = resp.headers.get("Content-Disposition");
    if (disposition) binaryHeaders["Content-Disposition"] = disposition;
    if (isOrgMemoryRequest) {
      Object.assign(binaryHeaders, buildOrgMemoryResponseHeaders(orgMemoryProxyConfig, "backend", {
        bucket: rolloutBucket,
        routeTarget: routeTarget || "backend",
      }));
    }
    return new NextResponse(respBody, {
      status: resp.status,
      headers: binaryHeaders,
    });
  }

  const respBody = await resp.text();
  if (resp.ok && isApprovalListPath(targetPath) && shouldMergeLocalApprovals(orgMemoryProxyConfig)) {
    try {
      const mergedBody = await mergeLocalApprovals(targetPath, url, JSON.parse(respBody));
      return NextResponse.json(mergedBody, {
        status: resp.status,
        headers: isOrgMemoryRequest
          ? buildOrgMemoryResponseHeaders(orgMemoryProxyConfig, "backend", {
              bucket: rolloutBucket,
              routeTarget: routeTarget || "backend",
            })
          : undefined,
      });
    } catch {
    }
  }

  if ((isSkillGovernanceRequest || isTestFlowRequest) && respContentType.includes("json")) {
    try {
      const parsedBody = JSON.parse(respBody);
      const managedSkillGovernanceResponse = isSkillGovernanceRequest
        ? await rememberSkillGovernanceBackendResponse({
            method: request.method,
            pathname: targetPath,
            backendBody: parsedBody,
            requestPayload,
          })
        : null;
      const testFlowDecoratedBody = isTestFlowRequest
        ? await rememberTestFlowBackendResponse({
            method: request.method,
            pathname: targetPath,
            backendBody: managedSkillGovernanceResponse?.body ?? parsedBody,
            requestPayload,
          })
        : managedSkillGovernanceResponse?.body ?? parsedBody;
      if (managedSkillGovernanceResponse || testFlowDecoratedBody !== parsedBody) {
        return NextResponse.json(
          managedSkillGovernanceResponse?.body ?? testFlowDecoratedBody,
          {
            status: managedSkillGovernanceResponse?.status || resp.status,
            headers: buildTextHeaders({
              respContentType,
              isOrgMemoryRequest,
              orgMemoryProxyConfig,
              rolloutBucket,
              routeTarget,
            }),
          });
      }
    } catch {
    }
  }

  return new NextResponse(respBody, {
    status: resp.status,
    headers: buildTextHeaders({
      respContentType,
      isOrgMemoryRequest,
      orgMemoryProxyConfig,
      rolloutBucket,
      routeTarget,
    }),
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
