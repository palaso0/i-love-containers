import React from "react";
import { HardDrive } from "lucide-react";
import { ComposeVolumeNode } from "@/lib/composeParser";

interface VolumeNodeItemProps {
  vol: ComposeVolumeNode;
  pos: { x: number; y: number };
  onMouseDown: (e: React.MouseEvent) => void;
}

export const VolumeNodeItem: React.FC<VolumeNodeItemProps> = ({
  vol,
  pos,
  onMouseDown,
}) => {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        left: pos.x,
        top: pos.y,
      }}
      className="absolute bg-surface/80 backdrop-blur-md border border-sky-500/30 rounded-lg px-2.5 py-1.5 flex items-center space-x-2 text-xs font-mono shadow-xs canvas-interactive cursor-grab active:cursor-grabbing "
    >
      <div className="w-5 h-5 rounded-md bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
        <HardDrive className="w-3 h-3" />
      </div>
      <div>
        <div className="font-semibold text-foreground text-[11px]">{vol.name}</div>
        <div className="text-[9px] text-muted-foreground">driver: {vol.driver}</div>
      </div>
    </div>
  );
};
