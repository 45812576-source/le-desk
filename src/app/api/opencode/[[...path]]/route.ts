import { NextRequest, NextResponse } from "next/server";

const OPENCODE_URL = process.env.OPENCODE_URL || "http://127.0.0.1:17171";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const subpath = path && path.length > 0 ? "/" + path.join("/") : "/";
  const search = req.nextUrl.search || "";
  const target = `${OPENCODE_URL}${subpath}${search}`;

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
    // 注入脚本：清除 localStorage 里硬编码的 defaultServerUrl，避免覆盖代理替换
    // 同时 patch fetch/WebSocket，把所有指向当前 origin 根路径的请求重定向到 /api/opencode-rpc
    const injectScript = `<script>
(function() {
  try {
    // 清除 opencode 存储的服务器 URL，强制使用代理
    localStorage.removeItem("opencode.settings.dat:defaultServerUrl");
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.startsWith("opencode.") && k.includes("Url")) {
        localStorage.removeItem(k); i--;
      }
    }
  } catch(e) {}

  // patch fetch：把 /api 以外的同源请求重写到 /api/opencode-rpc
  var _origFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === "string" ? input : (input instanceof Request ? input.url : String(input));
    // 把指向 location.origin 根路径（非代理前缀）的请求重定向到 opencode-rpc
    if (url.startsWith(location.origin + "/") && !url.startsWith(location.origin + "/api/")) {
      var rewritten = "/api/opencode-rpc" + url.slice(location.origin.length);
      input = typeof input === "string" ? rewritten : new Request(rewritten, input instanceof Request ? input : undefined);
    } else if (url.startsWith("/") && !url.startsWith("/api/") && !url.startsWith("/opencode")) {
      input = "/api/opencode-rpc" + url;
    }
    return _origFetch.call(this, input, init);
  };

  // patch WebSocket：同源 ws/wss 连接重定向到 /api/opencode-rpc
  var _origWS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    var wsUrl = String(url);
    var originWs = location.origin.replace(/^http/, "ws");
    if (wsUrl.startsWith(originWs + "/") && !wsUrl.includes("/api/")) {
      wsUrl = originWs + "/api/opencode-rpc" + wsUrl.slice(originWs.length);
    }
    return protocols ? new _origWS(wsUrl, protocols) : new _origWS(wsUrl);
  };
  window.WebSocket.prototype = _origWS.prototype;
  window.WebSocket.CONNECTING = _origWS.CONNECTING;
  window.WebSocket.OPEN = _origWS.OPEN;
  window.WebSocket.CLOSING = _origWS.CLOSING;
  window.WebSocket.CLOSED = _origWS.CLOSED;
})();
</script>`;
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
      '"/api/opencode-rpc"'
    );
    // 兜底：替换其他可能的变体写法（minified 版本可能有空格差异）
    js = js.replace(
      /location\.hostname\.includes\("opencode\.ai"\)\s*\?\s*"http:\/\/localhost:4096"\s*:\s*location\.origin/g,
      '"/api/opencode-rpc"'
    );
    // opencode 的 API client 硬编码了 http://localhost:4096，替换为相对路径代理
    js = js.replace(/http:\/\/localhost:4096/g, "/api/opencode-rpc");
    const respHeaders = new Headers();
    respHeaders.set("content-type", contentType || "application/javascript");
    respHeaders.set("cache-control", "no-store, no-cache, must-revalidate");
    respHeaders.delete("content-security-policy");
    return new NextResponse(js, { status: upstream.status, headers: respHeaders });
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
  const { path } = await params;
  const subpath = path && path.length > 0 ? "/" + path.join("/") : "/";
  const search = req.nextUrl.search || "";
  const target = `${OPENCODE_URL}${subpath}${search}`;

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
