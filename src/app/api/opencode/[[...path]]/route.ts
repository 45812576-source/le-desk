import { NextRequest, NextResponse } from "next/server";
import { NORMALIZE_SESSION_API_PATH_PATTERN } from "@/lib/opencode-session-routing";
import { createOpencodeInjectScript } from "@/lib/opencode-proxy-client-script";
import { rewriteOpenCodeCssAssetPaths, rewriteOpenCodeScriptAssetPaths } from "@/lib/opencode-asset-routing";

const OPENCODE_BASE_PORT = 17171;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

function resolvePort(raw: string | null | undefined): number | null {
  const portNum = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(portNum) && portNum > 1024 && portNum < 65536
    ? portNum
    : null;
}

async function resolveOpencodePort(req: NextRequest): Promise<number> {
  const fromQuery = resolvePort(req.nextUrl.searchParams.get("_oc_port"));
  if (fromQuery) return fromQuery;

  const fromCookie = resolvePort(req.cookies.get("oc_port")?.value);
  if (fromCookie) return fromCookie;

  const headers = new Headers();
  const cookie = req.headers.get("cookie");
  const authorization = req.headers.get("authorization");
  if (cookie) headers.set("cookie", cookie);
  if (authorization) headers.set("authorization", authorization);

  try {
    const response = await fetch(`${BACKEND_URL}/api/dev-studio/instance`, {
      headers,
      cache: "no-store",
    });
    if (response.ok) {
      const data = await response.json() as { port?: number | string };
      const port = resolvePort(String(data?.port ?? ""));
      if (port) return port;
    }
  } catch {
    // ignore and fall through to the safe default
  }

  return OPENCODE_BASE_PORT;
}

/** 解析用户专属 opencode 端口：优先 URL query _oc_port，其次 cookie oc_port，最后 fallback。*/
async function resolveOpencodeUrl(req: NextRequest): Promise<string> {
  const safePort = await resolveOpencodePort(req);
  return `http://127.0.0.1:${safePort}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const opencodeUrl = await resolveOpencodeUrl(req);
  const { path } = await params;
  const subpath = path && path.length > 0 ? "/" + path.join("/") : "/";
  // 去掉内部路由参数 _oc_port，不透传给 opencode 上游
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
    upstream = await fetch(target, { headers, redirect: "follow" });
  } catch {
    return NextResponse.json({ error: "opencode unavailable" }, { status: 503 });
  }

  const contentType = upstream.headers.get("content-type") || "";

  // HTML 响应：重写资源路径，把绝对路径改成经过 /api/opencode/ 的路径
  if (contentType.includes("text/html")) {
    let html = await upstream.text();
    // 替换 src="/xxx" href="/xxx" 里的绝对路径（排除已代理的路径）
    html = html.replace(
      /(src|href)="(\/(?!api\/opencode)[^"]+)"/g,
      (_, attr, p) => `${attr}="/api/opencode${p}"`
    );
    // 匹配 ./assets/ 开头的相对路径（Vite 有时生成相对路径）
    html = html.replace(
      /(src|href)="(\.\/(assets\/[^"]+))"/g,
      (_, attr, _full, assetPath) => `${attr}="/api/opencode/${assetPath}"`
    );
    // 重写 form/action 与 button/input formaction，避免表单提交绕过代理
    html = html.replace(
      /(action|formaction)="(\/(?!api\/)[^"]+)"/g,
      (_, attr, p) => `${attr}="/api/opencode-rpc${p}"`
    );
    // 从请求中取端口，注入到脚本里，让 iframe 内的 fetch/WebSocket 带上正确的端口参数
    const ocPort = req.nextUrl.searchParams.get("_oc_port") || req.cookies.get("oc_port")?.value || "";
    // 注入脚本：清除 localStorage 里硬编码的 defaultServerUrl，避免覆盖代理替换
    // 同时 patch fetch/WebSocket，把所有指向当前 origin 根路径的请求重定向到 /api/opencode-rpc
    const injectScript = createOpencodeInjectScript({
      ocPort,
      normalizeSessionApiPathPattern: NORMALIZE_SESSION_API_PATH_PATTERN,
    });
    html = html.replace("</head>", `${injectScript}</head>`);
    return new NextResponse(html, {
      status: upstream.status,
      headers: {
        "content-type": "text/html;charset=UTF-8",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  // JS 文件：额外替换硬编码的 API baseUrl，重定向到 Next.js 代理
  const isJs = contentType.includes("javascript") || subpath.endsWith(".js");
  if (isJs) {
    let js = await upstream.text();
    // opencode 在非 opencode.ai 域名下 fallback 到 location.origin 作为 API base，强制改为代理路径
    // 内网穿透场景：location.origin 是 ngrok URL，必须强制替换为 /api/opencode-rpc
    js = js.replace(
      'location.hostname.includes("opencode.ai")?"http://localhost:4096":location.origin',
      'location.origin+"/api/opencode-rpc"'
    );
    // 兜底：替换其他可能的变体写法（minified 版本可能有空格差异）
    js = js.replace(
      /location\.hostname\.includes\("opencode\.ai"\)\s*\?\s*"http:\/\/localhost:4096"\s*:\s*location\.origin/g,
      'location.origin+"/api/opencode-rpc"'
    );
    // opencode SDK 的 baseUrl 硬编码了 http://localhost:4096，替换为绝对路径代理
    // 注意：new URL(path, base) 要求 base 是绝对 URL，不能用相对路径
    // 只替换 baseUrl 上下文，避免破坏 placeholder 等普通字符串
    js = js.replace(new RegExp("baseUrl:" + '"http:' + "//localhost:4096" + '"', "g"), 'baseUrl:location.origin+"/api/opencode-rpc"');
    // Vite 打包的 JS 中硬编码了 /assets、./assets、assets 路径用于 CSS preload 和动态 import
    // 这些不经过 fetch patch，必须在源码级别重写到代理路径
    js = rewriteOpenCodeScriptAssetPaths(js);
    const respHeaders = new Headers();
    respHeaders.set("content-type", contentType || "application/javascript");
    // 包含 hash 的 JS 文件（如 /assets/index-AbCdEf.js）用 immutable 缓存
    const isHashedJs = /\/assets\/[^/]+-[a-zA-Z0-9]{6,}\.(js|mjs)$/.test(subpath);
    respHeaders.set("cache-control", isHashedJs
      ? "public, max-age=31536000, immutable"
      : "no-store, no-cache, must-revalidate");
    respHeaders.delete("content-security-policy");
    return new NextResponse(js, { status: upstream.status, headers: respHeaders });
  }

  // CSS 文件：重写 url(/assets/...) 引用到代理路径
  const isCss = contentType.includes("text/css") || subpath.endsWith(".css");
  if (isCss) {
    let css = await upstream.text();
    css = rewriteOpenCodeCssAssetPaths(css);
    const respHeaders = new Headers();
    respHeaders.set("content-type", contentType || "text/css");
    respHeaders.set("cache-control", "public, max-age=31536000, immutable");
    respHeaders.delete("content-security-policy");
    return new NextResponse(css, { status: upstream.status, headers: respHeaders });
  }

  // 其他资源直接透传
  const body = await upstream.arrayBuffer();
  const respHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (!["content-encoding", "transfer-encoding", "connection"].includes(k)) {
      respHeaders.set(k, v);
    }
  });
  // 移除 CSP，避免阻止 iframe 内的资源加载
  respHeaders.delete("content-security-policy");

  return new NextResponse(body, {
    status: upstream.status,
    headers: respHeaders,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxyMethod(req, params, "POST");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxyMethod(req, params, "PUT");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxyMethod(req, params, "DELETE");
}

async function proxyMethod(
  req: NextRequest,
  params: Promise<{ path?: string[] }>,
  method: string
) {
  const opencodeUrl = await resolveOpencodeUrl(req);
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

  const body = await req.arrayBuffer().catch(() => undefined);

  let upstream: Response;
  try {
    upstream = await fetch(target, { method, headers, body, redirect: "follow" });
  } catch {
    return NextResponse.json({ error: "opencode unavailable" }, { status: 503 });
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
