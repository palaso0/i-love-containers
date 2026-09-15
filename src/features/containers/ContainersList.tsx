import React, { useState } from "react";
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Search,
  MoreHorizontal,
  FileText,
  Terminal,
  Activity,
  Copy,
  Check,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { ContainerDetail, ContainerState } from "@/types";
import { formatBytes } from "@/lib/utils";
import { TechIcon } from "@/components/TechIcon";
import { DockerDisconnected } from "@/components/DockerDisconnected";
import { Box } from "lucide-react";

export const ContainersList: React.FC = () => {
  const {
    viewMode,
    containers,
    systemOverview,
    setSelectedContainerId,
    setContainerDetailTab,
    startContainer,
    stopContainer,
    restartContainer,
    removeContainer,
  } = useAppStore();

  const isConnected = systemOverview?.dockerConnected ?? false;

  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | ContainerState>("all");
  const [activeMenuContainerId, setActiveMenuContainerId] = useState<
    string | null
  >(null);
  const [containerToDelete, setContainerToDelete] =
    useState<ContainerDetail | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isConnected) {
    return <DockerDisconnected icon={Box} />;
  }

  const filteredContainers = containers.filter((container) => {
    const matchesSearch =
      container.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      container.image.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (container.composeProject &&
        container.composeProject
          .toLowerCase()
          .includes(searchQuery.toLowerCase()));

    const matchesState =
      stateFilter === "all" || container.state === stateFilter;
    return matchesSearch && matchesState;
  });

  const handleOpenDetail = (containerId: string) => {
    setSelectedContainerId(containerId);
    setContainerDetailTab("overview");
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getStatusDot = (state: ContainerState) => {
    switch (state) {
      case "running":
        return "bg-status-running shadow-[0_0_6px_rgba(16,185,129,0.4)]";
      case "restarting":
        return "bg-status-restarting animate-ping";
      case "paused":
        return "bg-status-paused";
      case "stopped":
      case "exited":
      default:
        return "bg-status-stopped";
    }
  };

  return (
    <div
      className="flex-1 overflow-y-auto p-5 space-y-4 bg-background"
      onClick={() => setActiveMenuContainerId(null)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-semibold text-foreground tracking-tight">
              Containers
            </h1>
            <span className="text-xs font-mono text-muted-foreground bg-surface-secondary/70 border border-border/60 px-2 py-0.5 rounded-full">
              {containers.filter((c) => c.state === "running").length}/
              {containers.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage local container runtimes and services
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter containers..."
              className="pl-8 pr-3 py-1 text-xs bg-surface border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 w-48 sm:w-56 transition-all shadow-xs"
            />
          </div>

          <div className="flex items-center bg-surface-secondary/70 border border-border/60 rounded-lg p-0.5">
            {(["all", "running", "stopped"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStateFilter(filter)}
                className={`px-2.5 py-0.5 text-2xs rounded-md capitalize transition-all ${
                  stateFilter === filter
                    ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredContainers.length === 0 ? (
        <div className="bg-surface/50 border border-border/60 rounded-xl p-12 text-center flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-muted-foreground">
            No containers match the filter criteria
          </p>
        </div>
      ) : viewMode === "minimal" ? (
        <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl overflow-hidden shadow-xs divide-y divide-border/60">
          {filteredContainers.map((container) => {
            const isRunning = container.state === "running";
            return (
              <div
                key={container.id}
                onClick={() => handleOpenDetail(container.id)}
                className="px-4 py-2.5 flex items-center justify-between hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3 truncate mr-4">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${getStatusDot(container.state)}`}
                  />
                  <TechIcon
                    image={container.image}
                    name={container.name}
                    className="w-4 h-4 shrink-0"
                  />
                  <span className="font-medium text-foreground text-xs truncate">
                    {container.name}
                  </span>
                  <span className="text-2xs font-mono text-muted-foreground truncate hidden sm:inline">
                    {container.image}
                  </span>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  {container.ports &&
                  container.ports.length > 0 &&
                  container.ports[0].publicPort ? (
                    <span className="text-2xs font-mono font-medium text-muted-foreground px-1.5 py-0.5 rounded bg-surface-secondary/60 border border-border/50">
                      :{container.ports[0].publicPort}
                    </span>
                  ) : null}

                  <span className="text-2xs font-mono text-muted-foreground hidden md:inline">
                    {container.status}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isRunning) {
                        stopContainer(container.id);
                      } else {
                        startContainer(container.id);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center space-x-1 shadow-xs ${
                      isRunning
                        ? "text-status-restarting hover:bg-status-restarting/10 border border-status-restarting/30 bg-surface"
                        : "text-status-running hover:bg-status-running/10 border border-status-running/30 bg-surface"
                    }`}
                  >
                    {isRunning ? (
                      <Square className="w-2.5 h-2.5 fill-current" />
                    ) : (
                      <Play className="w-2.5 h-2.5 fill-current" />
                    )}
                    <span>{isRunning ? "Stop" : "Start"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl overflow-hidden shadow-xs">
          <div className="grid grid-cols-12 px-4 py-2 border-b border-border/70 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 bg-surface-secondary/40 ">
            <div className="col-span-5 sm:col-span-4">Container & Service</div>
            <div className="col-span-3 sm:col-span-3">Image</div>
            <div className="col-span-2 hidden sm:block">CPU / Memory</div>
            <div className="col-span-2 hidden md:block">Ports</div>
            <div className="col-span-4 sm:col-span-3 md:col-span-1 text-right">
              Actions
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {filteredContainers.map((container) => {
              const isRunning = container.state === "running";
              const isMenuOpen = activeMenuContainerId === container.id;

              return (
                <div
                  key={container.id}
                  onClick={() => handleOpenDetail(container.id)}
                  className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-surface-hover transition-colors text-xs cursor-pointer group"
                >
                  <div className="col-span-5 sm:col-span-4 flex items-center space-x-2.5 truncate pr-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${getStatusDot(container.state)}`}
                    />
                    <TechIcon
                      image={container.image}
                      name={container.name}
                      className="w-4 h-4 shrink-0"
                    />
                    <div className="truncate">
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate block">
                        {container.name}
                      </span>
                      {container.composeProject && (
                        <span className="text-[10px] font-mono text-muted-foreground truncate block">
                          {container.composeProject}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-3 sm:col-span-3 truncate text-2xs font-mono text-muted-foreground pr-2">
                    <span className="bg-surface-secondary/80 px-1.5 py-0.5 rounded border border-border/60 truncate block">
                      {container.image}
                    </span>
                  </div>

                  <div className="col-span-2 hidden sm:block text-2xs font-mono text-foreground">
                    {isRunning ? (
                      <div className="flex items-center space-x-1.5">
                        <span className="text-status-running font-medium">
                          {container.cpuPercent ?? 0}%
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">
                          {formatBytes(container.memoryUsage ?? 0)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>

                  <div className="col-span-2 hidden md:block text-2xs font-mono truncate pr-2">
                    {(() => {
                      const publicPorts = Array.from(
                        new Set(
                          (container.ports || [])
                            .filter((p) => p.publicPort)
                            .map((p) =>
                              p.publicPort === p.privatePort
                                ? `:${p.publicPort}`
                                : `${p.publicPort}:${p.privatePort}`,
                            ),
                        ),
                      );
                      if (publicPorts.length === 0) {
                        return <span className="text-muted-foreground">-</span>;
                      }
                      return (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <span className="text-foreground font-medium">
                            {publicPorts[0]}
                          </span>
                          {publicPorts.length > 1 && (
                            <span className="text-muted-foreground">
                              +{publicPorts.length - 1}
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="col-span-4 sm:col-span-3 md:col-span-1 flex items-center justify-end space-x-1 relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isRunning) {
                          stopContainer(container.id);
                        } else {
                          startContainer(container.id);
                        }
                      }}
                      className={`flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors shadow-xs ${
                        isRunning
                          ? "text-status-restarting hover:bg-status-restarting/10 border border-status-restarting/30 bg-surface"
                          : "text-status-running hover:bg-status-running/10 border border-status-running/30 bg-surface"
                      }`}
                      title={isRunning ? "Stop Container" : "Start Container"}
                    >
                      {isRunning ? (
                        <Square className="w-2.5 h-2.5 fill-current" />
                      ) : (
                        <Play className="w-2.5 h-2.5 fill-current" />
                      )}
                      <span className="hidden sm:inline text-2xs">
                        {isRunning ? "Stop" : "Start"}
                      </span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuContainerId(
                          isMenuOpen ? null : container.id,
                        );
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-secondary border border-transparent hover:border-border/60 transition-colors"
                      title="More actions"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>

                    {isMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-7 w-44 bg-popover border border-popover-border rounded-xl shadow-2xl shadow-black/60 p-1 z-30 font-sans text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-75"
                      >
                        <button
                          onClick={() => {
                            setSelectedContainerId(container.id);
                            setContainerDetailTab("logs");
                            setActiveMenuContainerId(null);
                          }}
                          className="w-full flex items-center space-x-2 px-2.5 py-1 text-xs rounded-lg text-foreground hover:bg-surface-hover transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>View Logs</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedContainerId(container.id);
                            setContainerDetailTab("terminal");
                            setActiveMenuContainerId(null);
                          }}
                          className="w-full flex items-center space-x-2 px-2.5 py-1 text-xs rounded-lg text-foreground hover:bg-surface-hover transition-colors"
                        >
                          <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Open Terminal</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedContainerId(container.id);
                            setContainerDetailTab("stats");
                            setActiveMenuContainerId(null);
                          }}
                          className="w-full flex items-center space-x-2 px-2.5 py-1 text-xs rounded-lg text-foreground hover:bg-surface-hover transition-colors"
                        >
                          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>View Stats</span>
                        </button>

                        {isRunning && (
                          <button
                            onClick={() => {
                              restartContainer(container.id);
                              setActiveMenuContainerId(null);
                            }}
                            className="w-full flex items-center space-x-2 px-2.5 py-1 text-xs rounded-lg text-sky-500 hover:bg-surface-hover transition-colors"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Restart</span>
                          </button>
                        )}

                        <button
                          onClick={(e) => handleCopyId(container.id, e)}
                          className="w-full flex items-center space-x-2 px-2.5 py-1 text-xs rounded-lg text-muted-foreground hover:bg-surface-hover transition-colors"
                        >
                          {copiedId === container.id ? (
                            <Check className="w-3.5 h-3.5 text-status-running" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {copiedId === container.id
                              ? "ID Copied"
                              : "Copy ID"}
                          </span>
                        </button>

                        <div className="h-[1px] bg-border/70 my-1" />

                        <button
                          onClick={() => {
                            setContainerToDelete(container);
                            setActiveMenuContainerId(null);
                          }}
                          className="w-full flex items-center space-x-2 px-2.5 py-1 text-xs rounded-lg text-status-danger hover:bg-status-danger/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {containerToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-popover border border-popover-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl shadow-black/70 animate-in zoom-in-95 duration-100">
            <h3 className="text-sm font-semibold text-foreground">
              Remove Container?
            </h3>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              Are you sure you want to remove container{" "}
              <span className="font-mono text-status-danger font-medium">
                {containerToDelete.name}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                onClick={() => setContainerToDelete(null)}
                className="px-3 py-1 rounded-md text-xs font-medium text-foreground bg-surface border border-border/80 hover:bg-surface-secondary transition-colors shadow-xs"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await removeContainer(containerToDelete.id);
                  setContainerToDelete(null);
                }}
                className="px-3 py-1 rounded-md text-xs font-medium bg-status-danger hover:bg-status-danger/90 text-white shadow-xs transition-opacity"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
