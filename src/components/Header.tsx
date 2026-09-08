import React from "react";
import {
  RefreshCw,
  Search,
  PanelLeftOpen,
  ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { EngineSelector } from "@/components/EngineSelector";

export const Header: React.FC = () => {
  const {
    t,
    viewMode,
    toggleViewMode,
    isActionInProgress,
    refreshData,
    setIsCommandPaletteOpen,
    isSidebarOpen,
    toggleSidebar,
    activeTab,
    selectedContainerId,
    containers,
    setSelectedContainerId,
  } = useAppStore();

  const selectedContainer = containers.find((c) => c.id === selectedContainerId);

  const activeTabTitle =
    (t.nav as Record<string, string>)[activeTab] ||
    activeTab.charAt(0).toUpperCase() + activeTab.slice(1);

  return (
    <header
      data-tauri-drag-region
      className={`relative z-40 h-11 border-b border-border/80 bg-surface/80 backdrop-blur-xl flex items-center justify-between select-none transition-all ${
        !isSidebarOpen ? "pl-20 pr-3" : "px-3.5"
      }`}
    >
      <div className="flex items-center space-x-2.5 min-w-0">
        {!isSidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-secondary border border-border/50 transition-colors"
            title={t.nav.toggleSidebar}
          >
            <PanelLeftOpen className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="flex items-center space-x-1.5 text-xs">
          <span className="font-semibold text-foreground tracking-tight">
            {activeTabTitle}
          </span>
          {activeTab === "containers" && selectedContainer && (
            <>
              <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
              <button
                onClick={() => setSelectedContainerId(null)}
                className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[140px] font-mono text-2xs"
              >
                {selectedContainer.name}
              </button>
            </>
          )}
        </div>

        <div className="h-3 w-[1px] bg-border/80 mx-1 hidden sm:block" />

        <EngineSelector />
      </div>

      <div className="flex-1 max-w-xs mx-3">
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-2.5 py-1 text-xs text-muted-foreground bg-surface-secondary/60 hover:bg-surface-secondary border border-border/60 rounded-lg hover:border-muted-foreground/30 transition-all shadow-xs group"
        >
          <div className="flex items-center space-x-2 truncate">
            <Search className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-[11px] text-muted-foreground group-hover:text-foreground/80 transition-colors">
              {t.header.searchPlaceholder}
            </span>
          </div>
          <kbd className="px-1.5 py-0.2 text-[10px] font-mono bg-surface text-muted-foreground rounded-sm border border-border/60 shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center space-x-2">
        {activeTab === "overview" && (
          <div className="flex items-center bg-surface-secondary/80 border border-border/60 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => viewMode !== "minimal" && toggleViewMode()}
              className={`px-2.5 py-0.5 rounded-md text-2xs transition-all ${
                viewMode === "minimal"
                  ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Fleet grid view"
            >
              {t.header.fleet}
            </button>
            <button
              onClick={() => viewMode !== "detailed" && toggleViewMode()}
              className={`px-2.5 py-0.5 rounded-md text-2xs transition-all ${
                viewMode === "detailed"
                  ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="System details view"
            >
              {t.header.system}
            </button>
          </div>
        )}

        <button
          onClick={() => refreshData()}
          disabled={isActionInProgress}
          className="p-1.5 text-muted-foreground hover:text-foreground bg-surface border border-border/60 hover:bg-surface-hover rounded-md transition-colors shadow-xs disabled:opacity-50"
          title={t.header.refresh}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isActionInProgress ? "animate-spin text-primary" : ""}`}
          />
        </button>
      </div>
    </header>
  );
};