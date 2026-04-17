import { NextRequest, NextResponse } from "next/server";
import { resolveOrgMemoryRequest } from "@/lib/org-memory-api-store";
import {
  allowDirectOrgMemoryLocalRoute,
  readOrgMemoryProxyConfig,
} from "@/lib/org-memory-proxy";

async function readPayload(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") return {};
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return {};
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!allowDirectOrgMemoryLocalRoute(readOrgMemoryProxyConfig())) {
    return NextResponse.json({ detail: "本地 org-memory fallback 已关闭" }, { status: 404 });
  }

  const { path } = await params;
  const apiPath = `/org-memory/${path.join("/")}`;
  const result = await resolveOrgMemoryRequest(
    request.method,
    apiPath,
    await readPayload(request),
    {
      authorization: request.headers.get("authorization"),
    },
  );

  if (!result) {
    return NextResponse.json({ detail: "接口不存在" }, { status: 404 });
  }

  return NextResponse.json(result.body, { status: result.status || 200 });
}

export const GET = handler;
export const POST = handler;
