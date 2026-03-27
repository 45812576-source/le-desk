export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import http from "http";

const OPENCODE_BASE_PORT = 17171;

function resolveOpencodePort(req: NextRequest): number {
  const fromQuery = req.nextUrl.searchParams.get("_oc_port");
  const fromCookie = req.cookies.get("oc_port")?.value;
  const raw = fromQuery || fromCookie;
  const portNum = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(portNum) && portNum > 1024 && portNum < 65536
    ? portNum
    : OPENCODE_BASE_PORT;
}

async function proxyToOpenCodeApi(
  req: NextRequest,
  params: Promise<{ path?: string[] }>,
  method: string
) {
  const port = resolveOpencodePort(req);
  const { path } = await params;
  const subpath = path && path.length > 0 ? "/" + path.join("/") : "/";
  const upstreamParams = new URLSearchParams(req.nextUrl.searchParams);
  upstreamParams.delete("_oc_port");
  const search = upstreamParams.size > 0 ? "?" + upstreamParams.toString() : "";
  const targetPath = `${subpath}${search}`;

  // SSE 长连接：/event 路径转发到后端 FastAPI sse-proxy，彻底绕过 Next.js 超时
  const isEventStream = subpath.includes("/event");

  if (isEventStream) {
    // 把 Authorization header 带上，转发给 FastAPI sse-proxy
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const encodedPath = encodeURIComponent(subpath.replace(/^\//, ""));
    const sseTarget = `${backendUrl}/api/dev-studio/sse-proxy?path=${encodedPath}`;
    const sseHeaders = new Headers();
    req.headers.forEach((v, k) => {
      if (!["host", "connection", "accept-encoding"].includes(k)) sseHeaders.set(k, v);
    });
    let sseUpstream: Response;
    try {
      sseUpstream = await fetch(sseTarget, { headers: sseHeaders, signal: undefined } as RequestInit);
    } catch {
      return NextResponse.json({ error: "opencode unavailable" }, { status: 503 });
    }
    return new Response(sseUpstream.body, {
      status: sseUpstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  if (false && isEventStream) {
    return new Promise<Response>((resolve) => {
      const headers: Record<string, string> = {};
      req.headers.forEach((v, k) => {
        if (!["host", "connection"].includes(k)) headers[k] = v;
      });

      // keepalive 代理：opencode 关闭 SSE 连接后自动重连并继续转发，
      // 避免浏览器感知到断线，防止 server.connected 事件触发 UI 刷新
      let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
      let destroyed = false;

      const stream = new ReadableStream<Uint8Array>({
        start(c) { controller = c; },
        cancel() {
          destroyed = true;
          if (keepaliveTimer) clearInterval(keepaliveTimer);
        },
      });

      // 每 20s 发一个 SSE 注释行保持连接，防止 nginx/浏览器超时
      keepaliveTimer = setInterval(() => {
        if (destroyed || !controller) return;
        try { controller.enqueue(new TextEncoder().encode(": keepalive\n\n")); } catch {}
      }, 20000);

      function connectUpstream() {
        if (destroyed) return;
        const options = {
          hostname: "127.0.0.1",
          port,
          path: targetPath,
          method,
          headers,
        };
        const proxyReq = http.request(options, (proxyRes) => {
          proxyRes.on("data", (chunk: Buffer) => {
            if (!destroyed && controller) {
              try { controller.enqueue(new Uint8Array(chunk)); } catch {}
            }
          });
          proxyRes.on("end", () => {
            // opencode 关闭连接 → 1s 后自动重连，不通知浏览器
            if (!destroyed) setTimeout(connectUpstream, 1000);
          });
          proxyRes.on("error", () => {
            if (!destroyed) setTimeout(connectUpstream, 2000);
          });
        });
        proxyReq.on("error", () => {
          if (!destroyed) setTimeout(connectUpstream, 2000);
        });
        proxyReq.end();
      }

      connectUpstream();

      resolve(
        new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
          },
        })
      );
    });
  }

  // 普通请求走 fetch
  const target = `http://127.0.0.1:${port}${targetPath}`;
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
