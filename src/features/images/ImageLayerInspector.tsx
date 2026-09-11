import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ArrowLeft,
  Layers,
  File,
  Folder,
  Copy,
  Check,
  Search,
  AlertTriangle,
  HardDrive,
  FileCode,
  Filter,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { formatBytes } from "@/lib/utils";
import { ImageAnalysis, ImageLayerDetail, LayerFileChangeType } from "@/types";
import { fetchImageAnalysis } from "@/lib/api";

interface ImageLayerInspectorProps {
  imageId: string;
  onBack: () => void;
}

function formatDockerCommand(cmd: string): { instruction: string; rest: string; tokens: string[] } {
  const trimmed = cmd.trim();
  const match = trimmed.match(/^([A-Z]+)\s+([\s\S]*)$/);
  if (!match) {
    return { instruction: "CMD", rest: trimmed, tokens: [trimmed] };
  }
  const instruction = match[1];
  const rest = match[2];

  const parts = rest
    .split(/(\s*&&\s*|\s*;\s*|\s*\|\|\s*)/g)
    .filter(Boolean)
    .map((p) => p.trim())
    .filter(Boolean);

  return { instruction, rest, tokens: parts };
}

export const ImageLayerInspector: React.FC<ImageLayerInspectorProps> = ({
  imageId,
  onBack,
}) => {
  const { t, images } = useAppStore();
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(1);
  const [activeRightTab, setActiveRightTab] = useState<"command" | "files">("command");
  const [fileSearch, setFileSearch] = useState("");
  const [changeTypeFilter, setChangeTypeFilter] = useState<"all" | LayerFileChangeType>("all");
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const splitViewRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [leftWidth, setLeftWidth] = useState(() => {
    try {
      const saved = localStorage.getItem("ilc_image_layers_split_width");
      const parsed = saved ? parseInt(saved, 10) : 420;
      return parsed <= 260 ? 420 : Math.max(260, Math.min(750, parsed));
    } catch {
      return 420;
    }
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !splitViewRef.current) return;
      const rect = splitViewRef.current.getBoundingClientRect();
      const maxW = Math.max(280, rect.width - 280);
      const newWidth = Math.max(260, Math.min(maxW, ev.clientX - rect.left));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = (ev: MouseEvent) => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (splitViewRef.current) {
        const rect = splitViewRef.current.getBoundingClientRect();
        const maxW = Math.max(280, rect.width - 280);
        const finalWidth = Math.max(260, Math.min(maxW, ev.clientX - rect.left));
        try {
          localStorage.setItem("ilc_image_layers_split_width", String(finalWidth));
        } catch {}
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const currentImage = useMemo(() => {
    return images.find((img) => img.id === imageId);
  }, [images, imageId]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchImageAnalysis(imageId)
      .then((data) => {
        if (!isMounted) return;
        setAnalysis(data);
        if (data && data.layers.length > 0) {
          const firstNonEmpty = data.layers.find((l) => !l.emptyLayer);
          setSelectedLayerIndex(firstNonEmpty ? firstNonEmpty.index : data.layers[0].index);
        }
      })
      .catch(() => {
        if (isMounted) setAnalysis(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [imageId]);

  const selectedLayer: ImageLayerDetail | undefined = useMemo(() => {
    if (!analysis) return undefined;
    return analysis.layers.find((l) => l.index === selectedLayerIndex) || analysis.layers[0];
  }, [analysis, selectedLayerIndex]);

  const displayTotalSize = currentImage?.size && currentImage.size > 0
    ? currentImage.size
    : (analysis?.totalSize ?? 0);

  const filteredFiles = useMemo(() => {
    if (!selectedLayer || !selectedLayer.files) return [];
    return selectedLayer.files.filter((file) => {
      const matchesSearch = file.path.toLowerCase().includes(fileSearch.toLowerCase());
      const matchesType = changeTypeFilter === "all" || file.changeType === changeTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [selectedLayer, fileSearch, changeTypeFilter]);

  const handleCopyCmd = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 1500);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const getInstructionBadge = (inst: string) => {
    switch (inst) {
      case "FROM":
        return "bg-purple-500/15 text-purple-400 border-purple-500/30";
      case "RUN":
        return "bg-sky-500/15 text-sky-400 border-sky-500/30";
      case "COPY":
      case "ADD":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "ENV":
      case "WORKDIR":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      case "EXPOSE":
      case "CMD":
      case "ENTRYPOINT":
        return "bg-rose-500/15 text-rose-400 border-rose-500/30";
      default:
        return "bg-surface-secondary text-muted-foreground border-border/70";
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3 bg-background">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground font-mono">
          Analyzing image layers & filesystem diffs...
        </p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4 bg-background">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm font-medium text-foreground">Could not load image analysis</p>
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-xs rounded-lg bg-surface border border-border/80 text-foreground hover:bg-surface-secondary transition-colors"
        >
          {t.images.backToList}
        </button>
      </div>
    );
  }

  const repo = currentImage ? currentImage.repository : analysis.repository;
  const tag = currentImage ? currentImage.tag : analysis.tag;

  const parsedCommand = selectedLayer ? formatDockerCommand(selectedLayer.command) : null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      <div className="p-3.5 sm:p-4 border-b border-border/70 bg-surface/60 backdrop-blur-md space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg bg-surface border border-border/70 text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors shrink-0"
              title={t.images.backToList}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-1 min-w-0">
                <span className="text-sm font-semibold text-foreground tracking-tight font-mono truncate">
                  {repo}:{tag}
                </span>
                <span className="text-2xs font-mono text-muted-foreground bg-surface-secondary/80 border border-border/60 px-2 py-0.5 rounded-md flex items-center space-x-1 shrink-0">
                  <span>{analysis.imageId.replace("sha256:", "").substring(0, 12)}</span>
                  <button
                    onClick={() => handleCopyId(analysis.imageId)}
                    className="hover:text-foreground p-0.5"
                    title="Copy full hash"
                  >
                    {copiedId ? (
                      <Check className="w-2.5 h-2.5 text-status-running" />
                    ) : (
                      <Copy className="w-2.5 h-2.5" />
                    )}
                  </button>
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {analysis.architecture || "arm64"}/{analysis.os || "linux"} • {analysis.layerCount} {t.images.layersTab.toLowerCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0 flex-wrap">
            <div className="px-3 py-1.5 bg-surface border border-border/70 rounded-xl shadow-2xs flex items-center space-x-2.5">
              <HardDrive className="w-4 h-4 text-primary shrink-0" />
              <div>
                <span className="text-2xs uppercase tracking-wider text-muted-foreground block font-semibold">
                  {t.images.totalSize}
                </span>
                <span className="text-xs font-mono font-semibold text-foreground">
                  {formatBytes(displayTotalSize)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div ref={splitViewRef} className="flex-1 flex min-h-0 overflow-hidden relative">
        <div
          style={{ width: `${leftWidth}px` }}
          className="shrink-0 flex flex-col min-h-0 bg-surface/30 border-r border-border/70"
        >
          <div className="px-4 py-2.5 border-b border-border/70 flex items-center justify-between text-xs text-muted-foreground bg-surface-secondary/40 font-medium shrink-0">
            <div className="flex items-center space-x-2">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>{t.images.layersTab} ({analysis.layers.length})</span>
            </div>
            <span className="text-2xs font-mono text-muted-foreground/80">
              base (#1) → top
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {analysis.layers.map((layer) => {
              const isSelected = layer.index === selectedLayerIndex;

              return (
                <div
                  key={layer.id + layer.index}
                  onClick={() => setSelectedLayerIndex(layer.index)}
                  className={`p-3 transition-colors cursor-pointer group ${
                    isSelected
                      ? "bg-primary/10 border-l-2 border-primary"
                      : "hover:bg-surface-hover/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className={`text-2xs font-mono shrink-0 w-5 font-medium ${isSelected ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        #{layer.index}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase font-bold shrink-0 ${getInstructionBadge(
                          layer.instructionType
                        )}`}
                      >
                        {layer.instructionType}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-2xs font-mono font-medium ${
                          layer.emptyLayer ? "text-muted-foreground/60" : "text-foreground font-semibold"
                        }`}
                      >
                        {layer.emptyLayer ? "0 B" : formatBytes(layer.size)}
                      </span>
                      {layer.size > 0 && displayTotalSize > 0 && (
                        <span className="text-[10px] font-mono text-muted-foreground block">
                          {(Math.min(100, (layer.size / displayTotalSize) * 100)).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-1.5">
                    <p
                      className="text-xs font-mono text-foreground/90 truncate leading-relaxed group-hover:text-foreground"
                    >
                      {layer.command}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          onMouseDown={handleMouseDown}
          className="w-1.5 hover:w-2 -mx-0.5 cursor-col-resize group relative flex items-center justify-center shrink-0 z-20 transition-all hover:bg-primary/40 active:bg-primary"
          title="Arrastra para redimensionar paneles"
        >
          <div className="w-[1px] h-8 rounded-full bg-border group-hover:bg-primary/80 group-active:bg-primary transition-colors" />
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden min-w-0">
          <div className="px-4 py-2 border-b border-border/70 flex items-center justify-between bg-surface/50 shrink-0 flex-wrap gap-2">
            <div className="flex items-center space-x-1 bg-surface-secondary/70 p-0.5 rounded-lg border border-border/60 text-xs">
              <button
                onClick={() => setActiveRightTab("command")}
                className={`px-3 py-1 rounded-md transition-all font-medium flex items-center space-x-1.5 ${
                  activeRightTab === "command"
                    ? "bg-surface text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-primary" />
                <span>{t.images.commandTab}</span>
              </button>

              <button
                onClick={() => setActiveRightTab("files")}
                className={`px-3 py-1 rounded-md transition-all font-medium flex items-center space-x-1.5 ${
                  activeRightTab === "files"
                    ? "bg-surface text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>{t.images.filesTab}</span>
                {selectedLayer?.files && (
                  <span className="text-[10px] font-mono px-1 rounded bg-surface-secondary text-muted-foreground">
                    {selectedLayer.files.length}
                  </span>
                )}
              </button>
            </div>

            {selectedLayer && (
              <span className="text-2xs font-mono text-muted-foreground">
                {t.images.layerIndex.replace("#{index}", `#${selectedLayer.index}`)} • {selectedLayer.emptyLayer ? "0 B" : formatBytes(selectedLayer.size)}
              </span>
            )}
          </div>

          {activeRightTab === "command" && selectedLayer && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 text-2xs font-mono font-bold rounded border uppercase ${getInstructionBadge(selectedLayer.instructionType)}`}>
                      {selectedLayer.instructionType}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Dockerfile Instruction
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyCmd(selectedLayer.command)}
                    className="px-2.5 py-1 text-2xs rounded-lg bg-surface border border-border/70 text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-1.5 shadow-2xs"
                  >
                    {copiedCmd ? (
                      <>
                        <Check className="w-3 h-3 text-status-running" />
                        <span>{t.images.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{t.images.copyCommand}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 bg-surface-secondary/70 border border-border/70 rounded-xl font-mono text-xs text-foreground shadow-inner space-y-2">
                  <div className="flex items-center space-x-2 pb-2 border-b border-border/40 text-2xs text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60 inline-block" />
                    <span className="ml-2 font-medium">Dockerfile / sh execution</span>
                  </div>

                  {parsedCommand && parsedCommand.tokens.length > 1 ? (
                    <div className="space-y-1.5 pt-1 overflow-x-auto">
                      <div className="pb-1">
                        <span className={`px-2 py-0.5 rounded text-2xs font-mono font-bold uppercase tracking-wider border ${getInstructionBadge(selectedLayer.instructionType)}`}>
                          {selectedLayer.instructionType}
                        </span>
                      </div>
                      {parsedCommand.tokens.map((token, i) => {
                        const isOperator = token === "&&" || token === "||" || token === ";";
                        if (isOperator) {
                          return (
                            <span key={i} className="text-amber-400 font-bold px-1 inline-block">
                              {token}
                            </span>
                          );
                        }
                        return (
                          <div key={i} className="pl-3 py-0.5 border-l-2 border-primary/40 hover:border-primary transition-colors text-foreground/95 break-all">
                            {token}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pt-1 flex items-start space-x-2 select-all break-all whitespace-pre-wrap leading-relaxed">
                      {parsedCommand ? (
                        <>
                          <span className={`px-2 py-0.5 rounded text-2xs font-mono font-bold uppercase tracking-wider shrink-0 border ${getInstructionBadge(parsedCommand.instruction)}`}>
                            {parsedCommand.instruction}
                          </span>
                          <span className="text-foreground/95 pt-0.5">
                            {parsedCommand.rest}
                          </span>
                        </>
                      ) : (
                        <span className="text-foreground/95">
                          {selectedLayer.command}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                <div className="p-3 bg-surface border border-border/70 rounded-xl space-y-1 shadow-2xs">
                  <span className="text-2xs uppercase tracking-wider text-muted-foreground block font-semibold">
                    Layer Digest / ID
                  </span>
                  <span className="font-mono text-2xs text-foreground break-all block select-all">
                    {selectedLayer.id}
                  </span>
                </div>

                <div className="p-3 bg-surface border border-border/70 rounded-xl space-y-1 shadow-2xs">
                  <span className="text-2xs uppercase tracking-wider text-muted-foreground block font-semibold">
                    Created Timestamp
                  </span>
                  <span className="font-mono text-2xs text-foreground block">
                    {new Date(selectedLayer.created).toLocaleString()}
                  </span>
                </div>

                <div className="p-3 bg-surface border border-border/70 rounded-xl space-y-1 shadow-2xs">
                  <span className="text-2xs uppercase tracking-wider text-muted-foreground block font-semibold">
                    Size In Bytes
                  </span>
                  <span className="font-mono text-2xs text-foreground block">
                    {formatBytes(selectedLayer.size)} ({selectedLayer.size.toLocaleString()} bytes)
                  </span>
                </div>

                <div className="p-3 bg-surface border border-border/70 rounded-xl space-y-1 shadow-2xs">
                  <span className="text-2xs uppercase tracking-wider text-muted-foreground block font-semibold">
                    Percentage of Image
                  </span>
                  <span className="font-mono text-2xs text-foreground block">
                    {selectedLayer.size > 0 && displayTotalSize > 0
                      ? `${(Math.min(100, (selectedLayer.size / displayTotalSize) * 100)).toFixed(1)}%`
                      : "0%"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeRightTab === "files" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-3 border-b border-border/70 flex items-center justify-between gap-2 bg-surface/20 shrink-0 flex-wrap">
                <div className="relative flex-1 max-w-xs min-w-[180px]">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    placeholder={t.images.searchFiles}
                    className="w-full pl-8 pr-3 py-1 text-xs bg-surface border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 shadow-2xs font-mono"
                  />
                </div>

                <div className="flex items-center space-x-1 bg-surface-secondary/70 p-0.5 rounded-lg border border-border/60 text-2xs">
                  <button
                    onClick={() => setChangeTypeFilter("all")}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      changeTypeFilter === "all"
                        ? "bg-surface text-foreground font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.images.allChanges}
                  </button>
                  <button
                    onClick={() => setChangeTypeFilter("added")}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      changeTypeFilter === "added"
                        ? "bg-status-running/15 text-status-running font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    + {t.images.added}
                  </button>
                  <button
                    onClick={() => setChangeTypeFilter("modified")}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      changeTypeFilter === "modified"
                        ? "bg-amber-500/15 text-amber-500 font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ~ {t.images.modified}
                  </button>
                  <button
                    onClick={() => setChangeTypeFilter("deleted")}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      changeTypeFilter === "deleted"
                        ? "bg-status-danger/15 text-status-danger font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    - {t.images.deleted}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 divide-y divide-border/40 font-mono text-xs">
                {filteredFiles.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
                    <Filter className="w-6 h-6 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">
                      {t.images.noFiles}
                    </p>
                  </div>
                ) : (
                  filteredFiles.map((file, idx) => (
                    <div
                      key={file.path + idx}
                      className="py-1.5 px-2 flex items-center justify-between hover:bg-surface-hover rounded transition-colors group"
                    >
                      <div className="flex items-center space-x-2 min-w-0 truncate pr-2">
                        <span
                          className={`text-2xs font-bold px-1 rounded shrink-0 ${
                            file.changeType === "added"
                              ? "text-status-running bg-status-running/10"
                            : file.changeType === "modified"
                            ? "text-amber-500 bg-amber-500/10"
                            : "text-status-danger bg-status-danger/10"
                          }`}
                        >
                          {file.changeType === "added" ? "+" : file.changeType === "modified" ? "~" : "-"}
                        </span>
                        {file.type === "dir" ? (
                          <Folder className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        ) : (
                          <File className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate text-foreground text-xs select-all">
                          {file.path}
                        </span>
                      </div>

                      <span className="text-2xs text-muted-foreground shrink-0 font-medium">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
