import React, { useState } from "react";
import { Layers, Trash2, Search, Check, Copy } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { formatBytes } from "@/lib/utils";
import { DockerImage } from "@/types";
import { DockerDisconnected } from "@/components/DockerDisconnected";

export const ImagesView: React.FC = () => {
  const { t, images, systemOverview, removeImage } = useAppStore();
  const isConnected = systemOverview?.dockerConnected ?? false;
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [imageToDelete, setImageToDelete] = useState<DockerImage | null>(null);

  if (!isConnected) {
    return <DockerDisconnected icon={Layers} />;
  }

  const filteredImages = images.filter(
    (image) =>
      image.repository.toLowerCase().includes(searchQuery.toLowerCase()) ||
      image.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      image.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-semibold text-foreground tracking-tight">{t.images.title}</h1>
            <span className="text-xs font-mono text-muted-foreground bg-surface-secondary/70 border border-border/60 px-2 py-0.5 rounded-full">
              {images.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.images.subtitle}
          </p>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.images.search}
            className="pl-8 pr-3 py-1 text-xs bg-surface border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 w-48 sm:w-56 transition-all shadow-xs"
          />
        </div>
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl overflow-hidden shadow-xs">
        <div className="grid grid-cols-12 px-4 py-2 border-b border-border/70 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 bg-surface-secondary/40 ">
          <div className="col-span-5 sm:col-span-4">{t.images.repoAndTag}</div>
          <div className="col-span-3">{t.images.imageId}</div>
          <div className="col-span-2">{t.images.size}</div>
          <div className="col-span-1 hidden sm:block">{t.images.status}</div>
          <div className="col-span-2 sm:col-span-2 text-right">{t.images.actions}</div>
        </div>

        <div className="divide-y divide-border/60 text-xs">
          {filteredImages.map((image) => (
            <div
              key={image.id}
              className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-surface-hover transition-colors group"
            >
              <div className="col-span-5 sm:col-span-4 flex items-center space-x-2.5 truncate pr-2">
                <Layers className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-foreground text-xs truncate block">
                    {image.repository}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground truncate block">
                    :{image.tag}
                  </span>
                </div>
              </div>

              <div className="col-span-3 text-2xs font-mono text-muted-foreground flex items-center space-x-1">
                <span className="truncate">{image.id.replace("sha256:", "").substring(0, 12)}</span>
                <button
                  onClick={() => handleCopyId(image.id)}
                  className="hover:text-foreground p-0.5 text-muted-foreground rounded hover:bg-surface-secondary transition-colors"
                  title="Copy full hash"
                >
                  {copiedId === image.id ? (
                    <Check className="w-3 h-3 text-status-running" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>

              <div className="col-span-2 text-2xs font-mono text-foreground font-medium">
                {formatBytes(image.size)}
              </div>

              <div className="col-span-1 hidden sm:block">
                {image.inUse ? (
                  <span className="text-[10px] text-status-running bg-status-running/10 px-2 py-0.5 rounded-full border border-status-running/20 font-medium">
                    {t.images.inUse}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground bg-surface-secondary/70 px-2 py-0.5 rounded-full border border-border/60">
                    {t.images.unused}
                  </span>
                )}
              </div>

              <div className="col-span-2 sm:col-span-2 flex items-center justify-end">
                <button
                  onClick={() => setImageToDelete(image)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                  title={t.images.deleteImage}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {imageToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-popover border border-popover-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl shadow-black/70 animate-in zoom-in-95 duration-100">
            <h3 className="text-sm font-semibold text-foreground">{t.images.removeTitle}</h3>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              {t.images.removeDesc}{" "}
              <span className="font-mono text-sky-500 font-medium">
                {imageToDelete.repository}:{imageToDelete.tag}
              </span>
              ?
            </p>
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                onClick={() => setImageToDelete(null)}
                className="px-3 py-1 rounded-md text-xs font-medium text-foreground bg-surface border border-border/80 hover:bg-surface-secondary transition-colors shadow-xs"
              >
                {t.images.cancel}
              </button>
              <button
                onClick={async () => {
                  await removeImage(imageToDelete.id);
                  setImageToDelete(null);
                }}
                className="px-3 py-1 rounded-md text-xs font-medium bg-status-danger hover:bg-status-danger/90 text-white shadow-xs transition-opacity"
              >
                {t.images.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};