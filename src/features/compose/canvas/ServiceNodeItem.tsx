import React from "react";
import { HardDrive } from "lucide-react";
import { ComposeServiceNode } from "@/lib/composeParser";
import { TechIcon, getTechBadgeInfo } from "@/components/TechIcon";

interface ServiceNodeItemProps {
  svc: ComposeServiceNode;
  pos: { x: number; y: number };
  isSelected: boolean;
  isHovered: boolean;
  effectiveState: "running" | "stopped" | "paused";
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const ServiceNodeItem: React.FC<ServiceNodeItemProps> = ({
  svc,
  pos,
  isSelected,
  isHovered,
  effectiveState,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
}) => {
  const isRunning = effectiveState === "running";
  const isPaused = effectiveState === "paused";

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        left: pos.x,
        top: pos.y,
        width: svc.width,
        minHeight: svc.height,
      }}
      className={`absolute rounded-xl border p-3 flex flex-col justify-between transition-shadow canvas-interactive cursor-grab active:cursor-grabbing  ${
        isSelected
          ? "bg-surface/95 border-primary shadow-[0_0_22px_rgba(0,122,255,0.4)] ring-2 ring-primary/60"
          : isHovered
            ? "bg-surface/95 border-foreground/40 shadow-mac-segment"
            : "bg-surface/85 backdrop-blur-xl border-border/80 shadow-mac-segment"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isRunning
                ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.8)]"
                : isPaused
                  ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                  : "bg-status-stopped"
            }`}
          />
          <div className="flex items-center space-x-1.5 min-w-0">
            <TechIcon
              image={svc.image}
              name={svc.name}
              role={svc.role}
              className="w-4 h-4"
            />
            <span className="font-semibold text-xs text-foreground tracking-tight truncate">
              {svc.name}
            </span>
          </div>
        </div>

        <span
          className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full border shrink-0 ${
            getTechBadgeInfo(svc.image, svc.name, svc.role).badgeStyle
          }`}
        >
          {getTechBadgeInfo(svc.image, svc.name, svc.role).label}
        </span>
      </div>

      <div className="mt-1.5">
        <div className="text-[11px] font-mono text-muted-foreground truncate bg-surface-secondary/70 px-2 py-0.5 rounded-md border border-border/50">
          {svc.image}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center space-x-1 truncate">
          {svc.ports.length > 0 ? (
            svc.ports.map((p, i) => (
              <span
                key={i}
                className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded truncate"
              >
                :{p.split(":")[0] || p}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground/60 italic text-[9px]">
              internal
            </span>
          )}
        </div>

        {svc.volumes.length > 0 && (
          <div className="flex items-center space-x-1 text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20 shrink-0">
            <HardDrive className="w-2.5 h-2.5" />
            <span>{svc.volumes.length}</span>
          </div>
        )}
      </div>
    </div>
  );
};
