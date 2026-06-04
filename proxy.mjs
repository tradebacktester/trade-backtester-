import httpProxy from "http-proxy";
import http from "http";

const LISTEN_PORT = 5000;
const TARGET_PORT = Number(process.env.PROXY_TARGET_PORT ?? 24593);

const proxy = httpProxy.createProxyServer({
  target: { protocol: "http:", host: "localhost", port: TARGET_PORT },
  ws: true,
  changeOrigin: true,
});

proxy.on("error", (_err, _req, res) => {
  if (res && typeof res.writeHead === "function" && !res.headersSent) {
    try {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Waiting for app to start…");
    } catch {}
  }
});

const server = http.createServer((req, res) => {
  proxy.web(req, res);
});

server.on("upgrade", (req, socket, head) => {
  try {
    proxy.ws(req, socket, head);
  } catch {}
});

process.on("uncaughtException", (err) => {
  console.error("Proxy uncaught exception (non-fatal):", err.message);
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`Proxy ready: port ${LISTEN_PORT} → localhost:${TARGET_PORT}`);
});
