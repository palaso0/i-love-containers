import React, { useState, useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Terminal as TerminalIcon, Trash2 } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { executeContainerCommand } from "@/lib/api";
import { getTerminalTheme, formatTerminalPrompt } from "@/lib/terminalTheme";
import { setupTerminalInput, TerminalController } from "@/lib/terminalInput";
import { resolveContainerCompletion } from "@/lib/terminalCompletion";

interface TerminalTabProps {
  containerId: string;
  containerName: string;
}

export const TerminalTab: React.FC<TerminalTabProps> = ({
  containerId,
  containerName,
}) => {
  const { theme } = useAppStore();
  const isDark = theme === "dark";

  const terminalElementRef = useRef<HTMLDivElement>(null);
  const xtermInstanceRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentCwdRef = useRef<string>("/");
  const controllerRef = useRef<TerminalController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (!terminalElementRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "SF Mono, JetBrains Mono, Menlo, Monaco, Consolas, monospace",
      fontSize: 12.5,
      lineHeight: 1.25,
      rightClickSelectsWord: true,
      theme: getTerminalTheme(isDark),
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalElementRef.current);
    try {
      fitAddon.fit();
    } catch {}

    xtermInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln(
      `\x1b[1;38;5;205m♥\x1b[0m \x1b[1mI ♥ Containers\x1b[0m \x1b[90m—\x1b[0m \x1b[1;36m${containerName}\x1b[0m \x1b[90m(${containerId.substring(0, 12)})\x1b[0m \x1b[90m•\x1b[0m \x1b[32m● Connected\x1b[0m`
    );
    term.writeln("");

    // Initialize real container working directory
    executeContainerCommand(containerId, "pwd").then((res) => {
      if (res.exitCode === 0 && res.output) {
        const lines = res.output.trim().split(/\r?\n/);
        const lastLine = lines[lines.length - 1].trim();
        if (lastLine.startsWith("/")) {
          currentCwdRef.current = lastLine;
          controllerRef.current?.redraw();
        }
      }
    }).catch(() => {});

    const controller = setupTerminalInput({
      term,
      getPrompt: () => formatTerminalPrompt(containerName, containerId, currentCwdRef.current),
      onExecute: async (command) => {
        const isCd = command === "cd" || command.startsWith("cd ");
        if (isCd) {
          try {
            const cdCmd = `${command} && pwd`;
            const res = await executeContainerCommand(
              containerId,
              cdCmd,
              term.cols,
              term.rows,
              currentCwdRef.current
            );
            if (res.exitCode === 0 && res.output) {
              const lines = res.output.trim().split(/\r?\n/);
              const lastLine = lines[lines.length - 1].trim();
              if (lastLine.startsWith("/")) {
                currentCwdRef.current = lastLine;
              }
            } else if (res.output) {
              term.writeln(res.output.replace(/\r?\n/g, "\r\n"));
            }
          } catch (err: any) {
            term.writeln(`\x1b[31merror: ${err.message}\x1b[0m`);
          }
        } else {
          try {
            const res = await executeContainerCommand(
              containerId,
              command,
              term.cols,
              term.rows,
              currentCwdRef.current
            );
            if (res.output) {
              const formattedOutput = res.output.replace(/\r?\n/g, "\r\n");
              term.write(formattedOutput);
              if (!formattedOutput.endsWith("\r\n")) {
                term.writeln("");
              }
            }
          } catch (err: any) {
            term.writeln(`\x1b[31merror: ${err.message}\x1b[0m`);
          }
        }
      },
      onComplete: async (buf, pos) => {
        return resolveContainerCompletion(containerId, currentCwdRef.current, buf, pos);
      },
    });

    controllerRef.current = controller;
    controller.redraw();

    const termEl = terminalElementRef.current;
    const handleContextMenu = (e: MouseEvent) => {
      const selection = term.getSelection();
      if (selection) {
        e.preventDefault();
        navigator.clipboard.writeText(selection);
      }
    };
    termEl?.addEventListener("contextmenu", handleContextMenu);

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {}
    };

    window.addEventListener("resize", handleResize);

    return () => {
      controller.dispose();
      termEl?.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("resize", handleResize);
      term.dispose();
    };
  }, [containerId, containerName, isDark]);

  const handleClear = () => {
    controllerRef.current?.clear();
  };

  useEffect(() => {
    if (!rootRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsCompact(entry.contentRect.width < 460);
        try {
          fitAddonRef.current?.fit();
        } catch {}
      }
    });
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className={`flex flex-col h-full min-h-0 border border-border rounded-lg overflow-hidden shadow-inner ${
        isDark ? "bg-[#0d1117]" : "bg-white"
      }`}
    >
      <div className="h-9 px-3 bg-surface-secondary border-b border-border flex items-center justify-between">
        <div className="flex items-center space-x-2 text-2xs font-mono text-muted-foreground truncate min-w-0">
          <TerminalIcon className="w-3 h-3 text-primary shrink-0" />
          <span className="truncate">{isCompact ? "PTY" : "Interactive PTY (Docker Exec)"}</span>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
          <button
            onClick={handleClear}
            className="flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 text-2xs font-mono text-muted-foreground hover:text-foreground rounded bg-surface border border-border transition-colors"
            title="Clear console"
          >
            <Trash2 className="w-2.5 h-2.5" />
            {!isCompact && <span>Clear</span>}
          </button>
        </div>
      </div>
      <div ref={terminalElementRef} className="flex-1 p-2 min-h-0 select-text font-mono" />
    </div>
  );
};