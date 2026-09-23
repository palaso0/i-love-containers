import React, { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";
import { Trash2, RefreshCw } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { ContainerNotRunning } from "@/components/ContainerNotRunning";
import { ContainerState } from "@/types";
import { getOrCreateTerminalSession } from "@/lib/terminalSessionManager";

interface TerminalTabProps {
  containerId: string;
  containerName: string;
  containerState?: ContainerState;
  isActive?: boolean;
}

export const TerminalTab: React.FC<TerminalTabProps> = ({
  containerId,
  containerName,
  containerState,
  isActive = true,
}) => {
  const { theme, containers } = useAppStore();
  const isDark = theme === "dark";

  const currentContainer = containers.find((c) => c.id === containerId);
  const state = containerState ?? currentContainer?.state;
  const isRunning = !currentContainer || state === "running";

  const terminalElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRunning || !isActive) return;
    const containerEl = terminalElementRef.current;
    if (!containerEl) return;

    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );

    if (session.wrapperEl.parentElement !== containerEl) {
      containerEl.innerHTML = "";
      containerEl.appendChild(session.wrapperEl);
    }

    const safeFit = () => {
      if (
        !containerEl ||
        containerEl.clientWidth < 100 ||
        containerEl.clientHeight < 50
      ) {
        return;
      }
      try {
        session.fitAddon.fit();
        if (session.term.cols < 30) {
          session.term.resize(80, 24);
        }
      } catch {}
    };

    const fitTimer = setTimeout(safeFit, 25);

    const handleContextMenu = (e: MouseEvent) => {
      const selection = session.term.getSelection();
      if (selection) {
        e.preventDefault();
        navigator.clipboard.writeText(selection);
      }
    };
    containerEl.addEventListener("contextmenu", handleContextMenu);

    const handleResize = () => {
      safeFit();
    };
    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(safeFit);
    });
    resizeObserver.observe(containerEl);

    return () => {
      clearTimeout(fitTimer);
      containerEl.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [containerId, containerName, isRunning, isDark, isActive]);

  useEffect(() => {
    if (!isActive || !isRunning) return;
    const containerEl = terminalElementRef.current;
    if (!containerEl) return;
    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );
    if (session.wrapperEl.parentElement !== containerEl) {
      containerEl.innerHTML = "";
      containerEl.appendChild(session.wrapperEl);
    }
    if (!session.ws || session.ws.readyState >= WebSocket.CLOSING) {
      session.reconnect();
    }
    const timer = setTimeout(() => {
      try {
        if (containerEl.clientWidth >= 100 && containerEl.clientHeight >= 50) {
          session.fitAddon.fit();
        }
        session.term.focus();
      } catch {}
    }, 40);
    return () => clearTimeout(timer);
  }, [isActive, isRunning, containerId, containerName, isDark]);

  const handleClear = () => {
    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );
    session.clear();
  };

  const handleReconnect = () => {
    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );
    session.reconnect(true);
  };

  if (!isRunning && state) {
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
      className={`group relative flex flex-col h-full w-full min-h-0 border border-border rounded-lg overflow-hidden shadow-inner ${
        isDark ? "bg-[#0d1117]" : "bg-white"
      }`}
    >
      <div className="absolute top-2 right-2 z-10 flex items-center space-x-1 opacity-40 group-hover:opacity-100 transition-opacity bg-surface/90 backdrop-blur-xs px-1.5 py-0.5 rounded-md border border-border/80 shadow-xs">
        <button
          onClick={handleReconnect}
          className="flex items-center space-x-1 px-1.5 py-0.5 text-2xs font-mono text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
          title="Reconnect session"
        >
          <RefreshCw className="w-2.5 h-2.5" />
          <span>Reconnect</span>
        </button>
        <button
          onClick={handleClear}
          className="flex items-center space-x-1 px-1.5 py-0.5 text-2xs font-mono text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
          title="Clear console"
        >
          <Trash2 className="w-2.5 h-2.5" />
          <span>Clear</span>
        </button>
      </div>
      <div
        ref={terminalElementRef}
        className="w-full h-full min-h-0 p-2 select-text font-mono overflow-hidden"
      />
    </div>
  );
};
