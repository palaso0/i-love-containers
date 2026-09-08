import React, { useState } from "react";
import { ContainerDetail } from "@/types";
import { Copy, Check, Search } from "lucide-react";

interface InspectTabProps {
  container: ContainerDetail;
}

export const InspectTab: React.FC<InspectTabProps> = ({ container }) => {
  const [copied, setCopied] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  const formattedJson = JSON.stringify(
    {
      Id: container.id,
      Created: container.created,
      Path: container.command || "/bin/sh",
      Args: [],
      State: {
        Status: container.state,
        Running: container.state === "running",
        Paused: container.state === "paused",
        Restarting: container.state === "restarting",
        OOMKilled: false,
        Dead: false,
        Pid: container.state === "running" ? 1420 : 0,
        ExitCode: container.state === "stopped" ? 0 : 0,
        Error: "",
        StartedAt: container.startedAt || container.created,
        FinishedAt: container.state === "stopped" ? new Date().toISOString() : "0001-01-01T00:00:00Z",
      },
      Image: container.imageId,
      ResolvConfPath: "/var/lib/docker/containers/" + container.id + "/resolv.conf",
      HostnamePath: "/var/lib/docker/containers/" + container.id + "/hostname",
      HostsPath: "/var/lib/docker/containers/" + container.id + "/hosts",
      LogPath: "/var/lib/docker/containers/" + container.id + "/" + container.id + "-json.log",
      Name: "/" + container.name,
      RestartCount: 0,
      Driver: "overlay2",
      Platform: container.platform || "linux/arm64",
      HostConfig: {
        Binds: (container.mounts || []).map((m) => `${m.source}:${m.destination}:${m.rw ? "rw" : "ro"}`),
        NetworkMode: (container.networks || [])[0] || "bridge",
        PortBindings: (container.ports || []).reduce((acc, p) => {
          acc[`${p.privatePort}/${p.type}`] = [{ HostIp: p.ip || "", HostPort: `${p.publicPort || ""}` }];
          return acc;
        }, {} as Record<string, unknown>),
        RestartPolicy: {
          Name: container.restartPolicy || "no",
        },
      },
      Config: {
        Hostname: container.id ? container.id.substring(0, 12) : "container",
        Tty: true,
        OpenStdin: true,
        Env: container.env || [],
        Cmd: [container.command || "/bin/sh"],
        Image: container.image,
        WorkingDir: "/app",
      },
      NetworkSettings: {
        Bridge: "",
        IPAddress: container.ipAddress || "172.17.0.2",
      },
    },
    null,
    2
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lines = formattedJson.split("\n");
  const filteredLines = filterQuery
    ? lines.filter((line) => line.toLowerCase().includes(filterQuery.toLowerCase()))
    : lines;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-xs">
      <div className="px-3 py-2 bg-surface-secondary border-b border-border flex items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3 h-3 text-muted-foreground absolute left-2.5 top-2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search attributes..."
            className="w-full pl-7 pr-2.5 py-0.5 text-2xs bg-surface border border-border rounded text-foreground focus:outline-none font-mono"
          />
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 px-2.5 py-1 text-2xs font-mono rounded bg-surface border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-status-running" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? "Copied" : "Copy JSON"}</span>
        </button>
      </div>

      <pre className="p-3 font-mono text-2xs text-muted-foreground overflow-x-auto max-h-[460px] overflow-y-auto leading-relaxed select-text bg-surface-secondary/20">
        <code>{filteredLines.join("\n")}</code>
      </pre>
    </div>
  );
};