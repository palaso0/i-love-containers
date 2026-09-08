import React, { useState, useEffect } from "react";
import { Box } from "lucide-react";
import { ContainerDetail } from "@/types";
import { fetchContainer } from "@/lib/api";
import { useAppStore } from "@/stores/useAppStore";
import { OverviewTab } from "@/features/containers/tabs/OverviewTab";

interface StandaloneOverviewWindowProps {
  containerId: string;
  containerName?: string;
}

export const StandaloneOverviewWindow: React.FC<StandaloneOverviewWindowProps> = ({
  containerId,
  containerName = "container",
}) => {
  const { containers } = useAppStore();
  const [container, setContainer] = useState<ContainerDetail | null>(
    containers.find((c) => c.id === containerId) || null
  );

  useEffect(() => {
    if (!container) {
      fetchContainer(containerId).then((c) => {
        if (c) setContainer(c);
      });
    }
  }, [containerId, container]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground font-sans select-none">
      <div
        data-tauri-drag-region
        className="h-10 px-4 bg-surface/80 border-b border-border flex items-center justify-between font-mono text-2xs shrink-0 select-none"
      >
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.5)]" />
          <Box className="w-3.5 h-3.5 text-primary" />
          <span className="font-bold text-foreground">{containerName}</span>
          <span className="text-muted-foreground">({containerId.substring(0, 12)})</span>
          <span className="text-muted-foreground/60">•</span>
          <span className="text-muted-foreground">Overview</span>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {container ? (
          <OverviewTab container={container} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Loading...</div>
        )}
      </div>
    </div>
  );
};