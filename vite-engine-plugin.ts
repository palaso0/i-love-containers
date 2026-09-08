import type { Plugin, ViteDevServer } from "vite";
import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";

export interface EngineCandidate {
  id: string;
  name: string;
  type: "docker-desktop" | "orbstack" | "rancher" | "colima" | "podman" | "custom";
  socketCandidates: string[];
  appPaths: string[];
  configPaths: string[];
  description: string;
  icon: string;
}

export interface EngineInfo {
  id: string;
  name: string;
  type: "docker-desktop" | "orbstack" | "rancher" | "colima" | "podman" | "custom";
  socketPath: string;
  appPath?: string;
  status: "running" | "stopped" | "not_installed";
  isDefault: boolean;
  isActive: boolean;
  version?: string;
  apiVersion?: string;
  arch?: string;
  os?: string;
  description: string;
  icon: string;
}

const home = os.homedir();

const DEFAULT_CANDIDATES: EngineCandidate[] = [
  {
    id: "docker-desktop",
    name: "Docker Desktop",
    type: "docker-desktop",
    socketCandidates: [
      path.join(home, ".docker/run/docker.sock"),
      "/var/run/docker.sock",
    ],
    appPaths: ["/Applications/Docker.app"],
    configPaths: [path.join(home, ".docker")],
    description: "Official Docker Desktop daemon & VM",
    icon: "docker",
  },
  {
    id: "orbstack",
    name: "OrbStack",
    type: "orbstack",
    socketCandidates: [
      path.join(home, ".orbstack/run/docker.sock"),
    ],
    appPaths: ["/Applications/OrbStack.app"],
    configPaths: [path.join(home, ".orbstack")],
    description: "Ultra-fast, lightweight Docker & Linux alternative",
    icon: "orbstack",
  },
  {
    id: "rancher",
    name: "Rancher Desktop",
    type: "rancher",
    socketCandidates: [
      path.join(home, ".rd/docker.sock"),
      "/var/run/docker.sock",
    ],
    appPaths: ["/Applications/Rancher Desktop.app"],
    configPaths: [path.join(home, ".rd")],
    description: "Container management and local Kubernetes",
    icon: "rancher",
  },
  {
    id: "colima",
    name: "Colima",
    type: "colima",
    socketCandidates: [
      path.join(home, ".colima/default/docker.sock"),
      path.join(home, ".colima/docker.sock"),
    ],
    appPaths: [],
    configPaths: [path.join(home, ".colima")],
    description: "Minimal container runtimes on macOS with Lima",
    icon: "colima",
  },
  {
    id: "podman",
    name: "Podman",
    type: "podman",
    socketCandidates: [
      path.join(home, ".local/share/containers/podman/machine/podman-machine-default/podman.sock"),
      path.join(home, ".local/share/containers/podman/machine/qemu/podman.sock"),
      "/var/run/podman/podman.sock",
    ],
    appPaths: ["/Applications/Podman Desktop.app"],
    configPaths: [path.join(home, ".config/containers")],
    description: "Daemonless container engine by Red Hat",
    icon: "podman",
  },
];

async function pingSocket(socketPath: string): Promise<{
  ok: boolean;
  version?: string;
  apiVersion?: string;
  os?: string;
  arch?: string;
}> {
  return new Promise((resolve) => {
    try {
      if (!fs.existsSync(socketPath)) {
        return resolve({ ok: false });
      }

      const req = http.request(
        {
          socketPath,
          path: "/version",
          method: "GET",
          timeout: 1200,
        },
        (res) => {
          if (res.statusCode !== 200) {
            return resolve({ ok: false });
          }
          let rawData = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (rawData += chunk));
          res.on("end", () => {
            try {
              const data = JSON.parse(rawData);
              resolve({
                ok: true,
                version: data.Version || "unknown",
                apiVersion: data.ApiVersion || "unknown",
                os: data.Os || process.platform,
                arch: data.Arch || process.arch,
              });
            } catch {
              resolve({ ok: true, version: "connected" });
            }
          });
        }
      );

      req.on("error", () => resolve({ ok: false }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false });
      });
      req.end();
    } catch {
      resolve({ ok: false });
    }
  });
}

function requestUnixSocket(
  socketPath: string,
  requestPath: string,
  method = "GET",
  bodyData?: any
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      socketPath,
      path: requestPath,
      method,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let rawData = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (rawData += chunk));
      res.on("end", () => {
        try {
          const parsed = rawData ? JSON.parse(rawData) : null;
          resolve({ status: res.statusCode || 200, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 200, data: rawData });
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Socket request timed out"));
    });

    if (bodyData) {
      req.write(typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function execInContainer(
  socketPath: string,
  containerId: string,
  cmd: string,
  cwd?: string
): Promise<{ output: string; exitCode: number }> {
  try {
    const createRes = await requestUnixSocket(
      socketPath,
      `/containers/${containerId}/exec`,
      "POST",
      {
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
        WorkingDir: cwd && cwd !== "/" ? cwd : undefined,
        Cmd: ["/bin/sh", "-c", cmd],
      }
    );
    if (createRes.status < 300 && createRes.data?.Id) {
      const execId = createRes.data.Id;
      const startRes = await requestUnixSocket(
        socketPath,
        `/exec/${execId}/start`,
        "POST",
        {
          Detach: false,
          Tty: false,
        }
      );
      const rawOutput = typeof startRes.data === "string" ? startRes.data : "";
      let output = rawOutput;
      if (
        output.length >= 8 &&
        (output.charCodeAt(0) === 1 || output.charCodeAt(0) === 2) &&
        output.charCodeAt(1) === 0 &&
        output.charCodeAt(2) === 0 &&
        output.charCodeAt(3) === 0
      ) {
        output = output.slice(8);
      }
      return { output, exitCode: 0 };
    }
  } catch {}

  return new Promise((resolve) => {
    const cwdArg = cwd && cwd !== "/" ? `-w ${JSON.stringify(cwd)} ` : "";
    exec(
      `docker exec ${cwdArg}${containerId} sh -c ${JSON.stringify(cmd)}`,
      { timeout: 15000, maxBuffer: 15 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          output: stdout || stderr || "",
          exitCode: error ? (error.code || 1) : 0,
        });
      }
    );
  });
}

interface CachedContainerStats {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  pidsCount: number;
  lastTotalUsage: number;
  lastSystemUsage: number;
  timestamp: number;
}

const statsCache = new Map<string, CachedContainerStats>();

async function getLiveContainerStat(
  socketPath: string,
  containerId: string
): Promise<CachedContainerStats> {
  const cached = statsCache.get(containerId);
  const now = Date.now();
  if (cached && now - cached.timestamp < 1500) {
    return cached;
  }

  try {
    const raw = await requestUnixSocket(
      socketPath,
      `/containers/${containerId}/stats?stream=false&one-shot=true`
    );
    if (raw.status < 300 && raw.data && typeof raw.data === "object") {
      const d = raw.data;
      const curTotalUsage = d.cpu_stats?.cpu_usage?.total_usage || 0;
      const curSystemUsage = d.cpu_stats?.system_cpu_usage || 0;
      const onlineCpus =
        d.cpu_stats?.online_cpus ||
        d.cpu_stats?.cpu_usage?.percpu_usage?.length ||
        1;

      let cpuPercent = cached ? cached.cpuPercent : 0;
      if (cached && cached.lastTotalUsage > 0 && curTotalUsage >= cached.lastTotalUsage) {
        const cpuDelta = curTotalUsage - cached.lastTotalUsage;
        const sysDelta = curSystemUsage - cached.lastSystemUsage;
        if (sysDelta > 0) {
          cpuPercent = Number(
            ((cpuDelta / sysDelta) * onlineCpus * 100).toFixed(2)
          );
        }
      } else if (!cached && curTotalUsage > 0) {
        const preTotal = d.precpu_stats?.cpu_usage?.total_usage || 0;
        const preSystem = d.precpu_stats?.system_cpu_usage || 0;
        if (preTotal > 0 && preSystem > 0 && curSystemUsage > preSystem) {
          cpuPercent = Number(
            (((curTotalUsage - preTotal) / (curSystemUsage - preSystem)) * onlineCpus * 100).toFixed(2)
          );
        }
      }

      const cache =
        d.memory_stats?.stats?.inactive_file ||
        d.memory_stats?.stats?.cache ||
        0;
      const rawMem = d.memory_stats?.usage || 0;
      const memUsage = Math.max(0, rawMem - cache);
      const memoryLimit = d.memory_stats?.limit || 1024 * 1024 * 1024;
      const memPercent =
        memoryLimit > 0 ? Number(((memUsage / memoryLimit) * 100).toFixed(2)) : 0;

      let rx = 0;
      let tx = 0;
      if (d.networks) {
        for (const net of Object.values<any>(d.networks)) {
          rx += net.rx_bytes || 0;
          tx += net.tx_bytes || 0;
        }
      }

      const freshStat: CachedContainerStats = {
        cpuPercent,
        memoryUsage: memUsage,
        memoryLimit,
        memoryPercent: memPercent,
        networkRxBytes: rx,
        networkTxBytes: tx,
        pidsCount: d.pids_stats?.current || 1,
        lastTotalUsage: curTotalUsage,
        lastSystemUsage: curSystemUsage,
        timestamp: now,
      };
      statsCache.set(containerId, freshStat);
      return freshStat;
    }
  } catch {}

  return (
    cached || {
      cpuPercent: 0,
      memoryUsage: 0,
      memoryLimit: 0,
      memoryPercent: 0,
      networkRxBytes: 0,
      networkTxBytes: 0,
      pidsCount: 1,
      lastTotalUsage: 0,
      lastSystemUsage: 0,
      timestamp: now,
    }
  );
}

export async function detectEngines(activeId?: string): Promise<{
  engines: EngineInfo[];
  activeEngine: EngineInfo | null;
}> {
  const customSocket = process.env.DOCKER_HOST;
  const candidates = [...DEFAULT_CANDIDATES];

  if (customSocket && customSocket.startsWith("unix://")) {
    const cleanSocket = customSocket.replace("unix://", "");
    candidates.unshift({
      id: "custom",
      name: "Custom DOCKER_HOST",
      type: "custom",
      socketCandidates: [cleanSocket],
      appPaths: [],
      configPaths: [],
      description: `User-defined DOCKER_HOST: ${cleanSocket}`,
      icon: "server",
    });
  }

  const results: EngineInfo[] = [];

  for (const candidate of candidates) {
    let resolvedSocket = candidate.socketCandidates[0];
    let isRunning = false;
    let versionInfo: { version?: string; apiVersion?: string; os?: string; arch?: string } = {};

    for (const sock of candidate.socketCandidates) {
      if (fs.existsSync(sock)) {
        resolvedSocket = sock;
        const ping = await pingSocket(sock);
        if (ping.ok) {
          isRunning = true;
          versionInfo = ping;
          break;
        }
      }
    }

    let installedAppPath: string | undefined;
    for (const app of candidate.appPaths) {
      if (fs.existsSync(app)) {
        installedAppPath = app;
        break;
      }
    }

    let hasConfig = false;
    for (const cfg of candidate.configPaths) {
      if (fs.existsSync(cfg)) {
        hasConfig = true;
        break;
      }
    }

    let status: "running" | "stopped" | "not_installed" = "not_installed";
    if (isRunning) {
      status = "running";
    } else if (installedAppPath || hasConfig || fs.existsSync(resolvedSocket)) {
      status = "stopped";
    }

    results.push({
      id: candidate.id,
      name: candidate.name,
      type: candidate.type,
      socketPath: resolvedSocket,
      appPath: installedAppPath,
      status,
      isDefault: candidate.id === "docker-desktop",
      isActive: false,
      version: versionInfo.version,
      apiVersion: versionInfo.apiVersion,
      arch: versionInfo.arch,
      os: versionInfo.os,
      description: candidate.description,
      icon: candidate.icon,
    });
  }

  let selected = results.find((e) => e.id === activeId);
  if (!selected) {
    selected = results.find((e) => e.status === "running") || results.find((e) => e.status === "stopped") || results[0];
  }

  if (selected) {
    selected.isActive = true;
  }

  return {
    engines: results,
    activeEngine: selected || null,
  };
}

export function createEngineHandler(options: { cors?: boolean } = {}) {
  let activeEngineId: string | undefined;

  return async (req: http.IncomingMessage, res: http.ServerResponse, next?: () => void) => {
    if (options.cors) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }
    }

    const url = req.url || "";

    if (!url.startsWith("/api/")) {
      if (next) {
        return next();
      }
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

        if (url === "/api/engines" && req.method === "GET") {
          const detection = await detectEngines(activeEngineId);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(detection));
          return;
        }

        if (url === "/api/engines/select" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", async () => {
            try {
              const { engineId } = JSON.parse(body);
              activeEngineId = engineId;
              const detection = await detectEngines(activeEngineId);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(detection));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid payload" }));
            }
          });
          return;
        }

        if (url === "/api/engines/rescan" && req.method === "GET") {
          const detection = await detectEngines(activeEngineId);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(detection));
          return;
        }

        const { activeEngine, engines } = await detectEngines(activeEngineId);

        if (!activeEngine || activeEngine.status !== "running") {
          if (url === "/api/overview" && req.method === "GET") {
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                dockerConnected: false,
                engineVersion: activeEngine?.version || "Offline",
                operatingSystem: activeEngine?.os || process.platform,
                architecture: activeEngine?.arch || process.arch,
                totalContainers: 0,
                runningContainers: 0,
                stoppedContainers: 0,
                pausedContainers: 0,
                totalImages: 0,
                totalVolumes: 0,
                totalNetworks: 0,
                systemCpuPercent: 0,
                systemMemoryTotal: os.totalmem(),
                systemMemoryUsed: 0,
                hostName: os.hostname(),
                activeHost: activeEngine?.name || "Local Engine",
                isMockData: false,
                activeEngine,
                detectedEngines: engines,
              })
            );
            return;
          }

          if (
            url === "/api/containers" ||
            url === "/api/images" ||
            url === "/api/volumes" ||
            url === "/api/networks" ||
            url === "/api/compose"
          ) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify([]));
            return;
          }

          res.statusCode = 503;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "Container engine is stopped or not responding",
              activeEngine,
              detectedEngines: engines,
            })
          );
          return;
        }

        const socketPath = activeEngine.socketPath;

        try {
          if (url === "/api/overview" && req.method === "GET") {
            const [versionRes, infoRes, containersRes] = await Promise.allSettled([
              requestUnixSocket(socketPath, "/version"),
              requestUnixSocket(socketPath, "/info"),
              requestUnixSocket(socketPath, "/containers/json"),
            ]);

            const versionData = versionRes.status === "fulfilled" ? versionRes.value.data : {};
            const infoData = infoRes.status === "fulfilled" ? infoRes.value.data : {};
            const rawRunning =
              containersRes.status === "fulfilled" && Array.isArray(containersRes.value.data)
                ? containersRes.value.data
                : [];

            let totalCpuPercent = 0;
            let totalMemoryUsed = 0;

            if (rawRunning.length > 0) {
              const statsList = await Promise.all(
                rawRunning.map((c: any) => getLiveContainerStat(socketPath, c.Id))
              );
              for (const s of statsList) {
                totalCpuPercent += s.cpuPercent;
                totalMemoryUsed += s.memoryUsage;
              }
            }

            const overview = {
              dockerConnected: true,
              engineVersion: versionData?.Version || activeEngine.version || "Docker",
              operatingSystem: versionData?.Os || infoData?.OperatingSystem || process.platform,
              architecture: versionData?.Arch || infoData?.Architecture || process.arch,
              totalContainers: infoData?.Containers || 0,
              runningContainers: infoData?.ContainersRunning || 0,
              stoppedContainers: infoData?.ContainersStopped || 0,
              pausedContainers: infoData?.ContainersPaused || 0,
              totalImages: infoData?.Images || 0,
              totalVolumes: 0,
              totalNetworks: 0,
              systemCpuPercent: Number(totalCpuPercent.toFixed(2)),
              systemMemoryTotal: infoData?.MemTotal || os.totalmem(),
              systemMemoryUsed: totalMemoryUsed,
              hostName: os.hostname(),
              activeHost: activeEngine.name,
              isMockData: false,
              activeEngine,
              detectedEngines: engines,
            };

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(overview));
            return;
          }

          if (url === "/api/containers" && req.method === "GET") {
            const raw = await requestUnixSocket(socketPath, "/containers/json?all=true");
            const rawContainers = Array.isArray(raw.data) ? raw.data : [];

            const runningContainers = rawContainers.filter((c: any) => c.State === "running");
            const statsMap = new Map<string, CachedContainerStats>();
            if (runningContainers.length > 0) {
              const statsResults = await Promise.all(
                runningContainers.map(async (c: any) => ({
                  id: c.Id,
                  stat: await getLiveContainerStat(socketPath, c.Id),
                }))
              );
              for (const item of statsResults) {
                statsMap.set(item.id, item.stat);
              }
            }

            const formatted = rawContainers.map((c: any) => {
              const name = c.Names && c.Names[0] ? (c.Names[0].startsWith("/") ? c.Names[0].slice(1) : c.Names[0]) : c.Id.slice(0, 12);
              const composeProject = c.Labels ? c.Labels["com.docker.compose.project"] : undefined;
              const composeService = c.Labels ? c.Labels["com.docker.compose.service"] : undefined;
              const stat = statsMap.get(c.Id);

              return {
                id: c.Id,
                name,
                image: c.Image,
                imageId: c.ImageID,
                state: c.State,
                status: c.Status,
                created: new Date((c.Created || 0) * 1000).toISOString(),
                command: c.Command || "",
                env: [],
                mounts: (c.Mounts || []).map((m: any) => ({
                  type: m.Type || "bind",
                  source: m.Source || "",
                  destination: m.Destination || "",
                  mode: m.Mode || "",
                  rw: m.RW ?? true,
                })),
                networks: Object.keys(c.NetworkSettings?.Networks || {}),
                ports: (c.Ports || []).map((p: any) => ({
                  ip: p.IP,
                  privatePort: p.PrivatePort,
                  publicPort: p.PublicPort,
                  type: p.Type,
                })),
                composeProject,
                composeService,
                cpuPercent: stat ? stat.cpuPercent : 0,
                memoryUsage: stat ? stat.memoryUsage : 0,
              };
            });

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(formatted));
            return;
          }

          if (url.startsWith("/api/containers/") && req.method === "GET") {
            const cleanPath = url.replace("/api/containers/", "").split("?")[0];
            const parts = cleanPath.split("/");
            const containerId = parts[0];
            const subRoute = parts[1]; 

            if (subRoute === "logs") {
              try {
                const raw = await requestUnixSocket(
                  socketPath,
                  `/containers/${containerId}/logs?stdout=true&stderr=true&tail=100&timestamps=true`
                );
                if (raw.status < 300) {
                  const rawString = typeof raw.data === "string" ? raw.data : JSON.stringify(raw.data || "");
                  const lines = rawString
                    .split("\n")
                    .map((line) => {
                      if (
                        line.length >= 8 &&
                        (line.charCodeAt(0) === 1 || line.charCodeAt(0) === 2) &&
                        line.charCodeAt(1) === 0 &&
                        line.charCodeAt(2) === 0 &&
                        line.charCodeAt(3) === 0
                      ) {
                        return line.slice(8).trim();
                      }
                      return line.trim();
                    })
                    .filter(Boolean);
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify(lines));
                  return;
                }
              } catch {}
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify([]));
              return;
            }

            if (subRoute === "stats") {
              try {
                const stat = await getLiveContainerStat(socketPath, containerId);
                const statPoint = {
                  containerId,
                  timestamp: new Date(stat.timestamp).toISOString(),
                  cpuPercent: stat.cpuPercent,
                  memoryUsage: stat.memoryUsage,
                  memoryLimit: stat.memoryLimit,
                  memoryPercent: stat.memoryPercent,
                  networkRxBytes: stat.networkRxBytes,
                  networkTxBytes: stat.networkTxBytes,
                  blockReadBytes: 0,
                  blockWriteBytes: 0,
                  pidsCount: stat.pidsCount,
                };

                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify([statPoint]));
                return;
              } catch {}
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify([]));
              return;
            }

            if (subRoute === "files") {
              const urlObj = new URL(req.url || "", "http://localhost");
              const isContent = parts[2] === "content";
              const targetPath = urlObj.searchParams.get("path") || (isContent ? "" : "/");
              const safePath = targetPath.replace(/'/g, "'\\''");

              if (isContent) {
                const isDownload = urlObj.searchParams.get("download") === "true";
                const fileName = path.posix.basename(targetPath) || "file";
                const resCmd = await execInContainer(socketPath, containerId, `base64 '${safePath}'`);
                if (resCmd.exitCode !== 0) {
                  res.statusCode = 404;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: "File not found or unreadable" }));
                  return;
                }
                const cleanBase64 = resCmd.output.replace(/\s+/g, "");
                const buf = Buffer.from(cleanBase64, "base64");
                if (isDownload) {
                  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
                  res.setHeader("Content-Type", "application/octet-stream");
                  res.setHeader("Content-Length", buf.length);
                  res.end(buf);
                } else {
                  const isBinary = buf.includes(0);
                  if (isBinary || buf.length > 5 * 1024 * 1024) {
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ isBinary: true, size: buf.length, content: "" }));
                  } else {
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ isBinary: false, size: buf.length, content: buf.toString("utf8") }));
                  }
                }
                return;
              }

              const resCmd = await execInContainer(
                socketPath,
                containerId,
                `cd '${safePath}' 2>/dev/null && pwd && echo '---FILES_DELIMITER---' && ls -lan`
              );
              if (resCmd.exitCode !== 0 || !resCmd.output.includes("---FILES_DELIMITER---")) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: resCmd.output || "Failed to list directory", entries: [] }));
                return;
              }
              const [canonicalPwd, rawListing] = resCmd.output.split("---FILES_DELIMITER---");
              const currentPath = canonicalPwd.trim() || "/";
              const parentPath = currentPath === "/" ? null : path.posix.dirname(currentPath);
              const lines = rawListing.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
              const entries: any[] = [];
              for (const line of lines) {
                if (line.startsWith("total ")) continue;
                const cols = line.split(/\s+/);
                if (cols.length < 9) continue;
                const perms = cols[0];
                const isDir = perms.startsWith("d");
                const isSym = perms.startsWith("l");
                const size = parseInt(cols[4], 10) || 0;
                const dateStr = `${cols[5]} ${cols[6]} ${cols[7]}`;
                let name = cols.slice(8).join(" ");
                let linkTarget: string | undefined;
                if (isSym && name.includes(" -> ")) {
                  const symParts = name.split(" -> ");
                  name = symParts[0];
                  linkTarget = symParts[1];
                }
                if (name === "." || name === "..") continue;
                entries.push({
                  name,
                  path: currentPath === "/" ? `/${name}` : `${currentPath}/${name}`,
                  isDirectory: isDir,
                  isSymlink: isSym,
                  linkTarget,
                  size,
                  mtime: dateStr,
                  permissions: perms,
                  owner: cols[2],
                  group: cols[3],
                });
              }
              entries.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
              });
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ currentPath, parentPath, entries }));
              return;
            }

            const raw = await requestUnixSocket(socketPath, `/containers/${containerId}/json`);
            const c = raw.data;

            if (!c || !c.Id) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "Container not found" }));
              return;
            }

            const detail = {
              id: c.Id,
              name: (c.Name || "").replace(/^\//, ""),
              image: c.Config?.Image || "",
              imageId: c.Image || "",
              state: c.State?.Status || "unknown",
              status: c.State?.Status || "",
              created: c.Created,
              startedAt: c.State?.StartedAt,
              ports: [],
              command: [c.Path, ...(c.Args || [])].filter(Boolean).join(" "),
              env: c.Config?.Env || [],
              mounts: (c.Mounts || []).map((m: any) => ({
                type: m.Type,
                source: m.Source,
                destination: m.Destination,
                mode: m.Mode,
                rw: m.RW,
              })),
              networks: Object.keys(c.NetworkSettings?.Networks || {}),
              ipAddress: c.NetworkSettings?.IPAddress || "",
              restartPolicy: c.HostConfig?.RestartPolicy?.Name || "no",
              rawInspectJson: JSON.stringify(c, null, 2),
            };

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(detail));
            return;
          }

          if (url.startsWith("/api/containers/") && req.method === "DELETE") {
            const containerId = url.replace("/api/containers/", "").split("?")[0];
            try {
              const actionRes = await requestUnixSocket(
                socketPath,
                `/containers/${containerId}?force=true&v=true`,
                "DELETE"
              );
              if (actionRes.status < 300) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true }));
                return;
              }
            } catch {}

            exec(`docker rm -f ${containerId}`, (err) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: !err }));
            });
            return;
          }

          if (url.startsWith("/api/containers/") && req.method === "POST") {
            const parts = url.replace("/api/containers/", "").split("/");
            const containerId = parts[0];
            const action = parts[1];

            if (["start", "stop", "restart", "pause", "unpause"].includes(action)) {
              const actionRes = await requestUnixSocket(socketPath, `/containers/${containerId}/${action}`, "POST");
              res.statusCode = actionRes.status;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: actionRes.status < 300 }));
              return;
            }

            if (action === "files") {
              const fileAction = parts[2];
              let body = "";
              req.on("data", (chunk) => (body += chunk));
              req.on("end", async () => {
                try {
                  const payload = JSON.parse(body || "{}");
                  let cmd = "";

                  if (fileAction === "write") {
                    const targetPath = payload.path || "";
                    const content = payload.content || "";
                    const tempFile = path.join(os.tmpdir(), `ilc-w-${Date.now()}-${Math.random().toString(36).slice(2)}`);
                    fs.writeFileSync(tempFile, content, "utf8");
                    exec(`docker cp ${JSON.stringify(tempFile)} ${containerId}:${JSON.stringify(targetPath)}`, (cpErr) => {
                      try { fs.unlinkSync(tempFile); } catch {}
                      if (!cpErr) {
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ ok: true, output: "", exitCode: 0 }));
                      } else {
                        const b64 = Buffer.from(content, "utf8").toString("base64");
                        const safePath = targetPath.replace(/'/g, "'\\''");
                        execInContainer(socketPath, containerId, `echo '${b64}' | base64 -d > '${safePath}'`)
                          .then((fallbackRes) => {
                            res.setHeader("Content-Type", "application/json");
                            res.end(JSON.stringify({ ok: fallbackRes.exitCode === 0, output: fallbackRes.output, exitCode: fallbackRes.exitCode }));
                          })
                          .catch((e) => {
                            res.setHeader("Content-Type", "application/json");
                            res.end(JSON.stringify({ ok: false, error: e.message }));
                          });
                      }
                    });
                    return;
                  } else if (fileAction === "mkdir") {
                    const targetPath = (payload.path || "").replace(/'/g, "'\\''");
                    cmd = `mkdir -p '${targetPath}'`;
                  } else if (fileAction === "touch") {
                    const targetPath = (payload.path || "").replace(/'/g, "'\\''");
                    cmd = `touch '${targetPath}'`;
                  } else if (fileAction === "rename") {
                    const oldPath = (payload.oldPath || "").replace(/'/g, "'\\''");
                    const newPath = (payload.newPath || "").replace(/'/g, "'\\''");
                    cmd = `mv '${oldPath}' '${newPath}'`;
                  } else if (fileAction === "delete") {
                    const paths: string[] = Array.isArray(payload.paths) ? payload.paths : [payload.path];
                    const safePaths = paths.map((p) => `'${p.replace(/'/g, "'\\''")}'`).join(" ");
                    cmd = `rm -rf ${safePaths}`;
                  } else if (fileAction === "copy") {
                    const sourcePath = (payload.sourcePath || "").replace(/'/g, "'\\''");
                    const targetPath = (payload.targetPath || "").replace(/'/g, "'\\''");
                    cmd = `cp -r '${sourcePath}' '${targetPath}'`;
                  } else if (fileAction === "upload") {
                    const dirPath = payload.path || "/";
                    const filename = payload.filename || "file";
                    const base64Data = payload.base64 || "";
                    const targetDir = dirPath === "/" ? "" : dirPath;
                    const destPath = `${targetDir}/${filename}`;
                    const tempFile = path.join(os.tmpdir(), `ilc-up-${Date.now()}-${Math.random().toString(36).slice(2)}`);
                    fs.writeFileSync(tempFile, Buffer.from(base64Data, "base64"));
                    exec(`docker cp ${JSON.stringify(tempFile)} ${containerId}:${JSON.stringify(destPath)}`, (cpErr, _stdout, cpStderr) => {
                      try { fs.unlinkSync(tempFile); } catch {}
                      if (!cpErr) {
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ ok: true, output: "", exitCode: 0 }));
                      } else {
                        execInContainer(socketPath, containerId, `echo '${base64Data.replace(/'/g, "'\\''")}' | base64 -d > '${destPath.replace(/'/g, "'\\''")}'`)
                          .then((fallbackRes) => {
                            res.setHeader("Content-Type", "application/json");
                            res.end(JSON.stringify({ ok: fallbackRes.exitCode === 0, output: fallbackRes.output || cpStderr, exitCode: fallbackRes.exitCode }));
                          })
                          .catch((e) => {
                            res.setHeader("Content-Type", "application/json");
                            res.end(JSON.stringify({ ok: false, error: e.message }));
                          });
                      }
                    });
                    return;
                  } else {
                    res.statusCode = 400;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ error: "Unknown file action" }));
                    return;
                  }

                  const resCmd = await execInContainer(socketPath, containerId, cmd);
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      ok: resCmd.exitCode === 0,
                      output: resCmd.output,
                      exitCode: resCmd.exitCode,
                    })
                  );
                  return;
                } catch (err: any) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: err.message }));
                  return;
                }
              });
              return;
            }

            if (action === "exec") {
              let body = "";
              req.on("data", (chunk) => (body += chunk));
              req.on("end", async () => {
                try {
                  const payload = JSON.parse(body || "{}");
                  const commandStr = (payload.command || "").trim();
                  const cols = Math.max(20, Math.min(500, Number(payload.cols) || 120));
                  const rows = Math.max(5, Math.min(200, Number(payload.rows) || 30));
                  const cwd = (payload.cwd || "/").trim() || "/";

                  if (!commandStr) {
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ output: "", exitCode: 0 }));
                    return;
                  }

                  let execCmd = commandStr;
                  if (/^ls(\s|$)/.test(execCmd)) {
                    const tokens = execCmd.split(/\s+/);
                    const hasLongListing = tokens.some((t) => /^-.*[l1]/.test(t));
                    if (!hasLongListing) {
                      if (!tokens.includes("-x")) {
                        execCmd = execCmd.replace(/^ls(\s+|$)/, `ls -x -w ${cols} `);
                      } else if (!tokens.some((t) => /^-.*w/.test(t))) {
                        execCmd = execCmd.replace(/^ls(\s+|$)/, `ls -w ${cols} `);
                      }
                    }
                  }

                  try {
                    const createRes = await requestUnixSocket(
                      socketPath,
                      `/containers/${containerId}/exec`,
                      "POST",
                      {
                        AttachStdout: true,
                        AttachStderr: true,
                        Tty: true,
                        WorkingDir: cwd && cwd !== "/" ? cwd : undefined,
                        ConsoleSize: [rows, cols],
                        Env: [
                          `COLUMNS=${cols}`,
                          `LINES=${rows}`,
                          "TERM=xterm-256color",
                        ],
                        Cmd: ["/bin/sh", "-c", execCmd],
                      }
                    );

                    if (createRes.status < 300 && createRes.data?.Id) {
                      const execId = createRes.data.Id;
                      const startRes = await requestUnixSocket(
                        socketPath,
                        `/exec/${execId}/start`,
                        "POST",
                        {
                          Detach: false,
                          Tty: true,
                        }
                      );
                      const rawOutput = typeof startRes.data === "string" ? startRes.data : "";
                      let output = rawOutput;
                      if (
                        output.length >= 8 &&
                        (output.charCodeAt(0) === 1 || output.charCodeAt(0) === 2) &&
                        output.charCodeAt(1) === 0 &&
                        output.charCodeAt(2) === 0 &&
                        output.charCodeAt(3) === 0
                      ) {
                        output = output.slice(8);
                      }
                      res.setHeader("Content-Type", "application/json");
                      res.end(JSON.stringify({ output, exitCode: 0 }));
                      return;
                    }
                  } catch {}

                  exec(
                    `docker exec -e COLUMNS=${cols} -e LINES=${rows} -e TERM=xterm-256color -e COLORTERM=truecolor -e CLICOLOR=1 -w ${JSON.stringify(cwd)} ${containerId} sh -c ${JSON.stringify(execCmd)}`,
                    { timeout: 15000 },
                    (error, stdout, stderr) => {
                      const output = stdout || stderr || (error ? error.message : "");
                      res.setHeader("Content-Type", "application/json");
                      res.end(JSON.stringify({ output, exitCode: error ? 1 : 0 }));
                    }
                  );
                  return;
                } catch (err: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message }));
                  return;
                }
              });
              return;
            }
          }

          if (url === "/api/images" && req.method === "GET") {
            const raw = await requestUnixSocket(socketPath, "/images/json");
            const rawImages = Array.isArray(raw.data) ? raw.data : [];

            const formatted = rawImages.map((img: any) => {
              let repo = "<none>";
              let tag = "<none>";
              if (img.RepoTags && img.RepoTags.length > 0 && img.RepoTags[0] !== "<none>:<none>") {
                const parts = img.RepoTags[0].split(":");
                tag = parts.pop() || "latest";
                repo = parts.join(":");
              }

              return {
                id: img.Id,
                repository: repo,
                tag,
                size: img.Size,
                created: new Date((img.Created || 0) * 1000).toISOString(),
                inUse: (img.Containers || 0) > 0,
                containerCount: img.Containers || 0,
              };
            });

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(formatted));
            return;
          }

          if (url.startsWith("/api/images/") && req.method === "DELETE") {
            const imageId = decodeURIComponent(url.replace("/api/images/", "").split("?")[0]);
            try {
              const actionRes = await requestUnixSocket(
                socketPath,
                `/images/${encodeURIComponent(imageId)}?force=true`,
                "DELETE"
              );
              if (actionRes.status < 300) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true }));
                return;
              }
            } catch {}

            exec(`docker rmi -f ${imageId}`, (err) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: !err }));
            });
            return;
          }

          if (url === "/api/volumes" && req.method === "GET") {
            const sizeMap = new Map<string, { size: number; refCount: number }>();
            try {
              const dfRaw = await requestUnixSocket(socketPath, "/system/df");
              if (Array.isArray(dfRaw.data?.Volumes)) {
                for (const v of dfRaw.data.Volumes) {
                  if (v.Name) {
                    sizeMap.set(v.Name, {
                      size: typeof v.UsageData?.Size === "number" ? v.UsageData.Size : 0,
                      refCount: typeof v.UsageData?.RefCount === "number" ? v.UsageData.RefCount : 0,
                    });
                  }
                }
              }
            } catch {
            }

            const raw = await requestUnixSocket(socketPath, "/volumes");
            const rawVolumes = raw.data?.Volumes || [];

            const formatted = rawVolumes.map((v: any) => {
              const dfInfo = sizeMap.get(v.Name);
              const size = dfInfo ? dfInfo.size : (v.UsageData?.Size ?? 0);
              const inUse = dfInfo ? dfInfo.refCount > 0 : false;
              return {
                name: v.Name,
                driver: v.Driver,
                mountpoint: v.Mountpoint,
                createdAt: v.CreatedAt,
                size: size,
                inUse: inUse,
                containers: [],
              };
            });

            formatted.sort((a: any, b: any) =>
              a.name.localeCompare(b.name, undefined, { numeric: true })
            );

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(formatted));
            return;
          }

          if (url.startsWith("/api/volumes/") && req.method === "DELETE") {
            const volumeName = decodeURIComponent(url.replace("/api/volumes/", "").split("?")[0]);
            try {
              const actionRes = await requestUnixSocket(
                socketPath,
                `/volumes/${encodeURIComponent(volumeName)}?force=true`,
                "DELETE"
              );
              if (actionRes.status < 300) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true }));
                return;
              }
            } catch {}

            exec(`docker volume rm -f ${volumeName}`, (err) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: !err }));
            });
            return;
          }

          if (url === "/api/networks" && req.method === "GET") {
            const raw = await requestUnixSocket(socketPath, "/networks");
            const rawNetworks = Array.isArray(raw.data) ? raw.data : [];

            const formatted = rawNetworks.map((n: any) => {
              const connected: any[] = [];
              if (n.Containers) {
                Object.entries(n.Containers).forEach(([id, c]: [string, any]) => {
                  connected.push({
                    id,
                    name: c.Name,
                    ipv4: c.IPv4Address,
                  });
                });
              }

              return {
                id: n.Id,
                name: n.Name,
                driver: n.Driver,
                scope: n.Scope,
                internal: !!n.Internal,
                containers: connected,
              };
            });

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(formatted));
            return;
          }

          if (url === "/api/compose" && req.method === "GET") {
            const projectMap = new Map<
              string,
              {
                name: string;
                workingDir?: string;
                configFile?: string;
                containers: any[];
              }
            >();

            const knownProjectsFile = path.join(home, ".ilovecontainers-compose-projects.json");
            const knownProjects = new Map<string, { name: string; workingDir?: string; configFile?: string; lastUsed: number }>();
            try {
              if (fs.existsSync(knownProjectsFile)) {
                const data = JSON.parse(fs.readFileSync(knownProjectsFile, "utf-8"));
                for (const [key, val] of Object.entries(data)) {
                  if (val && typeof val === "object") {
                    knownProjects.set(key.toLowerCase(), val as any);
                  }
                }
              }
            } catch {}

            const searchCandidateDirs = [
              path.join(home, "Documents/AI Projects/testsDockerCompose"),
              path.join(home, "Documents/AI Projects"),
              process.cwd(),
            ];
            for (const cDir of searchCandidateDirs) {
              if (fs.existsSync(cDir)) {
                const cFile = path.join(cDir, "docker-compose.yml");
                if (fs.existsSync(cFile)) {
                  const bName = path.basename(cDir);
                  if (!knownProjects.has(bName.toLowerCase())) {
                    knownProjects.set(bName.toLowerCase(), {
                      name: bName,
                      workingDir: cDir,
                      configFile: cFile,
                      lastUsed: Date.now(),
                    });
                  }
                }
              }
            }

            try {
              const raw = await requestUnixSocket(socketPath, "/containers/json?all=true");
              const rawContainers = Array.isArray(raw.data) ? raw.data : [];

              for (const c of rawContainers) {
                const projName = c.Labels ? c.Labels["com.docker.compose.project"] : undefined;
                if (!projName) continue;

                const workingDir = c.Labels ? c.Labels["com.docker.compose.project.working_dir"] : undefined;
                const configFiles = c.Labels ? c.Labels["com.docker.compose.project.config_files"] : undefined;

                if (!projectMap.has(projName)) {
                  projectMap.set(projName, {
                    name: projName,
                    workingDir,
                    configFile: configFiles ? configFiles.split(",")[0].trim() : undefined,
                    containers: [],
                  });
                }

                const p = projectMap.get(projName)!;
                if (!p.workingDir && workingDir) p.workingDir = workingDir;
                if (!p.configFile && configFiles) p.configFile = configFiles.split(",")[0].trim();

                const name = c.Names && c.Names[0] ? c.Names[0].replace(/^\//, "") : "unnamed";
                p.containers.push({
                  id: c.Id,
                  name,
                  image: c.Image,
                  imageId: c.ImageID,
                  state: c.State,
                  status: c.Status,
                  created: new Date((c.Created || 0) * 1000).toISOString(),
                  ports: (c.Ports || []).map((pt: any) => ({
                    ip: pt.IP,
                    privatePort: pt.PrivatePort,
                    publicPort: pt.PublicPort,
                    type: pt.Type,
                  })),
                  composeProject: projName,
                  composeService: c.Labels ? c.Labels["com.docker.compose.service"] : undefined,
                });
              }
            } catch {}

            await new Promise<void>((done) => {
              exec("docker compose ls --all --format json", (err, stdout) => {
                if (!err && stdout) {
                  try {
                    const parsed = JSON.parse(stdout);
                    if (Array.isArray(parsed)) {
                      for (const item of parsed) {
                        const name = item.Name || item.name;
                        const configFiles = item.ConfigFiles || item.configFiles;
                        const primaryConfig = configFiles ? configFiles.split(",")[0].trim() : undefined;
                        if (name) {
                          if (projectMap.has(name)) {
                            const entry = projectMap.get(name)!;
                            if (primaryConfig && !entry.configFile) entry.configFile = primaryConfig;
                            if (primaryConfig && !entry.workingDir) entry.workingDir = path.dirname(primaryConfig);
                          } else {
                            projectMap.set(name, {
                              name,
                              workingDir: primaryConfig ? path.dirname(primaryConfig) : undefined,
                              configFile: primaryConfig,
                              containers: [],
                            });
                          }
                        }
                      }
                    }
                  } catch {}
                }
                done();
              });
            });

            for (const p of projectMap.values()) {
              knownProjects.set(p.name.toLowerCase(), {
                name: p.name,
                workingDir: p.workingDir,
                configFile: p.configFile,
                lastUsed: Date.now(),
              });
            }

            for (const kp of knownProjects.values()) {
              const alreadyInMap = Array.from(projectMap.keys()).some(
                (k) => k.toLowerCase() === kp.name.toLowerCase()
              );
              if (!alreadyInMap) {
                let resolvedFile = kp.configFile;
                let resolvedDir = kp.workingDir;
                if (!resolvedFile && resolvedDir) {
                  const candidates = [
                    path.join(resolvedDir, "docker-compose.yml"),
                    path.join(resolvedDir, "docker-compose.yaml"),
                    path.join(resolvedDir, "compose.yaml"),
                    path.join(resolvedDir, "compose.yml"),
                  ];
                  for (const cand of candidates) {
                    if (fs.existsSync(cand)) {
                      resolvedFile = cand;
                      break;
                    }
                  }
                }

                if (resolvedFile && fs.existsSync(resolvedFile)) {
                  projectMap.set(kp.name, {
                    name: kp.name,
                    workingDir: resolvedDir || path.dirname(resolvedFile),
                    configFile: resolvedFile,
                    containers: [],
                  });
                }
              }
            }

            try {
              const toPersist: Record<string, any> = {};
              for (const [k, v] of knownProjects.entries()) {
                toPersist[k] = v;
              }
              fs.writeFileSync(knownProjectsFile, JSON.stringify(toPersist, null, 2), "utf-8");
            } catch {}

            const result = Array.from(projectMap.values()).map((p) => {
              let yamlContent: string | undefined = undefined;
              let resolvedConfig = p.configFile;

              if (resolvedConfig && fs.existsSync(resolvedConfig)) {
                try {
                  yamlContent = fs.readFileSync(resolvedConfig, "utf-8");
                } catch {}
              } else if (p.workingDir) {
                const candidates = [
                  path.join(p.workingDir, "docker-compose.yml"),
                  path.join(p.workingDir, "docker-compose.yaml"),
                  path.join(p.workingDir, "compose.yaml"),
                  path.join(p.workingDir, "compose.yml"),
                ];
                for (const cand of candidates) {
                  if (fs.existsSync(cand)) {
                    try {
                      yamlContent = fs.readFileSync(cand, "utf-8");
                      resolvedConfig = cand;
                      break;
                    } catch {}
                  }
                }
              }

              const isRunning = p.containers.some((c) => c.state === "running");

              return {
                name: p.name,
                workingDir: p.workingDir || (resolvedConfig ? path.dirname(resolvedConfig) : undefined),
                configFile: resolvedConfig,
                yamlContent,
                containers: p.containers,
                status: isRunning ? "running" : "stopped",
              };
            });

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
            return;
          }

          if (url.startsWith("/api/compose/") && !url.endsWith("/up") && req.method === "PUT") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
              try {
                const payload = JSON.parse(body || "{}");
                const { yamlContent, configFile, workingDir } = payload;
                if (!yamlContent) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "Missing yamlContent" }));
                  return;
                }

                let targetFile = configFile;
                if (!targetFile && workingDir) {
                  targetFile = path.join(workingDir, "docker-compose.yml");
                }

                if (!targetFile) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "No configFile or workingDir specified" }));
                  return;
                }

                fs.writeFileSync(targetFile, yamlContent, "utf-8");
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, file: targetFile }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          if (url.startsWith("/api/compose/") && url.endsWith("/up") && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
              try {
                const payload = JSON.parse(body || "{}");
                const { workingDir, configFile } = payload;
                const cwd = workingDir || (configFile ? path.dirname(configFile) : undefined);
                const fileArg = configFile ? `-f "${configFile}"` : "";

                const cmd = `docker compose ${fileArg} up -d`.trim();
                exec(cmd, { cwd: cwd || process.cwd() }, (error, stdout, stderr) => {
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      ok: !error,
                      stdout: stdout || "",
                      stderr: stderr || (error ? error.message : ""),
                    })
                  );
                });
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          if (url.startsWith("/api/compose/") && req.method === "DELETE") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
              try {
                const payload = JSON.parse(body || "{}");
                let { workingDir, configFile, forget } = payload;
                const urlObj = new URL(url, "http://localhost");
                const isForget = forget === true || urlObj.searchParams.get("forget") === "true";
                const projectName = decodeURIComponent(urlObj.pathname.replace("/api/compose/", "").split("/")[0]);

                const knownProjectsFile = path.join(home, ".ilovecontainers-compose-projects.json");

                if (isForget) {
                  try {
                    if (fs.existsSync(knownProjectsFile)) {
                      const data = JSON.parse(fs.readFileSync(knownProjectsFile, "utf-8"));
                      delete data[projectName.toLowerCase()];
                      fs.writeFileSync(knownProjectsFile, JSON.stringify(data, null, 2), "utf-8");
                    }
                  } catch {}
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ ok: true, forgotten: true }));
                  return;
                }

                if (!configFile || !workingDir) {
                  try {
                    if (fs.existsSync(knownProjectsFile)) {
                      const data = JSON.parse(fs.readFileSync(knownProjectsFile, "utf-8"));
                      const match = data[projectName.toLowerCase()];
                      if (match) {
                        configFile = configFile || match.configFile;
                        workingDir = workingDir || match.workingDir;
                      }
                    }
                  } catch {}

                  if (!configFile || !workingDir) {
                    await new Promise<void>((done) => {
                      exec("docker compose ls --all --format json", (err, stdout) => {
                        if (!err && stdout) {
                          try {
                            const parsed = JSON.parse(stdout);
                            if (Array.isArray(parsed)) {
                              for (const item of parsed) {
                                const name = item.Name || item.name;
                                if (name && (name.toLowerCase() === projectName.toLowerCase() || name === projectName)) {
                                  const cf = item.ConfigFiles || item.configFiles;
                                  if (cf) {
                                    configFile = cf.split(",")[0].trim();
                                    workingDir = path.dirname(configFile);
                                  }
                                  break;
                                }
                              }
                            }
                          } catch {}
                        }
                        done();
                      });
                    });
                  }
                }

                const cwd = workingDir || (configFile ? path.dirname(configFile) : undefined);
                const fileArg = configFile ? `-f "${configFile}"` : "";

                try {
                  let existing: Record<string, any> = {};
                  if (fs.existsSync(knownProjectsFile)) {
                    existing = JSON.parse(fs.readFileSync(knownProjectsFile, "utf-8"));
                  }
                  existing[projectName.toLowerCase()] = {
                    name: projectName,
                    workingDir: cwd,
                    configFile: configFile,
                    lastUsed: Date.now(),
                  };
                  fs.writeFileSync(knownProjectsFile, JSON.stringify(existing, null, 2), "utf-8");
                } catch {}

                exec(`docker compose ${fileArg} down`, { cwd: cwd || process.cwd() }, async () => {
                  try {
                    const raw = await requestUnixSocket(socketPath, "/containers/json?all=true");
                    const rawContainers = Array.isArray(raw.data) ? raw.data : [];
                    for (const c of rawContainers) {
                      const pLabel = c.Labels ? c.Labels["com.docker.compose.project"] : undefined;
                      if (pLabel && (pLabel.toLowerCase() === projectName.toLowerCase() || pLabel === projectName)) {
                        try {
                          await requestUnixSocket(socketPath, `/containers/${c.Id}?force=true&v=true`, "DELETE");
                        } catch {
                          exec(`docker rm -f ${c.Id}`, () => {});
                        }
                      }
                    }
                  } catch {}
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ ok: true }));
                });
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          if (next) {
            return next();
          }
          res.statusCode = 404;
          res.end("Not Found");
        } catch (err: any) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message || "Failed to communicate with container daemon" }));
        }
  };
}

export function createContainerEnginePlugin(): Plugin {
  const handler = createEngineHandler({ cors: false });
  return {
    name: "vite-container-engine-plugin",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        handler(req, res, next).catch(next);
      });
    },
  };
}