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
    handle(req, res, parsedUrl);
  });

  // 代理 WebSocket 升级请求
  server.on("upgrade", (req, socket, head) => {
    const { pathname, query } = parse(req.url, true);

    // /asr → 后端 FastAPI
    if (pathname === "/asr") {
      proxy.ws(req, socket, head);
      return;
    }

    // /api/opencode-rpc/* → 用户专属 opencode 实例
    if (pathname && pathname.startsWith("/api/opencode-rpc")) {
      const ocPort = query._oc_port || "17171";
      const safePort = parseInt(String(ocPort), 10);
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
