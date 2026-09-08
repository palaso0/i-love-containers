import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  Trash2,
  Copy,
  Download,
  Search,
  Check,
  Clock,
  ArrowDown,
  WrapText,
} from "lucide-react";
import * as api from "@/lib/api";
import { useAppStore } from "@/stores/useAppStore";

interface LogsTabProps {
  containerId: string;
}

export const LogsTab: React.FC<LogsTabProps> = ({ containerId }) => {
  const { theme } = useAppStore();
  const isDark = theme === "dark";
  const [logs, setLogs] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [wrapLines, setWrapLines] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchLogs = async () => {
      if (isPaused) return;
      try {
        const realLogs = await api.fetchContainerLogs(containerId);
        if (isMounted && Array.isArray(realLogs)) {
          setLogs(realLogs);
        }
      } catch (err) {
        console.error("Failed to fetch container logs:", err);
      }
    };

    fetchLogs();
    const streamInterval = setInterval(fetchLogs, 2500);

    return () => {
      isMounted = false;
      clearInterval(streamInterval);
    };
  }, [containerId, isPaused]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 30;
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
  };

  const handleCopyLogs = () => {
    const safeLogs = Array.isArray(logs) ? logs : [];
    navigator.clipboard.writeText(safeLogs.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownloadLogs = () => {
    const safeLogs = Array.isArray(logs) ? logs : [];
    const blob = new Blob([safeLogs.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `container-${containerId}-logs.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const safeLogs = Array.isArray(logs) ? logs : [];
  const filteredLogs = safeLogs.filter((log) =>
    typeof log === "string" && log.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className={`flex flex-col h-full border border-border rounded-lg overflow-hidden shadow-inner min-h-0 ${
        isDark ? "bg-[#090b10] text-slate-200" : "bg-white text-slate-800"
      }`}
    >
      <div className="h-10 px-3 bg-surface border-b border-border flex items-center justify-between gap-2 select-none text-xs shrink-0">
        <div className="relative flex-1 max-w-xs min-w-[90px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find..."
            className="w-full pl-8 pr-2.5 py-1 text-2xs bg-surface-secondary border border-border rounded text-foreground focus:outline-none font-mono placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? "Resume" : "Pause"}
            className={`p-1.5 rounded border transition-colors ${
              isPaused
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            {isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
          </button>

          <button
            onClick={() => {
              const next = !autoScroll;
              setAutoScroll(next);
              if (next && containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
              }
            }}
            title={autoScroll ? "Auto-scroll: ON" : "Auto-scroll: OFF"}
            className={`p-1.5 rounded border transition-colors ${
              autoScroll
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <ArrowDown className="w-3 h-3" />
          </button>

          <button
            onClick={() => setShowTimestamps(!showTimestamps)}
            title={showTimestamps ? "Timestamps: ON" : "Timestamps: OFF"}
            className={`p-1.5 rounded border transition-colors ${
              showTimestamps
                ? "bg-surface-secondary border-border text-foreground font-semibold"
                : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <Clock className="w-3 h-3" />
          </button>

          <button
            onClick={() => setWrapLines(!wrapLines)}
            title={wrapLines ? "Word wrap: ON (click to scroll horizontally)" : "Word wrap: OFF (horizontal scroll enabled)"}
            className={`p-1.5 rounded border transition-colors ${
              wrapLines
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <WrapText className="w-3 h-3" />
          </button>

          <div className="h-4 w-[1px] bg-border mx-0.5" />

          <button
            onClick={() => setLogs([])}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title="Copy logs"
          >
            {copied ? <Check className="w-3 h-3 text-status-running" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            onClick={handleDownloadLogs}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title="Download logs"
          >
            <Download className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto overflow-x-auto p-3 font-mono text-2xs select-text leading-relaxed space-y-0.5 min-h-0 visible-scrollbar ${
          isDark ? "bg-[#090b10] text-slate-200" : "bg-[#f8fafc] text-slate-800"
        }`}
      >
        {filteredLogs.length === 0 ? (
          <div
            className={`h-full flex items-center justify-center select-none ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            No log entries match criteria
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const parts = log.split(" ");
            const timestamp = parts.slice(0, 2).join(" ");
            const message = showTimestamps ? log : parts.slice(2).join(" ");

            return (
              <div
                key={index}
                className={`flex items-start px-1 py-0.5 rounded ${
                  wrapLines ? "w-full" : "w-max min-w-full"
                } ${isDark ? "hover:bg-white/[0.06]" : "hover:bg-slate-200/70"}`}
              >
                {showTimestamps && (
                  <span
                    className={`mr-2.5 select-none shrink-0 font-mono ${
                      isDark ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    {timestamp}
                  </span>
                )}
                <span
                  className={`${
                    wrapLines ? "break-all whitespace-pre-wrap flex-1 min-w-0" : "whitespace-pre shrink-0"
                  } ${isDark ? "text-slate-200" : "text-slate-800"}`}
                >
                  {showTimestamps ? parts.slice(2).join(" ") : message}
                </span>
              </div>
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};