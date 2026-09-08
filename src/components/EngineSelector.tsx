import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  RefreshCw,
  Check,
  Server,
  Zap,
  Box,
  Compass,
  Layers,
  Sliders,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { ContainerEngineInfo } from "@/types";

function getEngineIcon(type: string, className = "w-3.5 h-3.5") {
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

export const EngineSelector: React.FC = () => {
  const {
    t,
    detectedEngines,
    activeEngine,
    switchEngine,
    rescanEngines,
    isActionInProgress,
    systemOverview,
    setActiveTab,
  } = useAppStore();

  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const currentEngine: ContainerEngineInfo =
    activeEngine ||
    detectedEngines.find((e) => e.isActive) ||
    detectedEngines[0] || {
      id: "docker-desktop",
      name: "Docker Desktop",
      type: "docker-desktop",
      socketPath: "/var/run/docker.sock",
      status: "stopped",
      isDefault: true,
      description: "Docker engine",
      icon: "docker",
    };

  const isConnected = systemOverview?.dockerConnected ?? (currentEngine.status === "running");

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-lg text-2xs font-mono transition-all border shadow-xs ${
          isConnected
            ? "bg-surface-secondary/80 border-border/70 hover:bg-surface-secondary text-foreground hover:border-border"
            : "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15 text-foreground"
        }`}
        title="Select container engine (Docker, OrbStack, Rancher, Colima, Podman)"
      >
        <span className="shrink-0">{getEngineIcon(currentEngine.type, "w-3 h-3")}</span>
        <span className="font-medium truncate max-w-[110px]">{currentEngine.name}</span>

        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            isConnected
              ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.7)]"
              : "bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.6)] animate-pulse"
          }`}
        />

        <span
          className={`text-[9px] font-sans font-semibold px-1 py-0.1 rounded uppercase tracking-wider ${
            isConnected
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              : "bg-status-danger/15 text-status-danger border border-status-danger/30"
          }`}
        >
          {isConnected ? t.engines.live : t.engines.stopped}
        </span>

        <ChevronDown
          className={`w-3 h-3 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <>

          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="absolute left-0 top-full mt-2 w-[360px] rounded-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans text-xs bg-white dark:bg-[#151923] border border-border/80 dark:border-white/15 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border/70">
              <div>
                <div className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                  <span>{t.engines.title}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t.engines.subtitle}
                </p>
              </div>

              <button
                onClick={() => rescanEngines()}
                disabled={isActionInProgress}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors bg-surface-secondary border border-border/70 hover:bg-surface-hover disabled:opacity-50 shadow-xs"
                title={t.engines.rescan}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isActionInProgress ? "animate-spin text-primary" : ""}`} />
              </button>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
              {detectedEngines.map((engine) => {
                const isEngineActive = currentEngine.id === engine.id;
                const isRunning = engine.status === "running";
                const isStopped = engine.status === "stopped";

                return (
                  <div
                    key={engine.id}
                    onClick={() => {
                      switchEngine(engine.id);
                      setIsOpen(false);
                    }}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between group ${
                      isEngineActive
                        ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
                        : "bg-surface-secondary/50 hover:bg-surface-secondary border-border/60 hover:border-border/90"
                    }`}
                  >
                    <div className="flex items-start space-x-2.5 min-w-0">
                      <div className="mt-0.5 p-1.5 rounded-md border border-border/70 bg-surface shrink-0 shadow-xs">
                        {getEngineIcon(engine.type, "w-3.5 h-3.5")}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-foreground text-xs truncate">
                            {engine.name}
                          </span>
                          {engine.version && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              v{engine.version}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[170px] mt-0.5">
                          {engine.socketPath}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span
                        className={`text-[9px] font-semibold font-mono uppercase px-1.5 py-0.5 rounded-full border ${
                          isRunning
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : isStopped
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-muted/40 text-muted-foreground border-border/60"
                        }`}
                      >
                        {isRunning
                          ? t.engines.running
                          : isStopped
                          ? t.engines.stopped
                          : t.engines.notInstalled}
                      </span>

                      {isEngineActive && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 pt-2 border-t border-border/70 flex items-center justify-end text-2xs text-muted-foreground">
              <button
                onClick={() => {
                  setActiveTab("settings");
                  setIsOpen(false);
                }}
                className="flex items-center space-x-1 hover:text-foreground text-primary transition-colors font-medium"
              >
                <Sliders className="w-3 h-3" />
                <span>{t.nav.settings}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};