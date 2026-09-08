import http from "node:http";
import os from "node:os";
import { createEngineHandler } from "../vite-engine-plugin";

const home = os.homedir();
const defaultPaths = [
  "/usr/local/bin",
  "/opt/homebrew/bin",
  "/opt/homebrew/sbin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
  `${home}/.docker/bin`,
  `${home}/.orbstack/bin`,
  `${home}/.local/bin`,
];
const currentPaths = (process.env.PATH || "").split(":");
for (const p of defaultPaths) {
  if (!currentPaths.includes(p)) {
    currentPaths.unshift(p);
  }
}
process.env.PATH = currentPaths.join(":");

const PORT = 41785;
const HOST = "127.0.0.1";

const handler = createEngineHandler({ cors: true });

const server = http.createServer((req, res) => {
  handler(req, res).catch((err) => {
    console.error("[Backend Server Error]:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: err?.message || "Internal Server Error" }));
    }
  });
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.log(`[Container Engine Server] Port ${PORT} is already in use; reusing running instance.`);
    process.exit(0);
  } else {
    console.error("[Container Engine Server] Server error:", err);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[Container Engine Server] Listening on http://${HOST}:${PORT}`);
});

process.stdin.resume();
process.stdin.on("end", () => {
  console.log("[Container Engine Server] Stdin closed, exiting...");
  process.exit(0);
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));