import React, { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";
import { Terminal as TerminalIcon, Trash2, RefreshCw } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { ContainerNotRunning } from "@/components/ContainerNotRunning";
import { getOrCreateTerminalSession } from "@/lib/terminalSessionManager";

interface StandaloneTerminalWindowProps {
  containerId: string;
  containerName: string;
}

export const StandaloneTerminalWindow: React.FC<
  StandaloneTerminalWindowProps
> = ({ containerId, containerName }) => {
  const { theme, containers } = useAppStore();
  const isDark = theme === "dark";

  const currentContainer = containers.find((c) => c.id === containerId);
  const state = currentContainer?.state;
  const isRunning = !currentContainer || state === "running";

  const terminalElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRunning) return;
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

    const fitTimer = setTimeout(safeFit, 20);

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
  }, [containerId, containerName, isRunning, isDark]);

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
      className={`flex flex-col h-screen w-screen overflow-hidden ${
        isDark ? "bg-[#0d1117]" : "bg-white"
      }`}
    >
      <div className="h-9 px-3 bg-surface-secondary border-b border-border flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-2 text-2xs font-mono text-muted-foreground truncate min-w-0">
          <TerminalIcon className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate font-semibold text-foreground">
            {containerName}
          </span>
          <span className="text-muted-foreground">({containerId.substring(0, 12)})</span>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleReconnect}
            className="flex items-center space-x-1 px-2 py-0.5 text-2xs font-mono text-muted-foreground hover:text-foreground rounded bg-surface border border-border transition-colors cursor-pointer"
            title="Reconnect session"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>Reconnect</span>
          </button>
          <button
            onClick={handleClear}
            className="flex items-center space-x-1 px-2 py-0.5 text-2xs font-mono text-muted-foreground hover:text-foreground rounded bg-surface border border-border transition-colors cursor-pointer"
            title="Clear console"
          >
            <Trash2 className="w-2.5 h-2.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>
      <div
        ref={terminalElementRef}
        className="flex-1 p-2 min-h-0 select-text font-mono overflow-hidden"
      />
    </div>
  );
};
