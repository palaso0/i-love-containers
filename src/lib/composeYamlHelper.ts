

export interface ComposeServiceConfig {
  name: string;
  image?: string;
  container_name?: string;
  restart?: "no" | "always" | "on-failure" | "unless-stopped" | string;
  platform?: string;
  ports?: string[];
  environment?: string[];
  depends_on?: string[];
  networks?: string[];
  volumes?: string[];
  command?: string;

  customDirectives?: Array<{ key: string; value: string }>;

  extraLines?: string[];
}

export interface ParsedComposeFile {
  version?: string;
  services: ComposeServiceConfig[];
  availableNetworks: string[];
  availableVolumes: string[];
  rawTopLevelNetworks?: string;
  rawTopLevelVolumes?: string;
  rawHeaderComments?: string;
}

export function parseComposeYamlToConfig(yaml: string): ParsedComposeFile {
  const lines = yaml.split("\n");
  const services: ComposeServiceConfig[] = [];
  const availableNetworks: string[] = [];
  const availableVolumes: string[] = [];

  let version: string | undefined = undefined;
  let currentSection: "header" | "services" | "networks" | "volumes" | "other" = "header";
  let currentService: ComposeServiceConfig | null = null;
  let currentArrayKey: "ports" | "environment" | "depends_on" | "networks" | "volumes" | "extra" | null = null;

  const headerLines: string[] = [];
  const networkLines: string[] = [];
  const volumeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("version:")) {
      version = trimmed.replace("version:", "").trim().replace(/['"]/g, "");
      headerLines.push(rawLine);
      continue;
    }

    const indent = rawLine.search(/\S/);
    if (indent === 0 && trimmed.endsWith(":")) {
      if (currentService) {
        services.push(currentService);
        currentService = null;
      }
      currentArrayKey = null;

      if (trimmed.startsWith("services:")) {
        currentSection = "services";
      } else if (trimmed.startsWith("networks:")) {
        currentSection = "networks";
      } else if (trimmed.startsWith("volumes:")) {
        currentSection = "volumes";
      } else {
        currentSection = "other";
      }
      continue;
    }

    if (currentSection === "header") {
      headerLines.push(rawLine);
      continue;
    }

    if (currentSection === "networks") {
      networkLines.push(rawLine);
      if (indent === 2 && trimmed.endsWith(":")) {
        const netName = trimmed.slice(0, -1).trim();
        if (netName && !availableNetworks.includes(netName)) {
          availableNetworks.push(netName);
        }
      }
      continue;
    }

    if (currentSection === "volumes") {
      volumeLines.push(rawLine);
      if (indent === 2 && trimmed.endsWith(":")) {
        const volName = trimmed.slice(0, -1).trim();
        if (volName && !availableVolumes.includes(volName)) {
          availableVolumes.push(volName);
        }
      }
      continue;
    }

    if (currentSection === "services") {
      if (indent === 2 && trimmed.endsWith(":")) {
        if (currentService) {
          services.push(currentService);
        }
        const sName = trimmed.slice(0, -1).trim();
        currentService = {
          name: sName,
          ports: [],
          environment: [],
          depends_on: [],
          networks: [],
          volumes: [],
          customDirectives: [],
          extraLines: [],
        };
        currentArrayKey = null;
        continue;
      }

      if (!currentService) continue;

      if (trimmed.startsWith("- ") && currentArrayKey) {
        let val = trimmed.slice(2).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }

        if (currentArrayKey === "ports") currentService.ports?.push(val);
        else if (currentArrayKey === "environment") currentService.environment?.push(val);
        else if (currentArrayKey === "depends_on") currentService.depends_on?.push(val);
        else if (currentArrayKey === "networks") currentService.networks?.push(val);
        else if (currentArrayKey === "volumes") currentService.volumes?.push(val);
        else currentService.extraLines?.push(rawLine);
        continue;
      }

      if (currentArrayKey === "environment" && indent >= 6 && trimmed.includes(":") && !trimmed.startsWith("-")) {
        const colonIdx = trimmed.indexOf(":");
        const k = trimmed.slice(0, colonIdx).trim();
        let v = trimmed.slice(colonIdx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        currentService.environment = currentService.environment || [];
        currentService.environment.push(`${k}=${v}`);
        continue;
      }

      if (indent === 4) {
        const colonIdx = trimmed.indexOf(":");
        if (colonIdx === -1) {
          currentService.extraLines?.push(rawLine);
          continue;
        }

        const key = trimmed.slice(0, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();

        if (trimmed.endsWith(":") && !value) {
          if (["ports", "environment", "depends_on", "networks", "volumes"].includes(key)) {
            currentArrayKey = key as any;
          } else {
            currentArrayKey = null;
            currentService.extraLines?.push(rawLine);
          }
          continue;
        }

        currentArrayKey = null;
        let cleanVal = value;
        if ((cleanVal.startsWith('"') && cleanVal.endsWith('"')) || (cleanVal.startsWith("'") && cleanVal.endsWith("'"))) {
          cleanVal = cleanVal.slice(1, -1);
        }

        switch (key) {
          case "image":
            currentService.image = cleanVal;
            break;
          case "container_name":
            currentService.container_name = cleanVal;
            break;
          case "restart":
            currentService.restart = cleanVal;
            break;
          case "platform":
            currentService.platform = cleanVal;
            break;
          case "command":
            currentService.command = cleanVal;
            break;
          default:
            if (key && cleanVal !== undefined) {
              currentService.customDirectives = currentService.customDirectives || [];
              currentService.customDirectives.push({ key, value: cleanVal });
            } else {
              currentService.extraLines?.push(rawLine);
            }
            break;
        }
        continue;
      }

      if (indent > 4 && currentService) {
        currentService.extraLines?.push(rawLine);
      }
    }
  }

  if (currentService) {
    services.push(currentService);
  }

  return {
    version: version || "3.8",
    services,
    availableNetworks,
    availableVolumes,
    rawTopLevelNetworks: networkLines.join("\n"),
    rawTopLevelVolumes: volumeLines.join("\n"),
    rawHeaderComments: headerLines.filter((l) => l.trim().startsWith("#")).join("\n"),
  };
}

export function serializeConfigToComposeYaml(config: ParsedComposeFile): string {
  const parts: string[] = [];

  if (config.rawHeaderComments) {
    parts.push(config.rawHeaderComments);
  }

  parts.push(`version: '${config.version || "3.8"}'\n`);
  parts.push("services:");

  for (const svc of config.services) {
    parts.push(`  ${svc.name}:`);

    if (svc.image) {
      parts.push(`    image: ${svc.image}`);
    }
    if (svc.container_name) {
      parts.push(`    container_name: ${svc.container_name}`);
    }
    if (svc.platform) {
      parts.push(`    platform: ${svc.platform}`);
    }
    if (svc.command) {
      parts.push(`    command: ${svc.command}`);
    }
    if (svc.restart) {
      parts.push(`    restart: ${svc.restart}`);
    }

    if (svc.ports && svc.ports.length > 0) {
      parts.push("    ports:");
      for (const p of svc.ports) {
        parts.push(`      - "${p}"`);
      }
    }

    if (svc.environment && svc.environment.length > 0) {
      parts.push("    environment:");
      for (const env of svc.environment) {
        parts.push(`      - ${env}`);
      }
    }

    if (svc.depends_on && svc.depends_on.length > 0) {
      parts.push("    depends_on:");
      for (const dep of svc.depends_on) {
        parts.push(`      - ${dep}`);
      }
    }

    if (svc.volumes && svc.volumes.length > 0) {
      parts.push("    volumes:");
      for (const v of svc.volumes) {
        parts.push(`      - ${v}`);
      }
    }

    if (svc.networks && svc.networks.length > 0) {
      parts.push("    networks:");
      for (const net of svc.networks) {
        parts.push(`      - ${net}`);
      }
    }

    if (svc.customDirectives && svc.customDirectives.length > 0) {
      for (const d of svc.customDirectives) {
        if (d.key && d.key.trim()) {
          parts.push(`    ${d.key.trim()}: ${d.value.trim()}`);
        }
      }
    }

    if (svc.extraLines && svc.extraLines.length > 0) {
      for (const line of svc.extraLines) {
        parts.push(line);
      }
    }

    parts.push("");
  }

  if (config.rawTopLevelNetworks && config.rawTopLevelNetworks.trim()) {
    parts.push("networks:");
    parts.push(config.rawTopLevelNetworks);
    parts.push("");
  } else if (config.availableNetworks && config.availableNetworks.length > 0) {
    parts.push("networks:");
    for (const net of config.availableNetworks) {
      parts.push(`  ${net}:`);
      parts.push("    driver: bridge");
    }
    parts.push("");
  }

  if (config.rawTopLevelVolumes && config.rawTopLevelVolumes.trim()) {
    parts.push("volumes:");
    parts.push(config.rawTopLevelVolumes);
    parts.push("");
  } else if (config.availableVolumes && config.availableVolumes.length > 0) {
    parts.push("volumes:");
    for (const vol of config.availableVolumes) {
      parts.push(`  ${vol}:`);
      parts.push("    driver: local");
    }
    parts.push("");
  }

  return parts.join("\n").trimEnd() + "\n";
}

export function applyBulkServiceConfig(
  yamlString: string,
  targetServices: string[],
  action: {
    field: "platform" | "restart" | "environment" | "network" | "custom";
    value: string;
    customKey?: string;
  }
): string {
  const config = parseComposeYamlToConfig(yamlString);
  const targets = new Set(targetServices.length > 0 ? targetServices : config.services.map((s) => s.name));

  for (const svc of config.services) {
    if (!targets.has(svc.name)) continue;

    switch (action.field) {
      case "platform":
        if (action.value.trim() === "") {
          delete svc.platform;
        } else {
          svc.platform = action.value.trim();
        }
        break;

      case "restart":
        if (action.value.trim() === "") {
          delete svc.restart;
        } else {
          svc.restart = action.value.trim();
        }
        break;

      case "environment": {
        const envItem = action.value.trim();
        if (envItem) {
          svc.environment = svc.environment || [];
          const [varName] = envItem.split("=");
          const existingIdx = svc.environment.findIndex((e) => e.startsWith(`${varName}=`));
          if (existingIdx >= 0) {
            svc.environment[existingIdx] = envItem;
          } else {
            svc.environment.push(envItem);
          }
        }
        break;
      }

      case "network": {
        const netName = action.value.trim();
        if (netName) {
          svc.networks = svc.networks || [];
          if (!svc.networks.includes(netName)) {
            svc.networks.push(netName);
          }
          if (!config.availableNetworks.includes(netName)) {
            config.availableNetworks.push(netName);
          }
        }
        break;
      }

      case "custom": {
        if (action.customKey) {
          const k = action.customKey.trim();
          const v = action.value.trim();
          svc.customDirectives = svc.customDirectives || [];
          const existing = svc.customDirectives.find((d) => d.key === k);
          if (existing) {
            existing.value = v;
          } else {
            svc.customDirectives.push({ key: k, value: v });
          }
        }
        break;
      }
    }
  }

  return serializeConfigToComposeYaml(config);
}