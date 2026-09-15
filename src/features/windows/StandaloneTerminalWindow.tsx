import React, { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Terminal as TerminalIcon, Trash2 } from "lucide-react";
import { executeContainerCommand } from "@/lib/api";
import { useAppStore } from "@/stores/useAppStore";
import { getTerminalTheme, formatTerminalPrompt } from "@/lib/terminalTheme";
import { setupTerminalInput, TerminalController } from "@/lib/terminalInput";
import { resolveContainerCompletion } from "@/lib/terminalCompletion";
import { ContainerNotRunning } from "@/components/ContainerNotRunning";

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
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentCwdRef = useRef<string>("/");
  const controllerRef = useRef<TerminalController | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    if (!terminalElementRef.current) return;
    if (xtermRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "SF Mono, JetBrains Mono, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
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

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln(
      `\x1b[1;38;5;205m♥\x1b[0m \x1b[1mI ♥ Containers\x1b[0m \x1b[90m—\x1b[0m \x1b[1;36m${containerName}\x1b[0m \x1b[90m(${containerId.substring(0, 12)})\x1b[0m \x1b[90m•\x1b[0m \x1b[32m● Connected\x1b[0m`,
    );
    term.writeln("");

    executeContainerCommand(containerId, "pwd")
      .then((res) => {
        if (res.exitCode === 0 && res.output) {
          const lines = res.output.trim().split(/\r?\n/);
          const lastLine = lines[lines.length - 1].trim();
          if (lastLine.startsWith("/")) {
            currentCwdRef.current = lastLine;
            controllerRef.current?.redraw();
          }
        }
      })
      .catch(() => {});

    const controller = setupTerminalInput({
      term,
      getPrompt: () =>
        formatTerminalPrompt(containerName, containerId, currentCwdRef.current),
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
              currentCwdRef.current,
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
              currentCwdRef.current,
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
        return resolveContainerCompletion(
          containerId,
          currentCwdRef.current,
          buf,
          pos,
        );
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

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch {}
      });
    });

    if (termEl) {
      resizeObserver.observe(termEl);
    }

    setTimeout(handleResize, 50);

    return () => {
      controller.dispose();
      termEl?.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
    };
  }, [containerId, containerName, isDark]);

  const handleClear = () => {
    controllerRef.current?.clear();
  };

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden ${
        isDark ? "bg-[#0d1117] text-slate-200" : "bg-white text-slate-800"
      }`}
    >
      <div
        data-tauri-drag-region
        className="h-10 px-4 bg-surface border-b border-border flex items-center justify-between font-mono text-2xs shrink-0"
      >
        <div className="flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isRunning
                ? "bg-status-running shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                : state === "paused"
                  ? "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]"
                  : "bg-muted-foreground/60"
            }`}
          />
          <TerminalIcon className="w-3.5 h-3.5 text-primary" />
          <span className="font-bold text-foreground">{containerName}</span>
          <span className="text-muted-foreground">
            ({containerId.substring(0, 12)})
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleClear}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-surface-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
            title="Clear console"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 select-text overflow-hidden font-mono flex flex-col min-h-0">
        {!isRunning ? (
          <ContainerNotRunning
            state={state}
            containerName={containerName}
            featureName="terminal"
          />
        ) : (
          <div ref={terminalElementRef} className="w-full h-full" />
        )}
      </div>
    </div>
  );
};
