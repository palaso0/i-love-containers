import React from "react";
import { ContainerDetail } from "@/types";
import { Copy, Check, Layers } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";

interface OverviewTabProps {
  container: ContainerDetail;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ container }) => {
  const { images, setActiveTab, setSelectedImageId } = useAppStore();
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleGoToImage = () => {
    const targetImg = images.find(
      (img) =>
        img.id === container.imageId ||
        `${img.repository}:${img.tag}` === container.image ||
        img.repository === container.image.split(":")[0]
    );
    setActiveTab("images");
    if (targetImg) {
      setSelectedImageId(targetImg.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 shadow-xs">
        <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider mb-3">
          Configuration & Metadata
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-surface-secondary/50 p-2.5 rounded-lg border border-border/60">
            <span className="text-muted-foreground block text-[11px] font-sans font-medium uppercase">Container ID</span>
            <div className="flex items-center justify-between mt-1 text-foreground">
              <span className="truncate text-xs">{container.id}</span>
              <button
                onClick={() => copyToClipboard(container.id, "id")}
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface transition-colors ml-2"
              >
                {copiedKey === "id" ? <Check className="w-3.5 h-3.5 text-status-running" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="bg-surface-secondary/50 p-2.5 rounded-lg border border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground block text-[11px] font-sans font-medium uppercase">Image Hash</span>
              <button
                onClick={handleGoToImage}
                className="text-primary hover:underline text-[11px] font-sans font-medium flex items-center space-x-1"
                title="Inspeccionar imagen y capas"
              >
                <Layers className="w-3 h-3 text-sky-400" />
                <span>Ver imagen</span>
              </button>
            </div>
            <div className="flex items-center justify-between mt-1 text-foreground">
              <span className="truncate text-xs">{container.imageId}</span>
              <button
                onClick={() => copyToClipboard(container.imageId, "image")}
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface transition-colors ml-2"
              >
                {copiedKey === "image" ? <Check className="w-3.5 h-3.5 text-status-running" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="bg-surface-secondary/50 p-2.5 rounded-lg border border-border/60">
            <span className="text-muted-foreground block text-[11px] font-sans font-medium uppercase">Uptime / Status</span>
            <span className="text-foreground text-xs block mt-1">{container.status}</span>
          </div>

          <div className="bg-surface-secondary/50 p-2.5 rounded-lg border border-border/60">
            <span className="text-muted-foreground block text-[11px] font-sans font-medium uppercase">Restart Policy</span>
            <span className="text-foreground text-xs block mt-1">{container.restartPolicy || "no"}</span>
          </div>

          <div className="bg-surface-secondary/50 p-2.5 rounded-lg border border-border/60 md:col-span-2">
            <span className="text-muted-foreground block text-[11px] font-sans font-medium uppercase">Entrypoint Command</span>
            <span className="text-foreground text-xs block mt-1 truncate">
              {container.command || "default"}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 shadow-xs">
        <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider mb-3">
          Port Bindings
        </h3>
        {Array.isArray(container.ports) && container.ports.length > 0 ? (
          <div className="divide-y divide-border/60">
            {container.ports.map((port, index) => (
              <div key={index} className="py-2.5 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-md bg-surface-secondary border border-border/70 text-foreground font-semibold text-2xs">
                    {port.type.toUpperCase()}
                  </span>
                  <span className="text-foreground">{port.privatePort}</span>
                </div>
                <div className="text-muted-foreground">
                  {port.publicPort ? (
                    <span className="text-status-running font-semibold">
                      {port.ip || "0.0.0.0"}:{port.publicPort}
                    </span>
                  ) : (
                    "Internal"
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No mapped host ports</div>
        )}
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 shadow-xs">
        <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider mb-3">
          Volume & Bind Mounts
        </h3>
        {Array.isArray(container.mounts) && container.mounts.length > 0 ? (
          <div className="space-y-2">
            {container.mounts.map((mount, index) => (
              <div key={index} className="bg-surface-secondary/50 p-2.5 rounded-lg border border-border/60 text-xs font-mono">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="font-semibold text-foreground uppercase text-2xs">{mount.type}</span>
                  <span className="text-2xs">{mount.rw ? "Read/Write" : "Read-only"}</span>
                </div>
                <div className="text-muted-foreground truncate">
                  SRC: <span className="text-foreground">{mount.source}</span>
                </div>
                <div className="text-muted-foreground truncate">
                  DST: <span className="text-foreground">{mount.destination}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No mounts attached</div>
        )}
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 shadow-xs">
        <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider mb-3">
          Environment Variables
        </h3>
        {container.env && container.env.length > 0 ? (
          <div className="bg-surface-secondary/50 rounded-lg border border-border/60 p-3 max-h-52 overflow-y-auto space-y-1 font-mono text-xs">
            {container.env.map((variable, index) => {
              const [key, ...values] = variable.split("=");
              return (
                <div key={index} className="flex items-start">
                  <span className="text-primary font-medium shrink-0 mr-1.5">{key}=</span>
                  <span className="text-muted-foreground truncate">{values.join("=")}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No custom variables configured</div>
        )}
      </div>
    </div>
  );
};