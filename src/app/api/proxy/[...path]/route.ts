import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

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

  let body: BodyInit | undefined;

  if (request.method === "GET" || request.method === "HEAD") {
    body = undefined;
  } else if (isMultipart) {
    // Pass through the raw body + content-type (with boundary) for file uploads
    headers["Content-Type"] = contentType;
    body = await request.arrayBuffer();
  } else {
    headers["Content-Type"] = contentType || "application/json";
    body = await request.text();
  }

  // SSE streaming endpoints need longer timeout (5min) for AI generation
  // Sandbox interactive run involves multiple LLM calls (execution + evaluation + report)
  // Preflight and ingest-paste are also SSE endpoints with multiple LLM calls
  const isStreamEndpoint = targetPath.includes("/stream") || targetPath.includes("/upload-stream");
  const isLongRunEndpoint = targetPath.includes("/sandbox/interactive/") && targetPath.endsWith("/run");
  const isPreflightEndpoint = targetPath.includes("/sandbox/preflight/");
  const isIngestEndpoint = targetPath.includes("/ingest-paste");
  const timeout = (isStreamEndpoint || isLongRunEndpoint || isPreflightEndpoint || isIngestEndpoint) ? 300_000 : 115_000;

  let resp: Response;
  try {
    resp = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { detail: `后端服务不可达: ${message}` },
      { status: 502 },
    );
  }

  // SSE streaming: pass through the ReadableStream directly
  const respContentType = resp.headers.get("Content-Type") || "";
  if (respContentType.includes("text/event-stream")) {
    return new Response(resp.body, {
      status: resp.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // Binary responses (images, files) must be passed through as ArrayBuffer,
  // not text(), which would corrupt the bytes.
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
    return new NextResponse(respBody, {
      status: resp.status,
      headers: binaryHeaders,
    });
  }

  const respBody = await resp.text();
  return new NextResponse(respBody, {
    status: resp.status,
    headers: {
      "Content-Type": respContentType || "application/json",
    },
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
