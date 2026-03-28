import { NextRequest, NextResponse } from "next/server";

const OPENCODE_BASE_PORT = 17171;

// ─── SSE 错误改写 ─────────────────────────────────────────────────────────────
// 百炼等上游 API 返回 400 context 超限时，opencode 会把原始错误文本塞进 SSE 事件流。
// 这里透明地扫描流内容，把已知错误码替换成中文友好提示，让用户能看懂。

const _BAILIAN_CONTEXT_RE = /Range of input length should be \[1,\s*(\d+)\]/;
const _BAILIAN_INVALID_RE = /InternalError\.Algo\.InvalidParameter/;

function _rewriteSseChunk(text: string): string {
  if (!_BAILIAN_INVALID_RE.test(text) && !_BAILIAN_CONTEXT_RE.test(text)) return text;

  const match = text.match(_BAILIAN_CONTEXT_RE);
  const limitK = match ? Math.round(parseInt(match[1]) / 1000) : 258;

  // 把 error 字段里的原始英文换成中文提示，其他字段保留
  return text.replace(
    /"message"\s*:\s*"[^"]*Range of input length[^"]*"/,
    `"message": "上下文已超出模型 ${limitK}K token 限制，请开启新 Session 或使用 /compact 压缩历史记录后重试"`
  ).replace(
    /"message"\s*:\s*"<400>[^"]*Range of input length[^"]*"/,
    `"message": "上下文已超出模型 ${limitK}K token 限制，请开启新 Session 或使用 /compact 压缩历史记录后重试"`
  );
}

function _makeSseErrorTransformer(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buf += decoder.decode(chunk, { stream: true });
      // SSE 以 \n\n 分隔事件，逐事件处理
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        controller.enqueue(encoder.encode(_rewriteSseChunk(part) + "\n\n"));
      }
    },
    flush(controller) {
      if (buf) controller.enqueue(encoder.encode(_rewriteSseChunk(buf)));
    },
  });
}

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

  // SSE 流：透传，但拦截已知的上游 API 错误并改写为中文友好提示
  if (contentType.includes("text/event-stream")) {
    const transformed = upstream.body
      ? upstream.body.pipeThrough(_makeSseErrorTransformer())
      : upstream.body;
    return new Response(transformed, {
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
