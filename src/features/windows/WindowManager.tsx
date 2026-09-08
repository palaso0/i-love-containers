import React, { useState, useRef, useEffect } from "react";
import {
  Terminal,
  FileText,
  LayoutGrid,
  Minus,
  X,
  Plus,
  ChevronDown,
  FolderGit2,
} from "lucide-react";
import { useWindowManagerStore } from "@/stores/useWindowManagerStore";
import { useAppStore } from "@/stores/useAppStore";
import { FloatingWindowItem } from "./FloatingWindowItem";

export const WindowManager: React.FC = () => {
  const {
    windows,
    focusWindow,
    restoreWindow,
    tileWindows,
    minimizeAllWindows,
    closeAllWindows,
    openTerminalWindow,
    openLogsWindow,
    openStackLogsWindow,
  } = useWindowManagerStore();

  const { containers, composeProjects } = useAppStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (windows.length === 0) {
    return null;
  }

  const activeCount = windows.filter((w) => !w.isMinimized).length;

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {windows.map((w) => (
        <FloatingWindowItem key={w.id} windowData={w} />
      ))}

      <div className="fixed bottom-3 right-4 pointer-events-auto flex items-center space-x-2 bg-surface/90 backdrop-blur-md border border-border rounded-xl px-2.5 py-1.5 shadow-2xl z-50 select-none font-mono text-2xs animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center space-x-1 border-r border-border pr-2">
          {windows.map((w) => {
            const Icon = w.type === "terminal" ? Terminal : FileText;
            return (
              <button
                key={w.id}
                onClick={() => {
                  if (w.isMinimized) {
                    restoreWindow(w.id);
                  } else {
                    focusWindow(w.id);
                  }
                }}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded-md transition-colors border ${
                  w.isMinimized
                    ? "bg-surface-secondary text-muted-foreground border-border hover:text-foreground opacity-60"
                    : "bg-surface text-foreground font-semibold border-primary/40 shadow-xs"
                }`}
                title={`Focus ${w.title}`}
              >
                <Icon className={`w-3 h-3 ${w.type === "terminal" ? "text-primary" : "text-sky-400"}`} />
                <span className="truncate max-w-[100px]">{w.containerName || w.title}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    w.isMinimized ? "bg-amber-500" : "bg-status-running"
                  }`}
                />
              </button>
            );
          })}

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1 rounded bg-surface hover:bg-surface-hover border border-border text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-0.5"
              title="Open another window"
            >
              <Plus className="w-3 h-3" />
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {isMenuOpen && (
              <div className="absolute bottom-9 right-0 w-64 bg-surface border border-border rounded-lg shadow-2xl p-1 z-50">
                <div className="px-2 py-1 text-[10px] text-muted-foreground font-bold uppercase tracking-wider border-b border-border">
                  Launch Shell Window
                </div>
                <div className="max-h-36 overflow-y-auto py-1">
                  {containers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        openTerminalWindow(c.id, c.name);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 flex items-center justify-between hover:bg-surface-hover rounded text-foreground transition-colors"
                    >
                      <div className="flex items-center space-x-1.5 truncate">
                        <Terminal className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{c.state}</span>
                    </button>
                  ))}
                </div>

                <div className="px-2 py-1 text-[10px] text-muted-foreground font-bold uppercase tracking-wider border-t border-b border-border mt-1">
                  Launch Log Window
                </div>
                <div className="max-h-32 overflow-y-auto py-1">
                  {containers.map((c) => (
                    <button
                      key={`l-${c.id}`}
                      onClick={() => {
                        openLogsWindow(c.id, c.name);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 flex items-center space-x-1.5 hover:bg-surface-hover rounded text-foreground transition-colors"
                    >
                      <FileText className="w-3 h-3 text-sky-400 shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>

                <div className="px-2 py-1 text-[10px] text-muted-foreground font-bold uppercase tracking-wider border-t border-b border-border mt-1">
                  Unified Stack Logs
                </div>
                <div className="max-h-24 overflow-y-auto py-1">
                  {composeProjects.map((p) => {
                    const services = containers
                      .filter((c) => c.composeProject === p.name)
                      .map((c) => ({ id: c.id, name: c.composeService || c.name }));
                    return (
                      <button
                        key={p.name}
                        onClick={() => {
                          openStackLogsWindow(p.name, services);
                          setIsMenuOpen(false);
                        }}
                        className="w-full text-left px-2 py-1 flex items-center space-x-1.5 hover:bg-surface-hover rounded text-foreground transition-colors"
                      >
                        <FolderGit2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {activeCount > 1 && (
            <button
              onClick={tileWindows}
              className="flex items-center space-x-1 px-2 py-1 rounded bg-surface hover:bg-surface-hover border border-border text-muted-foreground hover:text-foreground transition-colors"
              title="Tile windows automatically in grid layout"
            >
              <LayoutGrid className="w-3 h-3 text-primary" />
              <span>Tile ({activeCount})</span>
            </button>
          )}

          <button
            onClick={minimizeAllWindows}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            title="Minimize all windows"
          >
            <Minus className="w-3 h-3" />
          </button>

          <button
            onClick={closeAllWindows}
            className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-surface transition-colors"
            title="Close all floating windows"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};