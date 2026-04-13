import { createServer } from "http";
import { parse } from "url";
import next from "next";
import httpProxy from "http-proxy";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "5023", 10);
const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

const app = next({ dev });
const handle = app.getRequestHandler();
const proxy = httpProxy.createProxyServer({ target: backendUrl, ws: true, changeOrigin: true });

function resolvePort(raw) {
  const portNum = raw ? parseInt(String(raw), 10) : NaN;
  return Number.isFinite(portNum) && portNum > 1024 && portNum < 65536
    ? portNum
    : null;
}

function readCookie(headers, key) {
  const cookie = headers?.cookie;
  if (!cookie) return null;
  const pairs = cookie.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    if (name !== key) continue;
    return decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return null;
}

function readPortFromReferer(headers) {
  const referer = headers?.referer;
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return resolvePort(url.searchParams.get("_oc_port"));
  } catch {
    return null;
  }
}

async function resolveOpencodePort(req, query) {
  const fromQuery = resolvePort(query?._oc_port);
  if (fromQuery) return fromQuery;

  const fromCookie = resolvePort(readCookie(req.headers, "oc_port"));
  if (fromCookie) return fromCookie;

  const fromReferer = readPortFromReferer(req.headers);
  if (fromReferer) return fromReferer;

  const headers = {};
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers.authorization) headers.authorization = req.headers.authorization;

  try {
    const response = await fetch(`${backendUrl}/api/dev-studio/instance`, {
      headers,
      cache: "no-store",
    });
    if (response.ok) {
      const data = await response.json();
      const port = resolvePort(data?.port);
      if (port) return port;
    }
  } catch {
    // ignore and fall through to the safe default
  }

  return 17171;
}

proxy.on("error", (err, req, res) => {
  console.error("Proxy error:", err.message);
  if (res && "writeHead" in res) {
    res.writeHead(502);
    res.end("Bad Gateway");
  }
});

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const pathname = parsedUrl.pathname || "";

    if (pathname.startsWith("/_next/static/chunks/")) {
      const originalSetHeader = res.setHeader.bind(res);
      res.setHeader = (name, value) => {
        if (String(name).toLowerCase() === "cache-control") {
          return originalSetHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
        }
        return originalSetHeader(name, value);
      };
      res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    } else if (!pathname.startsWith("/_next/static/") && !pathname.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
      res.setHeader("Clear-Site-Data", '"cache"');
    }

    handle(req, res, parsedUrl);
  });

  // 代理 WebSocket 升级请求
  server.on("upgrade", async (req, socket, head) => {
    const { pathname, query } = parse(req.url, true);

    // /asr → 后端 FastAPI
    if (pathname === "/asr") {
      proxy.ws(req, socket, head);
      return;
    }

    // /api/knowledge/collab/* → 协同编辑 WebSocket
    if (pathname && pathname.startsWith("/api/knowledge/collab")) {
      proxy.ws(req, socket, head);
      return;
    }

    // /api/opencode-rpc/* → 用户专属 opencode 实例
    if (pathname && pathname.startsWith("/api/opencode-rpc")) {
      const safePort = await resolveOpencodePort(req, query);
      if (!Number.isFinite(safePort) || safePort <= 1024 || safePort >= 65536) {
        socket.destroy();
        return;
      }
      const upstream = pathname.replace(/^\/api\/opencode-rpc/, "") || "/";
      const ocProxy = httpProxy.createProxyServer({
        target: `http://127.0.0.1:${safePort}`,
        ws: true,
        changeOrigin: true,
      });
      ocProxy.on("error", (err) => {
        console.error("OpenCode WS proxy error:", err.message);
        socket.destroy();
      });
      req.url = upstream;
      ocProxy.ws(req, socket, head);
      return;
    }

    socket.destroy();
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
