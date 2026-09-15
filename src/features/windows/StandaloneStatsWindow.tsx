import React from "react";
import { Activity } from "lucide-react";
import { StatsTab } from "@/features/containers/tabs/StatsTab";

interface StandaloneStatsWindowProps {
  containerId: string;
  containerName?: string;
}

export const StandaloneStatsWindow: React.FC<StandaloneStatsWindowProps> = ({
  containerId,
  containerName = "container",
}) => {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground font-sans">
      <div
        data-tauri-drag-region
        className="h-10 px-4 bg-surface/80 border-b border-border flex items-center justify-between font-mono text-2xs shrink-0"
      >
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.5)]" />
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span className="font-bold text-foreground">{containerName}</span>
          <span className="text-muted-foreground">
            ({containerId.substring(0, 12)})
          </span>
          <span className="text-muted-foreground/60">•</span>
          <span className="text-muted-foreground">Stats</span>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        <StatsTab containerId={containerId} />
      </div>
    </div>
  );
};
