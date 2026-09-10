import { ContainerSummary } from "@/types";

export interface ComposeServiceNode {
  id: string; 
  name: string;
  image: string;
  role: "gateway" | "frontend" | "backend" | "database" | "cache" | "worker" | "service";
  ports: string[];
  networks: string[];
  volumes: string[];
  dependsOn: string[];
  environment?: string[];
  command?: string;
  state: "running" | "stopped" | "paused";
  containerId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComposeNetworkNode {
  id: string;
  name: string;
  driver: string;
  services: string[];
  color: string;
}

export interface ComposeVolumeNode {
  id: string;
  name: string;
  driver?: string;
  services: string[];
  x: number;
  y: number;
}

export interface ComposeEdge {
  id: string;
  from: string; 
  to: string; 
  type: "depends_on" | "network" | "volume";
  label?: string;
  active: boolean;
}

export interface ComposeTopology {
  services: ComposeServiceNode[];
  networks: ComposeNetworkNode[];
  volumes: ComposeVolumeNode[];
  edges: ComposeEdge[];
  canvasWidth: number;
  canvasHeight: number;
}

export const sampleComposeYaml = `version: '3.8'

services:
  proxy:
    image: nginx:1.25-alpine
    container_name: proxy
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - web
      - api
    networks:
      - frontend_net
      - backend_net
    restart: always

  web:
    image: node:20-alpine
    container_name: web
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - API_URL=http://api:8080
    depends_on:
      - api
    networks:
      - frontend_net
    restart: unless-stopped

  api:
    image: golang:1.23-alpine
    container_name: api
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - DB_HOST=db:5432
      - REDIS_HOST=cache:6379
    depends_on:
      - db
      - cache
    networks:
      - backend_net
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    container_name: db
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=ilc_store
      - POSTGRES_USER=admin
      - POSTGRES_PASSWORD=secretpassword
    volumes:
      - pgdata_volume:/var/lib/postgresql/data
    networks:
      - backend_net
    restart: unless-stopped

  cache:
    image: redis:7.2-alpine
    container_name: cache
    ports:
      - "6379:6379"
    environment:
      - ALLOW_EMPTY_PASSWORD=yes
    volumes:
      - redis_data:/data
    networks:
      - backend_net
    restart: always

networks:
  frontend_net:
    driver: bridge
  backend_net:
    driver: bridge

volumes:
  pgdata_volume:
    driver: local
  redis_data:
    driver: local
`;

function inferServiceRole(name: string, image: string): ComposeServiceNode["role"] {
  const lowerName = name.toLowerCase();
  const lowerImg = image.toLowerCase();

  if (
    lowerName.includes("nocodb") ||
    lowerImg.includes("nocodb") ||
    lowerName.includes("pgadmin") ||
    lowerImg.includes("pgadmin") ||
    lowerName.includes("phpmyadmin") ||
    lowerImg.includes("phpmyadmin") ||
    lowerName.includes("adminer") ||
    lowerImg.includes("adminer") ||
    lowerName.includes("metabase") ||
    lowerImg.includes("metabase") ||
    lowerName.includes("mongo-express") ||
    lowerImg.includes("mongo-express")
  ) {
    return "service";
  }

  if (
    lowerName.includes("proxy") ||
    lowerName.includes("nginx") ||
    lowerName.includes("gateway") ||
    lowerName.includes("traefik") ||
    lowerImg.includes("nginx") ||
    lowerImg.includes("traefik") ||
    lowerImg.includes("caddy") ||
    lowerImg.includes("envoy")
  ) {
    return "gateway";
  }

  if (
    lowerName.includes("web") ||
    lowerName.includes("ui") ||
    lowerName.includes("front") ||
    lowerName.includes("client") ||
    lowerImg.includes("node") ||
    lowerImg.includes("react") ||
    lowerImg.includes("next")
  ) {
    return "frontend";
  }

  if (
    lowerName.includes("api") ||
    lowerName.includes("server") ||
    lowerName.includes("backend") ||
    lowerName.includes("app") ||
    lowerImg.includes("golang") ||
    lowerImg.includes("python") ||
    lowerImg.includes("fastapi") ||
    lowerImg.includes("django") ||
    lowerImg.includes("express")
  ) {
    return "backend";
  }

  const isDbImage =
    lowerImg.includes("postgres") ||
    lowerImg.includes("pgsql") ||
    lowerImg.includes("mysql") ||
    lowerImg.includes("mariadb") ||
    lowerImg.includes("mongo") ||
    lowerImg.includes("cockroach") ||
    lowerImg.includes("scylla") ||
    lowerImg.includes("cassandra") ||
    lowerImg.includes("clickhouse") ||
    lowerImg.includes("timescale") ||
    lowerImg.includes("sqlite") ||
    lowerImg.includes("neo4j");

  const isDbName =
    lowerName === "db" ||
    lowerName === "database" ||
    lowerName.endsWith("-db") ||
    lowerName.endsWith("_db") ||
    lowerName.startsWith("db-") ||
    lowerName.startsWith("db_") ||
    /(^|[-_])(postgres|mysql|mariadb|mongo|mongodb)([-_]|$)/.test(lowerName);

  if (isDbImage || isDbName) {
    return "database";
  }

  if (
    lowerName.includes("cache") ||
    lowerName.includes("redis") ||
    lowerName.includes("memcache") ||
    lowerImg.includes("redis") ||
    lowerImg.includes("valkey")
  ) {
    return "cache";
  }

  if (
    lowerName.includes("worker") ||
    lowerName.includes("queue") ||
    lowerName.includes("celery") ||
    lowerImg.includes("rabbitmq") ||
    lowerImg.includes("kafka")
  ) {
    return "worker";
  }

  return "service";
}

export function parseComposeYaml(
  yamlContent: string,
  liveContainers: ContainerSummary[] = []
): ComposeTopology {
  const serviceBlocks: Record<string, {
    image?: string;
    ports?: string[];
    volumes?: string[];
    networks?: string[];
    depends_on?: string[];
    environment?: string[];
    command?: string;
  }> = {};

  const networkList: Record<string, string> = {};
  const volumeList: Record<string, string> = {};

  const lines = yamlContent.split("\n");
  let currentSection: "services" | "networks" | "volumes" | null = null;
  let currentService: string | null = null;
  let currentKey: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = rawLine.search(/\S/);

    if (indent === 0) {
      if (trimmed.startsWith("services:")) {
        currentSection = "services";
        currentService = null;
        currentKey = null;
      } else if (trimmed.startsWith("networks:")) {
        currentSection = "networks";
        currentService = null;
        currentKey = null;
      } else if (trimmed.startsWith("volumes:")) {
        currentSection = "volumes";
        currentService = null;
        currentKey = null;
      } else {
        currentSection = null;
      }
      continue;
    }

    if (currentSection === "services") {
      if (indent === 2 && trimmed.endsWith(":")) {
        currentService = trimmed.slice(0, -1).trim();
        serviceBlocks[currentService] = {
          ports: [],
          volumes: [],
          networks: [],
          depends_on: [],
          environment: [],
        };
        currentKey = null;
        continue;
      }

      if (currentService && serviceBlocks[currentService]) {
        const s = serviceBlocks[currentService];

        if (indent === 4 && trimmed.endsWith(":")) {
          currentKey = trimmed.slice(0, -1).trim();
          continue;
        }

        if (indent === 4 && trimmed.includes(":")) {
          const colonIdx = trimmed.indexOf(":");
          const k = trimmed.slice(0, colonIdx).trim();
          const v = trimmed.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, "");
          if (k === "image") s.image = v;
          if (k === "command") s.command = v;
          currentKey = null;
          continue;
        }

        if (indent >= 6 && trimmed.startsWith("- ") && currentKey) {
          const item = trimmed.slice(2).trim().replace(/^['"]|['"]$/g, "");
          if (currentKey === "ports") s.ports?.push(item);
          if (currentKey === "volumes") s.volumes?.push(item);
          if (currentKey === "networks") s.networks?.push(item);
          if (currentKey === "depends_on") s.depends_on?.push(item);
          if (currentKey === "environment") s.environment?.push(item);
        } else if (indent >= 6 && currentKey === "environment" && trimmed.includes("=")) {
          s.environment?.push(trimmed.replace(/^['"]|['"]$/g, ""));
        }
      }
    } else if (currentSection === "networks") {
      if (indent === 2 && trimmed.endsWith(":")) {
        const netName = trimmed.slice(0, -1).trim();
        networkList[netName] = "bridge";
      }
    } else if (currentSection === "volumes") {
      if (indent === 2 && trimmed.endsWith(":")) {
        const volName = trimmed.slice(0, -1).trim();
        volumeList[volName] = "local";
      }
    }
  }

  if (Object.keys(serviceBlocks).length === 0 && liveContainers.length > 0) {
    liveContainers.forEach((c) => {
      const sName = c.composeService || c.name;
      serviceBlocks[sName] = {
        image: c.image,
        ports: c.ports?.map((p) => `${p.publicPort ? `${p.publicPort}:` : ""}${p.privatePort}`) || [],
        volumes: [],
        networks: ["default"],
        depends_on: [],
      };
    });
  }

  const networkColors = ["#007aff", "#a855f7", "#30d158", "#ff9f0a", "#38bdf8"];
  let netColorIdx = 0;
  const networks: ComposeNetworkNode[] = Object.keys(networkList).map((netName) => ({
    id: netName,
    name: netName,
    driver: networkList[netName] || "bridge",
    services: [],
    color: networkColors[netColorIdx++ % networkColors.length],
  }));

  const volumes: ComposeVolumeNode[] = Object.keys(volumeList).map((volName) => ({
    id: volName,
    name: volName,
    driver: volumeList[volName] || "local",
    services: [],
    x: 0,
    y: 0,
  }));

  const rawServices = Object.entries(serviceBlocks).map(([name, data]) => {
    const liveMatch = liveContainers.find(
      (c) =>
        (c.composeService && c.composeService.toLowerCase() === name.toLowerCase()) ||
        c.name.toLowerCase().includes(name.toLowerCase())
    );

    const image = data.image || liveMatch?.image || "alpine:latest";
    const role = inferServiceRole(name, image);

    return {
      id: name,
      name,
      image,
      role,
      ports: data.ports && data.ports.length > 0 ? data.ports : liveMatch?.ports?.map((p) => `${p.publicPort ? `${p.publicPort}:` : ""}${p.privatePort}`) || [],
      networks: data.networks && data.networks.length > 0 ? data.networks : ["default"],
      volumes: data.volumes || [],
      dependsOn: data.depends_on || [],
      environment: data.environment || [],
      command: data.command,
      state: liveMatch?.state === "running" ? "running" : liveMatch?.state === "paused" ? "paused" : "stopped",
      containerId: liveMatch?.id,
      x: 0,
      y: 0,
      width: 220,
      height: 96,
    } as ComposeServiceNode;
  });

  rawServices.forEach((svc) => {
    svc.networks.forEach((netName) => {
      const net = networks.find((n) => n.id === netName);
      if (net) {
        net.services.push(svc.id);
      }
    });

    svc.volumes.forEach((volSpec) => {
      const volName = volSpec.split(":")[0];
      const vol = volumes.find((v) => v.id === volName);
      if (vol) {
        vol.services.push(svc.id);
      }
    });
  });

  // 1. Group services into architectural tiers
  // 0: Gateways & Reverse Proxies (nginx, traefik, envoy, gateway)
  // 1: Frontends & Web UIs (web, ui, client, front)
  // 2: Application Services & Core APIs (api, server, app, backend)
  // 3: Workers & Auxiliary Tools (worker, queue, mailhog, tools)
  // 4: Databases & Storage (postgres, mysql, mariadb, mongo)
  // 5: Caches & In-Memory Stores (redis, memcached, valkey)
  const tiers: ComposeServiceNode[][] = [[], [], [], [], [], []];

  rawServices.forEach((svc) => {
    switch (svc.role) {
      case "gateway":
        tiers[0].push(svc);
        break;
      case "frontend":
        tiers[1].push(svc);
        break;
      case "backend":
        tiers[2].push(svc);
        break;
      case "worker":
        tiers[3].push(svc);
        break;
      case "database":
        tiers[4].push(svc);
        break;
      case "cache":
        tiers[5].push(svc);
        break;
      default:
        if (svc.ports && svc.ports.length > 0) {
          tiers[2].push(svc);
        } else {
          tiers[3].push(svc);
        }
        break;
    }
  });

  const nodeWidth = 230;
  const nodeHeight = 96;
  const horizontalGap = 44;
  const verticalGap = 84;
  const maxPerRow = 3; // Maximum nodes per row to prevent horizontal runaway

  interface LayoutRow {
    items: ComposeServiceNode[];
    tierIndex: number;
  }

  const rows: LayoutRow[] = [];

  tiers.forEach((tier, tierIdx) => {
    if (tier.length === 0) return;

    // Stable sort by service name
    const sorted = [...tier].sort((a, b) => a.name.localeCompare(b.name));

    // Chunk into rows of at most maxPerRow (or 2x2 if 4 items)
    const perRow = sorted.length === 4 ? 2 : maxPerRow;
    for (let i = 0; i < sorted.length; i += perRow) {
      rows.push({
        items: sorted.slice(i, i + perRow),
        tierIndex: tierIdx,
      });
    }
  });

  if (rows.length === 0 && rawServices.length > 0) {
    for (let i = 0; i < rawServices.length; i += maxPerRow) {
      rows.push({
        items: rawServices.slice(i, i + maxPerRow),
        tierIndex: 0,
      });
    }
  }

  // Calculate required canvas width
  let maxRowWidth = 0;
  rows.forEach((row) => {
    const w = row.items.length * nodeWidth + (row.items.length - 1) * horizontalGap;
    if (w > maxRowWidth) maxRowWidth = w;
  });

  const canvasWidth = Math.max(1040, maxRowWidth + 140);
  let currentY = 70;
  let prevTier = -1;

  rows.forEach((row) => {
    // Add extra tier spacing when switching tiers
    if (prevTier !== -1 && row.tierIndex !== prevTier) {
      currentY += 16;
    }
    prevTier = row.tierIndex;

    const count = row.items.length;
    const rowWidth = count * nodeWidth + (count - 1) * horizontalGap;
    const startX = Math.max(50, (canvasWidth - rowWidth) / 2);

    row.items.forEach((svc, idx) => {
      svc.x = Math.round(startX + idx * (nodeWidth + horizontalGap));
      svc.y = Math.round(currentY);
      svc.width = nodeWidth;
      svc.height = nodeHeight;
    });

    currentY += nodeHeight + verticalGap;
  });

  // Position volumes cleanly in a dedicated storage tier at the bottom
  // Guaranteed zero overlap with any service card!
  if (volumes.length > 0) {
    currentY += 24;
    const volWidth = 140;
    const volHeight = 44;
    const volGap = 28;
    const volPerRow = Math.min(4, Math.max(2, Math.ceil(volumes.length / 2)));
    const sortedVolumes = [...volumes].sort((a, b) => a.name.localeCompare(b.name));

    for (let i = 0; i < sortedVolumes.length; i += volPerRow) {
      const chunk = sortedVolumes.slice(i, i + volPerRow);
      const rowW = chunk.length * volWidth + (chunk.length - 1) * volGap;
      const startX = Math.max(50, (canvasWidth - rowW) / 2);

      chunk.forEach((vol, idx) => {
        vol.x = Math.round(startX + idx * (volWidth + volGap));
        vol.y = Math.round(currentY);
      });

      currentY += volHeight + 28;
    }
  }

  const canvasHeight = Math.max(760, currentY + 60);

  // Generate clean edges (only real explicit depends_on and volume mounts)
  const edges: ComposeEdge[] = [];
  rawServices.forEach((svc) => {
    svc.dependsOn.forEach((dep) => {
      const target = rawServices.find((s) => s.id === dep);
      if (target) {
        edges.push({
          id: `dep-${svc.id}-${target.id}`,
          from: svc.id,
          to: target.id,
          type: "depends_on",
          label: "depends on",
          active: svc.state === "running" && target.state === "running",
        });
      }
    });
  });

  volumes.forEach((vol) => {
    vol.services.forEach((sId) => {
      edges.push({
        id: `vol-${sId}-${vol.id}`,
        from: sId,
        to: vol.id,
        type: "volume",
        label: "mounts",
        active: true,
      });
    });
  });

  return {
    services: rawServices,
    networks,
    volumes,
    edges,
    canvasWidth,
    canvasHeight,
  };
}