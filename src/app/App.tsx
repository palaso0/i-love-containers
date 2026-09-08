import React, { useEffect } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { OverviewView } from "@/features/overview/OverviewView";
import { ContainersSplitView } from "@/features/containers/ContainersSplitView";
import { ImagesView } from "@/features/images/ImagesView";
import { VolumesView } from "@/features/volumes/VolumesView";
import { NetworksView } from "@/features/networks/NetworksView";
import { ComposeView } from "@/features/compose/ComposeView";
import { SettingsView } from "@/features/settings/SettingsView";
import { FleetView } from "@/features/fleet/FleetView";
import { useAppStore } from "@/stores/useAppStore";

export const App: React.FC = () => {
  const {
    viewMode,
    activeTab,
    selectedContainerId,
    setContainerDetailTab,
    refreshData,
    isInitialLoading,
    toggleViewMode,
    isSidebarOpen,
    toggleSidebar,
  } = useAppStore();

  useEffect(() => {
    const handleGlobalShortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      } else if (event.key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        refreshData();
      } else if (event.key.toLowerCase() === "m" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        toggleViewMode();
      } else if (event.key.toLowerCase() === "l" && selectedContainerId) {
        event.preventDefault();
        setContainerDetailTab("logs");
      } else if (event.key.toLowerCase() === "t" && selectedContainerId) {
        event.preventDefault();
        setContainerDetailTab("terminal");
      } else if (event.key.toLowerCase() === "s" && selectedContainerId) {
        event.preventDefault();
        setContainerDetailTab("stats");
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [selectedContainerId, setContainerDetailTab, refreshData, toggleViewMode, toggleSidebar]);

  if (isInitialLoading) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center select-none font-sans">
        <div className="flex items-center space-x-2 text-primary animate-pulse mb-2">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            I <span className="text-primary">♥</span> Containers
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Checking local container engine...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden font-sans select-none antialiased">
      {isSidebarOpen && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          {activeTab === "overview" && (viewMode === "minimal" ? <FleetView /> : <OverviewView />)}
          {activeTab === "containers" && <ContainersSplitView />}
          {activeTab === "images" && <ImagesView />}
          {activeTab === "volumes" && <VolumesView />}
          {activeTab === "networks" && <NetworksView />}
          {activeTab === "compose" && <ComposeView />}
          {activeTab === "settings" && <SettingsView />}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
};