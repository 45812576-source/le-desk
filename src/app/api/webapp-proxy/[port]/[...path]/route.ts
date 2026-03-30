/**
 * Dynamic proxy for user webapp backends.
 * Route: /api/webapp-proxy/{port}/[...path]
 * Forwards to http://localhost:{port}/[...path]
 */
import { NextRequest, NextResponse } from "next/server";

export async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ port: string; path: string[] }> }
) {
  const { port, path } = await params;
  const targetPath = "/" + (path?.join("/") || "");
  const url = new URL(request.url);
  const targetUrl = `http://localhost:${port}${targetPath}${url.search}`;

  const contentType = request.headers.get("Content-Type") || "";
  const isMultipart = contentType.includes("multipart/form-data");

  const headers: Record<string, string> = {};
  const auth = request.headers.get("Authorization");
  if (auth) headers["Authorization"] = auth;

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

  let resp: Response;
  try {
    resp = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });
  } catch {
    return new NextResponse(
      JSON.stringify({ error: "Backend not reachable", port }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const respContentType = resp.headers.get("Content-Type") || "";

  // SSE streaming
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

  // Binary responses
  const isBinary =
    respContentType.startsWith("image/") ||
    respContentType.startsWith("video/") ||
    respContentType.startsWith("audio/") ||
    respContentType.includes("octet-stream") ||
    respContentType.includes("pdf");

  if (isBinary) {
    const respBody = await resp.arrayBuffer();
    return new NextResponse(respBody, {
      status: resp.status,
      headers: { "Content-Type": respContentType },
    });
  }

  const respBody = await resp.text();
  return new NextResponse(respBody, {
    status: resp.status,
    headers: { "Content-Type": respContentType || "application/json" },
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
