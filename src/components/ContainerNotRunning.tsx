import React from "react";
import { PowerOff, Pause } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { ContainerState } from "@/types";

interface ContainerNotRunningProps {
  state?: ContainerState;
  containerName?: string;
  featureName?: string;
}

export const ContainerNotRunning: React.FC<ContainerNotRunningProps> = ({
  state = "stopped",
  containerName,
  featureName,
}) => {
  const { t } = useAppStore();
  const isPaused = state === "paused";

  const title = isPaused
    ? t.containers.containerPausedTitle
    : t.containers.containerNotRunningTitle;

  const desc = isPaused
    ? t.containers.containerPausedDesc
    : t.containers.containerNotRunningDesc;

  return (
    <div className="flex-1 h-full min-h-[300px] flex flex-col items-center justify-center p-8 bg-background/50 border border-border/60 rounded-xl select-none text-center">
      <div className="flex flex-col items-center space-y-4 max-w-md">
        <div
          className={`w-16 h-16 rounded-3xl flex items-center justify-center border shadow-xs ${
            isPaused
              ? "bg-amber-500/10 border-amber-500/25 text-amber-500"
              : "bg-surface-secondary border-border/80 text-muted-foreground"
          }`}
        >
          {isPaused ? (
            <Pause className="w-8 h-8" />
          ) : (
            <PowerOff className="w-8 h-8" />
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-center space-x-2">
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
              {title}
            </h3>
            <span
              className={`px-1.5 py-0.5 text-2xs font-mono uppercase rounded font-medium ${
                isPaused
                  ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                  : "bg-surface-secondary text-muted-foreground border border-border"
              }`}
            >
              {state}
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {desc}
          </p>

          {(containerName || featureName) && (
            <div className="pt-2 text-2xs font-mono text-muted-foreground/60">
              {containerName && <span className="font-medium text-muted-foreground">{containerName}</span>}
              {containerName && featureName && <span> • </span>}
              {featureName && <span className="capitalize">{featureName}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
