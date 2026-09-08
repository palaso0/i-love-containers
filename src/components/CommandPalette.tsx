import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Box,
  Play,
  Square,
  RotateCw,
  Terminal,
  FileText,
  Activity,
  Layers,
  HardDrive,
  Network,
  FolderGit2,
  Settings,
  Sun,
  Moon,
  Minimize2,
  Maximize2,
  X,
  Server,
  Zap,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";

export const CommandPalette: React.FC = () => {
  const {
    theme,
    toggleTheme,
    viewMode,
    toggleViewMode,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    containers,
    setActiveTab,
    setSelectedContainerId,
    setContainerDetailTab,
    startContainer,
    stopContainer,
    restartContainer,
    refreshData,
    detectedEngines,
    switchEngine,
    rescanEngines,
  } = useAppStore();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (event.key === "Escape" && isCommandPaletteOpen) {
        event.preventDefault();
        setIsCommandPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCommandPaletteOpen, setIsCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  interface PaletteItem {
    id: string;
    category: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    action: () => void;
  }

  const items: PaletteItem[] = [
    ...detectedEngines.map((engine) => ({
      id: `engine-${engine.id}`,
      category: "Container Engines",
      title: `Switch to ${engine.name}`,
      description: `Target daemon at ${engine.socketPath} (${engine.status})`,
      icon: engine.type === "orbstack" ? Zap : Server,
      action: () => switchEngine(engine.id),
    })),
    {
      id: "engine-rescan",
      category: "Container Engines",
      title: "Rescan Container Engine Sockets",
      description: "Probe host for Docker Desktop, OrbStack, Rancher, Colima, Podman",
      icon: RotateCw,
      action: () => rescanEngines(),
    },
    {
      id: "action-view-mode",
      category: "View",
      title: viewMode === "minimal" ? "Switch to Detailed Mode (M)" : "Switch to Minimal Mode (M)",
      description: "Toggle between lightweight essentials and full metrics view",
      icon: viewMode === "minimal" ? Maximize2 : Minimize2,
      action: () => toggleViewMode(),
    },
    {
      id: "action-theme",
      category: "Appearance",
      title: `Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`,
      description: "Toggle application color scheme",
      icon: theme === "dark" ? Sun : Moon,
      action: () => toggleTheme(),
    },
    {
      id: "action-refresh",
      category: "System",
      title: "Refresh All Resources",
      description: "Poll latest state from container daemon",
      icon: RotateCw,
      action: () => refreshData(),
    },
    {
      id: "nav-overview",
      category: "Navigation",
      title: "Go to Overview",
      description: "System overview and resource counters",
      icon: Layers,
      action: () => setActiveTab("overview"),
    },
    {
      id: "nav-containers",
      category: "Navigation",
      title: "Go to Containers",
      description: "View and manage all active containers",
      icon: Box,
      action: () => {
        setActiveTab("containers");
        setSelectedContainerId(null);
      },
    },
    {
      id: "nav-images",
      category: "Navigation",
      title: "Go to Images",
      description: "Manage local Docker images",
      icon: Layers,
      action: () => setActiveTab("images"),
    },
    {
      id: "nav-volumes",
      category: "Navigation",
      title: "Go to Volumes",
      description: "Inspect persistent mounts",
      icon: HardDrive,
      action: () => setActiveTab("volumes"),
    },
    {
      id: "nav-networks",
      category: "Navigation",
      title: "Go to Networks",
      description: "Inspect network bridges",
      icon: Network,
      action: () => setActiveTab("networks"),
    },
    {
      id: "nav-compose",
      category: "Navigation",
      title: "Go to Compose Stacks",
      description: "Multi-container application services",
      icon: FolderGit2,
      action: () => setActiveTab("compose"),
    },
    {
      id: "nav-settings",
      category: "Navigation",
      title: "Go to Settings",
      description: "Preferences and daemon host endpoints",
      icon: Settings,
      action: () => setActiveTab("settings"),
    },
  ];

  containers.forEach((container) => {
    items.push({
      id: `open-${container.id}`,
      category: "Containers",
      title: `Open ${container.name}`,
      description: `${container.image} • ${container.status}`,
      icon: Box,
      action: () => {
        setActiveTab("containers");
        setSelectedContainerId(container.id);
        setContainerDetailTab("overview");
      },
    });

    items.push({
      id: `logs-${container.id}`,
      category: "Containers",
      title: `Logs: ${container.name}`,
      description: `View real-time logs for ${container.name}`,
      icon: FileText,
      action: () => {
        setActiveTab("containers");
        setSelectedContainerId(container.id);
        setContainerDetailTab("logs");
      },
    });

    items.push({
      id: `terminal-${container.id}`,
      category: "Containers",
      title: `Terminal: ${container.name}`,
      description: `Open interactive shell in ${container.name}`,
      icon: Terminal,
      action: () => {
        setActiveTab("containers");
        setSelectedContainerId(container.id);
        setContainerDetailTab("terminal");
      },
    });

    items.push({
      id: `stats-${container.id}`,
      category: "Containers",
      title: `Stats: ${container.name}`,
      description: `Inspect CPU and memory charts for ${container.name}`,
      icon: Activity,
      action: () => {
        setActiveTab("containers");
        setSelectedContainerId(container.id);
        setContainerDetailTab("stats");
      },
    });

    if (container.state === "running") {
      items.push({
        id: `stop-${container.id}`,
        category: "Actions",
        title: `Stop ${container.name}`,
        description: `Stop container process`,
        icon: Square,
        action: () => stopContainer(container.id),
      });
      items.push({
        id: `restart-${container.id}`,
        category: "Actions",
        title: `Restart ${container.name}`,
        description: `Restart container process`,
        icon: RotateCw,
        action: () => restartContainer(container.id),
      });
    } else {
      items.push({
        id: `start-${container.id}`,
        category: "Actions",
        title: `Start ${container.name}`,
        description: `Launch stopped container`,
        icon: Play,
        action: () => startContainer(container.id),
      });
    }
  });

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (item: PaletteItem) => {
    item.action();
    setIsCommandPaletteOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (event.key === "Enter" && filteredItems[selectedIndex]) {
      event.preventDefault();
      handleSelect(filteredItems[selectedIndex]);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-start justify-center pt-24 animate-in fade-in duration-100"
      onClick={() => setIsCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-popover border border-popover-border rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 border-b border-border/70 bg-surface/50">
          <Search className="w-4 h-4 text-muted-foreground mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search containers..."
            className="w-full py-3 bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground font-sans"
          />
          <button
            onClick={() => setIsCommandPaletteOpen(false)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-88 overflow-y-auto p-2 space-y-0.5">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No matching commands or containers found
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-primary text-white shadow-xs font-medium"
                      : "hover:bg-surface-hover text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isSelected ? "text-white" : "text-primary"
                      }`}
                    />
                    <div className="truncate">
                      <div
                        className={`text-xs truncate ${
                          isSelected ? "text-white font-semibold" : "text-foreground font-medium"
                        }`}
                      >
                        {item.title}
                      </div>
                      <div
                        className={`text-2xs truncate ${
                          isSelected ? "text-white/80" : "text-muted-foreground"
                        }`}
                      >
                        {item.description}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ml-2 font-medium ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-surface-secondary/80 text-muted-foreground border border-border/60"
                    }`}
                  >
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-border/60 bg-surface-secondary/40 flex items-center justify-between text-xs text-muted-foreground select-none">
          <div className="flex items-center space-x-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border/70 text-[10px] font-mono shadow-2xs">
                ↑↓
              </kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border/70 text-[10px] font-mono shadow-2xs">
                ↵
              </kbd>
              <span>select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border/70 text-[10px] font-mono shadow-2xs">
                esc
              </kbd>
              <span>close</span>
            </span>
          </div>
          <span className="text-[11px] font-medium text-foreground/60">Spotlight</span>
        </div>
      </div>
    </div>
  );
};