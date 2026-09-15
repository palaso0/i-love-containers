import React, { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  Box,
  Layers,
  HardDrive,
  Network,
  FolderGit2,
  Settings,
  Cpu,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { ActiveTab } from "@/types";
import { handleWindowDragStart } from "@/lib/windowDrag";

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number | string;
}

export const Sidebar: React.FC = () => {
  const {
    t,
    activeTab,
    setActiveTab,
    setSelectedContainerId,
    containers,
    images,
    volumes,
    networks,
    composeProjects,
    systemOverview,
  } = useAppStore();

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = localStorage.getItem("ilc_sidebar_width");
      const parsed = saved ? parseInt(saved, 10) : 175;
      if (parsed < 110) return 64;
      return parsed >= 220 ? 175 : Math.max(64, Math.min(260, parsed));
    } catch {
      return 175;
    }
  });

  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const isCompact = sidebarWidth < 150;
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let unlistenEvent: (() => void) | undefined;

    const checkFs = async () => {
      if (typeof window !== "undefined") {
        if (
          window.innerWidth < window.screen.width - 20 ||
          window.innerHeight < window.screen.height - 70
        ) {
          setIsFullscreen(false);
          return;
        }
      }

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const fs = await invoke<boolean>("check_fullscreen");
        setIsFullscreen(fs);
        return;
      } catch {}

      if (document.fullscreenElement) {
        setIsFullscreen(true);
        return;
      }

      const isFs =
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.innerHeight >= window.screen.availHeight - 10 ||
        window.innerHeight >= window.screen.height - 60;
      setIsFullscreen(isFs);
    };

    checkFs();

    const handleResize = () => {
      if (
        window.innerWidth < window.screen.width - 20 ||
        window.innerHeight < window.screen.height - 70
      ) {
        setIsFullscreen(false);
      }
      checkFs();
      setTimeout(checkFs, 150);
      setTimeout(checkFs, 400);
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleResize);

    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlistenEvent = await listen<boolean>("fullscreen-changed", (event) => {
          setIsFullscreen(event.payload);
        });
      } catch {}
    })();

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleResize);
      if (unlistenEvent) unlistenEvent();
    };
  }, []);

  const handleSetWidth = (w: number) => {
    const clamped = w < 110 ? 64 : Math.max(150, Math.min(260, w));
    setSidebarWidth(clamped);
    try {
      localStorage.setItem("ilc_sidebar_width", String(clamped));
    } catch {}
  };

  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const clientX = ev.clientX;
      let newWidth: number;
      if (clientX < 110) {
        newWidth = 64;
      } else {
        newWidth = Math.max(150, Math.min(360, clientX));
      }
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = (ev: MouseEvent) => {
      isDraggingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      const clientX = ev.clientX;
      let finalWidth: number;
      if (clientX < 110) {
        finalWidth = 64;
      } else {
        finalWidth = Math.max(150, Math.min(360, clientX));
      }
      handleSetWidth(finalWidth);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const runningContainersCount = containers.filter(
    (c) => c.state === "running",
  ).length;

  const runtimeItems: NavItem[] = [
    {
      id: "containers",
      label: t.nav.containers,
      icon: Box,
      count:
        runningContainersCount > 0
          ? `${runningContainersCount}/${containers.length}`
          : containers.length,
    },
    {
      id: "images",
      label: t.nav.images,
      icon: Layers,
      count: images.length,
    },
    {
      id: "volumes",
      label: t.nav.volumes,
      icon: HardDrive,
      count: volumes.length,
    },
    {
      id: "networks",
      label: t.nav.networks,
      icon: Network,
      count: networks.length,
    },
    {
      id: "compose",
      label: t.nav.compose,
      icon: FolderGit2,
      count: composeProjects.length,
    },
  ];

  const systemItems: NavItem[] = [
    {
      id: "overview",
      label: t.nav.overview,
      icon: LayoutDashboard,
    },
    {
      id: "settings",
      label: t.nav.settings,
      icon: Settings,
    },
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab !== "containers") {
      setSelectedContainerId(null);
    }
  };

  const renderNavGroup = (title: string, items: NavItem[]) => (
    <div className="space-y-0.5">
      {!isCompact ? (
        <div className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
          {title}
        </div>
      ) : (
        <div className="my-2 mx-2 border-t border-sidebar-border/40" />
      )}
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            data-active={isActive ? "true" : "false"}
            data-nav-item="true"
            onClick={() => handleSelectTab(item.id)}
            title={`${item.label}${item.count !== undefined ? ` (${item.count})` : ""}`}
            className={`w-full group flex items-center ${
              isCompact
                ? "justify-center px-1.5 py-2 relative"
                : "justify-start px-2.5 py-1.5"
            } rounded-lg text-xs transition-all ${
              isActive
                ? "bg-white/[0.08] text-primary font-medium shadow-2xs"
                : "text-foreground/80 hover:text-foreground hover:bg-white/[0.04]"
            }`}
          >
            <div
              className={`flex items-center ${isCompact ? "justify-center" : "space-x-2"} min-w-0 flex-1`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              />
              {!isCompact && (
                <>
                  <span
                    className={`truncate ${isActive ? "text-primary font-semibold" : ""}`}
                  >
                    {item.label}
                  </span>
                  {item.count !== undefined && (
                    <span
                      className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full shrink-0 ml-1.5 ${
                        isActive
                          ? "text-primary font-semibold bg-primary/15"
                          : "text-muted-foreground/70 group-hover:text-muted-foreground bg-surface/60 border border-border/40"
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </>
              )}
            </div>
            {isCompact && item.count !== undefined && (
              <span className="sr-only">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  const isConnected = systemOverview?.dockerConnected ?? false;

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className={`relative h-full border-r border-sidebar-border bg-sidebar backdrop-blur-xl flex flex-col justify-between  z-10 shrink-0 ${
        isDragging
          ? "transition-none"
          : "transition-[width] duration-150 ease-out"
      }`}
    >
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div
          data-tauri-drag-region
          onMouseDown={handleWindowDragStart}
          className={`h-11 flex items-center border-b border-sidebar-border/40 shrink-0 relative ${
            isFullscreen
              ? "justify-center px-2"
              : isCompact
                ? "justify-center"
                : "pl-20 pr-3 justify-start"
          }`}
        >
          {(!isCompact || isFullscreen) && (
            <div className="flex items-center space-x-1.5 text-foreground min-w-0">
              <img
                src="/ilc-logo.png"
                alt="ILC"
                className="h-7 w-auto object-contain shrink-0 drop-shadow-xs"
              />
            </div>
          )}
        </div>

        <div className={`${isCompact ? "p-1 space-y-1" : "p-2 space-y-3"}`}>
          {renderNavGroup(t.nav.docker, runtimeItems)}
          {renderNavGroup(t.nav.system, systemItems)}
        </div>
      </div>

      <div
        className={`${isCompact ? "p-1.5" : "p-2.5"} border-t border-sidebar-border/60`}
      >
        {isCompact ? (
          <div
            className="bg-surface/50 rounded-lg p-2 border border-border/40 flex flex-col items-center justify-center cursor-default"
            title={`${t.nav.daemonStatus}: ${isConnected ? (systemOverview?.engineVersion ?? "v27") : t.header.offline} | CPU: ${isConnected ? (systemOverview?.systemCpuPercent ?? 0) : 0}%`}
          >
            <span
              className={`w-2 h-2 rounded-full mb-1 ${
                isConnected
                  ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.5)]"
                  : "bg-status-danger"
              }`}
            />
            <span className="font-mono text-[9px] text-muted-foreground font-semibold">
              {isConnected
                ? `${systemOverview?.systemCpuPercent ?? 0}%`
                : t.header.offline}
            </span>
          </div>
        ) : (
          <div className="bg-surface/50 rounded-lg p-2 border border-border/40 space-y-1.5">
            <div className="flex items-center justify-between text-2xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isConnected
                      ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.5)]"
                      : "bg-status-danger"
                  }`}
                />
                {t.nav.daemonStatus}
              </span>
              <span className="font-mono text-[10px]">
                {isConnected
                  ? (systemOverview?.engineVersion ?? "v27")
                  : t.header.offline}
              </span>
            </div>
            {isConnected && (
              <>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 font-mono pt-0.5">
                  <span className="flex items-center gap-1">
                    <Cpu className="w-2.5 h-2.5 text-muted-foreground" />
                    {t.nav.cpu}
                  </span>
                  <span>{systemOverview?.systemCpuPercent ?? 0}%</span>
                </div>
                <div className="w-full bg-surface-secondary/80 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, systemOverview?.systemCpuPercent ?? 0)}%`,
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}
        <p className="text-sm font-bold text-foreground/60 text-center mt-2 truncate px-1">
          {isCompact ? "ILC" : "I Love Containers"}
        </p>
      </div>

      <div
        onMouseDown={handleSidebarMouseDown}
        onDoubleClick={() => handleSetWidth(isCompact ? 175 : 64)}
        className="w-1.5 hover:w-2 -mr-0.5 cursor-col-resize group absolute top-0 right-0 h-full flex items-center justify-center shrink-0 z-30 transition-all hover:bg-primary/40 active:bg-primary "
        title="Arrastra para redimensionar barra lateral (doble click para alternar compacto)"
      >
        <div className="w-[1px] h-8 rounded-full bg-border group-hover:bg-primary/80 group-active:bg-primary transition-colors" />
      </div>
    </aside>
  );
};
