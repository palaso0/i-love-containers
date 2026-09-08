import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Search,
  Box,
  FileText,
  Terminal,
  Activity,
  Code2,
  FolderGit2,
  ExternalLink,
  AppWindow,
  Pause,
  X,
  ChevronDown,
  ChevronRight,
  Folder,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { ContainerDetail, ContainerState } from "@/types";
import { formatBytes } from "@/lib/utils";
import { openRealNativeWindow } from "@/lib/nativeWindow";
import { OverviewTab } from "./tabs/OverviewTab";
import { LogsTab } from "./tabs/LogsTab";
import { TerminalTab } from "./tabs/TerminalTab";
import { StatsTab } from "./tabs/StatsTab";
import { InspectTab } from "./tabs/InspectTab";
import { FileManagerTab } from "./tabs/FileManagerTab";
import { TechIcon } from "@/components/TechIcon";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DockerDisconnected } from "@/components/DockerDisconnected";

const getStatusDot = (state: ContainerState, size: "sm" | "md" = "sm") => {
  const sizeClass = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";
  switch (state) {
    case "running":
      return `${sizeClass} rounded-full shrink-0 bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.7)]`;
    case "paused":
      return `${sizeClass} rounded-full shrink-0 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]`;
    case "restarting":
      return `${sizeClass} rounded-full shrink-0 bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.7)]`;
    default:
      return `${sizeClass} rounded-full shrink-0 bg-status-stopped`;
  }
};

const IndeterminateCheckbox: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  className?: string;
  title?: string;
}> = ({ checked, indeterminate = false, onChange, className = "", title }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      ref={ref}
      checked={checked}
      onChange={onChange}
      title={title}
      className={`w-3.5 h-3.5 rounded border-border/80 text-primary accent-primary bg-surface/70 hover:bg-surface cursor-pointer shrink-0 transition-all ${className}`}
      onClick={(e) => e.stopPropagation()}
    />
  );
};

export const ContainersSplitView: React.FC = () => {
  const {
    t,
    containers,
    systemOverview,
    selectedContainerId,
    setSelectedContainerId,
    containerDetailTab,
    setContainerDetailTab,
    startContainer,
    stopContainer,
    pauseContainer,
    unpauseContainer,
    restartContainer,
    removeContainer,
    removeComposeProject,
    composeProjects,
    isActionInProgress,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | ContainerState>("all");
  const [containerToDelete, setContainerToDelete] = useState<ContainerDetail | null>(null);
  const [stackToDelete, setStackToDelete] = useState<{ name: string; containers: ContainerDetail[] } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkToDelete, setBulkToDelete] = useState<string[] | null>(null);
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  const [collapsedStacks, setCollapsedStacks] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("ilc_collapsed_stacks");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleStackCollapse = (stackName: string) => {
    setCollapsedStacks((prev) => {
      const next = new Set(prev);
      if (next.has(stackName)) {
        next.delete(stackName);
      } else {
        next.add(stackName);
      }
      try {
        localStorage.setItem("ilc_collapsed_stacks", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const areAllStacksCollapsed = () => {
    const composeProjectNames = Object.keys(composeGroups).filter((g) => g !== "__standalone__");
    if (composeProjectNames.length === 0) return false;
    return composeProjectNames.every((name) => collapsedStacks.has(name));
  };

  const toggleCollapseAll = () => {
    const composeProjectNames = Object.keys(composeGroups).filter((g) => g !== "__standalone__");
    if (areAllStacksCollapsed()) {
      setCollapsedStacks(new Set());
      try {
        localStorage.setItem("ilc_collapsed_stacks", JSON.stringify([]));
      } catch {}
    } else {
      const all = new Set(composeProjectNames);
      setCollapsedStacks(all);
      try {
        localStorage.setItem("ilc_collapsed_stacks", JSON.stringify(Array.from(all)));
      } catch {}
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (containerToDelete) setContainerToDelete(null);
        if (stackToDelete) setStackToDelete(null);
        if (bulkToDelete) setBulkToDelete(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [containerToDelete, stackToDelete, bulkToDelete]);

  const splitViewRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [leftWidth, setLeftWidth] = useState(() => {
    try {
      const saved = localStorage.getItem("ilc_containers_split_width");
      const parsed = saved ? parseInt(saved, 10) : 410;
      return parsed <= 330 ? 410 : Math.max(330, Math.min(650, parsed));
    } catch {
      return 410;
    }
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !splitViewRef.current) return;
      const rect = splitViewRef.current.getBoundingClientRect();
      const maxW = Math.max(360, rect.width - 320);
      const newWidth = Math.max(330, Math.min(maxW, ev.clientX - rect.left));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = (ev: MouseEvent) => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (splitViewRef.current) {
        const rect = splitViewRef.current.getBoundingClientRect();
        const maxW = Math.max(360, rect.width - 320);
        const finalWidth = Math.max(330, Math.min(maxW, ev.clientX - rect.left));
        try {
          localStorage.setItem("ilc_containers_split_width", String(finalWidth));
        } catch {}
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const detailPaneRef = useRef<HTMLDivElement>(null);
  const [detailWidth, setDetailWidth] = useState(600);

  useEffect(() => {
    if (!detailPaneRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDetailWidth(entry.contentRect.width);
      }
    });
    ro.observe(detailPaneRef.current);
    return () => ro.disconnect();
  }, []);

  const isCompactDetail = detailWidth < 520;
  const isUltraCompact = detailWidth < 380;

  const filteredContainers = containers.filter((container) => {
    const matchesSearch =
      container.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      container.image.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (container.composeProject &&
        container.composeProject.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesState = stateFilter === "all" || container.state === stateFilter;
    return matchesSearch && matchesState;
  });

  useEffect(() => {
    if (filteredContainers.length > 0) {
      const exists = filteredContainers.some((c) => c.id === selectedContainerId);
      if (!selectedContainerId || !exists) {
        setSelectedContainerId(filteredContainers[0].id);
      }
    }
  }, [filteredContainers, selectedContainerId, setSelectedContainerId]);

  const activeContainer = containers.find((c) => c.id === selectedContainerId) || filteredContainers[0];

  const composeGroups = filteredContainers.reduce<Record<string, ContainerDetail[]>>((acc, c) => {
    const groupName = c.composeProject || "__standalone__";
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(c);
    return acc;
  }, {});

  const handleStopAll = async (groupContainers: ContainerDetail[], e: React.MouseEvent) => {
    e.stopPropagation();
    for (const c of groupContainers) {
      if (c.state === "running") {
        await stopContainer(c.id);
      }
    }
  };

  const handleStartAll = async (groupContainers: ContainerDetail[], e: React.MouseEvent) => {
    e.stopPropagation();
    for (const c of groupContainers) {
      if (c.state !== "running") {
        await startContainer(c.id);
      }
    }
  };

  const handleRestartAll = async (groupContainers: ContainerDetail[], e: React.MouseEvent) => {
    e.stopPropagation();
    for (const c of groupContainers) {
      await restartContainer(c.id);
    }
  };

  useEffect(() => {
    const containerIdSet = new Set(containers.map((c) => c.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (containerIdSet.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [containers]);

  const toggleContainerSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleGroupSelect = (groupContainers: ContainerDetail[]) => {
    const groupIds = groupContainers.map((c) => c.id);
    const allInGroupSelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allInGroupSelected) {
        groupIds.forEach((id) => next.delete(id));
      } else {
        groupIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkStart = async () => {
    setIsBulkOperating(true);
    try {
      for (const id of selectedIds) {
        const c = containers.find((item) => item.id === id);
        if (c && c.state !== "running") {
          await startContainer(id);
        }
      }
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkStop = async () => {
    setIsBulkOperating(true);
    try {
      for (const id of selectedIds) {
        const c = containers.find((item) => item.id === id);
        if (c && (c.state === "running" || c.state === "paused")) {
          await stopContainer(id);
        }
      }
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkRestart = async () => {
    setIsBulkOperating(true);
    try {
      for (const id of selectedIds) {
        await restartContainer(id);
      }
    } finally {
      setIsBulkOperating(false);
    }
  };

  const tabs: {
    id: "overview" | "stats" | "logs" | "terminal" | "inspect" | "files";
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "overview", label: t.containers.tabs.overview, icon: Box },
    { id: "stats", label: t.containers.tabs.stats, icon: Activity },
    { id: "logs", label: t.containers.tabs.logs, icon: FileText },
    { id: "terminal", label: t.containers.tabs.terminal, icon: Terminal },
    { id: "inspect", label: t.containers.tabs.inspect, icon: Code2 },
    { id: "files", label: t.containers.tabs.files, icon: Folder },
  ];

  const isConnected = systemOverview?.dockerConnected ?? false;

  if (!isConnected) {
    return <DockerDisconnected icon={Box} />;
  }

  return (
    <div ref={splitViewRef} className="flex-1 flex h-full overflow-hidden bg-background select-none min-w-0">
      <div
        style={{ width: `${leftWidth}px` }}
        className="border-r border-border/80 flex flex-col h-full bg-surface/30 shrink-0 min-w-0 overflow-hidden"
      >
        <div className="p-3 border-b border-border/70 space-y-2 bg-surface/50 backdrop-blur-sm">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.containers.searchPlaceholder}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all shadow-xs"
            />
          </div>

          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center bg-surface-secondary/80 border border-border/60 rounded-md p-0.5 text-2xs shrink-0">
              {(["all", "running", "paused", "stopped"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStateFilter(filter)}
                  className={`px-2 py-0.5 rounded capitalize transition-all ${
                    stateFilter === filter
                      ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.containers[filter]}
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-1.5 shrink-0">
              {Object.keys(composeGroups).some((g) => g !== "__standalone__") && (
                <button
                  onClick={toggleCollapseAll}
                  className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-2xs font-mono text-muted-foreground hover:text-foreground bg-surface border border-border/60 transition-colors shrink-0"
                  title={areAllStacksCollapsed() ? "Expand all stacks" : "Collapse all stacks"}
                >
                  {areAllStacksCollapsed() ? (
                    <>
                      <ChevronRight className="w-3 h-3 text-primary" />
                      <span>Stacks</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 text-primary" />
                      <span>Stacks</span>
                    </>
                  )}
                </button>
              )}
              <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap shrink-0">
                {filteredContainers.filter((c) => c.state === "running").length}/{filteredContainers.length} {t.containers.active}
              </span>
            </div>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="px-3 py-1.5 bg-primary-muted/70 border-b border-primary/25 flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-150 shrink-0">
            <div className="flex items-center space-x-2 text-xs min-w-0">
              <span className="font-semibold text-primary font-mono text-[11px] truncate">
                {selectedIds.size} seleccionados
              </span>
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              <button
                disabled={isBulkOperating}
                onClick={handleBulkStart}
                className="p-1 rounded text-muted-foreground hover:text-status-running hover:bg-surface/80 transition-colors disabled:opacity-50"
                title="Iniciar seleccionados"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
              <button
                disabled={isBulkOperating}
                onClick={handleBulkStop}
                className="p-1 rounded text-muted-foreground hover:text-status-restarting hover:bg-surface/80 transition-colors disabled:opacity-50"
                title="Detener seleccionados"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
              <button
                disabled={isBulkOperating}
                onClick={handleBulkRestart}
                className="p-1 rounded text-muted-foreground hover:text-sky-400 hover:bg-surface/80 transition-colors disabled:opacity-50"
                title="Reiniciar seleccionados"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isBulkOperating ? "animate-spin" : ""}`} />
              </button>
              <button
                disabled={isBulkOperating}
                onClick={() => setBulkToDelete(Array.from(selectedIds))}
                className="p-1 rounded text-status-danger/80 hover:text-status-danger hover:bg-status-danger/15 transition-colors disabled:opacity-50"
                title="Eliminar seleccionados"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface/80 transition-colors ml-1"
                title="Deseleccionar todos"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {Object.entries(composeGroups).map(([groupName, groupList]) => {
            const isCompose = groupName !== "__standalone__";
            const runningInGroup = groupList.filter((c) => c.state === "running").length;
            const isCollapsed = isCompose && collapsedStacks.has(groupName);

            return (
              <div key={groupName} className="space-y-1">
                {isCompose ? (
                  <div
                    onClick={() => toggleStackCollapse(groupName)}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-primary-muted border border-primary/30 text-xs text-foreground cursor-pointer hover:border-primary/50 transition-colors select-none"
                  >
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStackCollapse(groupName);
                        }}
                        className="p-0.5 rounded text-primary hover:text-foreground transition-colors"
                        title={isCollapsed ? "Expand stack" : "Collapse stack"}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <div onClick={(e) => e.stopPropagation()}>
                        <IndeterminateCheckbox
                          checked={groupList.length > 0 && groupList.every((c) => selectedIds.has(c.id))}
                          indeterminate={
                            groupList.some((c) => selectedIds.has(c.id)) &&
                            !groupList.every((c) => selectedIds.has(c.id))
                          }
                          onChange={() => toggleGroupSelect(groupList)}
                          title="Seleccionar todo el stack"
                        />
                      </div>
                      <FolderGit2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-semibold text-xs tracking-tight truncate text-primary-hover">
                        {groupName}
                      </span>
                      <span className="text-[10px] font-mono bg-primary/20 text-primary-hover px-1.5 py-0.2 rounded-full">
                        {runningInGroup}/{groupList.length}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openRealNativeWindow({
                            id: `stack-logs-${groupName}-${Date.now()}`,
                            title: `${groupName} — Unified Logs`,
                            type: "logs",
                            composeProject: groupName,
                          });
                        }}
                        className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-sky-400 hover:text-sky-300 hover:bg-surface/80 transition-colors text-2xs font-mono"
                        title="Open unified live logs in native window"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Logs</span>
                      </button>
                      <button
                        onClick={(e) => handleStartAll(groupList, e)}
                        className="p-1 rounded text-muted-foreground hover:text-status-running hover:bg-surface/80 transition-colors"
                        title={t.containers.startAll}
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                      <button
                        onClick={(e) => handleStopAll(groupList, e)}
                        className="p-1 rounded text-muted-foreground hover:text-status-restarting hover:bg-surface/80 transition-colors"
                        title={t.containers.stopAll}
                      >
                        <Square className="w-3 h-3 fill-current" />
                      </button>
                      <button
                        onClick={(e) => handleRestartAll(groupList, e)}
                        className="p-1 rounded text-muted-foreground hover:text-sky-400 hover:bg-surface/80 transition-colors"
                        title={t.containers.restartAll}
                      >
                        <RotateCw className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStackToDelete({ name: groupName, containers: groupList });
                        }}
                        className="p-1 rounded text-status-danger/70 hover:text-status-danger hover:bg-status-danger/15 transition-colors"
                        title={t.containers.remove}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    <div className="flex items-center space-x-2">
                      <IndeterminateCheckbox
                        checked={groupList.length > 0 && groupList.every((c) => selectedIds.has(c.id))}
                        indeterminate={
                          groupList.some((c) => selectedIds.has(c.id)) &&
                          !groupList.every((c) => selectedIds.has(c.id))
                        }
                        onChange={() => toggleGroupSelect(groupList)}
                        title="Seleccionar todos los standalone"
                      />
                      <span>{t.containers.standalone}</span>
                    </div>
                    <span className="text-2xs font-mono lowercase">
                      {groupList.filter((c) => c.state === "running").length}/{groupList.length}
                    </span>
                  </div>
                )}

                {!isCollapsed && (
                  <div className="space-y-1">
                    {groupList.map((container) => {
                      const isSelected = activeContainer?.id === container.id;
                      const isRunning = container.state === "running";
                      const isPaused = container.state === "paused";

                      return (
                        <div
                          key={container.id}
                          onClick={() => setSelectedContainerId(container.id)}
                          className={`group/row px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 border flex items-center justify-between gap-2 ${
                            isSelected
                              ? "bg-white/[0.08] border-white/10 shadow-mac-segment text-foreground font-medium"
                              : "bg-surface/30 hover:bg-surface/90 hover:border-border/80 border-transparent text-foreground/80 hover:text-foreground hover:shadow-xs"
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <IndeterminateCheckbox
                              checked={selectedIds.has(container.id)}
                              onChange={() => toggleContainerSelect(container.id)}
                              title="Seleccionar para acciones en lote"
                            />
                            <span className={getStatusDot(container.state)} />
                            <TechIcon image={container.image} name={container.name} className="w-4 h-4 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1.5">
                                <span
                                  className={`text-xs truncate ${
                                    isSelected ? "text-primary font-semibold" : "font-medium text-foreground"
                                  }`}
                                >
                                  {container.name}
                                </span>
                                {(() => {
                                  if (!container.ports || container.ports.length === 0) return null;
                                  const publicPorts = Array.from(
                                    new Set(
                                      container.ports
                                        .filter((p) => p.publicPort)
                                        .map((p) => p.publicPort!)
                                    )
                                  );
                                  if (publicPorts.length > 0) {
                                    return (
                                      <span
                                        className="text-[10px] font-mono text-primary font-medium bg-primary/10 border border-primary/25 px-1.5 py-0.2 rounded shrink-0"
                                        title={`Host port: ${publicPorts.map((p) => `:${p}`).join(", ")}`}
                                      >
                                        {publicPorts.slice(0, 2).map((p) => `:${p}`).join(" ")}
                                        {publicPorts.length > 2 && ` +${publicPorts.length - 2}`}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <div className="text-[11px] font-mono text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                                {isRunning && container.cpuPercent !== undefined ? (
                                  <span>{container.cpuPercent}% CPU • {formatBytes(container.memoryUsage ?? 0)}</span>
                                ) : isPaused ? (
                                  <span className="text-amber-400 font-medium">{t.containers.paused}</span>
                                ) : (
                                  <span>{container.image}</span>
                                )}
                              </div>
                            </div>
                          </div>

                        <div className="flex items-center space-x-1 shrink-0">
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
                            className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-surface transition-colors"
                            title="Open terminal in native OS window"
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
                            className="p-1 rounded text-muted-foreground hover:text-sky-400 hover:bg-surface transition-colors"
                            title="Open logs in native OS window"
                          >
                            <FileText className="w-3 h-3" />
                          </button>
                          {isRunning && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                pauseContainer(container.id);
                              }}
                              className="p-1 rounded text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                              title={t.containers.pause}
                            >
                              <Pause className="w-3 h-3" />
                            </button>
                          )}
                          {isPaused && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                unpauseContainer(container.id);
                              }}
                              className="p-1 rounded text-muted-foreground hover:text-status-running hover:bg-status-running/10 transition-colors"
                              title={t.containers.unpause}
                            >
                              <Play className="w-3 h-3 fill-current" />
                            </button>
                          )}
                          {isRunning || isPaused ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                stopContainer(container.id);
                              }}
                              className="p-1 rounded text-2xs text-status-restarting hover:bg-status-restarting/10 transition-colors"
                              title={t.containers.stop}
                            >
                              <Square className="w-3 h-3 fill-current" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startContainer(container.id);
                              }}
                              className="p-1 rounded text-2xs text-status-running hover:bg-status-running/10 transition-colors"
                              title={t.containers.start}
                            >
                              <Play className="w-3 h-3 fill-current" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setContainerToDelete(container);
                            }}
                            className="p-1 rounded text-status-danger/70 hover:text-status-danger hover:bg-status-danger/15 transition-colors"
                            title={t.containers.remove}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

          {filteredContainers.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground">
              {t.containers.noContainers}
            </div>
          )}
        </div>
      </div>

      <div
        onMouseDown={handleMouseDown}
        className="w-1.5 hover:w-2 -mx-0.5 cursor-col-resize group relative flex items-center justify-center shrink-0 z-20 transition-all hover:bg-primary/40 active:bg-primary select-none"
        title="Arrastra para redimensionar columnas"
      >
        <div className="w-[1px] h-8 rounded-full bg-border group-hover:bg-primary/80 group-active:bg-primary transition-colors" />
      </div>

      <div ref={detailPaneRef} className="flex-1 flex flex-col h-full overflow-hidden bg-background min-w-0">
        {activeContainer ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">

            <div className="p-3 sm:p-3.5 border-b border-border/70 flex items-center justify-between gap-2 bg-surface/40 backdrop-blur-sm shrink-0 flex-wrap">
              <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                <span className={getStatusDot(activeContainer.state, "md")} />
                <TechIcon image={activeContainer.image} name={activeContainer.name} className="w-5 h-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                    <h1 className="text-sm sm:text-base font-semibold text-foreground tracking-tight truncate max-w-[180px] sm:max-w-xs" title={activeContainer.name}>
                      {activeContainer.name}
                    </h1>
                    <span className="text-[10px] font-mono text-muted-foreground bg-surface-secondary px-1.5 py-0.5 rounded border border-border/60 shrink-0">
                      {activeContainer.id.substring(0, isUltraCompact ? 6 : 12)}
                    </span>
                    {!isUltraCompact && activeContainer.composeProject && (
                      <span className="text-[10px] font-medium text-primary bg-primary-muted px-2 py-0.5 rounded-full border border-primary/30 truncate max-w-[140px] shrink-0" title={activeContainer.composeProject}>
                        {activeContainer.composeProject}
                      </span>
                    )}
                    {activeContainer.state === "paused" && (
                      <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30 shrink-0">
                        {t.containers.paused}
                      </span>
                    )}
                  </div>
                  {!isUltraCompact && (
                    <p className="text-2xs text-muted-foreground font-mono mt-0.5 truncate">
                      {activeContainer.image} • {activeContainer.status}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0 self-end sm:self-auto">
                <div className="flex items-center space-x-1 shrink-0 flex-wrap">
                  {activeContainer.state === "running" ? (
                    <>
                      <button
                        onClick={() => pauseContainer(activeContainer.id)}
                        className="flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium bg-surface border border-border/80 text-amber-400 hover:bg-amber-400/10 hover:border-amber-400/40 transition-colors shadow-xs"
                        title={t.containers.pause}
                      >
                        <Pause className="w-3 h-3" />
                        {!isCompactDetail && <span>{t.containers.pause}</span>}
                      </button>
                      <button
                        onClick={() => stopContainer(activeContainer.id)}
                        className="flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium bg-surface border border-border/80 text-status-restarting hover:bg-status-restarting/10 hover:border-status-restarting/40 transition-colors shadow-xs"
                        title={t.containers.stop}
                      >
                        <Square className="w-3 h-3 fill-current" />
                        {!isCompactDetail && <span>{t.containers.stop}</span>}
                      </button>
                      <button
                        onClick={() => restartContainer(activeContainer.id)}
                        className="flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium bg-surface border border-border/80 text-sky-400 hover:bg-sky-400/10 hover:border-sky-400/40 transition-colors shadow-xs"
                        title={t.containers.restart}
                      >
                        <RotateCw className="w-3 h-3" />
                        {!isCompactDetail && <span>{t.containers.restart}</span>}
                      </button>
                    </>
                  ) : activeContainer.state === "paused" ? (
                    <>
                      <button
                        onClick={() => unpauseContainer(activeContainer.id)}
                        className="flex items-center space-x-1 px-2 sm:px-3 py-1 rounded-md text-xs font-medium bg-status-running text-white hover:opacity-90 transition-opacity shadow-xs"
                        title={t.containers.unpause}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        {!isCompactDetail && <span>{t.containers.unpause}</span>}
                      </button>
                      <button
                        onClick={() => stopContainer(activeContainer.id)}
                        className="flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium bg-surface border border-border/80 text-status-restarting hover:bg-status-restarting/10 hover:border-status-restarting/40 transition-colors shadow-xs"
                        title={t.containers.stop}
                      >
                        <Square className="w-3 h-3 fill-current" />
                        {!isCompactDetail && <span>{t.containers.stop}</span>}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startContainer(activeContainer.id)}
                      className="flex items-center space-x-1 px-2.5 sm:px-3.5 py-1 rounded-md text-xs font-medium bg-status-running text-white hover:opacity-90 transition-opacity shadow-xs"
                      title={t.containers.start}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      {!isCompactDetail && <span>{t.containers.start}</span>}
                    </button>
                  )}

                  <div className="h-4 w-[1px] bg-border/80 mx-0.5 hidden sm:block" />

                  <button
                    onClick={() => setContainerToDelete(activeContainer)}
                    className="p-1.5 rounded-md bg-surface border border-border/80 text-muted-foreground hover:text-status-danger hover:bg-status-danger/10 hover:border-status-danger/40 transition-colors shadow-xs"
                    title={t.containers.remove}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center space-x-1.5">
                  {activeContainer.ports && activeContainer.ports.length > 0 && activeContainer.ports[0].publicPort && (
                    <a
                      href={`http://localhost:${activeContainer.ports[0].publicPort}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center space-x-1 px-2 py-0.5 rounded bg-surface border border-border/70 text-2xs font-mono text-primary hover:underline shadow-xs"
                    >
                      <span>:{activeContainer.ports[0].publicPort}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}

                  <button
                    onClick={() => {
                      const tabType = containerDetailTab;
                      const tabTitle = tabs.find((t) => t.id === tabType)?.label || tabType;
                      openRealNativeWindow({
                        id: `${tabType}-${activeContainer.id}-${Date.now()}`,
                        title: `${activeContainer.name} — ${tabTitle}`,
                        type: tabType as any,
                        containerId: activeContainer.id,
                        containerName: activeContainer.name,
                      });
                    }}
                    className="flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-2xs font-mono bg-surface border border-border/70 text-foreground hover:text-primary hover:border-primary/40 transition-colors shadow-xs shrink-0"
                    title="Pop out into real native OS window"
                  >
                    <AppWindow className="w-3 h-3 text-primary" />
                    <span>Pop out ({tabs.find((t) => t.id === containerDetailTab)?.label})</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="px-2.5 sm:px-4 py-1.5 sm:py-2 border-b border-border/70 flex items-center justify-between gap-1.5 bg-surface/20 shrink-0 overflow-x-auto">
              <div className="inline-flex items-center bg-surface-secondary/80 border border-border/60 p-0.5 rounded-lg shadow-xs shrink-0">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = containerDetailTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setContainerDetailTab(tab.id)}
                      className={`flex items-center space-x-1 sm:space-x-1.5 ${
                        isCompactDetail ? "px-2 py-1" : "px-3 py-1"
                      } rounded-md text-xs font-medium transition-all shrink-0 ${
                        isActive
                          ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                      }`}
                      title={tab.label}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      {!isCompactDetail && <span>{tab.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className={`flex-1 ${
                containerDetailTab === "logs" ||
                containerDetailTab === "terminal" ||
                containerDetailTab === "files"
                  ? "overflow-hidden flex flex-col min-h-0"
                  : "overflow-y-auto"
              } p-4 bg-background min-h-0`}
            >
              <ErrorBoundary fallbackTitle="Error loading container tab">
                {containerDetailTab === "overview" && <OverviewTab container={activeContainer} />}
                {containerDetailTab === "stats" && <StatsTab containerId={activeContainer.id} />}
                {containerDetailTab === "logs" && <LogsTab containerId={activeContainer.id} />}
                {containerDetailTab === "terminal" && (
                  <TerminalTab containerId={activeContainer.id} containerName={activeContainer.name} />
                )}
                {containerDetailTab === "inspect" && <InspectTab container={activeContainer} />}
                {containerDetailTab === "files" && (
                  <FileManagerTab
                    containerId={activeContainer.id}
                    containerName={activeContainer.name}
                  />
                )}
              </ErrorBoundary>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground text-center">
            <Box className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-xs font-medium">{t.containers.selectToInspect}</p>
          </div>
        )}
      </div>

      {containerToDelete &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 select-none"
            onClick={() => setContainerToDelete(null)}
          >
            <div
              className="bg-popover text-foreground border border-border/80 dark:border-white/15 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl shadow-black/80"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-foreground">{t.containers.removeConfirmTitle}</h3>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                {t.containers.removeConfirmDesc}{" "}
                <span className="font-mono text-status-danger font-medium">{containerToDelete.name}</span>?{" "}
                {t.containers.cannotBeUndone}
              </p>
              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setContainerToDelete(null)}
                  className="px-3 py-1 rounded-md text-xs font-medium text-foreground bg-surface border border-border/80 hover:bg-surface-secondary transition-colors shadow-xs cursor-pointer"
                >
                  {t.containers.cancel}
                </button>
                <button
                  type="button"
                  disabled={isActionInProgress}
                  onClick={async () => {
                    await removeContainer(containerToDelete.id);
                    setContainerToDelete(null);
                  }}
                  className="px-3 py-1 rounded-md text-xs font-medium bg-status-danger hover:bg-status-danger/90 text-white shadow-xs transition-opacity cursor-pointer flex items-center space-x-1.5"
                >
                  {isActionInProgress && <RotateCw className="w-3 h-3 animate-spin" />}
                  <span>{t.containers.remove}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {stackToDelete &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 select-none"
            onClick={() => setStackToDelete(null)}
          >
            <div
              className="bg-popover text-foreground border border-border/80 dark:border-white/15 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl shadow-black/80"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-foreground">{t.containers.removeConfirmTitle}</h3>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                {t.containers.removeConfirmDesc}{" "}
                <span className="font-mono text-status-danger font-medium">{stackToDelete.name}</span>{" "}
                ({stackToDelete.containers.length} {t.containers.active})?{" "}
                {t.containers.cannotBeUndone}
              </p>
              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setStackToDelete(null)}
                  className="px-3 py-1 rounded-md text-xs font-medium text-foreground bg-surface border border-border/80 hover:bg-surface-secondary transition-colors shadow-xs cursor-pointer"
                >
                  {t.containers.cancel}
                </button>
                <button
                  type="button"
                  disabled={isActionInProgress}
                  onClick={async () => {
                    const proj = composeProjects.find(
                      (p) => p.name.toLowerCase() === stackToDelete.name.toLowerCase()
                    );
                    await removeComposeProject(stackToDelete.name, proj?.workingDir, proj?.configFile);
                    setStackToDelete(null);
                  }}
                  className="px-3 py-1 rounded-md text-xs font-medium bg-status-danger hover:bg-status-danger/90 text-white shadow-xs transition-opacity cursor-pointer flex items-center space-x-1.5"
                >
                  {isActionInProgress && <RotateCw className="w-3 h-3 animate-spin" />}
                  <span>{t.containers.remove}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {bulkToDelete &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 select-none"
            onClick={() => setBulkToDelete(null)}
          >
            <div
              className="bg-popover text-foreground border border-border/80 dark:border-white/15 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl shadow-black/80"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-foreground">{t.containers.removeConfirmTitle}</h3>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                ¿Deseas eliminar permanentemente los {bulkToDelete.length} contenedores seleccionados?{" "}
                {t.containers.cannotBeUndone}
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-surface/50 rounded-lg border border-border/50 text-2xs font-mono">
                {bulkToDelete.map((id) => {
                  const c = containers.find((item) => item.id === id);
                  return (
                    <div key={id} className="text-muted-foreground truncate flex items-center space-x-1.5">
                      <span className="text-status-danger">•</span>
                      <span className="text-foreground font-medium">{c?.name || id.slice(0, 12)}</span>
                      {c?.composeProject && (
                        <span className="text-muted-foreground/60 text-[10px]">({c.composeProject})</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkToDelete(null)}
                  className="px-3 py-1 rounded-md text-xs font-medium text-foreground bg-surface border border-border/80 hover:bg-surface-secondary transition-colors shadow-xs cursor-pointer"
                >
                  {t.containers.cancel}
                </button>
                <button
                  type="button"
                  disabled={isBulkOperating}
                  onClick={async () => {
                    setIsBulkOperating(true);
                    try {
                      for (const id of bulkToDelete) {
                        await removeContainer(id);
                      }
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        bulkToDelete.forEach((id) => next.delete(id));
                        return next;
                      });
                    } finally {
                      setIsBulkOperating(false);
                      setBulkToDelete(null);
                    }
                  }}
                  className="px-3 py-1 rounded-md text-xs font-medium bg-status-danger hover:bg-status-danger/90 text-white shadow-xs transition-opacity cursor-pointer flex items-center space-x-1.5"
                >
                  {isBulkOperating && <RotateCw className="w-3 h-3 animate-spin" />}
                  <span>{t.containers.remove}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};