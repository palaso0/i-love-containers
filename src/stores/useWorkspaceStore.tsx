import React, { createContext, useContext, useState, useCallback } from "react";

export type WorkspaceSessionType = "terminal" | "logs";

export interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  color: string;
  message: string;
}

export interface WorkspaceSession {
  id: string;
  type: WorkspaceSessionType;
  title: string;
  containerId?: string;
  containerName?: string;
  composeProject?: string;
  createdAt: number;
  terminalHistory?: string[];
  currentInput?: string;
  terminalCwd?: string;
  logs?: LogEntry[];
  activeServiceFilters?: string[];
  isPaused?: boolean;
  autoScroll?: boolean;
  showTimestamps?: boolean;
}

interface WorkspaceContextValue {
  dockOpen: boolean;
  dockHeight: number;
  isMaximized: boolean;
  splitMode: "none" | "vertical";
  activeSessionId: string | null;
  secondarySessionId: string | null;
  sessions: WorkspaceSession[];
  setDockOpen: (open: boolean) => void;
  toggleDock: () => void;
  setDockHeight: (height: number) => void;
  toggleMaximized: () => void;
  toggleSplitMode: () => void;
  setActiveSession: (id: string) => void;
  setSecondarySession: (id: string | null) => void;
  openTerminal: (containerId: string, containerName: string) => string;
  openLogs: (containerId: string, containerName: string) => string;
  openStackLogs: (composeProject: string, serviceContainers: Array<{ id: string; name: string }>) => string;
  closeSession: (id: string) => void;
  appendLog: (sessionId: string, entry: LogEntry) => void;
  clearSessionLogs: (sessionId: string) => void;
  toggleSessionPause: (sessionId: string) => void;
  toggleSessionAutoScroll: (sessionId: string) => void;
  toggleSessionTimestamps: (sessionId: string) => void;
  toggleServiceFilter: (sessionId: string, serviceName: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dockOpen, setDockOpen] = useState(false);
  const [dockHeight, setDockHeightState] = useState(340);
  const [isMaximized, setIsMaximized] = useState(false);
  const [splitMode, setSplitMode] = useState<"none" | "vertical">("none");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [secondarySessionId, setSecondarySessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<WorkspaceSession[]>([]);
  const [terminalCounters, setTerminalCounters] = useState<Record<string, number>>({});

  const setDockHeight = useCallback((height: number) => {
    setDockHeightState(Math.max(180, Math.min(800, height)));
  }, []);

  const toggleDock = useCallback(() => {
    setDockOpen((prev) => {
      if (!prev && sessions.length === 0) return false;
      return !prev;
    });
  }, [sessions.length]);

  const toggleMaximized = useCallback(() => {
    setIsMaximized((prev) => !prev);
  }, []);

  const toggleSplitMode = useCallback(() => {
    setSplitMode((prevMode) => {
      if (prevMode === "none") {
        const candidate = sessions.find((s: WorkspaceSession) => s.id !== activeSessionId);
        setSecondarySessionId(candidate ? candidate.id : null);
        return "vertical";
      }
      setSecondarySessionId(null);
      return "none";
    });
  }, [sessions, activeSessionId]);

  const setActiveSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const setSecondarySession = useCallback((id: string | null) => {
    setSecondarySessionId(id);
  }, []);

  const openTerminal = useCallback((containerId: string, containerName: string) => {
    const currentCount = (terminalCounters[containerId] || 0) + 1;
    setTerminalCounters((prev) => ({ ...prev, [containerId]: currentCount }));

    const sessionId = `term-${containerId}-${Date.now()}`;
    const newSession: WorkspaceSession = {
      id: sessionId,
      type: "terminal",
      title: `${containerName} #${currentCount}`,
      containerId,
      containerName,
      createdAt: Date.now(),
      terminalHistory: [],
      currentInput: "",
      terminalCwd: "/app",
    };

    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(sessionId);
    setDockOpen(true);

    return sessionId;
  }, [terminalCounters]);

  const openLogs = useCallback((containerId: string, containerName: string) => {
    const existing = sessions.find(
      (s: WorkspaceSession) => s.type === "logs" && s.containerId === containerId && !s.composeProject
    );

    if (existing) {
      setActiveSessionId(existing.id);
      setDockOpen(true);
      return existing.id;
    }

    const sessionId = `logs-${containerId}-${Date.now()}`;
    const newSession: WorkspaceSession = {
      id: sessionId,
      type: "logs",
      title: `${containerName} (Logs)`,
      containerId,
      containerName,
      createdAt: Date.now(),
      logs: [],
      activeServiceFilters: [containerName],
      isPaused: false,
      autoScroll: true,
      showTimestamps: true,
    };

    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(sessionId);
    setDockOpen(true);

    return sessionId;
  }, [sessions]);

  const openStackLogs = useCallback((
    composeProject: string,
    serviceContainers: Array<{ id: string; name: string }>
  ) => {
    const existing = sessions.find(
      (s: WorkspaceSession) => s.type === "logs" && s.composeProject === composeProject
    );

    if (existing) {
      setActiveSessionId(existing.id);
      setDockOpen(true);
      return existing.id;
    }

    const sessionId = `stack-logs-${composeProject}-${Date.now()}`;
    const newSession: WorkspaceSession = {
      id: sessionId,
      type: "logs",
      title: `${composeProject} (All)`,
      composeProject,
      createdAt: Date.now(),
      logs: [],
      activeServiceFilters: serviceContainers.map((s) => s.name),
      isPaused: false,
      autoScroll: true,
      showTimestamps: true,
    };

    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(sessionId);
    setDockOpen(true);

    return sessionId;
  }, [sessions]);

  const closeSession = useCallback((id: string) => {
    setSessions((prev) => {
      const filtered = prev.filter((s: WorkspaceSession) => s.id !== id);
      if (activeSessionId === id) {
        const nextActive = filtered.length > 0 ? filtered[filtered.length - 1].id : null;
        setActiveSessionId(nextActive);
      }
      if (secondarySessionId === id) {
        setSecondarySessionId(null);
        setSplitMode("none");
      }
      if (filtered.length <= 1) {
        setSplitMode("none");
        setSecondarySessionId(null);
      }
      if (filtered.length === 0) {
        setDockOpen(false);
      }
      return filtered;
    });
  }, [activeSessionId, secondarySessionId]);

  const appendLog = useCallback((sessionId: string, entry: LogEntry) => {
    setSessions((prev) =>
      prev.map((session: WorkspaceSession) => {
        if (session.id !== sessionId || !session.logs) return session;
        if (session.isPaused) return session;
        return {
          ...session,
          logs: [...session.logs.slice(-800), entry],
        };
      })
    );
  }, []);

  const clearSessionLogs = useCallback((sessionId: string) => {
    setSessions((prev) =>
      prev.map((session: WorkspaceSession) => {
        if (session.id !== sessionId) return session;
        return {
          ...session,
          logs: [],
        };
      })
    );
  }, []);

  const toggleSessionPause = useCallback((sessionId: string) => {
    setSessions((prev) =>
      prev.map((session: WorkspaceSession) => {
        if (session.id !== sessionId) return session;
        return {
          ...session,
          isPaused: !session.isPaused,
        };
      })
    );
  }, []);

  const toggleSessionAutoScroll = useCallback((sessionId: string) => {
    setSessions((prev) =>
      prev.map((session: WorkspaceSession) => {
        if (session.id !== sessionId) return session;
        return {
          ...session,
          autoScroll: !session.autoScroll,
        };
      })
    );
  }, []);

  const toggleSessionTimestamps = useCallback((sessionId: string) => {
    setSessions((prev) =>
      prev.map((session: WorkspaceSession) => {
        if (session.id !== sessionId) return session;
        return {
          ...session,
          showTimestamps: !session.showTimestamps,
        };
      })
    );
  }, []);

  const toggleServiceFilter = useCallback((sessionId: string, serviceName: string) => {
    setSessions((prev) =>
      prev.map((session: WorkspaceSession) => {
        if (session.id !== sessionId) return session;
        const currentFilters = session.activeServiceFilters || [];
        const exists = currentFilters.includes(serviceName);
        const updated = exists
          ? currentFilters.filter((name: string) => name !== serviceName)
          : [...currentFilters, serviceName];
        return {
          ...session,
          activeServiceFilters: updated,
        };
      })
    );
  }, []);

  const value: WorkspaceContextValue = {
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
    appendLog,
    clearSessionLogs,
    toggleSessionPause,
    toggleSessionAutoScroll,
    toggleSessionTimestamps,
    toggleServiceFilter,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspaceStore = (): WorkspaceContextValue => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaceStore must be used within a WorkspaceProvider");
  }
  return context;
};