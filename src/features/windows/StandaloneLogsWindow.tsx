import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Search,
  Play,
  Pause,
  ArrowDown,
  Clock,
  Trash2,
  Copy,
  Check,
  Download,
  Filter,
} from "lucide-react";

import { useAppStore } from "@/stores/useAppStore";
import * as api from "@/lib/api";

interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  color: string;
  message: string;
}

interface StandaloneLogsWindowProps {
  containerId?: string;
  containerName?: string;
  composeProject?: string;
}

export const StandaloneLogsWindow: React.FC<StandaloneLogsWindowProps> = ({
  containerId,
  containerName,
  composeProject,
}) => {
  const { theme } = useAppStore();
  const isDark = theme === "dark";

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [clearedAt, setClearedAt] = useState<number>(0);
  const clearedAtRef = useRef<number>(0);
  clearedAtRef.current = clearedAt;
  const [searchQuery, setSearchQuery] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const availableServices = Array.from(new Set(logs.map((l) => l.source)));

  useEffect(() => {
    let isMounted = true;

    const fetchRealLogs = async () => {
      if (isPaused) return;

      try {
        if (composeProject) {
          const containers = await api.fetchContainers();
          const projectContainers = containers.filter(
            (c) => c.composeProject === composeProject,
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
                  timestamp: displayTimestamp || new Date().toISOString().substring(0, 19).replace("T", " "),
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
          if (isMounted) {
            const cutoff = clearedAtRef.current;
            const filtered = cutoff > 0
              ? combined.filter((l) => l.timestampMs > cutoff)
              : combined;
            setLogs(filtered.slice(-1000));
          }
        } else if (containerId) {
          const rawLogs = await api.fetchContainerLogs(containerId);
          if (!isMounted) return;

          const serviceName = containerName || "container";
          const color = isDark ? "#38bdf8" : "#0284c7";

          const parsed = rawLogs.map((line) => {
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
              id: `${containerId}-${rawTimestamp}-${line.substring(0, 40)}`,
              timestamp: displayTimestamp || new Date().toISOString().substring(0, 19).replace("T", " "),
              timestampMs,
              source: serviceName,
              color,
              message,
            };
          });

          if (isMounted) {
            const cutoff = clearedAtRef.current;
            const filtered = cutoff > 0
              ? parsed.filter((l) => l.timestampMs > cutoff)
              : parsed;
            setLogs(filtered.slice(-1000));
          }
        }
      } catch (err) {
        console.error("Failed to load logs:", err);
      }
    };

    fetchRealLogs();
    const interval = setInterval(fetchRealLogs, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [containerId, containerName, composeProject, isPaused, isDark]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current?.parentElement) {
      logsEndRef.current.parentElement.scrollTop =
        logsEndRef.current.parentElement.scrollHeight;
    }
  }, [logs.length, autoScroll]);

  const handleCopyLogs = () => {
    const text = logs
      .map(
        (l) =>
          `${showTimestamps ? l.timestamp + " " : ""}[${l.source}] ${l.message}`,
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const text = logs
      .map((l) => `${l.timestamp} [${l.source}] ${l.message}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(composeProject || containerName || "logs").toLowerCase()}-stream.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleServiceFilter = (name: string) => {
    setActiveFilters((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  };

  const filteredLogs = logs.filter((l) => {
    if (activeFilters.length > 0 && !activeFilters.includes(l.source))
      return false;
    if (searchQuery.trim() === "") return true;
    return (
      l.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.source.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden ${
        isDark ? "bg-[#090b10] text-slate-200" : "bg-background text-slate-800"
      }`}
    >
      <div
        data-tauri-drag-region
        className="h-10 px-4 bg-surface border-b border-border flex items-center justify-between font-mono text-2xs shrink-0 gap-3"
      >
        <div className="flex items-center space-x-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-status-running shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          <FileText className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-bold text-foreground">
            {composeProject
              ? `${composeProject} (All Services)`
              : containerName}
          </span>
          {containerId && (
            <span className="text-muted-foreground hidden sm:inline">
              ({containerId.substring(0, 12)})
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 flex-1 justify-end">
          <div className="relative max-w-xs w-full">
            <Search className="w-3 h-3 text-muted-foreground absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search log stream..."
              className="w-full pl-7 pr-2.5 py-1 text-2xs bg-surface-secondary border border-border rounded text-foreground focus:outline-none font-mono"
            />
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded border transition-colors ${
              isPaused
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500 font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {isPaused ? (
              <Play className="w-3 h-3 fill-current" />
            ) : (
              <Pause className="w-3 h-3 fill-current" />
            )}
            <span>{isPaused ? "Resume" : "Pause"}</span>
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded border transition-colors ${
              autoScroll
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowDown className="w-3 h-3" />
            <span>Auto-scroll</span>
          </button>

          <button
            onClick={() => setShowTimestamps(!showTimestamps)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded border transition-colors ${
              showTimestamps
                ? "bg-surface-secondary border-border text-foreground font-semibold"
                : "bg-surface border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Time</span>
          </button>

          <button
            onClick={() => {
              const now = Date.now();
              clearedAtRef.current = now;
              setClearedAt(now);
              setLogs([]);
            }}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface-secondary"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface-secondary"
            title="Copy logs"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-status-running" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface-secondary"
            title="Download log file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {availableServices.length > 1 && (
        <div className="px-4 py-1.5 bg-surface/60 border-b border-border flex items-center space-x-2 font-mono text-2xs shrink-0 overflow-x-auto">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground mr-1">Services:</span>
          {availableServices.map((name) => {
            const active =
              activeFilters.length === 0 || activeFilters.includes(name);
            return (
              <button
                key={name}
                onClick={() => toggleServiceFilter(name)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  active
                    ? "bg-surface-secondary text-foreground font-semibold border border-border"
                    : "text-muted-foreground opacity-50 hover:opacity-100 hover:bg-surface-secondary"
                }`}
              >
                {active ? "● " : "○ "}
                {name}
              </button>
            );
          })}
        </div>
      )}

      <div
        className={`flex-1 overflow-y-auto p-4 select-text font-mono text-2xs leading-relaxed space-y-0.5 min-h-0 ${
          isDark ? "bg-[#090b10] text-slate-200" : "bg-[#f8fafc] text-slate-800"
        }`}
      >
        {filteredLogs.length === 0 ? (
          <div
            className={`h-full flex items-center justify-center  ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            No log entries found
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`flex items-start px-1 py-0.5 rounded font-mono ${
                isDark ? "hover:bg-white/5" : "hover:bg-slate-200/70"
              }`}
            >
              {showTimestamps && (
                <span
                  className={`mr-2.5  shrink-0 font-mono ${
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
                className={`break-all whitespace-pre-wrap ${
                  isDark ? "text-slate-200" : "text-slate-800"
                }`}
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
