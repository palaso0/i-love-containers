import React from "react";
import { useAppStore } from "@/stores/useAppStore";
import { Unplug } from "lucide-react";

interface DockerDisconnectedProps {
  icon?: React.ComponentType<{ className?: string }>;
}

export const DockerDisconnected: React.FC<DockerDisconnectedProps> = ({ icon: Icon = Unplug }) => {
  const { t } = useAppStore();

  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center p-8 bg-background select-none">
      <div className="flex flex-col items-center space-y-5 max-w-sm text-center">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-surface-secondary/80 border border-border/80 flex items-center justify-center shadow-sm">
          <Icon className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/70" />
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          {t.containers.disconnected}
        </h2>
      </div>
    </div>
  );
};