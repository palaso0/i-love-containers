import React, { useState } from "react";
import {
  Play,
  Square,
  RotateCw,
  FolderGit2,
  ExternalLink,
  Search,
  Check,
  Layers,
  Terminal,
  FileText,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { ContainerDetail } from "@/types";
import { formatBytes } from "@/lib/utils";
import { openRealNativeWindow } from "@/lib/nativeWindow";
import { ServiceDrawer } from "./ServiceDrawer";
import { TechIcon } from "@/components/TechIcon";
import { DockerDisconnected } from "@/components/DockerDisconnected";

export const FleetView: React.FC = () => {
  const {
    viewMode,
    containers,
    composeProjects,
    systemOverview,
    startContainer,
    stopContainer,
    restartContainer,
  } = useAppStore();

  const isConnected = systemOverview?.dockerConnected ?? false;

  const [selectedService, setSelectedService] =
    useState<ContainerDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedPort, setCopiedPort] = useState<number | null>(null);

  if (!isConnected) {
    return <DockerDisconnected icon={Layers} />;
  }

  const handleCopyPort = (port: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`http://localhost:${port}`);
    setCopiedPort(port);
    setTimeout(() => setCopiedPort(null), 1500);
  };

  const handleStopAll = async (containerIds: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    for (const id of containerIds) {
      await stopContainer(id);
    }
  };

  const handleRestartAll = async (
    containerIds: string[],
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    for (const id of containerIds) {
      await restartContainer(id);
    }
  };

  const filteredContainers = containers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.image.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.composeProject &&
        c.composeProject.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const standaloneContainers = filteredContainers.filter(
    (c) => !c.composeProject,
  );

  const runningCount = containers.filter((c) => c.state === "running").length;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-5">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.6)]" />
              <span className="text-xs font-semibold text-foreground">
                {runningCount} Active
              </span>
              <span className="text-muted-foreground text-xs">•</span>
              <span className="text-xs text-muted-foreground">
                {containers.length - runningCount} Stopped
              </span>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stacks & services..."
              className="pl-8 pr-3 py-1 text-xs bg-surface border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 w-48 sm:w-56 transition-all shadow-xs"
            />
          </div>
        </div>

        <div className="space-y-4">
          {composeProjects.map((project) => {
            const projectContainers = filteredContainers.filter(
              (c) => c.composeProject === project.name,
            );
            if (projectContainers.length === 0) return null;

            const projectRunningCount = projectContainers.filter(
              (c) => c.state === "running",
            ).length;
            const containerIds = projectContainers.map((c) => c.id);

            return (
              <div
                key={project.name}
                className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl overflow-hidden shadow-xs"
              >
                <div className="px-4 py-2.5 bg-surface-secondary/50 border-b border-border/70 flex items-center justify-between ">
                  <div className="flex items-center space-x-2">
                    <FolderGit2 className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground font-mono">
                      {project.name}
                    </span>
                    <span className="text-2xs font-mono text-muted-foreground hidden sm:inline">
                      ({projectRunningCount}/{projectContainers.length} running)
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 text-xs">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openRealNativeWindow({
                          id: `stack-logs-${project.name}-${Date.now()}`,
                          title: `${project.name} — Unified Logs`,
                          type: "logs",
                          composeProject: project.name,
                        });
                      }}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-sky-400 hover:text-sky-300 hover:bg-surface transition-colors"
                      title="Open unified live log stream in native OS window"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Logs</span>
                    </button>
                    <button
                      onClick={(e) => handleRestartAll(containerIds, e)}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                      title="Restart all services in stack"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Restart</span>
                    </button>
                    <button
                      onClick={(e) => handleStopAll(containerIds, e)}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-muted-foreground hover:text-status-restarting hover:bg-surface transition-colors"
                      title="Stop all services in stack"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Stop</span>
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-border/60 text-xs">
                  {projectContainers.map((container) => {
                    const isRunning = container.state === "running";
                    const primaryPort =
                      container.ports && container.ports.length > 0
                        ? container.ports[0].publicPort
                        : null;

                    return (
                      <div
                        key={container.id}
                        onClick={() => setSelectedService(container)}
                        className="px-4 py-2.5 flex items-center justify-between hover:bg-surface-hover transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center space-x-3 truncate mr-3 flex-1">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isRunning
                                ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.6)]"
                                : "bg-status-stopped"
                            }`}
                          />
                          <TechIcon
                            image={container.image}
                            name={container.composeService || container.name}
                            className="w-4 h-4 shrink-0"
                          />
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors text-xs truncate">
                            {container.composeService || container.name}
                          </span>
                          <span className="text-2xs font-mono text-muted-foreground truncate hidden md:inline">
                            {container.image}
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          {primaryPort && (
                            <button
                              onClick={(e) => handleCopyPort(primaryPort, e)}
                              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-surface-secondary border border-border text-2xs text-muted-foreground hover:text-foreground transition-colors"
                              title="Click to copy http://localhost URL"
                            >
                              <span>:{primaryPort}</span>
                              {copiedPort === primaryPort ? (
                                <Check className="w-2.5 h-2.5 text-status-running" />
                              ) : (
                                <ExternalLink className="w-2.5 h-2.5" />
                              )}
                            </button>
                          )}

                          {viewMode === "detailed" && isRunning && (
                            <span className="text-2xs text-muted-foreground hidden sm:inline">
                              {formatBytes(container.memoryUsage ?? 0)} •{" "}
                              {container.cpuPercent ?? 0}%
                            </span>
                          )}

                          <span className="text-2xs text-muted-foreground hidden lg:inline">
                            {container.status}
                          </span>

                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openRealNativeWindow({
                                  id: `term-${container.id}-${Date.now()}`,
                                  title: `${container.composeService || container.name} — Terminal`,
                                  type: "terminal",
                                  containerId: container.id,
                                  containerName:
                                    container.composeService || container.name,
                                });
                              }}
                              className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-surface-secondary transition-colors"
                              title="Open interactive shell in native OS window"
                            >
                              <Terminal className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openRealNativeWindow({
                                  id: `logs-${container.id}-${Date.now()}`,
                                  title: `${container.composeService || container.name} — Logs`,
                                  type: "logs",
                                  containerId: container.id,
                                  containerName:
                                    container.composeService || container.name,
                                });
                              }}
                              className="p-1 rounded text-muted-foreground hover:text-sky-400 hover:bg-surface-secondary transition-colors"
                              title="Open live logs in native OS window"
                            >
                              <FileText className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isRunning) {
                                stopContainer(container.id);
                              } else {
                                startContainer(container.id);
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-2xs font-mono transition-colors flex items-center space-x-1 ${
                              isRunning
                                ? "text-amber-500 hover:bg-amber-500/10 border border-amber-500/30"
                                : "text-status-running hover:bg-status-running/10 border border-status-running/30"
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
              </div>
            );
          })}

          {standaloneContainers.length > 0 && (
            <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-xs">
              <div className="px-3.5 py-2 bg-surface-secondary/50 border-b border-border flex items-center justify-between ">
                <div className="flex items-center space-x-2 font-mono">
                  <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold text-foreground">
                    Standalone Services
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    ({standaloneContainers.length})
                  </span>
                </div>
              </div>

              <div className="divide-y divide-border font-mono text-xs">
                {standaloneContainers.map((container) => {
                  const isRunning = container.state === "running";
                  const primaryPort =
                    container.ports && container.ports.length > 0
                      ? container.ports[0].publicPort
                      : null;

                  return (
                    <div
                      key={container.id}
                      onClick={() => setSelectedService(container)}
                      className="px-3.5 py-2.5 flex items-center justify-between hover:bg-surface-hover transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center space-x-3 truncate mr-3 flex-1">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isRunning
                              ? "bg-status-running shadow-[0_0_6px_rgba(16,185,129,0.4)]"
                              : "bg-status-stopped"
                          }`}
                        />
                        <TechIcon
                          image={container.image}
                          name={container.name}
                          className="w-4 h-4 shrink-0"
                        />
                        <span className="font-semibold text-foreground text-xs truncate">
                          {container.name}
                        </span>
                        <span className="text-2xs text-muted-foreground truncate hidden md:inline">
                          {container.image}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        {primaryPort && (
                          <button
                            onClick={(e) => handleCopyPort(primaryPort, e)}
                            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-surface-secondary border border-border text-2xs text-muted-foreground hover:text-foreground transition-colors"
                            title="Click to copy URL"
                          >
                            <span>:{primaryPort}</span>
                            {copiedPort === primaryPort ? (
                              <Check className="w-2.5 h-2.5 text-status-running" />
                            ) : (
                              <ExternalLink className="w-2.5 h-2.5" />
                            )}
                          </button>
                        )}

                        <span className="text-2xs text-muted-foreground hidden lg:inline">
                          {container.status}
                        </span>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRealNativeWindow({
                                id: `term-${container.id}-${Date.now()}`,
                                title: `${container.name} — Terminal`,
                                type: "terminal",
                                containerId: container.id,
                                containerName: container.name,
                              });
                            }}
                            className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-surface-secondary transition-colors"
                            title="Open interactive shell in native OS window"
                          >
                            <Terminal className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRealNativeWindow({
                                id: `logs-${container.id}-${Date.now()}`,
                                title: `${container.name} — Logs`,
                                type: "logs",
                                containerId: container.id,
                                containerName: container.name,
                              });
                            }}
                            className="p-1 rounded text-muted-foreground hover:text-sky-400 hover:bg-surface-secondary transition-colors"
                            title="Open live logs in native OS window"
                          >
                            <FileText className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isRunning) {
                              stopContainer(container.id);
                            } else {
                              startContainer(container.id);
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-2xs font-mono transition-colors flex items-center space-x-1 ${
                            isRunning
                              ? "text-amber-500 hover:bg-amber-500/10 border border-amber-500/30"
                              : "text-status-running hover:bg-status-running/10 border border-status-running/30"
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
            </div>
          )}
        </div>

        <div className="py-2 text-center  font-mono text-[11px] text-muted-foreground">
          Click any service row to inspect logs, interactive shell, and resource
          metrics
        </div>
      </div>

      {selectedService && (
        <ServiceDrawer
          container={selectedService}
          onClose={() => setSelectedService(null)}
        />
      )}
    </div>
  );
};
