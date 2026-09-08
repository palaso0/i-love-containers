import React, { useState, useRef, useEffect } from "react";
import {
  Terminal,
  FileText,
  X,
  Plus,
  Columns,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  FolderGit2,
} from "lucide-react";
import { useWorkspaceStore, WorkspaceSession } from "@/stores/useWorkspaceStore";
import { useAppStore } from "@/stores/useAppStore";
import { PersistentTerminal } from "./PersistentTerminal";
import { UnifiedLogsViewer } from "./UnifiedLogsViewer";

export const WorkspaceDock: React.FC = () => {
  const {
    dockOpen,
    dockHeight,
    isMaximized,
    splitMode,
    activeSessionId,
    secondarySessionId,
    sessions,
    setDockOpen,
    toggleDock,
    setDockHeight,
    toggleMaximized,
    toggleSplitMode,
    setActiveSession,
    setSecondarySession,
    openTerminal,
    openLogs,
    openStackLogs,
    closeSession,
  } = useWorkspaceStore();

  const { containers, composeProjects, theme } = useAppStore();
  const isDark = theme === "dark";

  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(event.target as Node)) {
        setIsNewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newHeight = window.innerHeight - e.clientY;
      setDockHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
      }
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setDockHeight]);

  const activeSession = sessions.find((s: WorkspaceSession) => s.id === activeSessionId) || sessions[0];
  const secondarySession =
    sessions.find((s: WorkspaceSession) => s.id === secondarySessionId) ||
    sessions.find((s: WorkspaceSession) => s.id !== activeSession?.id);

  const terminalCount = sessions.filter((s: WorkspaceSession) => s.type === "terminal").length;
  const logCount = sessions.filter((s: WorkspaceSession) => s.type === "logs").length;

  if (sessions.length === 0) {
    return null;
  }

  if (!dockOpen) {
    return (
      <div className="border-t border-border bg-surface/95 backdrop-blur-md px-3 py-1.5 flex items-center justify-between z-30 shadow-lg">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setDockOpen(true)}
            className="flex items-center space-x-2 px-2.5 py-1 rounded-md bg-surface-secondary border border-border text-2xs font-mono text-foreground hover:border-muted-foreground/40 transition-colors"
          >
            <ChevronUp className="w-3 h-3 text-primary" />
            <span className="font-semibold">Workspace Dock</span>
            <span className="text-muted-foreground">•</span>
            {terminalCount > 0 && (
              <span className="text-primary font-semibold">
                {terminalCount} {terminalCount === 1 ? "Terminal" : "Terminals"}
              </span>
            )}
            {logCount > 0 && (
              <span className="text-sky-400 font-semibold">
                {logCount} {logCount === 1 ? "Log Stream" : "Log Streams"}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center space-x-2 text-2xs font-mono text-muted-foreground">
          <span>Persistent in background</span>
          <button
            onClick={() => setDockOpen(true)}
            className="px-2 py-0.5 rounded bg-surface hover:bg-surface-hover text-foreground border border-border"
          >
            Open (⌘J)
          </button>
        </div>
      </div>
    );
  }

  const computedHeight = isMaximized ? "calc(100vh - 48px)" : `${dockHeight}px`;

  return (
    <div
      style={{ height: computedHeight }}
      className="border-t border-border bg-surface flex flex-col z-30  overflow-hidden shadow-2xl transition-[height] duration-75 relative"
    >
      <div
        onMouseDown={() => setIsResizing(true)}
        className="h-1.5 w-full cursor-row-resize bg-transparent hover:bg-primary/50 transition-colors absolute top-0 left-0 right-0 z-40"
      />

      <div className="h-9 px-2 bg-surface-secondary border-b border-border flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-1 overflow-x-auto max-w-[calc(100vw-220px)] scrollbar-none py-1">
          {sessions.map((session: WorkspaceSession) => {
            const isActive = session.id === activeSession?.id;
            const Icon = session.type === "terminal" ? Terminal : FileText;

            return (
              <div
                key={session.id}
                onClick={() => setActiveSession(session.id)}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-2xs font-mono cursor-pointer border transition-colors shrink-0 group ${
                  isActive
                    ? "bg-surface text-foreground font-semibold border-border shadow-xs"
                    : "bg-surface/40 text-muted-foreground hover:text-foreground hover:bg-surface border-transparent"
                }`}
              >
                <Icon className={`w-3 h-3 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className="truncate max-w-[120px]">{session.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeSession(session.id);
                  }}
                  className="p-0.5 rounded hover:bg-surface-hover text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}

          <div className="relative" ref={newMenuRef}>
            <button
              onClick={() => setIsNewMenuOpen(!isNewMenuOpen)}
              className="flex items-center space-x-1 px-2 py-1 rounded bg-surface hover:bg-surface-hover border border-border text-2xs font-mono text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Open new terminal or log stream"
            >
              <Plus className="w-3 h-3" />
              <span>New</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {isNewMenuOpen && (
              <div className="absolute top-8 left-0 w-64 bg-surface border border-border rounded-lg shadow-xl z-50 p-1 font-mono text-2xs">
                <div className="px-2 py-1 text-muted-foreground font-bold border-b border-border uppercase tracking-wider text-[10px]">
                  New Terminal
                </div>
                <div className="max-h-36 overflow-y-auto py-1 divide-y divide-border/40">
                  {containers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        openTerminal(c.id, c.name);
                        setIsNewMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 flex items-center justify-between hover:bg-surface-hover rounded text-foreground transition-colors"
                    >
                      <div className="flex items-center space-x-1.5 truncate mr-2">
                        <Terminal className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{c.state}</span>
                    </button>
                  ))}
                </div>

                <div className="px-2 py-1 text-muted-foreground font-bold border-t border-b border-border uppercase tracking-wider text-[10px] mt-1">
                  Live Container Logs
                </div>
                <div className="max-h-28 overflow-y-auto py-1">
                  {containers.map((c) => (
                    <button
                      key={`log-${c.id}`}
                      onClick={() => {
                        openLogs(c.id, c.name);
                        setIsNewMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 flex items-center space-x-1.5 hover:bg-surface-hover rounded text-foreground transition-colors"
                    >
                      <FileText className="w-3 h-3 text-sky-400 shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>

                <div className="px-2 py-1 text-muted-foreground font-bold border-t border-b border-border uppercase tracking-wider text-[10px] mt-1">
                  Unified Stack Logs
                </div>
                <div className="max-h-28 overflow-y-auto py-1">
                  {composeProjects.map((p) => {
                    const projectServices = containers
                      .filter((c) => c.composeProject === p.name)
                      .map((c) => ({ id: c.id, name: c.composeService || c.name }));
                    return (
                      <button
                        key={p.name}
                        onClick={() => {
                          openStackLogs(p.name, projectServices);
                          setIsNewMenuOpen(false);
                        }}
                        className="w-full text-left px-2 py-1 flex items-center space-x-1.5 hover:bg-surface-hover rounded text-foreground transition-colors"
                      >
                        <FolderGit2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate font-semibold">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          ({projectServices.length} svcs)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0 font-mono text-2xs">
          {sessions.length > 1 && (
            <button
              onClick={toggleSplitMode}
              className={`p-1.5 rounded transition-colors ${
                splitMode === "vertical"
                  ? "bg-surface text-primary border border-border shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface"
              }`}
              title="Toggle split view side-by-side"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={toggleMaximized}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            title={isMaximized ? "Restore height" : "Maximize dock"}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => toggleDock()}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            title="Minimize dock to bottom bar (⌘J)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className={`flex-1 flex overflow-hidden ${isDark ? "bg-[#090b10]" : "bg-[#f8fafc]"}`}>
        {splitMode === "vertical" && secondarySession ? (
          <>
            <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
              <div className="h-6 px-3 bg-surface border-b border-border flex items-center justify-between text-2xs font-mono text-muted-foreground ">
                <span>Pane 1: {activeSession?.title}</span>
              </div>
              <div className="flex-1 relative overflow-hidden">
                {sessions.map((session: WorkspaceSession) => (
                  <React.Fragment key={session.id}>
                    {session.type === "terminal" ? (
                      <PersistentTerminal
                        session={session}
                        isActive={session.id === activeSession?.id}
                      />
                    ) : (
                      <UnifiedLogsViewer
                        session={session}
                        isActive={session.id === activeSession?.id}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="h-6 px-3 bg-surface border-b border-border flex items-center justify-between text-2xs font-mono text-muted-foreground ">
                <span>Pane 2: {secondarySession.title}</span>
                <select
                  value={secondarySession.id}
                  onChange={(e) => setSecondarySession(e.target.value)}
                  className="bg-surface-secondary border border-border rounded px-1.5 py-0 text-2xs text-foreground focus:outline-none"
                >
                  {sessions
                    .filter((s: WorkspaceSession) => s.id !== activeSession?.id)
                    .map((s: WorkspaceSession) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex-1 relative overflow-hidden">
                {sessions.map((session: WorkspaceSession) => (
                  <React.Fragment key={`sec-${session.id}`}>
                    {session.type === "terminal" ? (
                      <PersistentTerminal
                        session={session}
                        isActive={session.id === secondarySession.id}
                      />
                    ) : (
                      <UnifiedLogsViewer
                        session={session}
                        isActive={session.id === secondarySession.id}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 relative overflow-hidden">
            {sessions.map((session: WorkspaceSession) => (
              <React.Fragment key={session.id}>
                {session.type === "terminal" ? (
                  <PersistentTerminal
                    session={session}
                    isActive={session.id === activeSession?.id}
                  />
                ) : (
                  <UnifiedLogsViewer
                    session={session}
                    isActive={session.id === activeSession?.id}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};