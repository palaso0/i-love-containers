import React, { useState, useEffect, useRef } from "react";
import {
  Trash2,
  Download,
  Search,
  Clock,
  ChevronsDown,
  Filter,
  WrapText,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  WorkspaceSession,
  useWorkspaceStore,
} from "@/stores/useWorkspaceStore";
import { useAppStore } from "@/stores/useAppStore";
import * as api from "@/lib/api";

interface UnifiedLogsViewerProps {
  session: WorkspaceSession;
  isActive: boolean;
}

export const UnifiedLogsViewer: React.FC<UnifiedLogsViewerProps> = ({
  session,
  isActive,
}) => {
  const { theme, language } = useAppStore();
  const isDark = theme === "dark";
  const isEs = language === "es";

  const {
    appendLog,
    clearSessionLogs,
    toggleSessionAutoScroll,
    toggleSessionTimestamps,
    toggleServiceFilter,
  } = useWorkspaceStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [fontSize, setFontSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("ilc_logs_font_size");
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 8 && parsed <= 30) return parsed;
      }
    } catch {}
    return 11;
  });
  const [wrapLines, setWrapLines] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => {
    setFontSize((prev) => {
      const next = Math.min(26, prev + 1);
      try {
        localStorage.setItem("ilc_logs_font_size", String(next));
      } catch {}
      return next;
    });
  };

  const handleZoomOut = () => {
    setFontSize((prev) => {
      const next = Math.max(9, prev - 1);
      try {
        localStorage.setItem("ilc_logs_font_size", String(next));
      } catch {}
      return next;
    });
  };

  const handleResetZoom = () => {
    setFontSize(11);
    try {
      localStorage.setItem("ilc_logs_font_size", "11");
    } catch {}
  };

  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === "0") {
          e.preventDefault();
          handleResetZoom();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive]);

  const logs = session.logs || [];
  const autoScroll = session.autoScroll ?? true;
  const showTimestamps = session.showTimestamps ?? true;
  const activeFilters = session.activeServiceFilters || [];

  const availableServices = Array.from(new Set(logs.map((l) => l.source)));

  useEffect(() => {
    if (!isActive) return;
    let isMounted = true;

    const fetchRealLogs = async () => {
      try {
        if (session.composeProject) {
          const containers = await api.fetchContainers();
          const projectContainers = containers.filter(
            (c) => c.composeProject === session.composeProject,
          );
          if (projectContainers.length === 0) return;

          const colorPaletteDark = [
            "#38bdf8",
            "#a78bfa",
            "#34d399",
            "#f472b6",
            "#fbbf24",
            "#fb7185",
          ];
          const colorPaletteLight = [
            "#0284c7",
            "#7c3aed",
            "#059669",
            "#db2777",
            "#d97706",
            "#e11d48",
          ];

          const logsByContainer = await Promise.all(
            projectContainers.map(async (c, idx) => {
              const rawLogs = await api.fetchContainerLogs(c.id);
              const serviceName = c.composeService || c.name;
              const color = isDark
                ? colorPaletteDark[idx % colorPaletteDark.length]
                : colorPaletteLight[idx % colorPaletteLight.length];

              return rawLogs.map((line) => {
                const firstSpace = line.indexOf(" ");
                const firstToken = firstSpace > 0 ? line.slice(0, firstSpace) : line;
                const hasTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(firstToken);
                const rawTimestamp = hasTimestamp ? firstToken : "";
                const displayTimestamp = hasTimestamp
                  ? rawTimestamp.substring(0, 19).replace("T", " ")
                  : "";
                const message = hasTimestamp ? line.slice(firstSpace + 1) : line;
                const timestampMs = hasTimestamp ? new Date(rawTimestamp).getTime() : 0;

                return {
                  id: `${c.id}-${rawTimestamp}-${line.substring(0, 40)}`,
                  timestamp:
                    displayTimestamp ||
                    new Date().toISOString().substring(0, 19).replace("T", " "),
                  timestampMs,
                  source: serviceName,
                  color,
                  message,
                };
              });
            }),
          );

          const combined = logsByContainer
            .flat()
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          if (isMounted && combined.length > 0) {
            combined
              .slice(-100)
              .forEach((entry) => appendLog(session.id, entry));
          }
        } else if (session.containerId) {
          const rawLogs = await api.fetchContainerLogs(session.containerId);
          if (!isMounted) return;

          const serviceName = session.containerName || "container";
          const color = isDark ? "#38bdf8" : "#0284c7";

          rawLogs.slice(-100).forEach((line) => {
            const firstSpace = line.indexOf(" ");
            const firstToken = firstSpace > 0 ? line.slice(0, firstSpace) : line;
            const hasTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(firstToken);
            const rawTimestamp = hasTimestamp ? firstToken : "";
            const displayTimestamp = hasTimestamp
              ? rawTimestamp.substring(0, 19).replace("T", " ")
              : "";
            const message = hasTimestamp ? line.slice(firstSpace + 1) : line;
            const timestampMs = hasTimestamp ? new Date(rawTimestamp).getTime() : 0;

            appendLog(session.id, {
              id: `${session.containerId}-${rawTimestamp}-${line.substring(0, 40)}`,
              timestamp:
                displayTimestamp ||
                new Date().toISOString().substring(0, 19).replace("T", " "),
              timestampMs,
              source: serviceName,
              color,
              message,
            });
          });
        }
      } catch (err) {
        console.error("Failed to fetch logs in dock:", err);
      }
    };

    fetchRealLogs();
    const interval = setInterval(fetchRealLogs, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [
    session.id,
    session.containerId,
    session.containerName,
    session.composeProject,
    isActive,
    isDark,
    appendLog,
  ]);

  useEffect(() => {
    if (autoScroll && isActive && logsEndRef.current?.parentElement) {
      logsEndRef.current.parentElement.scrollTop =
        logsEndRef.current.parentElement.scrollHeight;
    }
  }, [logs.length, autoScroll, isActive]);

  const handleDownload = () => {
    const text = logs
      .map((l) => `${l.timestamp} [${l.source}] ${l.message}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${session.title.toLowerCase().replace(/\s+/g, "-")}-logs.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((l) => {
    if (activeFilters.length > 0 && !activeFilters.includes(l.source)) {
      return false;
    }
    if (searchQuery.trim() === "") return true;
    const query = searchQuery.toLowerCase();
    return (
      l.message.toLowerCase().includes(query) ||
      l.source.toLowerCase().includes(query)
    );
  });

  return (
    <div
      className={`w-full h-full flex flex-col select-text ${
        isDark ? "bg-[#090b10] text-slate-200" : "bg-[#f8fafc] text-slate-800"
      }`}
      style={{ display: isActive ? "flex" : "none" }}
    >
      <div className="h-9 px-3 bg-surface border-b border-border flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3 h-3 text-muted-foreground absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEs ? "Buscar en registros..." : "Search in log stream..."}
              className="w-full pl-7 pr-2.5 py-1 text-2xs bg-surface-secondary border border-border rounded text-foreground focus:outline-none font-mono"
            />
          </div>

          <button
            onClick={() => toggleSessionAutoScroll(session.id)}
            title={
              isEs
                ? autoScroll
                  ? "Seguir registros (Auto-scroll): ACTIVADO"
                  : "Seguir registros (Auto-scroll): DESACTIVADO"
                : autoScroll
                  ? "Follow logs (Auto-scroll): ON"
                  : "Follow logs (Auto-scroll): OFF"
            }
            className={`p-1 rounded border transition-colors ${
              autoScroll
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <ChevronsDown className="w-2.5 h-2.5" />
          </button>

          <button
            onClick={() => toggleSessionTimestamps(session.id)}
            title={
              isEs
                ? showTimestamps
                  ? "Hora / Marcas de tiempo: ACTIVADO"
                  : "Hora / Marcas de tiempo: DESACTIVADO"
                : showTimestamps
                  ? "Time / Timestamps: ON"
                  : "Time / Timestamps: OFF"
            }
            className={`p-1 rounded border transition-colors ${
              showTimestamps
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-2.5 h-2.5" />
          </button>

          <button
            onClick={() => setWrapLines(!wrapLines)}
            title={
              isEs
                ? wrapLines
                  ? "Ajuste de línea: ACTIVADO (clic para activar desplazamiento horizontal)"
                  : "Ajuste de línea: DESACTIVADO (desplazamiento horizontal activo)"
                : wrapLines
                  ? "Word wrap: ON (click to scroll horizontally)"
                  : "Word wrap: OFF (horizontal scroll enabled)"
            }
            className={`p-1.5 rounded border transition-colors ${
              wrapLines
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <WrapText className="w-2.5 h-2.5" />
          </button>

          <div className="h-4 w-[1px] bg-border mx-0.5" />

          <button
            onClick={handleZoomOut}
            className="p-1 rounded border border-border bg-surface-secondary text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Alejar (⌘-)" : "Zoom out (⌘-)"}
          >
            <ZoomOut className="w-2.5 h-2.5" />
          </button>

          <button
            onClick={handleResetZoom}
            className="px-1.5 py-0.5 text-2xs font-mono rounded border border-border bg-surface-secondary text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Restablecer zoom (⌘0)" : "Reset zoom (⌘0)"}
          >
            {Math.round((fontSize / 11) * 100)}%
          </button>

          <button
            onClick={handleZoomIn}
            className="p-1 rounded border border-border bg-surface-secondary text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Acercar (⌘+)" : "Zoom in (⌘+)"}
          >
            <ZoomIn className="w-2.5 h-2.5" />
          </button>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => clearSessionLogs(session.id)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Limpiar registros" : "Clear logs"}
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Descargar registros" : "Download logs"}
          >
            <Download className="w-3 h-3" />
          </button>
        </div>
      </div>

      {availableServices.length > 1 && (
        <div className="px-3 py-1.5 bg-surface/50 border-b border-border flex items-center space-x-2  overflow-x-auto text-2xs font-mono shrink-0">
          <div className="flex items-center space-x-1 text-muted-foreground">
            <Filter className="w-2.5 h-2.5" />
            <span>{isEs ? "Filtrar:" : "Filter:"}</span>
          </div>
          {availableServices.map((serviceName) => {
            const isSelected = activeFilters.includes(serviceName);
            return (
              <button
                key={serviceName}
                onClick={() => toggleServiceFilter(session.id, serviceName)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  isSelected
                    ? "bg-surface-secondary text-foreground font-semibold border border-border"
                    : "text-muted-foreground opacity-50 hover:opacity-100 hover:bg-surface-secondary"
                }`}
              >
                {isSelected ? "● " : "○ "}
                {serviceName}
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={scrollContainerRef}
        style={{ fontSize: `${fontSize}px` }}
        className="flex-1 overflow-y-auto overflow-x-auto p-3 font-mono select-text leading-relaxed space-y-0.5 min-h-0 visible-scrollbar"
      >
        {filteredLogs.length === 0 ? (
          <div
            className={`h-full flex items-center justify-center  ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            {isEs ? "No se encontraron registros" : "No log entries found"}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`flex items-start px-1 py-0.2 rounded font-mono ${
                wrapLines ? "w-full" : "w-max min-w-full"
              } ${isDark ? "hover:bg-white/5" : "hover:bg-slate-200/70"}`}
            >
              {showTimestamps && (
                <span
                  className={`mr-2 shrink-0 ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {log.timestamp}
                </span>
              )}
              <span
                className="font-semibold mr-2 shrink-0 "
                style={{ color: log.color }}
              >
                [{log.source}]
              </span>
              <span
                className={`${
                  wrapLines
                    ? "break-all whitespace-pre-wrap flex-1 min-w-0"
                    : "whitespace-pre shrink-0"
                } ${isDark ? "text-slate-200" : "text-slate-800"}`}
              >
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
