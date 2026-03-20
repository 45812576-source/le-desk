import { NextRequest, NextResponse } from "next/server";

const AI_PROXY_URL = process.env.AI_PROXY_URL || "http://localhost:8080";

export async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = "/" + path.join("/");
  const url = new URL(request.url);
  const targetUrl = `${AI_PROXY_URL}${targetPath}${url.search}`;

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (!["host", "connection"].includes(key)) {
      headers[key] = value;
    }
  });

  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  const resp = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  // SSE 流式透传
  const respContentType = resp.headers.get("Content-Type") || "";
  if (respContentType.includes("text/event-stream")) {
    return new Response(resp.body, {
      status: resp.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const respBody = await resp.arrayBuffer();
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
