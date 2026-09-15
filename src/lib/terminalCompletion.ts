import { fetchContainerFiles, executeContainerCommand } from "@/lib/api";

const COMMON_COMMANDS = [
  "apt",
  "apt-get",
  "awk",
  "cat",
  "cd",
  "chmod",
  "chown",
  "clear",
  "cp",
  "curl",
  "df",
  "diff",
  "docker",
  "dpkg",
  "echo",
  "env",
  "exit",
  "export",
  "find",
  "git",
  "grep",
  "head",
  "history",
  "hostname",
  "id",
  "ip",
  "kill",
  "less",
  "ln",
  "ls",
  "man",
  "mkdir",
  "more",
  "mv",
  "nano",
  "netstat",
  "node",
  "npm",
  "pkill",
  "pnpm",
  "printenv",
  "ps",
  "pwd",
  "rm",
  "rmdir",
  "sed",
  "sh",
  "sleep",
  "source",
  "ssh",
  "stat",
  "sudo",
  "tail",
  "tar",
  "tee",
  "top",
  "touch",
  "uname",
  "vi",
  "vim",
  "wc",
  "wget",
  "which",
  "whoami",
  "yarn",
];

export interface CompletionCandidate {
  name: string;
  isDirectory?: boolean;
}

export interface CompletionResult {
  replacement?: string;
  newCursorPos?: number;
  candidates?: CompletionCandidate[];
}

export function findLongestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return "";
  if (strings.length === 1) return strings[0];

  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    const current = strings[i];
    let j = 0;
    while (
      j < prefix.length &&
      j < current.length &&
      prefix[j] === current[j]
    ) {
      j++;
    }
    prefix = prefix.slice(0, j);
    if (prefix === "") break;
  }
  return prefix;
}

export function formatCompletionCandidates(
  candidates: CompletionCandidate[],
  termCols: number = 80,
): string[] {
  if (candidates.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  const maxLen =
    Math.max(...sorted.map((c) => c.name.length + (c.isDirectory ? 1 : 0))) + 2;
  const colWidth = Math.max(maxLen, 12);
  const numCols = Math.max(1, Math.floor(termCols / colWidth));

  const lines: string[] = [];
  let currentLine = "";
  let colIndex = 0;

  for (const c of sorted) {
    const displayName = c.isDirectory ? `${c.name}/` : c.name;
    const colored = c.isDirectory
      ? `\x1b[1;36m${displayName}\x1b[0m${" ".repeat(Math.max(0, colWidth - displayName.length))}`
      : `${displayName}${" ".repeat(Math.max(0, colWidth - displayName.length))}`;

    currentLine += colored;
    colIndex++;

    if (colIndex >= numCols) {
      lines.push(currentLine.trimEnd());
      currentLine = "";
      colIndex = 0;
    }
  }

  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trimEnd());
  }

  return lines;
}

export async function resolveContainerCompletion(
  containerId: string,
  cwd: string,
  buffer: string,
  cursorPos: number,
): Promise<CompletionResult | null> {
  const textBeforeCursor = buffer.slice(0, cursorPos);
  const textAfterCursor = buffer.slice(cursorPos);

  const tokenMatch = textBeforeCursor.match(/(?:^|\s)([^\s]*)$/);
  if (!tokenMatch) return null;

  const currentToken = tokenMatch[1];
  const tokenStartIndex = textBeforeCursor.length - currentToken.length;

  const isFirstWord = !textBeforeCursor.slice(0, tokenStartIndex).trim();
  const hasSlash = currentToken.includes("/");

  let targetDir = cwd || "/";
  let prefix = currentToken;

  if (hasSlash) {
    const lastSlashIdx = currentToken.lastIndexOf("/");
    const dirPart = currentToken.slice(0, lastSlashIdx);
    prefix = currentToken.slice(lastSlashIdx + 1);

    if (currentToken.startsWith("/")) {
      targetDir = dirPart || "/";
    } else {
      const base = cwd.endsWith("/") ? cwd.slice(0, -1) : cwd;
      targetDir = dirPart ? `${base}/${dirPart}` : base || "/";
    }
  }

  let fileCandidates: CompletionCandidate[] = [];
  try {
    const res = await fetchContainerFiles(containerId, targetDir);
    if (res && Array.isArray(res.entries) && res.entries.length > 0) {
      fileCandidates = res.entries
        .filter(
          (e) => e.name.startsWith(prefix) && e.name !== "." && e.name !== "..",
        )
        .map((e) => ({
          name: e.name,
          isDirectory: e.isDirectory,
        }));
    }
  } catch {}

  if (fileCandidates.length === 0) {
    try {
      const safeDir = targetDir.replace(/'/g, "'\\''");
      const cmdRes = await executeContainerCommand(
        containerId,
        `ls -1pa '${safeDir}' 2>/dev/null`,
        undefined,
        undefined,
        cwd,
      );
      if (cmdRes.exitCode === 0 && cmdRes.output) {
        const rawNames = cmdRes.output
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        fileCandidates = rawNames
          .filter((raw) => {
            const clean = raw.endsWith("/") ? raw.slice(0, -1) : raw;
            return clean !== "." && clean !== ".." && clean.startsWith(prefix);
          })
          .map((raw) => ({
            name: raw.endsWith("/") ? raw.slice(0, -1) : raw,
            isDirectory: raw.endsWith("/"),
          }));
      }
    } catch {}
  }

  let commandCandidates: CompletionCandidate[] = [];
  if (isFirstWord && !hasSlash && prefix.length > 0) {
    commandCandidates = COMMON_COMMANDS.filter((cmd) =>
      cmd.startsWith(prefix),
    ).map((cmd) => ({ name: cmd, isDirectory: false }));
  }

  const candidateMap = new Map<string, CompletionCandidate>();
  for (const c of commandCandidates) {
    candidateMap.set(c.name, c);
  }
  for (const f of fileCandidates) {
    candidateMap.set(f.name, f);
  }

  const matches = Array.from(candidateMap.values());

  if (matches.length === 0) {
    return null;
  }

  const matchNames = matches.map((m) => m.name);

  if (matches.length === 1) {
    const match = matches[0];
    let completedToken = hasSlash
      ? currentToken.slice(0, currentToken.lastIndexOf("/") + 1) + match.name
      : match.name;

    if (match.isDirectory) {
      completedToken += "/";
    } else {
      completedToken += " ";
    }

    const newBuffer =
      buffer.slice(0, tokenStartIndex) + completedToken + textAfterCursor;
    const newCursorPos = tokenStartIndex + completedToken.length;

    return {
      replacement: newBuffer,
      newCursorPos,
      candidates: undefined,
    };
  }

  const lcp = findLongestCommonPrefix(matchNames);

  let newBuffer = buffer;
  let newCursorPos = cursorPos;

  if (lcp.length > prefix.length) {
    const completedToken = hasSlash
      ? currentToken.slice(0, currentToken.lastIndexOf("/") + 1) + lcp
      : lcp;
    newBuffer =
      buffer.slice(0, tokenStartIndex) + completedToken + textAfterCursor;
    newCursorPos = tokenStartIndex + completedToken.length;
  }

  return {
    replacement: newBuffer !== buffer ? newBuffer : undefined,
    newCursorPos: newBuffer !== buffer ? newCursorPos : undefined,
    candidates: matches,
  };
}
