import React from "react";
import {
  Play,
  Square,
  Pause,
  RotateCw,
  Trash2,
  Terminal,
} from "lucide-react";
import { ContainerDetail, ContainerState } from "@/types";

import { TechIcon } from "@/components/TechIcon";
import { formatBytes } from "@/lib/utils";
import { openRealNativeWindow } from "@/lib/nativeWindow";
import { IndeterminateCheckbox } from "./IndeterminateCheckbox";


interface ContainerRowItemProps {
  container: ContainerDetail;
  isSelected: boolean;
  isActionInProgress: boolean;
  selectedIds: Set<string>;
  t: any;
  getStatusDot: (state: ContainerState, size?: "sm" | "md") => string;
  onSelectContainer: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onStart: (id: string, e: React.MouseEvent) => void;
  onStop: (id: string, e: React.MouseEvent) => void;
  onPause: (id: string, e: React.MouseEvent) => void;
  onUnpause: (id: string, e: React.MouseEvent) => void;
  onRestart: (id: string, e: React.MouseEvent) => void;
  onDelete: (c: ContainerDetail, e: React.MouseEvent) => void;
}

export const ContainerRowItem: React.FC<ContainerRowItemProps> = ({
  container,
  isSelected,
  selectedIds,
  t,
  getStatusDot,
  onSelectContainer,
  onToggleSelect,
  onStart,
  onStop,
  onPause,
  onUnpause,
  onRestart,
  onDelete,
}) => {
  const isRunning = container.state === "running";
  const isPaused = container.state === "paused";

  return (
    <div
      key={container.id}
      onClick={() => onSelectContainer(container.id)}
      className={`group/row px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 border flex items-center justify-between gap-2 ${
        isSelected
          ? "bg-white/[0.08] border-white/10 shadow-mac-segment text-foreground font-medium"
          : "bg-surface/30 hover:bg-surface/90 hover:border-border/80 border-transparent text-foreground/80 hover:text-foreground hover:shadow-xs"
      }`}
    >
      <div className="flex items-center space-x-2 min-w-0">
        <IndeterminateCheckbox
          checked={selectedIds.has(container.id)}
          onChange={() => onToggleSelect(container.id)}
          title="Seleccionar para acciones en lote"
        />
        <span className={getStatusDot(container.state)} />
        <TechIcon
          image={container.image}
          name={container.name}
          className="w-4 h-4 shrink-0"
        />
        <div className="min-w-0">
          <div className="flex items-center space-x-1.5">
            <span
              className={`text-xs truncate ${
                isSelected
                  ? "text-primary font-semibold"
                  : "font-medium text-foreground"
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
                    .map((p) => p.publicPort!),
                ),
              );
              if (publicPorts.length > 0) {
                return (
                  <span className="flex items-center gap-1">
                    {publicPorts.slice(0, 2).map((port) => (
                      <span
                        key={port}
                        className="text-[10px] font-mono text-primary font-medium bg-primary/10 border border-primary/25 px-1.5 py-0.2 rounded"
                      >
                        :{port}
                      </span>
                    ))}

                    {publicPorts.length > 2 && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        +{publicPorts.length - 2}
                      </span>
                    )}
                  </span>
                );
              }
              return null;
            })()}

          </div>
          <div className="text-[11px] font-mono text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
            {isRunning && container.cpuPercent !== undefined ? (
              <span>
                {container.cpuPercent}% CPU •{" "}
                {formatBytes(container.memoryUsage ?? 0)}
              </span>
            ) : isPaused ? (
              <span className="text-amber-400 font-medium">
                {t.containers.paused}
              </span>
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

        {isRunning ? (
          <>
            <button
              onClick={(e) => onStop(container.id, e)}
              className="p-1 rounded text-muted-foreground hover:text-status-restarting hover:bg-surface transition-colors"
              title={t.containers.stop}
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
            <button
              onClick={(e) => onPause(container.id, e)}
              className="p-1 rounded text-muted-foreground hover:text-amber-500 hover:bg-surface transition-colors"
              title={t.containers.pause}
            >
              <Pause className="w-3 h-3 fill-current" />
            </button>
            <button
              onClick={(e) => onRestart(container.id, e)}
              className="p-1 rounded text-muted-foreground hover:text-sky-400 hover:bg-surface transition-colors"
              title={t.containers.restart}
            >
              <RotateCw className="w-3 h-3" />
            </button>
          </>
        ) : isPaused ? (
          <>
            <button
              onClick={(e) => onUnpause(container.id, e)}
              className="p-1 rounded text-status-running hover:bg-surface transition-colors"
              title={t.containers.unpause}
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
            <button
              onClick={(e) => onStop(container.id, e)}
              className="p-1 rounded text-muted-foreground hover:text-status-restarting hover:bg-surface transition-colors"
              title={t.containers.stop}
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          </>
        ) : (
          <button
            onClick={(e) => onStart(container.id, e)}
            className="p-1 rounded text-status-running hover:bg-surface transition-colors"
            title={t.containers.start}
          >
            <Play className="w-3 h-3 fill-current" />
          </button>
        )}

        <button
          onClick={(e) => onDelete(container, e)}
          className="p-1 rounded text-muted-foreground hover:text-status-danger hover:bg-surface transition-colors opacity-0 group-hover/row:opacity-100 focus:opacity-100"
          title={t.containers.remove}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
