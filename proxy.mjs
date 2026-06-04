import httpProxy from "http-proxy";
import http from "http";

const LISTEN_PORT = 5000;
const TARGET_PORT = Number(process.env.PROXY_TARGET_PORT ?? 24593);

const proxy = httpProxy.createProxyServer({
  target: { host: "localhost", port: TARGET_PORT },
  ws: true,
  changeOrigin: true,
});

proxy.on("error", (_err, _req, res) => {
  if (res && !res.headersSent) {
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
  proxy.ws(req, socket, head);
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(
    `Proxy ready: port ${LISTEN_PORT} → localhost:${TARGET_PORT}`
  );
});
