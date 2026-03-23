import { NextRequest, NextResponse } from "next/server";

const OPENCODE_BASE_PORT = 17171;

function resolveOpencodeUrl(req: NextRequest): string {
  const fromQuery = req.nextUrl.searchParams.get("_oc_port");
  const fromCookie = req.cookies.get("oc_port")?.value;
  const raw = fromQuery || fromCookie;
  const portNum = raw ? parseInt(raw, 10) : NaN;
  const safePort = Number.isFinite(portNum) && portNum > 1024 && portNum < 65536
    ? portNum
    : OPENCODE_BASE_PORT;
  return `http://127.0.0.1:${safePort}`;
}

async function proxyToOpenCodeApi(req: NextRequest, params: Promise<{ path?: string[] }>, method: string) {
  const opencodeUrl = resolveOpencodeUrl(req);
  const { path } = await params;
  const subpath = path && path.length > 0 ? "/" + path.join("/") : "/";
  const upstreamParams = new URLSearchParams(req.nextUrl.searchParams);
  upstreamParams.delete("_oc_port");
  const search = upstreamParams.size > 0 ? "?" + upstreamParams.toString() : "";
  const target = `${opencodeUrl}${subpath}${search}`;

  const headers = new Headers();
  req.headers.forEach((v, k) => {
    if (!["host", "connection"].includes(k)) headers.set(k, v);
  });

  let upstream: Response;
  try {
    const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer().catch(() => undefined);
    upstream = await fetch(target, { method, headers, body, redirect: "follow" });
  } catch {
    return NextResponse.json({ error: "opencode api unavailable" }, { status: 503 });
  }

  const contentType = upstream.headers.get("content-type") || "";

  // SSE 流直接透传
  if (contentType.includes("text/event-stream")) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // 204/304 不能有 body，直接返回空响应
  if (upstream.status === 204 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status });
  }

  const respBody = await upstream.arrayBuffer();
  const respHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (!["content-encoding", "transfer-encoding", "connection"].includes(k)) {
      respHeaders.set(k, v);
    }
  });
  respHeaders.delete("content-security-policy");

  return new NextResponse(respBody, {
    status: upstream.status,
    headers: respHeaders,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxyToOpenCodeApi(req, params, "GET");
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxyToOpenCodeApi(req, params, "POST");
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxyToOpenCodeApi(req, params, "PUT");
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxyToOpenCodeApi(req, params, "DELETE");
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxyToOpenCodeApi(req, params, "PATCH");
}
