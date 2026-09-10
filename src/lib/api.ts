import {
  ContainerDetail,
  ContainerStats,
  ComposeProject,
  DockerImage,
  DockerNetwork,
  DockerVolume,
  SystemOverview,
  ContainerEngineInfo,
  ContainerFileItem,
  ContainerFileListResponse,
  ImageAnalysis,
} from "@/types";
import { DEFAULT_ENGINES, DEFAULT_OVERVIEW, DEFAULT_IMAGES } from "./engines";

let localContainers: ContainerDetail[] = [];
let localImages: DockerImage[] = [...DEFAULT_IMAGES];
let localVolumes: DockerVolume[] = [];
let localEngines: ContainerEngineInfo[] = [...DEFAULT_ENGINES];
let localActiveEngine: ContainerEngineInfo | null = DEFAULT_ENGINES[0] || null;

const BACKEND_PORT = 41785;

function getApiUrl(path: string): string {
  if (typeof window !== "undefined" && window.location.port === "5173") {
    return path;
  }
  return `http://127.0.0.1:${BACKEND_PORT}${path}`;
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = input.startsWith("/api") ? getApiUrl(input) : input;
  let attempts = 0;
  while (attempts < 3) {
    try {
      return await fetch(url, init);
    } catch (err) {
      attempts++;
      if (attempts >= 3) throw err;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  return fetch(url, init);
}

export async function fetchDetectedEngines(): Promise<{
  engines: ContainerEngineInfo[];
  activeEngine: ContainerEngineInfo | null;
}> {
  try {
    const response = await apiFetch("/api/engines");
    if (response.ok) {
      const data = await response.json();
      if (data.engines) {
        localEngines = data.engines;
        localActiveEngine = data.activeEngine || localEngines.find((e) => e.isActive) || localEngines[0];
        return data;
      }
    }
  } catch {}

  if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const nativeEngines = await invoke<any[]>("detect_container_engines");
      if (Array.isArray(nativeEngines) && nativeEngines.length > 0) {
        localEngines = nativeEngines.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.id as any,
          socketPath: e.socket_path,
          appPath: e.app_path,
          status: e.status,
          isDefault: e.is_default,
          isActive: e.id === (localActiveEngine?.id || "docker-desktop"),
        }));
        localActiveEngine = localEngines.find((e) => e.isActive) || localEngines[0];
        return {
          engines: localEngines,
          activeEngine: localActiveEngine,
        };
      }
    } catch {}
  }

  return {
    engines: localEngines,
    activeEngine: localActiveEngine,
  };
}

export async function selectContainerEngine(engineId: string): Promise<{
  engines: ContainerEngineInfo[];
  activeEngine: ContainerEngineInfo | null;
}> {
  try {
    const response = await apiFetch("/api/engines/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engineId }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.engines) {
        localEngines = data.engines;
        localActiveEngine = data.activeEngine;
        return data;
      }
    }
  } catch {}

  localEngines = localEngines.map((e) => ({
    ...e,
    isActive: e.id === engineId,
  }));
  localActiveEngine = localEngines.find((e) => e.id === engineId) || null;

  return {
    engines: localEngines,
    activeEngine: localActiveEngine,
  };
}

export async function rescanContainerEngines(): Promise<{
  engines: ContainerEngineInfo[];
  activeEngine: ContainerEngineInfo | null;
}> {
  try {
    const response = await apiFetch("/api/engines/rescan");
    if (response.ok) {
      const data = await response.json();
      if (data.engines) {
        localEngines = data.engines;
        localActiveEngine = data.activeEngine;
        return data;
      }
    }
  } catch {}

  return {
    engines: localEngines,
    activeEngine: localActiveEngine,
  };
}

export async function fetchSystemOverview(): Promise<SystemOverview> {
  try {
    const response = await apiFetch("/api/overview");
    if (response.ok) {
      const data = await response.json();
      if (data.detectedEngines) {
        localEngines = data.detectedEngines;
      }
      if (data.activeEngine) {
        localActiveEngine = data.activeEngine;
      }
      return data;
    }
  } catch {}

  return {
    ...DEFAULT_OVERVIEW,
    activeEngine: localActiveEngine || DEFAULT_ENGINES[0],
    detectedEngines: localEngines,
  };
}

export async function fetchContainers(): Promise<ContainerDetail[]> {
  try {
    const response = await apiFetch("/api/containers");
    if (response.ok) {
      return await response.json();
    }
  } catch {}
  return [];
}

export async function fetchContainer(id: string): Promise<ContainerDetail | null> {
  try {
    const response = await apiFetch(`/api/containers/${id}`);
    if (response.ok) {
      return await response.json();
    }
  } catch {}
  return null;
}

export async function startContainer(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/containers/${id}/start`, { method: "POST" });
    if (response.ok) return true;
  } catch {}

  localContainers = localContainers.map((container) => {
    if (container.id === id) {
      return {
        ...container,
        state: "running",
        status: "Up Less than a minute",
        startedAt: new Date().toISOString(),
        cpuPercent: 1.2,
        memoryUsage: 64 * 1024 * 1024,
      };
    }
    return container;
  });
  return true;
}

export async function stopContainer(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/containers/${id}/stop`, { method: "POST" });
    if (response.ok) return true;
  } catch {}

  localContainers = localContainers.map((container) => {
    if (container.id === id) {
      return {
        ...container,
        state: "stopped",
        status: "Exited (0) Just now",
        cpuPercent: 0,
        memoryUsage: 0,
      };
    }
    return container;
  });
  return true;
}

export async function pauseContainer(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/containers/${id}/pause`, { method: "POST" });
    if (response.ok) return true;
  } catch {}

  localContainers = localContainers.map((container) => {
    if (container.id === id) {
      return {
        ...container,
        state: "paused",
        status: "Paused",
        cpuPercent: 0,
      };
    }
    return container;
  });
  return true;
}

export async function unpauseContainer(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/containers/${id}/unpause`, { method: "POST" });
    if (response.ok) return true;
  } catch {}

  localContainers = localContainers.map((container) => {
    if (container.id === id) {
      return {
        ...container,
        state: "running",
        status: "Up",
        cpuPercent: 1.2,
      };
    }
    return container;
  });
  return true;
}

export async function restartContainer(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/containers/${id}/restart`, { method: "POST" });
    if (response.ok) return true;
  } catch {}

  localContainers = localContainers.map((container) => {
    if (container.id === id) {
      return {
        ...container,
        state: "running",
        status: "Up Just restarted",
        startedAt: new Date().toISOString(),
      };
    }
    return container;
  });
  return true;
}

export async function removeContainer(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/containers/${id}`, { method: "DELETE" });
    if (response.ok) return true;
  } catch {}

  localContainers = localContainers.filter((container) => container.id !== id);
  return true;
}

export async function fetchImages(): Promise<DockerImage[]> {
  try {
    const response = await apiFetch("/api/images");
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        localImages = data;
        return data;
      }
    }
  } catch {}
  return localImages;
}

export async function removeImage(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/images/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) return true;
  } catch {}

  localImages = localImages.filter((img) => img.id !== id);
  return true;
}

export function getMockImageAnalysis(imageId: string, repository = "node", tag = "20-alpine"): ImageAnalysis {
  const totalSize = 178 * 1024 * 1024;
  const wastedSize = 28 * 1024 * 1024;
  return {
    imageId,
    repository,
    tag,
    totalSize,
    wastedSize,
    efficiencyScore: 84,
    layerCount: 8,
    architecture: "arm64",
    os: "linux",
    layers: [
      {
        id: "sha256:7264a8db6415",
        index: 1,
        command: "FROM alpine:3.19",
        rawCommand: "ADD file:7264a8db6415... in /",
        instructionType: "FROM",
        size: 7.3 * 1024 * 1024,
        sizePercent: 4.1,
        created: new Date(Date.now() - 30 * 86400000).toISOString(),
        emptyLayer: false,
        files: [
          { path: "/bin/sh", size: 124000, type: "file", changeType: "added" },
          { path: "/etc/alpine-release", size: 14, type: "file", changeType: "added" },
          { path: "/etc/passwd", size: 1200, type: "file", changeType: "added" },
          { path: "/lib/ld-musl-aarch64.so.1", size: 680000, type: "file", changeType: "added" },
          { path: "/usr/bin/busybox", size: 840000, type: "file", changeType: "added" },
        ],
      },
      {
        id: "sha256:b892ec01a4e2",
        index: 2,
        command: "ENV NODE_VERSION=20.18.0 YARN_VERSION=1.22.22",
        rawCommand: "ENV NODE_VERSION=20.18.0 YARN_VERSION=1.22.22",
        instructionType: "ENV",
        size: 0,
        sizePercent: 0,
        created: new Date(Date.now() - 25 * 86400000).toISOString(),
        emptyLayer: true,
        files: [],
      },
      {
        id: "sha256:4c728e91d8f3",
        index: 3,
        command: "RUN apk add --no-cache libstdc++ ca-certificates",
        rawCommand: "RUN apk add --no-cache libstdc++ ca-certificates",
        instructionType: "RUN",
        size: 14.8 * 1024 * 1024,
        sizePercent: 8.3,
        created: new Date(Date.now() - 24 * 86400000).toISOString(),
        emptyLayer: false,
        files: [
          { path: "/usr/lib/libstdc++.so.6", size: 2800000, type: "file", changeType: "added" },
          { path: "/etc/ssl/certs/ca-certificates.crt", size: 210000, type: "file", changeType: "added" },
          { path: "/etc/apk/world", size: 45, type: "file", changeType: "modified" },
        ],
      },
      {
        id: "sha256:e1a90c41f712",
        index: 4,
        command: "RUN wget https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-arm64.tar.gz && tar -xzf node-v20.18.0-linux-arm64.tar.gz -C /usr/local --strip-components=1",
        rawCommand: "RUN wget https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-arm64.tar.gz",
        instructionType: "RUN",
        size: 92.4 * 1024 * 1024,
        sizePercent: 51.9,
        created: new Date(Date.now() - 22 * 86400000).toISOString(),
        emptyLayer: false,
        isBloat: true,
        bloatReason: "Tarball downloaded without removing archive in same layer",
        files: [
          { path: "/usr/local/bin/node", size: 84000000, type: "file", changeType: "added" },
          { path: "/usr/local/bin/npm", size: 12000, type: "symlink", changeType: "added" },
          { path: "/usr/local/lib/node_modules", size: 8000000, type: "dir", changeType: "added" },
          { path: "/tmp/node-v20.18.0-linux-arm64.tar.gz", size: 28000000, type: "file", changeType: "added" },
        ],
      },
      {
        id: "sha256:f481c9a1029e",
        index: 5,
        command: "WORKDIR /app",
        rawCommand: "WORKDIR /app",
        instructionType: "WORKDIR",
        size: 0,
        sizePercent: 0,
        created: new Date(Date.now() - 10 * 86400000).toISOString(),
        emptyLayer: true,
        files: [{ path: "/app", size: 4096, type: "dir", changeType: "added" }],
      },
      {
        id: "sha256:32810a0129bc",
        index: 6,
        command: "COPY package.json package-lock.json ./",
        rawCommand: "COPY package.json package-lock.json ./",
        instructionType: "COPY",
        size: 24 * 1024,
        sizePercent: 0.1,
        created: new Date(Date.now() - 5 * 86400000).toISOString(),
        emptyLayer: false,
        files: [
          { path: "/app/package.json", size: 1820, type: "file", changeType: "added" },
          { path: "/app/package-lock.json", size: 22500, type: "file", changeType: "added" },
        ],
      },
      {
        id: "sha256:91c2847a9801",
        index: 7,
        command: "RUN npm ci --only=production",
        rawCommand: "RUN npm ci --only=production",
        instructionType: "RUN",
        size: 58.2 * 1024 * 1024,
        sizePercent: 32.7,
        created: new Date(Date.now() - 4 * 86400000).toISOString(),
        emptyLayer: false,
        isBloat: true,
        bloatReason: "npm cache left in /root/.npm",
        files: [
          { path: "/app/node_modules", size: 42000000, type: "dir", changeType: "added" },
          { path: "/root/.npm", size: 16200000, type: "dir", changeType: "added" },
        ],
      },
      {
        id: "sha256:aa91280fc291",
        index: 8,
        command: "COPY . .",
        rawCommand: "COPY . .",
        instructionType: "COPY",
        size: 5.1 * 1024 * 1024,
        sizePercent: 2.9,
        created: new Date(Date.now() - 1 * 86400000).toISOString(),
        emptyLayer: false,
        files: [
          { path: "/app/src/index.ts", size: 4500, type: "file", changeType: "added" },
          { path: "/app/src/server.ts", size: 12800, type: "file", changeType: "added" },
          { path: "/app/dist", size: 4800000, type: "dir", changeType: "added" },
        ],
      },
    ],
    recommendations: [
      {
        title: "Clean NPM and package cache",
        description: "Layer 7 leaves 16.2 MB in /root/.npm. Run 'npm cache clean --force' in the same RUN command.",
        severity: "medium",
        layerIndex: 7,
        potentialSavings: 16.2 * 1024 * 1024,
      },
      {
        title: "Remove intermediate download archive",
        description: "Layer 4 downloads a 28 MB archive that is extracted and not deleted in the same command.",
        severity: "high",
        layerIndex: 4,
        potentialSavings: 28 * 1024 * 1024,
      },
      {
        title: "Multi-stage build opportunity",
        description: "Use a builder stage for dependencies and copy only compiled assets into a lean final runtime image.",
        severity: "high",
        potentialSavings: 65 * 1024 * 1024,
      },
    ],
  };
}

export async function fetchImageAnalysis(imageId: string): Promise<ImageAnalysis | null> {
  try {
    const response = await apiFetch(`/api/images/${encodeURIComponent(imageId)}/analysis`);
    if (response.ok) {
      return await response.json();
    }
  } catch {}

  const match = localImages.find((img) => img.id === imageId);
  return getMockImageAnalysis(
    imageId,
    match ? match.repository : "app",
    match ? match.tag : "latest"
  );
}

export async function fetchVolumes(): Promise<DockerVolume[]> {
  try {
    const response = await apiFetch("/api/volumes");
    if (response.ok) {
      return await response.json();
    }
  } catch {}
  return [];
}

export async function removeVolume(name: string): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/volumes/${encodeURIComponent(name)}`, { method: "DELETE" });
    if (response.ok) return true;
  } catch {}

  localVolumes = localVolumes.filter((vol) => vol.name !== name);
  return true;
}

export async function fetchNetworks(): Promise<DockerNetwork[]> {
  try {
    const response = await apiFetch("/api/networks");
    if (response.ok) {
      return await response.json();
    }
  } catch {}
  return [];
}

export async function fetchComposeProjects(): Promise<ComposeProject[]> {
  try {
    const response = await apiFetch("/api/compose");
    if (response.ok) {
      return await response.json();
    }
  } catch {}
  return [];
}

export async function saveComposeProjectYaml(
  projectName: string,
  yamlContent: string,
  workingDir?: string,
  configFile?: string
): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/compose/${encodeURIComponent(projectName)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yamlContent, workingDir, configFile }),
    });
    if (response.ok) return true;
  } catch {}
  return false;
}

export async function upComposeProject(
  projectName: string,
  workingDir?: string,
  configFile?: string
): Promise<{ ok: boolean; stdout?: string; stderr?: string }> {
  try {
    const response = await apiFetch(`/api/compose/${encodeURIComponent(projectName)}/up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workingDir, configFile }),
    });
    if (response.ok) return await response.json();
  } catch {}
  return { ok: false, stderr: "Failed to run docker compose up" };
}

export async function removeComposeProject(
  projectName: string,
  workingDir?: string,
  configFile?: string
): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/compose/${encodeURIComponent(projectName)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workingDir, configFile }),
    });
    if (response.ok) return true;
  } catch {}
  return false;
}

export async function forgetComposeProject(projectName: string): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/compose/${encodeURIComponent(projectName)}?forget=true`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forget: true }),
    });
    if (response.ok) return true;
  } catch {}
  return false;
}

export async function executeContainerCommand(
  containerId: string,
  command: string,
  cols?: number,
  rows?: number,
  cwd?: string
): Promise<{ output: string; exitCode: number }> {
  try {
    const response = await apiFetch(`/api/containers/${containerId}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, cols, rows, cwd }),
    });
    if (response.ok) return await response.json();
  } catch {}
  return { output: "", exitCode: 1 };
}

export async function fetchContainerStats(id: string): Promise<ContainerStats[]> {
  try {
    const response = await apiFetch(`/api/containers/${id}/stats`);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {}
  return [];
}

export async function fetchContainerLogs(id: string): Promise<string[]> {
  try {
    const response = await apiFetch(`/api/containers/${id}/logs`);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {}
  return [];
}

interface MockFsNode {
  name: string;
  isDirectory: boolean;
  size: number;
  mtime: string;
  permissions: string;
  content?: string;
}

const mockFilesystem: Record<string, MockFsNode[]> = {
  "/": [
    { name: "app", isDirectory: true, size: 4096, mtime: "Sep 7 12:00", permissions: "drwxr-xr-x" },
    { name: "bin", isDirectory: true, size: 4096, mtime: "Sep 7 00:00", permissions: "drwxr-xr-x" },
    { name: "etc", isDirectory: true, size: 4096, mtime: "Sep 7 00:00", permissions: "drwxr-xr-x" },
    { name: "home", isDirectory: true, size: 4096, mtime: "Sep 7 00:00", permissions: "drwxr-xr-x" },
    { name: "var", isDirectory: true, size: 4096, mtime: "Sep 7 00:00", permissions: "drwxr-xr-x" },
    { name: "tmp", isDirectory: true, size: 4096, mtime: "Sep 7 00:00", permissions: "drwxrwxrwt" },
    { name: ".dockerenv", isDirectory: false, size: 0, mtime: "Sep 7 00:00", permissions: "-rw-r--r--", content: "" },
  ],
  "/app": [
    { name: "package.json", isDirectory: false, size: 482, mtime: "Sep 7 12:00", permissions: "-rw-r--r--", content: '{\n  "name": "container-app",\n  "version": "1.0.0",\n  "main": "index.js",\n  "scripts": {\n    "start": "node index.js"\n  }\n}' },
    { name: "index.js", isDirectory: false, size: 215, mtime: "Sep 7 12:05", permissions: "-rw-r--r--", content: 'const http = require("http");\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { "Content-Type": "text/plain" });\n  res.end("Hello from container!");\n});\nserver.listen(8080);' },
    { name: "README.md", isDirectory: false, size: 310, mtime: "Sep 7 11:30", permissions: "-rw-r--r--", content: '# App in Container\n\nThis application is running inside your Docker container.' },
    { name: "config.json", isDirectory: false, size: 120, mtime: "Sep 7 11:45", permissions: "-rw-r--r--", content: '{\n  "port": 8080,\n  "environment": "production"\n}' },
    { name: "logs", isDirectory: true, size: 4096, mtime: "Sep 7 12:10", permissions: "drwxr-xr-x" },
  ],
  "/etc": [
    { name: "hosts", isDirectory: false, size: 158, mtime: "Sep 7 00:00", permissions: "-rw-r--r--", content: '127.0.0.1\tlocalhost\n::1\tlocalhost ip6-localhost ip6-loopback' },
    { name: "resolv.conf", isDirectory: false, size: 64, mtime: "Sep 7 00:00", permissions: "-rw-r--r--", content: 'nameserver 127.0.0.11\noptions ndots:0' },
  ],
  "/var": [
    { name: "log", isDirectory: true, size: 4096, mtime: "Sep 7 00:00", permissions: "drwxr-xr-x" },
  ],
  "/var/log": [
    { name: "app.log", isDirectory: false, size: 1024, mtime: "Sep 7 12:00", permissions: "-rw-r--r--", content: '[INFO] 2026-09-07 Service started\n[INFO] 2026-09-07 Ready for requests' },
  ],
};

function normalizePath(p: string): string {
  const clean = (p || "").replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
  if (!clean || clean === "/") return "/";
  const segments = clean.split("/").filter(Boolean);
  return "/" + segments.join("/");
}

function getParentPath(p: string): string | null {
  const norm = normalizePath(p);
  if (norm === "/") return null;
  const segments = norm.split("/").filter(Boolean);
  segments.pop();
  return segments.length === 0 ? "/" : "/" + segments.join("/");
}

export async function fetchContainerFiles(
  containerId: string,
  dirPath?: string
): Promise<ContainerFileListResponse> {
  const hasExplicitPath = Boolean(dirPath && dirPath.trim());
  const normalized = hasExplicitPath ? normalizePath(dirPath!) : "";
  const query = normalized ? `?path=${encodeURIComponent(normalized)}` : "";
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files${query}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.entries)) {
        return data;
      }
    }
  } catch {}

  const fallbackPath = normalized || "/";
  const nodes = mockFilesystem[fallbackPath] || [];
  const entries: ContainerFileItem[] = nodes.map((n) => ({
    name: n.name,
    path: fallbackPath === "/" ? `/${n.name}` : `${fallbackPath}/${n.name}`,
    isDirectory: n.isDirectory,
    isSymlink: false,
    size: n.size,
    mtime: n.mtime,
    permissions: n.permissions,
    owner: "root",
    group: "root",
  }));

  return {
    currentPath: fallbackPath,
    parentPath: getParentPath(fallbackPath),
    entries,
    defaultWorkingDir: fallbackPath,
  };
}

export async function fetchFileContent(
  containerId: string,
  filePath: string
): Promise<{ isBinary: boolean; size: number; content: string }> {
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/content?path=${encodeURIComponent(filePath)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  const norm = normalizePath(filePath);
  const parent = getParentPath(norm) || "/";
  const fileName = norm.split("/").filter(Boolean).pop() || "";
  const found = (mockFilesystem[parent] || []).find((f) => f.name === fileName);
  if (found) {
    return {
      isBinary: false,
      size: found.size,
      content: found.content || "",
    };
  }

  return { isBinary: false, size: 0, content: "" };
}

export async function downloadContainerFile(
  containerId: string,
  filePath: string,
  filename?: string
): Promise<void> {
  const name = filename || filePath.split("/").filter(Boolean).pop() || "download";
  try {
    const url = `/api/containers/${containerId}/files/content?path=${encodeURIComponent(filePath)}&download=true`;
    const fullUrl = getApiUrl(url);
    const a = document.createElement("a");
    a.href = fullUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    const res = await fetchFileContent(containerId, filePath);
    const blob = new Blob([res.content], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export async function saveContainerFile(
  containerId: string,
  filePath: string,
  content: string
): Promise<{ ok: boolean }> {
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, content }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const norm = normalizePath(filePath);
  const parent = getParentPath(norm) || "/";
  const fileName = norm.split("/").filter(Boolean).pop() || "";
  const list = mockFilesystem[parent];
  if (list) {
    const item = list.find((f) => f.name === fileName);
    if (item) {
      item.content = content;
      item.size = content.length;
      return { ok: true };
    }
  }
  return { ok: true };
}

export async function createContainerFolder(
  containerId: string,
  folderPath: string
): Promise<{ ok: boolean }> {
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/mkdir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: folderPath }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const norm = normalizePath(folderPath);
  const parent = getParentPath(norm) || "/";
  const folderName = norm.split("/").filter(Boolean).pop() || "";
  if (!mockFilesystem[parent]) mockFilesystem[parent] = [];
  mockFilesystem[parent].push({
    name: folderName,
    isDirectory: true,
    size: 4096,
    mtime: "Just now",
    permissions: "drwxr-xr-x",
  });
  mockFilesystem[norm] = [];
  return { ok: true };
}

export async function createContainerFile(
  containerId: string,
  filePath: string
): Promise<{ ok: boolean }> {
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/touch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const norm = normalizePath(filePath);
  const parent = getParentPath(norm) || "/";
  const fileName = norm.split("/").filter(Boolean).pop() || "";
  if (!mockFilesystem[parent]) mockFilesystem[parent] = [];
  mockFilesystem[parent].push({
    name: fileName,
    isDirectory: false,
    size: 0,
    mtime: "Just now",
    permissions: "-rw-r--r--",
    content: "",
  });
  return { ok: true };
}

export async function renameContainerFile(
  containerId: string,
  oldPath: string,
  newPath: string
): Promise<{ ok: boolean }> {
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPath, newPath }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const oldNorm = normalizePath(oldPath);
  const newNorm = normalizePath(newPath);
  const parent = getParentPath(oldNorm) || "/";
  const oldName = oldNorm.split("/").filter(Boolean).pop() || "";
  const newName = newNorm.split("/").filter(Boolean).pop() || "";
  const list = mockFilesystem[parent];
  if (list) {
    const item = list.find((f) => f.name === oldName);
    if (item) item.name = newName;
  }
  return { ok: true };
}

export async function deleteContainerFiles(
  containerId: string,
  paths: string[]
): Promise<{ ok: boolean }> {
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    if (res.ok) return await res.json();
  } catch {}

  for (const p of paths) {
    const norm = normalizePath(p);
    const parent = getParentPath(norm) || "/";
    const name = norm.split("/").filter(Boolean).pop() || "";
    if (mockFilesystem[parent]) {
      mockFilesystem[parent] = mockFilesystem[parent].filter((f) => f.name !== name);
    }
    delete mockFilesystem[norm];
  }
  return { ok: true };
}

export async function copyContainerFile(
  containerId: string,
  sourcePath: string,
  targetPath: string
): Promise<{ ok: boolean }> {
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePath, targetPath }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const srcNorm = normalizePath(sourcePath);
  const srcParent = getParentPath(srcNorm) || "/";
  const srcName = srcNorm.split("/").filter(Boolean).pop() || "";
  const srcItem = (mockFilesystem[srcParent] || []).find((f) => f.name === srcName);

  const tgtNorm = normalizePath(targetPath);
  const tgtParent = getParentPath(tgtNorm) || "/";
  const tgtName = tgtNorm.split("/").filter(Boolean).pop() || "";

  if (srcItem) {
    if (!mockFilesystem[tgtParent]) mockFilesystem[tgtParent] = [];
    mockFilesystem[tgtParent].push({
      ...srcItem,
      name: tgtName,
    });
    if (srcItem.isDirectory && mockFilesystem[srcNorm]) {
      mockFilesystem[tgtNorm] = JSON.parse(JSON.stringify(mockFilesystem[srcNorm]));
    }
  }
  return { ok: true };
}

export async function uploadContainerFile(
  containerId: string,
  dirPath: string,
  file: File
): Promise<{ ok: boolean }> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.split(",")[1] || "";
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dirPath, filename: file.name, base64 }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const norm = normalizePath(dirPath);
  if (!mockFilesystem[norm]) mockFilesystem[norm] = [];
  mockFilesystem[norm].push({
    name: file.name,
    isDirectory: false,
    size: file.size,
    mtime: "Just now",
    permissions: "-rw-r--r--",
    content: "",
  });
  return { ok: true };
}

export async function copyHostFileToContainer(
  containerId: string,
  destDir: string,
  hostPath: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("copy_host_file_to_container", {
      containerId,
      destDir,
      hostPath,
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}