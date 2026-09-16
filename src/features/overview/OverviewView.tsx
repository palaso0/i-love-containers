import React from "react";
import {
  Box,
  Layers,
  HardDrive,
  Network,
  RotateCw,
  ArrowRight,
  Activity,
  Server,
  Play,
  Square,
  Zap,
  Compass,
  Check,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { formatBytes } from "@/lib/utils";

function getEngineIcon(type: string, className = "w-4 h-4") {
  switch (type) {
    case "docker-desktop":
      return <Box className={`${className} text-sky-400`} />;
    case "orbstack":
      return <Zap className={`${className} text-amber-400`} />;
    case "rancher":
      return <Compass className={`${className} text-emerald-400`} />;
    case "colima":
      return <Layers className={`${className} text-purple-400`} />;
    case "podman":
      return <Box className={`${className} text-purple-400`} />;
    default:
      return <Server className={`${className} text-primary`} />;
  }
}

export const OverviewView: React.FC = () => {
  const {
    t,
    viewMode,
    systemOverview,
    containers,
    setActiveTab,
    setSelectedContainerId,
    startContainer,
    stopContainer,
    refreshData,
    isActionInProgress,
    detectedEngines,
    activeEngine,
    switchEngine,
    rescanEngines,
  } = useAppStore();

  const isConnected = systemOverview?.dockerConnected ?? false;
  const currentEngine =
    activeEngine ||
    detectedEngines.find((e) => e.isActive) ||
    detectedEngines[0];

  if (!isConnected) {
    return (
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-background">
        <div className="max-w-xl w-full space-y-5">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-3xl bg-surface-secondary/80 border border-border/80 flex items-center justify-center mx-auto shadow-xs">
              <Box className="w-10 h-10 text-muted-foreground/70" />
            </div>
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              {t.containers.disconnected}
            </h2>
          </div>

          <div className="bg-surface/90 backdrop-blur-md border border-border/80 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-primary" />
                <span>{t.engines.title}</span>
              </span>
              <button
                onClick={() => rescanEngines()}
                disabled={isActionInProgress}
                className="text-2xs text-muted-foreground hover:text-foreground flex items-center space-x-1 p-1 rounded hover:bg-surface-secondary transition-colors"
                title={t.engines.rescan}
              >
                <RefreshCw
                  className={`w-3 h-3 ${isActionInProgress ? "animate-spin text-primary" : ""}`}
                />
                <span>{t.engines.rescan}</span>
              </button>
            </div>

            <div className="space-y-2">
              {detectedEngines.map((engine) => {
                const isRunning = engine.status === "running";
                const isStopped = engine.status === "stopped";
                const isCurrent = currentEngine?.id === engine.id;

                return (
                  <div
                    key={engine.id}
                    onClick={() => switchEngine(engine.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isCurrent
                        ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                        : "bg-surface-secondary/40 hover:bg-surface-secondary border-border/40 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="p-1.5 rounded-lg bg-surface border border-border/50 shrink-0">
                        {getEngineIcon(engine.type, "w-4 h-4")}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-foreground text-xs">
                            {engine.name}
                          </span>
                          {engine.appPath && (
                            <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
                              {engine.appPath}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[260px] mt-0.5">
                          {engine.socketPath}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span
                        className={`text-[10px] font-semibold font-mono uppercase px-2 py-0.5 rounded-full border ${
                          isRunning
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : isStopped
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-muted/20 text-muted-foreground border-border/40"
                        }`}
                      >
                        {isRunning
                          ? t.engines.running
                          : isStopped
                            ? t.engines.stopped
                            : t.engines.notInstalled}
                      </span>
                      {isCurrent && (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {currentEngine &&
              currentEngine.status === "stopped" &&
              currentEngine.appPath && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs space-y-1">
                  <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <span>💡 Tip:</span>
                    <span>{currentEngine.name} is installed on this Mac</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Launch{" "}
                    <strong className="text-foreground">
                      {currentEngine.name}
                    </strong>{" "}
                    from your Applications folder or Spotlight, then click{" "}
                    <strong>Retry Connection</strong> below.
                  </p>
                </div>
              )}
          </div>

          <div className="flex items-center justify-center pt-1">
            <button
              onClick={() => refreshData()}
              disabled={isActionInProgress}
              className="w-full sm:w-auto min-w-[200px] py-2 px-6 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-medium transition-all flex items-center justify-center space-x-2 shadow-xs disabled:opacity-50"
            >
              <RotateCw
                className={`w-3.5 h-3.5 ${isActionInProgress ? "animate-spin" : ""}`}
              />
              <span>{t.engines.retry}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const runningContainers = containers.filter((c) => c.state === "running");
  const stoppedContainers = containers.filter((c) => c.state === "stopped");

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background ">
      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-surface-secondary border border-border/60 shrink-0">
            {getEngineIcon(currentEngine?.type || "docker-desktop", "w-4 h-4")}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xs font-semibold text-foreground">
                {currentEngine?.name || "Docker"}
              </h2>
              <span
                className={`text-[9px] font-mono font-semibold uppercase px-1.5 py-0.2 rounded-full border ${
                  isConnected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }`}
              >
                {isConnected ? t.engines.live : t.engines.demo}
              </span>
              {systemOverview?.engineVersion && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  v{systemOverview.engineVersion}
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground mt-0.5 flex items-center gap-2">
              <span>{currentEngine?.socketPath || "/var/run/docker.sock"}</span>
              {systemOverview?.operatingSystem && (
                <>
                  <span>•</span>
                  <span>{systemOverview.operatingSystem}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setActiveTab("settings")}
            className="px-2.5 py-1 rounded-lg text-2xs font-medium text-muted-foreground hover:text-foreground bg-surface-secondary/70 border border-border/60 hover:bg-surface-secondary transition-colors flex items-center space-x-1.5"
          >
            <Sliders className="w-3 h-3 text-primary" />
            <span>{t.overview.enginesAndSettings}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border/70 pb-3">
        <div>
          <h1 className="text-base font-semibold text-foreground tracking-tight">
            {t.overview.title}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.overview.subtitle}
            {viewMode === "minimal" && ` • ${t.overview.minimalMode}`}
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-foreground bg-surface-secondary/70 border border-border/60 px-2.5 py-1 rounded-md shadow-xs">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected
                  ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.6)]"
                  : "bg-amber-400"
              }`}
            />
            {currentEngine?.name || "Docker"}{" "}
            {systemOverview?.engineVersion || ""}
          </span>
        </div>
      </div>

      {viewMode === "minimal" ? (
        <div className="space-y-4">
          <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.6)]" />
                <span className="text-sm font-semibold text-foreground">
                  {runningContainers.length} {t.overview.running}
                </span>
              </div>
              <span className="text-muted-foreground text-xs">•</span>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-status-stopped" />
                <span className="text-sm font-semibold text-muted-foreground">
                  {stoppedContainers.length} {t.overview.stopped}
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab("containers")}
              className="text-xs font-medium text-primary hover:underline flex items-center space-x-1"
            >
              <span>{t.overview.viewAllContainers}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-xs divide-y divide-border font-mono text-xs">
            {containers.map((container) => {
              const isRunning = container.state === "running";
              return (
                <div
                  key={container.id}
                  onClick={() => {
                    setActiveTab("containers");
                    setSelectedContainerId(container.id);
                  }}
                  className="px-4 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-3 truncate mr-4">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isRunning
                          ? "bg-status-running shadow-[0_0_6px_rgba(16,185,129,0.4)]"
                          : "bg-status-stopped"
                      }`}
                    />
                    <span className="font-semibold text-foreground text-xs truncate">
                      {container.name}
                    </span>
                    <span className="text-2xs text-muted-foreground truncate hidden sm:inline">
                      {container.image}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <span className="text-2xs text-muted-foreground hidden md:inline">
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
                      className={`px-2.5 py-1 rounded text-2xs font-mono transition-colors flex items-center space-x-1 ${
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
                      <span>{isRunning ? t.overview.stop : t.overview.start}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div
              onClick={() => setActiveTab("containers")}
              className="bg-surface/80 backdrop-blur-sm border border-border/70 hover:border-border hover:bg-surface rounded-xl p-3.5 transition-all cursor-pointer group shadow-xs"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground/80 mb-2">
                <span>{t.overview.containers}</span>
                <Box className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-semibold text-foreground tracking-tight">
                  {runningContainers.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.overview.runningStat
                    .replace("{running}", String(runningContainers.length))
                    .replace("{stopped}", String(stoppedContainers.length))}
                </span>
              </div>
              <div className="w-full bg-surface-secondary h-1 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-status-running h-full rounded-full"
                  style={{
                    width: `${containers.length ? (runningContainers.length / containers.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div
              onClick={() => setActiveTab("images")}
              className="bg-surface/80 backdrop-blur-sm border border-border/70 hover:border-border hover:bg-surface rounded-xl p-3.5 transition-all cursor-pointer group shadow-xs"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground/80 mb-2">
                <span>{t.overview.images}</span>
                <Layers className="w-4 h-4 text-muted-foreground group-hover:text-sky-400 transition-colors" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-semibold text-foreground tracking-tight">
                  {systemOverview?.totalImages ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">{t.overview.cached}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t.overview.baseLayers}</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            <div
              onClick={() => setActiveTab("volumes")}
              className="bg-surface/80 backdrop-blur-sm border border-border/70 hover:border-border hover:bg-surface rounded-xl p-3.5 transition-all cursor-pointer group shadow-xs"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground/80 mb-2">
                <span>{t.overview.volumes}</span>
                <HardDrive className="w-4 h-4 text-muted-foreground group-hover:text-amber-400 transition-colors" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-semibold text-foreground tracking-tight">
                  {systemOverview?.totalVolumes ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">{t.overview.mounts}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t.overview.persistentStores}</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            <div
              onClick={() => setActiveTab("networks")}
              className="bg-surface/80 backdrop-blur-sm border border-border/70 hover:border-border hover:bg-surface rounded-xl p-3.5 transition-all cursor-pointer group shadow-xs"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground/80 mb-2">
                <span>{t.overview.networks}</span>
                <Network className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-semibold text-foreground tracking-tight">
                  {systemOverview?.totalNetworks ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">{t.overview.bridges}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t.overview.virtualTopologies}</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-status-running" />
                  {t.overview.containerCpuUsage}
                </span>
                <span className="font-semibold text-foreground font-mono text-xs">
                  {systemOverview?.systemCpuPercent ?? 0}%
                </span>
              </div>
              <div className="w-full bg-surface-secondary h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-status-running h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, systemOverview?.systemCpuPercent ?? 0)}%`,
                  }}
                />
              </div>
            </div>

            <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-sky-400" />
                  {t.overview.containerMemoryUsage}
                </span>
                <span className="font-semibold text-foreground font-mono text-xs">
                  {formatBytes(systemOverview?.systemMemoryUsed ?? 0)} /{" "}
                  {formatBytes(systemOverview?.systemMemoryTotal ?? 0)}
                </span>
              </div>
              <div className="w-full bg-surface-secondary h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      systemOverview?.systemMemoryTotal
                        ? (systemOverview.systemMemoryUsed /
                            systemOverview.systemMemoryTotal) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 border-b border-border/70 flex items-center justify-between bg-surface-secondary/40">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-foreground">
                  {t.overview.recentContainers}
                </span>
                <span className="text-2xs font-mono text-muted-foreground bg-surface-secondary px-1.5 py-0.5 rounded-full">
                  {containers.length}
                </span>
              </div>
              <button
                onClick={() => setActiveTab("containers")}
                className="text-xs font-medium text-primary hover:underline flex items-center space-x-1"
              >
                <span>{t.overview.manageAll}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-border/60">
              {containers.slice(0, 5).map((container) => {
                const isRunning = container.state === "running";
                return (
                  <div
                    key={container.id}
                    onClick={() => {
                      setActiveTab("containers");
                      setSelectedContainerId(container.id);
                    }}
                    className="px-4 py-2.5 flex items-center justify-between hover:bg-surface-hover transition-colors cursor-pointer text-xs group"
                  >
                    <div className="flex items-center space-x-2.5 truncate mr-4">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isRunning
                            ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.6)]"
                            : "bg-status-stopped"
                        }`}
                      />
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {container.name}
                      </span>
                      <span className="text-2xs font-mono text-muted-foreground truncate hidden sm:inline">
                        {container.image}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      {isRunning ? (
                        <div className="flex items-center space-x-1 text-2xs font-mono text-foreground hidden sm:flex">
                          <span className="text-status-running font-medium">
                            {container.cpuPercent ?? 0}%
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">
                            {formatBytes(container.memoryUsage ?? 0)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-2xs font-mono text-muted-foreground hidden sm:inline">
                          {t.overview.exited}
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isRunning) {
                            stopContainer(container.id);
                          } else {
                            startContainer(container.id);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1 shadow-xs ${
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
                        <span className="text-2xs">
                          {isRunning ? t.overview.stop : t.overview.start}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
