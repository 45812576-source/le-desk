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

  // 代理 WebSocket 升级请求 /asr → 后端
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname === "/asr") {
      proxy.ws(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
