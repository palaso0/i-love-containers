import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { executeContainerCommand } from "@/lib/api";
import { getTerminalTheme, formatTerminalPrompt } from "@/lib/terminalTheme";
import { setupTerminalInput, TerminalController } from "@/lib/terminalInput";
import { resolveContainerCompletion } from "@/lib/terminalCompletion";

export interface TerminalSession {
  containerId: string;
  containerName: string;
  term: XTerm;
  fitAddon: FitAddon;
  controller: TerminalController;
  wrapperEl: HTMLDivElement;
  currentCwd: { current: string };
  isDark: boolean;
}

const sessions = new Map<string, TerminalSession>();

export function getOrCreateTerminalSession(
  containerId: string,
  containerName: string,
  isDark: boolean
): TerminalSession {
  const existing = sessions.get(containerId);
  if (existing) {
    if (existing.isDark !== isDark) {
      existing.isDark = isDark;
      existing.term.options.theme = getTerminalTheme(isDark);
    }
    existing.containerName = containerName;
    if (existing.term.cols < 25) {
      try {
        existing.term.resize(80, 24);
        existing.controller.clear();
      } catch {}
    }
    return existing;
  }

  const wrapperEl = document.createElement("div");
  wrapperEl.className = "w-full h-full min-h-0 select-text font-mono";
  wrapperEl.style.height = "100%";
  wrapperEl.style.width = "100%";

  const term = new XTerm({
    cursorBlink: true,
    fontFamily: "SF Mono, JetBrains Mono, Menlo, Monaco, Consolas, monospace",
    fontSize: 12.5,
    lineHeight: 1.25,
    rightClickSelectsWord: true,
    theme: getTerminalTheme(isDark),
    convertEol: true,
    cols: 80,
    rows: 24,
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  term.open(wrapperEl);

  const currentCwd = { current: "/" };

  term.writeln(
    `\x1b[1;38;5;205m♥\x1b[0m \x1b[1mI ♥ Containers\x1b[0m \x1b[90m—\x1b[0m \x1b[1;36m${containerName}\x1b[0m \x1b[90m(${containerId.substring(0, 12)})\x1b[0m \x1b[90m•\x1b[0m \x1b[32m● Connected\x1b[0m`
  );
  term.writeln("");

  executeContainerCommand(containerId, "pwd")
    .then((res) => {
      if (res.exitCode === 0 && res.output) {
        const lines = res.output.trim().split(/\r?\n/);
        const lastLine = lines[lines.length - 1].trim();
        if (lastLine.startsWith("/")) {
          currentCwd.current = lastLine;
          if (controller.getBuffer() === "") {
            controller.redraw();
          }
        }
      }
    })
    .catch(() => {});

  const controller = setupTerminalInput({
    term,
    getPrompt: () => formatTerminalPrompt(containerName, containerId, currentCwd.current),
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
            currentCwd.current
          );
          if (res.exitCode === 0 && res.output) {
            const lines = res.output.trim().split(/\r?\n/);
            const lastLine = lines[lines.length - 1].trim();
            if (lastLine.startsWith("/")) {
              currentCwd.current = lastLine;
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
            currentCwd.current
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
      return resolveContainerCompletion(containerId, currentCwd.current, buf, pos);
    },
  });

  controller.redraw();

  const session: TerminalSession = {
    containerId,
    containerName,
    term,
    fitAddon,
    controller,
    wrapperEl,
    currentCwd,
    isDark,
  };

  sessions.set(containerId, session);
  return session;
}

export function destroyTerminalSession(containerId: string): void {
  const session = sessions.get(containerId);
  if (!session) return;

  try {
    session.controller.dispose();
    session.term.dispose();
    session.wrapperEl.remove();
  } catch {}

  sessions.delete(containerId);
}

export function clearAllTerminalSessions(): void {
  for (const containerId of sessions.keys()) {
    destroyTerminalSession(containerId);
  }
}
