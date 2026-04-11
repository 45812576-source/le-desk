import { NextRequest, NextResponse } from "next/server";

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
    const injectScript = `<script>
(function() {
  var _ocPort = ${JSON.stringify(ocPort)};
  var _portSuffix = _ocPort ? ("?_oc_port=" + _ocPort) : "";
  var _proxyBase = "/api/opencode";

  try {
    if (location.pathname === _proxyBase || location.pathname.startsWith(_proxyBase + "/")) {
      var _internalPath = location.pathname.slice(_proxyBase.length) || "/";
      history.replaceState(history.state, "", _internalPath + location.search + location.hash);
    }
  } catch (e) {}

  function _addPort(url) {
    if (!_ocPort) return url;
    try {
      var sep = url.includes("?") ? "&" : "?";
      return url + sep + "_oc_port=" + _ocPort;
    } catch(e) { return url; }
  }

  function _resolveSameOriginPath(url) {
    if (!url || typeof url !== "string") return null;
    try {
      var resolved = new URL(url, location.href);
      if (resolved.origin !== location.origin) return null;
      return resolved.pathname + resolved.search + resolved.hash;
    } catch (e) {
      return null;
    }
  }

  function _isStaticPath(path) {
    return !!path && (
      path.startsWith("/assets/") ||
      path === "/favicon.ico" ||
      path.endsWith(".css") ||
      path.endsWith(".js") ||
      path.endsWith(".mjs") ||
      path.endsWith(".png") ||
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".gif") ||
      path.endsWith(".svg") ||
      path.endsWith(".webp") ||
      path.endsWith(".ico") ||
      path.endsWith(".woff") ||
      path.endsWith(".woff2") ||
      path.endsWith(".ttf") ||
      path.endsWith(".map") ||
      path.endsWith(".webmanifest")
    );
  }

  function _rewriteRpcPath(url) {
    if (!url || typeof url !== "string") return url;
    var path = _resolveSameOriginPath(url) || url;
    if (path.startsWith("/api/")) return _addPort(path);
    if (!path.startsWith("/")) return url;
    if (_isStaticPath(path)) return _addPort("/api/opencode" + path);
    return _addPort("/api/opencode-rpc" + path);
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

  // patch fetch：把同源 API/相对路径统一改写到代理，并带端口参数
  var _origFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === "string" ? input : (input instanceof Request ? input.url : String(input));
    var rewritten = _rewriteRpcPath(url);
    if (rewritten !== url) {
      input = typeof input === "string" ? rewritten : new Request(rewritten, input instanceof Request ? input : undefined);
    }
    return _origFetch.call(this, input, init);
  };

  try {
    var _origXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (typeof url === "string") {
        arguments[1] = _rewriteRpcPath(url);
      }
      return _origXHROpen.apply(this, arguments);
    };
  } catch (e) {}

  try {
    var _origEventSource = window.EventSource;
    if (_origEventSource) {
      window.EventSource = function(url, config) {
        var nextUrl = typeof url === "string" ? _rewriteRpcPath(url) : url;
        return new _origEventSource(nextUrl, config);
      };
      window.EventSource.prototype = _origEventSource.prototype;
    }
  } catch (e) {}

  // patch location.reload()：opencode SPA 内部偶尔调用 reload，会导致 iframe 整体刷新
  // 用 no-op 替换，避免周期性白屏闪退
  try {
    Location.prototype.reload = function() {};
  } catch(e) {}

  // patch 表单提交：OpenCode 某些问答/确认交互会通过 form action 提交
  function _rewriteForm(el) {
    if (!el || !el.getAttribute) return;
    var action = el.getAttribute("action");
    if (action) el.setAttribute("action", _rewriteRpcPath(action));
  }
  document.addEventListener("submit", function(e) {
    var form = e.target;
    if (form && form.tagName === "FORM") _rewriteForm(form);
  }, true);
  try {
    var _origSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function() {
      _rewriteForm(this);
      return _origSubmit.call(this);
    };
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
    a.href = typeof url === "string" ? _rewriteRpcPath(url) : url;
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
        var formaction = el.getAttribute("formaction");
        if (formaction) {
          el.setAttribute("formaction", _rewriteRpcPath(formaction));
        }
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

  // MutationObserver：拦截动态添加的 <link>/<script>/<img>，把 /assets/ 重写到代理路径
  try {
    var _rewriteAttr = function(el, attr) {
      var val = el.getAttribute(attr);
      if (val && val.startsWith("/assets/")) {
        el.setAttribute(attr, "/api/opencode" + val);
      } else if (val && val.startsWith("./assets/")) {
        el.setAttribute(attr, "/api/opencode/assets/" + val.slice(9));
      } else if (val && val.startsWith("/") && !val.startsWith("/api/")) {
        el.setAttribute(attr, "/api/opencode" + val);
      }
    };
    new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var nodes = mutations[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (n.nodeType !== 1) continue;
          var tag = n.tagName;
          if (tag === "LINK") _rewriteAttr(n, "href");
          else if (tag === "SCRIPT" || tag === "IMG") _rewriteAttr(n, "src");
          else if (tag === "FORM") _rewriteForm(n);
          else if (tag === "BUTTON" || tag === "INPUT") {
            var formAction = n.getAttribute("formaction");
            if (formAction) n.setAttribute("formaction", _rewriteRpcPath(formAction));
          }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch(e) {}

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

  // preload 失败容错：modulepreload 加载失败时降级为普通 script[type=module]
  window.addEventListener("error", function(e) {
    if (e.target && e.target.tagName === "LINK" && e.target.rel === "modulepreload") {
      var failedHref = e.target.href;
      e.target.remove();
      var script = document.createElement("script");
      script.type = "module";
      script.src = failedHref;
      document.head.appendChild(script);
    }
  }, true);
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
    // Vite 打包的 JS 中硬编码了 "/assets/..." 路径用于 CSS preload 和动态 import
    // 这些不经过 fetch patch，必须在源码级别重写到代理路径
    js = js.replace(/(["'])(?:\.\/)?assets\//g, '$1/api/opencode/assets/');
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
    css = css.replace(/url\(\s*\/assets\//g, "url(/api/opencode/assets/");
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
