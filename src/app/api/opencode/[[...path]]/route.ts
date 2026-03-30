import { NextRequest, NextResponse } from "next/server";

const OPENCODE_BASE_PORT = 17171;

/** 解析用户专属 opencode 端口：优先 URL query _oc_port，其次 cookie oc_port，最后 fallback。*/
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const opencodeUrl = resolveOpencodeUrl(req);
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
    // 从请求中取端口，注入到脚本里，让 iframe 内的 fetch/WebSocket 带上正确的端口参数
    const ocPort = req.nextUrl.searchParams.get("_oc_port") || req.cookies.get("oc_port")?.value || "";
    // 注入脚本：清除 localStorage 里硬编码的 defaultServerUrl，避免覆盖代理替换
    // 同时 patch fetch/WebSocket，把所有指向当前 origin 根路径的请求重定向到 /api/opencode-rpc
    const injectScript = `<script>
(function() {
  var _ocPort = ${JSON.stringify(ocPort)};
  var _portSuffix = _ocPort ? ("?_oc_port=" + _ocPort) : "";

  function _addPort(url) {
    if (!_ocPort) return url;
    try {
      var sep = url.includes("?") ? "&" : "?";
      return url + sep + "_oc_port=" + _ocPort;
    } catch(e) { return url; }
  }

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

  // patch fetch：把 /api 以外的同源请求重写到 /api/opencode-rpc，并带端口参数
  var _origFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === "string" ? input : (input instanceof Request ? input.url : String(input));
    if (url.startsWith(location.origin + "/") && !url.startsWith(location.origin + "/api/")) {
      var rewritten = _addPort("/api/opencode-rpc" + url.slice(location.origin.length));
      input = typeof input === "string" ? rewritten : new Request(rewritten, input instanceof Request ? input : undefined);
    } else if (url.startsWith("/") && !url.startsWith("/api/") && !url.startsWith("/opencode")) {
      input = _addPort("/api/opencode-rpc" + url);
    }
    return _origFetch.call(this, input, init);
  };

  // patch location.reload()：opencode SPA 内部偶尔调用 reload，会导致 iframe 整体刷新
  // 用 no-op 替换，避免周期性白屏闪退
  try {
    Location.prototype.reload = function() {};
  } catch(e) {}

  // 辅助：判断 URL 是否指向文件下载（opencode 的文件/artifact 路径）
  var _DOWNLOAD_RE = /\/(file|files|artifact|artifacts|download|workdir)\b/i;
  function _isDownloadUrl(url) {
    if (_DOWNLOAD_RE.test(url)) return true;
    // 带有明确 download query 参数的也算下载
    try { if (new URL(url, location.origin).searchParams.has("download")) return true; } catch(e) {}
    return false;
  }
  // 辅助：通过隐藏 <a download> 触发浏览器真实下载
  function _triggerDownload(url) {
    var a = document.createElement("a");
    a.href = url.startsWith("/") ? _addPort("/api/opencode-rpc" + url) : url;
    a.download = "";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { document.body.removeChild(a); }, 200);
  }

  // patch window.open：拦截新 tab/窗口做 SPA 内导航，但放行下载链接
  var _origOpen = window.open;
  window.open = function(url, target, features) {
    if (url && typeof url === "string") {
      var path = url;
      if (url.startsWith(location.origin)) {
        path = url.slice(location.origin.length) || "/";
      } else if (/^https?:\/\/(?:127\.0\.0\.1|localhost)(:\d+)?/.test(url)) {
        path = url.replace(/^https?:\/\/(?:127\.0\.0\.1|localhost)(:\d+)?/, "") || "/";
      }
      // 下载链接：走真实下载，不做 pushState
      if (_isDownloadUrl(path)) {
        _triggerDownload(path);
        return null;
      }
      if (path.startsWith("/")) {
        history.pushState(null, "", _addPort(path));
        return null;
      }
    }
    // 完全外部链接：pushState 留在 iframe 内
    if (url && typeof url === "string") {
      history.pushState(null, "", url);
      return null;
    }
    return _origOpen.call(this, url, target, features);
  };

  // 拦截 target="_blank" 链接点击，但放行 download 属性和下载链接
  document.addEventListener("click", function(e) {
    var el = e.target;
    while (el && el !== document) {
      if (el.tagName === "A") {
        var href = el.getAttribute("href");
        // 带 download 属性的 <a> 标签：放行，让浏览器原生处理下载
        if (el.hasAttribute("download")) {
          // 仅重写路径让它走代理
          if (href && href.startsWith("/") && !href.startsWith("/api/")) {
            el.href = _addPort("/api/opencode-rpc" + href);
          }
          return; // 不阻止默认行为
        }
        // target="_blank" 且指向下载路径：触发下载
        if (el.getAttribute("target") === "_blank" && href && _isDownloadUrl(href)) {
          e.preventDefault();
          e.stopPropagation();
          _triggerDownload(href);
          return;
        }
        // 其他 target="_blank"：pushState 做 SPA 内导航
        if (el.getAttribute("target") === "_blank") {
          e.preventDefault();
          e.stopPropagation();
          if (href) {
            history.pushState(null, "", href.startsWith("/") ? _addPort(href) : href);
          }
          return;
        }
      }
      el = el.parentElement;
    }
  }, true);

  // patch WebSocket：同源 ws/wss 连接重定向到 /api/opencode-rpc，并带端口参数
  var _origWS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    var wsUrl = String(url);
    var originWs = location.origin.replace(/^http/, "ws");
    if (wsUrl.startsWith(originWs + "/") && !wsUrl.includes("/api/")) {
      wsUrl = _addPort(originWs + "/api/opencode-rpc" + wsUrl.slice(originWs.length));
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
