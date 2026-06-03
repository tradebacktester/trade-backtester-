import http from "http";
import httpProxy from "http-proxy";

const TARGET = "http://localhost:80";
const PORT = 5000;

const proxy = httpProxy.createProxyServer({ ws: true, target: TARGET });

proxy.on("error", (err, req, res) => {
  if (res && !res.headersSent) {
    res.writeHead(502);
    res.end("Proxy error: " + err.message);
  }
});

const server = http.createServer((req, res) => {
  proxy.web(req, res);
});

server.on("upgrade", (req, socket, head) => {
  proxy.ws(req, socket, head);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Proxy running on port ${PORT} → ${TARGET}`);
});
