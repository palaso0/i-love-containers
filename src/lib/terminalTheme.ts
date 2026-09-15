import { ITheme } from "@xterm/xterm";

export function getTerminalTheme(isDark: boolean): ITheme {
  if (isDark) {
    return {
      background: "#0d1117",
      foreground: "#e6edf3",
      cursor: "#38bdf8",
      cursorAccent: "#0d1117",
      selectionBackground: "rgba(56, 189, 248, 0.35)",
      selectionForeground: "#ffffff",
      selectionInactiveBackground: "rgba(56, 189, 248, 0.2)",
      black: "#484f58",
      red: "#ff7b72",
      green: "#3fb950",
      yellow: "#d29922",
      blue: "#58a6ff",
      magenta: "#bc8cff",
      cyan: "#39c5cf",
      white: "#b1bac4",
      brightBlack: "#6e7681",
      brightRed: "#ffa198",
      brightGreen: "#56d364",
      brightYellow: "#e3b341",
      brightBlue: "#79c0ff",
      brightMagenta: "#d2a8ff",
      brightCyan: "#56d4dd",
      brightWhite: "#ffffff",
    };
  }

  return {
    background: "#ffffff",
    foreground: "#0f172a",
    cursor: "#0284c7",
    cursorAccent: "#ffffff",
    selectionBackground: "#b4d5fe",
    selectionForeground: "#0f172a",
    selectionInactiveBackground: "#dbeafe",
    black: "#334155",
    red: "#dc2626",
    green: "#16a34a",
    yellow: "#ca8a04",
    blue: "#2563eb",
    magenta: "#9333ea",
    cyan: "#0284c7",
    white: "#f8fafc",
    brightBlack: "#64748b",
    brightRed: "#ef4444",
    brightGreen: "#22c55e",
    brightYellow: "#eab308",
    brightBlue: "#3b82f6",
    brightMagenta: "#a855f7",
    brightCyan: "#06b6d4",
    brightWhite: "#0f172a",
  };
}

export function formatTerminalPrompt(
  containerName: string,
  containerId: string,
  cwd: string = "/",
): string {
  const shortId = containerId.substring(0, 12);
  const host = containerName ? containerName : shortId;
  const displayCwd = cwd === "/" ? "/" : cwd.replace(/\/$/, "");

  return `\x1b[32m➜\x1b[0m \x1b[1;36mroot@${host}\x1b[0m \x1b[1;34m${displayCwd}\x1b[0m \x1b[1;35m❯\x1b[0m `;
}
