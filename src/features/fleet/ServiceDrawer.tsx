import React, { useState } from "react";
import {
  X,
  Play,
  Square,
  RotateCw,
  Trash2,
  Terminal,
  FileText,
  Activity,
  Box,
  ExternalLink,
  Check,
  AppWindow,
} from "lucide-react";
import { ContainerDetail } from "@/types";
import { useAppStore } from "@/stores/useAppStore";
import { openRealNativeWindow } from "@/lib/nativeWindow";
import { LogsTab } from "@/features/containers/tabs/LogsTab";
import { TerminalTab } from "@/features/containers/tabs/TerminalTab";
import { StatsTab } from "@/features/containers/tabs/StatsTab";
import { OverviewTab } from "@/features/containers/tabs/OverviewTab";
import { TechIcon } from "@/components/TechIcon";

interface ServiceDrawerProps {
  container: ContainerDetail;
  onClose: () => void;
}

export const ServiceDrawer: React.FC<ServiceDrawerProps> = ({ container, onClose }) => {
  const {
    startContainer,
    stopContainer,
    restartContainer,
    removeContainer,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<"logs" | "terminal" | "stats" | "info">("logs");
  const [copiedPort, setCopiedPort] = useState<number | null>(null);

  const isRunning = container.state === "running";

  const handleOpenInWindow = () => {
    if (activeTab === "terminal") {
      openRealNativeWindow({
        id: `term-${container.id}-${Date.now()}`,
        title: `${container.name} — Terminal`,
        type: "terminal",
        containerId: container.id,
        containerName: container.name,
      });
      onClose();
    } else if (activeTab === "logs") {
      openRealNativeWindow({
        id: `logs-${container.id}-${Date.now()}`,
        title: `${container.name} — Logs`,
        type: "logs",
        containerId: container.id,
        containerName: container.name,
      });
      onClose();
    }
  };

  const handleCopyPort = (port: number) => {
    navigator.clipboard.writeText(`http://localhost:${port}`);
    setCopiedPort(port);
    setTimeout(() => setCopiedPort(null), 1500);
  };

  const tabs: {
    id: "logs" | "terminal" | "stats" | "info";
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "logs", label: "Logs", icon: FileText },
    { id: "terminal", label: "Shell", icon: Terminal },
    { id: "stats", label: "Stats", icon: Activity },
    { id: "info", label: "Inspect", icon: Box },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-surface border-t border-x border-border rounded-t-xl shadow-2xl overflow-hidden flex flex-col h-[600px] animate-in slide-in-from-bottom duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 px-4 bg-surface-secondary/70 border-b border-border flex items-center justify-between select-none">
          <div className="flex items-center space-x-3">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isRunning
                  ? "bg-status-running shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                  : "bg-status-stopped"
              }`}
            />
            <TechIcon image={container.image} name={container.name} className="w-4 h-4 shrink-0" />
            <div className="flex items-baseline space-x-2 font-mono">
              <span className="text-xs font-bold text-foreground">{container.name}</span>
              <span className="text-2xs text-muted-foreground">{container.image}</span>
            </div>

            {container.ports && container.ports.length > 0 && container.ports[0].publicPort && (
              <button
                onClick={() => handleCopyPort(container.ports[0].publicPort!)}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-surface border border-border text-2xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                title="Click to copy URL"
              >
                <span>:{container.ports[0].publicPort}</span>
                {copiedPort === container.ports[0].publicPort ? (
                  <Check className="w-2.5 h-2.5 text-status-running" />
                ) : (
                  <ExternalLink className="w-2.5 h-2.5" />
                )}
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-surface border border-border rounded-md p-0.5 font-mono text-2xs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded transition-colors ${
                      isActive
                        ? "bg-surface-secondary text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className={`w-3 h-3 ${isActive ? "text-primary" : ""}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="h-4 w-[1px] bg-border mx-1" />

            {isRunning ? (
              <>
                <button
                  onClick={() => stopContainer(container.id)}
                  className="p-1.5 rounded text-amber-500 hover:bg-amber-500/10 border border-amber-500/30 transition-colors"
                  title="Stop"
                >
                  <Square className="w-3 h-3 fill-current" />
                </button>
                <button
                  onClick={() => restartContainer(container.id)}
                  className="p-1.5 rounded text-cyan-500 hover:bg-cyan-500/10 border border-cyan-500/30 transition-colors"
                  title="Restart"
                >
                  <RotateCw className="w-3 h-3" />
                </button>
              </>
            ) : (
              <button
                onClick={() => startContainer(container.id)}
                className="p-1.5 rounded text-status-running hover:bg-status-running/10 border border-status-running/30 transition-colors"
                title="Start"
              >
                <Play className="w-3 h-3 fill-current" />
              </button>
            )}

            <button
              onClick={async () => {
                await removeContainer(container.id);
                onClose();
              }}
              className="p-1.5 rounded text-rose-500 hover:bg-rose-500/10 border border-border transition-colors"
              title="Remove"
            >
              <Trash2 className="w-3 h-3" />
            </button>

            {(activeTab === "terminal" || activeTab === "logs") && (
              <button
                onClick={handleOpenInWindow}
                className="flex items-center space-x-1 px-2 py-1 rounded bg-surface border border-border text-2xs font-mono text-foreground hover:border-emerald-500 transition-colors shadow-xs"
                title="Open in detached floating window that you can move and expand"
              >
                <AppWindow className="w-3 h-3 text-emerald-500" />
                <span>Window</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface transition-colors ml-1"
              title="Close drawer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-background">
          {activeTab === "logs" && <LogsTab containerId={container.id} />}
          {activeTab === "terminal" && (
            <TerminalTab containerId={container.id} containerName={container.name} />
          )}
          {activeTab === "stats" && <StatsTab containerId={container.id} />}
          {activeTab === "info" && <OverviewTab container={container} />}
        </div>
      </div>
    </div>
  );
};