import { Terminal as XTerm } from "@xterm/xterm";
import { formatCompletionCandidates, CompletionResult } from "@/lib/terminalCompletion";

export function getPrevWordIndex(buffer: string, cursorPos: number): number {
  if (cursorPos <= 0) return 0;
  let idx = cursorPos - 1;

  while (idx > 0 && buffer[idx] === " ") {
    idx--;
  }

  while (idx > 0 && buffer[idx - 1] !== " ") {
    idx--;
  }
  return idx;
}

export function getNextWordIndex(buffer: string, cursorPos: number): number {
  if (cursorPos >= buffer.length) return buffer.length;
  let idx = cursorPos;

  while (idx < buffer.length && buffer[idx] !== " ") {
    idx++;
  }

  while (idx < buffer.length && buffer[idx] === " ") {
    idx++;
  }
  return idx;
}

export interface TerminalControllerOptions {
  term: XTerm;
  getPrompt: () => string;
  onExecute: (command: string) => Promise<void>;
  onComplete?: (buffer: string, cursorPos: number) => Promise<CompletionResult | null>;
  initialHistory?: string[];
}

export interface TerminalController {
  dispose: () => void;
  clear: () => void;
  redraw: () => void;
  getBuffer: () => string;
  setBuffer: (text: string, newPos?: number) => void;
  getCursorPos: () => number;
}

export function setupTerminalInput({
  term,
  getPrompt,
  onExecute,
  onComplete,
  initialHistory = [],
}: TerminalControllerOptions): TerminalController {
  let buffer = "";
  let cursorPos = 0;
  const history: string[] = [...initialHistory];
  let historyIdx = -1;
  let isExecuting = false;
  let isCompleting = false;

  const redraw = () => {
    const prompt = getPrompt();
    const diff = buffer.length - cursorPos;
    const moveCursorBack = diff > 0 ? `\x1b[${diff}D` : "";
    term.write(`\r\x1b[K${prompt}${buffer}${moveCursorBack}`);
  };

  const insertText = (text: string) => {
    buffer = buffer.slice(0, cursorPos) + text + buffer.slice(cursorPos);
    cursorPos += text.length;
    redraw();
  };

  const handleNavKey = (event: KeyboardEvent): boolean => {

    if ((event.metaKey && event.key === "ArrowLeft") || event.key === "Home") {
      cursorPos = 0;
      redraw();
      return true;
    }

    if ((event.metaKey && event.key === "ArrowRight") || event.key === "End") {
      cursorPos = buffer.length;
      redraw();
      return true;
    }

    if ((event.ctrlKey || event.altKey) && event.key === "ArrowLeft") {
      cursorPos = getPrevWordIndex(buffer, cursorPos);
      redraw();
      return true;
    }

    if ((event.ctrlKey || event.altKey) && event.key === "ArrowRight") {
      cursorPos = getNextWordIndex(buffer, cursorPos);
      redraw();
      return true;
    }

    if (event.key === "ArrowLeft" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (cursorPos > 0) {
        cursorPos--;
        redraw();
      }
      return true;
    }

    if (event.key === "ArrowRight" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (cursorPos < buffer.length) {
        cursorPos++;
        redraw();
      }
      return true;
    }

    if (event.metaKey && event.key === "Backspace") {
      buffer = buffer.slice(cursorPos);
      cursorPos = 0;
      redraw();
      return true;
    }

    if (event.altKey && event.key === "Backspace") {
      const prev = getPrevWordIndex(buffer, cursorPos);
      buffer = buffer.slice(0, prev) + buffer.slice(cursorPos);
      cursorPos = prev;
      redraw();
      return true;
    }

    if (event.key === "Delete") {
      if (cursorPos < buffer.length) {
        buffer = buffer.slice(0, cursorPos) + buffer.slice(cursorPos + 1);
        redraw();
      }
      return true;
    }

    return false;
  };

  const triggerCompletion = async () => {
    if (!onComplete || isExecuting || isCompleting) return;
    isCompleting = true;

    try {
      const result = await onComplete(buffer, cursorPos);
      if (!result) {
        // No match found
        return;
      }

      if (result.replacement !== undefined) {
        buffer = result.replacement;
        cursorPos = result.newCursorPos !== undefined ? result.newCursorPos : buffer.length;
      }

      if (result.candidates && result.candidates.length > 0) {
        // Render candidates list below prompt
        term.writeln("");
        const formattedLines = formatCompletionCandidates(result.candidates, term.cols);
        for (const line of formattedLines) {
          term.writeln(line);
        }
      }

      redraw();
    } catch {
      redraw();
    } finally {
      isCompleting = false;
    }
  };

  term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
    if (event.key === "Tab") {
      event.preventDefault();
      if (event.type === "keydown") {
        triggerCompletion();
      }
      return false;
    }

    const isNavKey =
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "Home" ||
      event.key === "End" ||
      event.key === "Delete" ||
      (event.key === "Backspace" && (event.metaKey || event.altKey));

    if (isNavKey) {
      if (event.type === "keydown") {
        handleNavKey(event);
      }
      return false;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
      if (term.hasSelection()) {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection).catch(() => {});
        }
        return false;
      }

      if (event.ctrlKey && !event.metaKey) {
        return true;
      }
      return false;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
      if (event.type === "keydown") {
        navigator.clipboard
          .readText()
          .then((clipText) => {
            if (clipText) {
              const cleanText = clipText.replace(/[\r\n]+/g, " ");
              insertText(cleanText);
            }
          })
          .catch(() => {});
      }
      return false;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      if (event.metaKey) {
        term.selectAll();
        return false;
      }

      return true;
    }

    return true;
  });

  const onDataDisposable = term.onData(async (data: string) => {
    if (isExecuting) return;

    if (data === "\x1b[A") {
      if (history.length > 0) {
        const nextIdx = historyIdx + 1;
        if (nextIdx < history.length) {
          historyIdx = nextIdx;
          buffer = history[history.length - 1 - nextIdx];
          cursorPos = buffer.length;
          redraw();
        }
      }
      return;
    }

    if (data === "\x1b[B") {
      if (historyIdx > 0) {
        historyIdx--;
        buffer = history[history.length - 1 - historyIdx];
        cursorPos = buffer.length;
        redraw();
      } else if (historyIdx === 0) {
        historyIdx = -1;
        buffer = "";
        cursorPos = 0;
        redraw();
      }
      return;
    }

    if (data.startsWith("\x1b")) {
      return;
    }

    const code = data.charCodeAt(0);

    if (code === 9 || data === "\t") {
      triggerCompletion();
      return;
    }

    if (code === 13) {
      term.writeln("");
      const cmd = buffer.trim();

      if (cmd === "clear") {
        term.clear();
        buffer = "";
        cursorPos = 0;
        historyIdx = -1;
        redraw();
        return;
      }

      if (cmd.length > 0) {
        if (history.length === 0 || history[history.length - 1] !== cmd) {
          history.push(cmd);
        }
        historyIdx = -1;
        buffer = "";
        cursorPos = 0;

        isExecuting = true;
        try {
          await onExecute(cmd);
        } finally {
          isExecuting = false;
        }
      } else {
        buffer = "";
        cursorPos = 0;
        historyIdx = -1;
      }

      redraw();
      return;
    }

    if (code === 127 || data === "\b" || data === "\x7f") {
      if (cursorPos > 0) {
        buffer = buffer.slice(0, cursorPos - 1) + buffer.slice(cursorPos);
        cursorPos--;
        redraw();
      }
      return;
    }

    if (code === 3) {
      term.writeln("^C");
      buffer = "";
      cursorPos = 0;
      historyIdx = -1;
      redraw();
      return;
    }

    if (code === 21) {
      buffer = "";
      cursorPos = 0;
      redraw();
      return;
    }

    if (code === 1) {
      cursorPos = 0;
      redraw();
      return;
    }

    if (code === 5) {
      cursorPos = buffer.length;
      redraw();
      return;
    }

    if (code === 11) {
      buffer = buffer.slice(0, cursorPos);
      redraw();
      return;
    }

    if (data.length >= 1 && code >= 32) {
      insertText(data);
    }
  });

  return {
    dispose: () => {
      onDataDisposable.dispose();
    },
    clear: () => {
      term.clear();
      buffer = "";
      cursorPos = 0;
      historyIdx = -1;
      redraw();
    },
    redraw,
    getBuffer: () => buffer,
    setBuffer: (text: string, newPos?: number) => {
      buffer = text;
      cursorPos = newPos !== undefined ? newPos : text.length;
      redraw();
    },
    getCursorPos: () => cursorPos,
  };
}