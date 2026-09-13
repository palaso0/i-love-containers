import React, { useState, useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";
import { Terminal as TerminalIcon, Trash2 } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { ContainerNotRunning } from "@/components/ContainerNotRunning";
import { ContainerState } from "@/types";
import {
  getOrCreateTerminalSession,
  destroyTerminalSession,
} from "@/lib/terminalSessionManager";

interface TerminalTabProps {
  containerId: string;
  containerName: string;
  containerState?: ContainerState;
}

export const TerminalTab: React.FC<TerminalTabProps> = ({
  containerId,
  containerName,
  containerState,
}) => {
  const { theme, containers } = useAppStore();
  const isDark = theme === "dark";

  const currentContainer = containers.find((c) => c.id === containerId);
  const state = containerState ?? currentContainer?.state ?? "running";
  const isRunning = state === "running";

  const terminalElementRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (!isRunning) {
      destroyTerminalSession(containerId);
      return;
    }
    const containerEl = terminalElementRef.current;
    if (!containerEl) return;

    const session = getOrCreateTerminalSession(containerId, containerName, isDark);

    if (session.wrapperEl.parentElement !== containerEl) {
      containerEl.appendChild(session.wrapperEl);
    }

    const fitTimer = setTimeout(() => {
      try {
        session.fitAddon.fit();
      } catch {}
    }, 10);

    const handleContextMenu = (e: MouseEvent) => {
      const selection = session.term.getSelection();
      if (selection) {
        e.preventDefault();
        navigator.clipboard.writeText(selection);
      }
    };
    containerEl.addEventListener("contextmenu", handleContextMenu);

    const handleResize = () => {
      try {
        session.fitAddon.fit();
      } catch {}
    };
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(fitTimer);
      containerEl.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("resize", handleResize);
      if (session.wrapperEl.parentElement === containerEl) {
        session.wrapperEl.remove();
      }
    };
  }, [containerId, containerName, isRunning, isDark]);

  const handleClear = () => {
    const session = getOrCreateTerminalSession(containerId, containerName, isDark);
    session.controller.clear();
  };

  useEffect(() => {
    if (!rootRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsCompact(entry.contentRect.width < 460);
        try {
          const session = getOrCreateTerminalSession(containerId, containerName, isDark);
          session.fitAddon.fit();
        } catch {}
      }
    });
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, [containerId, containerName, isDark]);

  if (!isRunning) {
    return (
      <ContainerNotRunning
        state={state}
        containerName={containerName}
        featureName="terminal"
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className={`flex flex-col h-full min-h-0 border border-border rounded-lg overflow-hidden shadow-inner ${
        isDark ? "bg-[#0d1117]" : "bg-white"
      }`}
    >
      <div className="h-9 px-3 bg-surface-secondary border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2 text-2xs font-mono text-muted-foreground truncate min-w-0">
          <TerminalIcon className="w-3 h-3 text-primary shrink-0" />
          <span className="truncate">{isCompact ? "PTY" : "Interactive PTY (Docker Exec)"}</span>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
          <button
            onClick={handleClear}
            className="flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 text-2xs font-mono text-muted-foreground hover:text-foreground rounded bg-surface border border-border transition-colors cursor-pointer"
            title="Clear console"
          >
            <Trash2 className="w-2.5 h-2.5" />
            {!isCompact && <span>Clear</span>}
          </button>
        </div>
      </div>
      <div ref={terminalElementRef} className="flex-1 p-2 min-h-0 select-text font-mono overflow-hidden" />
    </div>
  );
};