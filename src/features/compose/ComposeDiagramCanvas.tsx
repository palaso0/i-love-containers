import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  HardDrive,
  Terminal,
  FileText,
  Play,
  Square,
  RotateCw,
  ExternalLink,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  ComposeTopology,
  ComposeServiceNode,
  ComposeVolumeNode,
} from "@/lib/composeParser";
import { useAppStore } from "@/stores/useAppStore";
import { openRealNativeWindow } from "@/lib/nativeWindow";
import { TechIcon, getTechBadgeInfo } from "@/components/TechIcon";

interface ComposeDiagramCanvasProps {
  topology: ComposeTopology;
  projectName: string;
}

export const ComposeDiagramCanvas: React.FC<ComposeDiagramCanvasProps> = ({
  topology,
  projectName,
}) => {
  const {
    t,
    theme,
    startContainer,
    stopContainer,
    restartContainer,
    setSelectedContainerId,
    setActiveTab,
  } = useAppStore();

  const isDark = theme === "dark";

  const [view, setView] = useState<{ x: number; y: number; zoom: number }>(() => {
    try {
      const raw = localStorage.getItem(`ilc-compose-layout-${projectName}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed?.view &&
          typeof parsed.view.x === "number" &&
          typeof parsed.view.y === "number" &&
          typeof parsed.view.zoom === "number"
        ) {
          return parsed.view;
        }
      }
    } catch {}
    return { x: 0, y: 0, zoom: 1 };
  });

  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const raw = localStorage.getItem(`ilc-compose-layout-${projectName}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.nodePositions && typeof parsed.nodePositions === "object" && parsed.nodePositions !== null) {
          return parsed.nodePositions;
        }
      }
    } catch {}
    return {};
  });

  const [isDragging, setIsDragging] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [optimisticStates, setOptimisticStates] = useState<Record<string, "running" | "stopped" | "paused">>({});
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredNetworkId, setHoveredNetworkId] = useState<string | null>(null);

  const selectedService = useMemo<ComposeServiceNode | null>(() => {
    if (!selectedServiceId) return null;
    const base = topology.services.find((s) => s.id === selectedServiceId) || null;
    if (!base) return null;
    const overridden = optimisticStates[base.id];
    return overridden ? { ...base, state: overridden } : base;
  }, [selectedServiceId, topology.services, optimisticStates]);

  useEffect(() => {
    setOptimisticStates((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [sId, optState] of Object.entries(prev)) {
        const actual = topology.services.find((s) => s.id === sId);
        if (actual && actual.state === optState) {
          delete next[sId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [topology.services]);

  const handleServiceAction = async (
    serviceId: string,
    containerId: string,
    action: "start" | "stop" | "restart"
  ) => {
    setActionLoading(true);

    const nextState = action === "stop" ? "stopped" : "running";
    setOptimisticStates((prev) => ({
      ...prev,
      [serviceId]: nextState,
    }));

    try {
      if (action === "start") {
        await startContainer(containerId);
      } else if (action === "stop") {
        await stopContainer(containerId);
      } else if (action === "restart") {
        await restartContainer(containerId);
      }
    } catch (err) {
      console.error(`Failed to ${action} container:`, err);

      setOptimisticStates((prev) => {
        const next = { ...prev };
        delete next[serviceId];
        return next;
      });
    } finally {
      setActionLoading(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  const nodePositionsRef = useRef(nodePositions);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const touchStateRef = useRef<{ dist: number; center: { x: number; y: number } } | null>(null);
  const autoPanFrameRef = useRef<number | null>(null);
  const lastClientMousePosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const wheelSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draggingNodeRef = useRef<{
    id: string;
    type: "service" | "volume";
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
    hasMoved: boolean;
  } | null>(null);

  const saveLayout = (
    positions: Record<string, { x: number; y: number }>,
    currentView: { x: number; y: number; zoom: number }
  ) => {
    try {
      localStorage.setItem(
        `ilc-compose-layout-${projectName}`,
        JSON.stringify({
          nodePositions: positions,
          view: currentView,
        })
      );
    } catch {}
  };

  const updateView = (nextView: { x: number; y: number; zoom: number }) => {
    viewRef.current = nextView;
    setView(nextView);
  };

  const getServicePos = (svc: ComposeServiceNode) => {
    return nodePositions[svc.id] || { x: svc.x, y: svc.y };
  };

  const getVolumePos = (vol: ComposeVolumeNode) => {
    return nodePositions[vol.id] || { x: vol.x, y: vol.y };
  };

  const initializedProjectRef = useRef<string | null>(null);

  const handleResetView = () => {
    setNodePositions({});
    nodePositionsRef.current = {};
    try {
      localStorage.removeItem(`ilc-compose-layout-${projectName}`);
    } catch {}
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      const padX = 64;
      const padTop = 72;
      const padBottom = 48;
      const scaleX = (clientWidth - padX * 2) / topology.canvasWidth;
      const scaleY = (clientHeight - padTop - padBottom) / topology.canvasHeight;
      const fitZoom = Math.min(1, Math.max(0.35, Math.min(scaleX, scaleY)));
      const initialX = Math.round((clientWidth - topology.canvasWidth * fitZoom) / 2);
      const initialY = Math.round(
        padTop + Math.max(0, (clientHeight - padTop - padBottom - topology.canvasHeight * fitZoom) / 2)
      );
      const nextView = { x: initialX, y: initialY, zoom: fitZoom };
      updateView(nextView);
      saveLayout({}, nextView);
    }
  };

  const handleFitView = () => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth <= 0 || clientHeight <= 0) return;

    const allPositions = [
      ...topology.services.map((s) => {
        const p = getServicePos(s);
        return { x1: p.x, y1: p.y, x2: p.x + s.width, y2: p.y + s.height };
      }),
      ...topology.volumes.map((v) => {
        const p = getVolumePos(v);
        return { x1: p.x, y1: p.y, x2: p.x + 140, y2: p.y + 44 };
      }),
    ];

    if (allPositions.length === 0) {
      handleResetView();
      return;
    }

    const minX = Math.min(...allPositions.map((p) => p.x1));
    const maxX = Math.max(...allPositions.map((p) => p.x2));
    const minY = Math.min(...allPositions.map((p) => p.y1));
    const maxY = Math.max(...allPositions.map((p) => p.y2));

    const contentWidth = Math.max(300, maxX - minX);
    const contentHeight = Math.max(200, maxY - minY);

    const padX = 72;
    const padTop = 80;
    const padBottom = 56;

    const scaleX = (clientWidth - padX * 2) / contentWidth;
    const scaleY = (clientHeight - padTop - padBottom) / contentHeight;
    const fitZoom = Math.min(1, Math.max(0.35, Math.min(scaleX, scaleY)));

    const initialX = Math.round((clientWidth - contentWidth * fitZoom) / 2 - minX * fitZoom);
    const initialY = Math.round(
      padTop + Math.max(0, (clientHeight - padTop - padBottom - contentHeight * fitZoom) / 2) - minY * fitZoom
    );

    const nextView = { x: initialX, y: initialY, zoom: fitZoom };
    updateView(nextView);
    saveLayout(nodePositionsRef.current, nextView);
  };

  const loadOrInitLayout = () => {
    try {
      const raw = localStorage.getItem(`ilc-compose-layout-${projectName}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.nodePositions && typeof parsed.nodePositions === "object" && parsed.nodePositions !== null) {
          nodePositionsRef.current = parsed.nodePositions;
          setNodePositions(parsed.nodePositions);
          if (
            parsed.view &&
            typeof parsed.view.x === "number" &&
            typeof parsed.view.y === "number" &&
            typeof parsed.view.zoom === "number"
          ) {
            updateView(parsed.view);
            return;
          } else {
            handleFitView();
            return;
          }
        }
      }
    } catch {}

    handleResetView();
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          if (initializedProjectRef.current !== projectName) {
            initializedProjectRef.current = projectName;
            loadOrInitLayout();
          }
        }
      }
    });

    ro.observe(container);

    return () => {
      ro.disconnect();
    };
  }, [projectName, topology.canvasWidth, topology.canvasHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      let mouseX = e.clientX - rect.left;
      let mouseY = e.clientY - rect.top;

      if (mousePosRef.current && (isNaN(mouseX) || (mouseX === 0 && mouseY === 0))) {
        mouseX = mousePosRef.current.x;
        mouseY = mousePosRef.current.y;
      }

      if (e.ctrlKey || e.metaKey) {

        const zoomDelta = -e.deltaY * 0.003;
        const zoomFactor = Math.min(Math.max(Math.exp(zoomDelta), 0.90), 1.10);

        const { x, y, zoom } = viewRef.current;
        const nextZoom = Math.min(Math.max(0.35, zoom * zoomFactor), 2.5);

        const worldX = (mouseX - x) / zoom;
        const worldY = (mouseY - y) / zoom;

        const nextX = mouseX - worldX * nextZoom;
        const nextY = mouseY - worldY * nextZoom;

        const nextView = { x: nextX, y: nextY, zoom: nextZoom };
        updateView(nextView);
        if (wheelSaveTimeoutRef.current) {
          clearTimeout(wheelSaveTimeoutRef.current);
        }
        wheelSaveTimeoutRef.current = setTimeout(() => {
          saveLayout(nodePositionsRef.current, nextView);
        }, 300);
      } else {
        const { x, y, zoom } = viewRef.current;
        const nextView = {
          x: x - e.deltaX,
          y: y - e.deltaY,
          zoom,
        };
        updateView(nextView);
        if (wheelSaveTimeoutRef.current) {
          clearTimeout(wheelSaveTimeoutRef.current);
        }
        wheelSaveTimeoutRef.current = setTimeout(() => {
          saveLayout(nodePositionsRef.current, nextView);
        }, 300);
      }
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("wheel", onWheel);
    };
  }, []);

  const handleNodeMouseDown = (
    e: React.MouseEvent,
    id: string,
    type: "service" | "volume",
    pos: { x: number; y: number }
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    draggingNodeRef.current = {
      id,
      type,
      startX: e.clientX,
      startY: e.clientY,
      nodeStartX: pos.x,
      nodeStartY: pos.y,
      hasMoved: false,
    };
    lastClientMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".canvas-interactive")) {
      return;
    }
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - viewRef.current.x, y: e.clientY - viewRef.current.y };
    setIsDragging(true);
  };

  useEffect(() => {
    const checkAutoPan = () => {
      if (
        !draggingNodeRef.current ||
        !draggingNodeRef.current.hasMoved ||
        !containerRef.current ||
        !lastClientMousePosRef.current
      ) {
        if (autoPanFrameRef.current) {
          cancelAnimationFrame(autoPanFrameRef.current);
          autoPanFrameRef.current = null;
        }
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = lastClientMousePosRef.current.clientX - rect.left;
      const mouseY = lastClientMousePosRef.current.clientY - rect.top;
      const threshold = 60;
      let panX = 0;
      let panY = 0;

      if (mouseX < threshold) {
        panX = Math.min(16, Math.max(2, (threshold - mouseX) * 0.35));
      } else if (mouseX > rect.width - threshold) {
        panX = -Math.min(16, Math.max(2, (mouseX - (rect.width - threshold)) * 0.35));
      }

      if (mouseY < threshold + 40) {
        panY = Math.min(16, Math.max(2, (threshold + 40 - mouseY) * 0.35));
      } else if (mouseY > rect.height - threshold) {
        panY = -Math.min(16, Math.max(2, (mouseY - (rect.height - threshold)) * 0.35));
      }

      if (panX !== 0 || panY !== 0) {
        const nextView = {
          ...viewRef.current,
          x: viewRef.current.x + panX,
          y: viewRef.current.y + panY,
        };
        viewRef.current = nextView;
        setView(nextView);

        if (draggingNodeRef.current) {
          draggingNodeRef.current.startX += panX;
          draggingNodeRef.current.startY += panY;

          const zoom = nextView.zoom;
          const rawDx = (lastClientMousePosRef.current.clientX - draggingNodeRef.current.startX) / zoom;
          const rawDy = (lastClientMousePosRef.current.clientY - draggingNodeRef.current.startY) / zoom;
          const rawWorldX = draggingNodeRef.current.nodeStartX + rawDx;
          const rawWorldY = draggingNodeRef.current.nodeStartY + rawDy;

          const nodeW = draggingNodeRef.current.type === "service" ? 230 : 150;
          const nodeH = draggingNodeRef.current.type === "service" ? 100 : 44;

          const minScreenX = 40;
          const maxScreenX = Math.max(minScreenX, rect.width - nodeW * zoom - 40);
          const minScreenY = 64;
          const maxScreenY = Math.max(minScreenY, rect.height - nodeH * zoom - 40);

          const screenX = nextView.x + rawWorldX * zoom;
          const screenY = nextView.y + rawWorldY * zoom;

          const clampedScreenX = Math.min(Math.max(screenX, minScreenX), maxScreenX);
          const clampedScreenY = Math.min(Math.max(screenY, minScreenY), maxScreenY);

          const nextX = Math.round((clampedScreenX - nextView.x) / zoom);
          const nextY = Math.round((clampedScreenY - nextView.y) / zoom);

          nodePositionsRef.current = {
            ...nodePositionsRef.current,
            [draggingNodeRef.current.id]: { x: nextX, y: nextY },
          };
          setNodePositions({ ...nodePositionsRef.current });
        }
      }

      autoPanFrameRef.current = requestAnimationFrame(checkAutoPan);
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggingNodeRef.current) {
        lastClientMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };

        const zoom = viewRef.current.zoom;
        const rawDx = (e.clientX - draggingNodeRef.current.startX) / zoom;
        const rawDy = (e.clientY - draggingNodeRef.current.startY) / zoom;

        if (!draggingNodeRef.current.hasMoved && Math.hypot(rawDx, rawDy) > 3) {
          draggingNodeRef.current.hasMoved = true;
        }

        if (draggingNodeRef.current.hasMoved && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const nodeW = draggingNodeRef.current.type === "service" ? 230 : 150;
          const nodeH = draggingNodeRef.current.type === "service" ? 100 : 44;

          const rawWorldX = draggingNodeRef.current.nodeStartX + rawDx;
          const rawWorldY = draggingNodeRef.current.nodeStartY + rawDy;

          const minScreenX = 40;
          const maxScreenX = Math.max(minScreenX, rect.width - nodeW * zoom - 40);
          const minScreenY = 64;
          const maxScreenY = Math.max(minScreenY, rect.height - nodeH * zoom - 40);

          const screenX = viewRef.current.x + rawWorldX * zoom;
          const screenY = viewRef.current.y + rawWorldY * zoom;

          const clampedScreenX = Math.min(Math.max(screenX, minScreenX), maxScreenX);
          const clampedScreenY = Math.min(Math.max(screenY, minScreenY), maxScreenY);

          const nextX = Math.round((clampedScreenX - viewRef.current.x) / zoom);
          const nextY = Math.round((clampedScreenY - viewRef.current.y) / zoom);

          nodePositionsRef.current = {
            ...nodePositionsRef.current,
            [draggingNodeRef.current.id]: { x: nextX, y: nextY },
          };
          setNodePositions({ ...nodePositionsRef.current });

          if (!autoPanFrameRef.current) {
            autoPanFrameRef.current = requestAnimationFrame(checkAutoPan);
          }
        }
        return;
      }

      if (!isDraggingRef.current) return;
      updateView({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
        zoom: viewRef.current.zoom,
      });
    };

    const handleGlobalMouseUp = () => {
      if (autoPanFrameRef.current) {
        cancelAnimationFrame(autoPanFrameRef.current);
        autoPanFrameRef.current = null;
      }

      if (draggingNodeRef.current) {
        const wasDrag = draggingNodeRef.current.hasMoved;
        const nodeId = draggingNodeRef.current.id;
        const nodeType = draggingNodeRef.current.type;
        draggingNodeRef.current = null;

        if (wasDrag) {
          saveLayout(nodePositionsRef.current, viewRef.current);
        } else if (nodeType === "service") {
          setSelectedServiceId(nodeId);
        }
        return;
      }

      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        saveLayout(nodePositionsRef.current, viewRef.current);
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      if (autoPanFrameRef.current) {
        cancelAnimationFrame(autoPanFrameRef.current);
        autoPanFrameRef.current = null;
      }
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [topology]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest(".canvas-interactive")) return;

    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.touches[0].clientX - viewRef.current.x,
        y: e.touches[0].clientY - viewRef.current.y,
      };
      setIsDragging(true);
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStateRef.current = {
        dist,
        center: {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        },
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      updateView({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y,
        zoom: viewRef.current.zoom,
      });
    } else if (e.touches.length === 2 && touchStateRef.current && containerRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const rawFactor = newDist / touchStateRef.current.dist;
      const zoomFactor = Math.min(Math.max(1 + (rawFactor - 1) * 0.4, 0.92), 1.08);

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = touchStateRef.current.center.x - rect.left;
      const centerY = touchStateRef.current.center.y - rect.top;

      const { x, y, zoom } = viewRef.current;
      const nextZoom = Math.min(Math.max(0.35, zoom * zoomFactor), 2.5);

      const worldX = (centerX - x) / zoom;
      const worldY = (centerY - y) / zoom;

      updateView({
        x: centerX - worldX * nextZoom,
        y: centerY - worldY * nextZoom,
        zoom: nextZoom,
      });

      touchStateRef.current.dist = newDist;
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchStateRef.current = null;
    setIsDragging(false);
    saveLayout(nodePositionsRef.current, viewRef.current);
  };

  const handleZoomStep = (factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const { x, y, zoom } = viewRef.current;
    const nextZoom = Math.min(Math.max(0.35, zoom * factor), 2.5);

    const worldX = (centerX - x) / zoom;
    const worldY = (centerY - y) / zoom;

    const nextView = {
      x: centerX - worldX * nextZoom,
      y: centerY - worldY * nextZoom,
      zoom: nextZoom,
    };
    updateView(nextView);
    saveLayout(nodePositionsRef.current, nextView);
  };


  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full h-full min-h-[560px] overflow-hidden bg-background cursor-grab ${
        isDragging ? "cursor-grabbing" : ""
      }`}
      style={{
        backgroundImage: `radial-gradient(${
          isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.09)"
        } 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >

      <div className="absolute top-3 right-3 z-20 flex items-center space-x-1 bg-surface/90 backdrop-blur-xl border border-border/80 p-1 rounded-xl shadow-mac-segment canvas-interactive">
        <button
          onClick={handleResetView}
          className="flex items-center space-x-1 px-2 py-1 rounded-lg text-xs text-primary font-medium hover:bg-primary/10 transition-colors"
          title={t.compose.autoArrange}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-[11px] font-sans font-semibold">{t.compose.autoArrange}</span>
        </button>
        <div className="w-[1px] h-3.5 bg-border/80" />
        <button
          onClick={() => handleZoomStep(1.2)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
          title={t.compose.zoomIn}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-mono text-muted-foreground px-1 min-w-[38px] text-center">
          {Math.round(view.zoom * 100)}%
        </span>
        <button
          onClick={() => handleZoomStep(1 / 1.2)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
          title={t.compose.zoomOut}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <div className="w-[1px] h-3.5 bg-border/80" />
        <button
          onClick={handleFitView}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
          title={t.compose.resetZoom}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 max-w-lg pointer-events-none">
        <div className="bg-surface/90 backdrop-blur-xl border border-border/80 px-3 py-1.5 rounded-xl shadow-mac-segment pointer-events-auto flex items-center space-x-2 text-xs">
          <span className="font-semibold text-foreground tracking-tight">{projectName}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.7)]" />
          <span className="text-[11px] text-muted-foreground font-mono">
            {topology.services.length} {t.compose.servicesCount} • {topology.networks.length} {t.compose.networksCount} • {topology.volumes.length} {t.compose.volumesCount}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 pointer-events-auto">
          {topology.networks.map((net) => (
            <div
              key={net.id}
              onMouseEnter={() => setHoveredNetworkId(net.id)}
              onMouseLeave={() => setHoveredNetworkId(null)}
              className="bg-surface/80 backdrop-blur-sm border border-border/70 px-2 py-0.5 rounded-lg text-[10px] font-mono text-foreground/80 flex items-center space-x-1.5 shadow-2xs hover:border-foreground/40 transition-colors cursor-default"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: net.color }} />
              <span>{net.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`,
          transformOrigin: "0 0",
          width: topology.canvasWidth,
          height: topology.canvasHeight,
        }}
        className="absolute will-change-transform"
      >

        {topology.networks.map((net, netIdx) => {
          const memberServices = net.services
            .map((sId) => topology.services.find((s) => s.id === sId))
            .filter((s): s is ComposeServiceNode => !!s);

          if (memberServices.length === 0) return null;

          const positions = memberServices.map((s) => {
            const pos = getServicePos(s);
            return {
              x1: pos.x,
              y1: pos.y,
              x2: pos.x + s.width,
              y2: pos.y + s.height,
            };
          });

          const extraPad = netIdx * 8;
          const padX = 24 + extraPad;
          const padTop = 34 + extraPad;
          const padBottom = 22 + extraPad;

          const minX = Math.min(...positions.map((p) => p.x1)) - padX;
          const minY = Math.min(...positions.map((p) => p.y1)) - padTop;
          const maxX = Math.max(...positions.map((p) => p.x2)) + padX;
          const maxY = Math.max(...positions.map((p) => p.y2)) + padBottom;

          const width = maxX - minX;
          const height = maxY - minY;

          const isNetHovered =
            hoveredNetworkId === net.id ||
            memberServices.some((s) => s.id === hoveredNodeId) ||
            (selectedService && memberServices.some((s) => s.id === selectedService.id));

          const isLeft = netIdx % 2 === 0;
          const badgePosStyle = isLeft
            ? { left: 24 + Math.floor(netIdx / 2) * 200 }
            : { right: 24 + Math.floor(netIdx / 2) * 200 };

          return (
            <div
              key={net.id}
              style={{
                left: minX,
                top: minY,
                width,
                height,
                borderColor: isNetHovered ? net.color : isDark ? `${net.color}45` : `${net.color}65`,
                backgroundColor: isNetHovered ? `${net.color}0f` : isDark ? `${net.color}04` : `${net.color}0a`,
                boxShadow: isNetHovered ? `0 0 28px ${net.color}25` : "none",
              }}
              className="absolute rounded-3xl border-2 border-dashed pointer-events-none transition-all duration-200"
            >

              <div
                style={{
                  ...badgePosStyle,
                  top: -12,
                  color: net.color,
                  backgroundColor: "var(--surface)",
                  borderColor: isNetHovered ? net.color : isDark ? `${net.color}50` : `${net.color}75`,
                }}
                className="absolute px-2.5 py-0.5 rounded-md border flex items-center space-x-1.5 text-[10px] font-mono tracking-tight  shadow-xs z-10"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: net.color }} />
                <span className="font-semibold">{net.name}</span>
                <span className="text-[9px] opacity-70 font-sans">• {net.driver || "bridge"}</span>
              </div>
            </div>
          );
        })}

        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ overflow: "visible" }}
          width={topology.canvasWidth}
          height={topology.canvasHeight}
        >
          <defs>
            <linearGradient id="edge-running-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#30d158" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#007aff" stopOpacity="0.85" />
            </linearGradient>

            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <marker
              id="arrowhead-active"
              markerWidth="8"
              markerHeight="8"
              refX="4"
              refY="4"
              orient="auto"
            >
              <polygon points="1 1, 7 4, 1 7" fill="#007aff" opacity="0.95" />
            </marker>

            <marker
              id="arrowhead-muted"
              markerWidth="8"
              markerHeight="8"
              refX="4"
              refY="4"
              orient="auto"
            >
              <polygon points="1 1, 7 4, 1 7" fill={isDark ? "#52525b" : "#94a3b8"} opacity="0.85" />
            </marker>

            <marker
              id="arrowhead-volume"
              markerWidth="8"
              markerHeight="8"
              refX="4"
              refY="4"
              orient="auto"
            >
              <polygon points="1 1, 7 4, 1 7" fill="#38bdf8" opacity="0.9" />
            </marker>
          </defs>

          {topology.edges.map((edge) => {
            const fromService = topology.services.find((s) => s.id === edge.from);
            const toService = topology.services.find((s) => s.id === edge.to);
            const toVolume = !toService ? topology.volumes.find((v) => v.id === edge.to) : null;

            if (!fromService || (!toService && !toVolume)) return null;

            const fromPos = getServicePos(fromService);
            const toPos = toService ? getServicePos(toService) : toVolume ? getVolumePos(toVolume) : null;
            if (!toPos) return null;

            const isVolume = edge.type === "volume";
            const fromState = optimisticStates[fromService.id] || fromService.state;
            const toState = toService ? (optimisticStates[toService.id] || toService.state) : "running";
            const isRunning = isVolume
              ? fromState === "running"
              : fromState === "running" && toState === "running";

            const fromBox = {
              x: fromPos.x,
              y: fromPos.y,
              width: fromService.width,
              height: fromService.height,
            };

            const toBox = {
              x: toPos.x,
              y: toPos.y,
              width: toService ? toService.width : 130,
              height: toService ? toService.height : 40,
            };

            const outgoingEdges = topology.edges.filter((e) => e.from === edge.from);
            const outIdx = outgoingEdges.findIndex((e) => e.id === edge.id);
            const totalOut = outgoingEdges.length;

            const cFrom = { x: fromBox.x + fromBox.width / 2, y: fromBox.y + fromBox.height / 2 };
            const cTo = { x: toBox.x + toBox.width / 2, y: toBox.y + toBox.height / 2 };
            const dx = cTo.x - cFrom.x;
            const dy = cTo.y - cFrom.y;

            const verticalOverlap =
              Math.max(fromBox.y, toBox.y) < Math.min(fromBox.y + fromBox.height, toBox.y + toBox.height);
            const isHorizontal = verticalOverlap || Math.abs(dx) > Math.abs(dy) * 1.15;

            let pathD: string;

            if (isHorizontal) {
              if (dx >= 0) {

                const x1 = fromBox.x + fromBox.width;
                let y1 = cFrom.y;
                if (totalOut > 1) {
                  const spread = fromBox.height * 0.45;
                  y1 = cFrom.y - spread / 2 + (spread * outIdx) / (totalOut - 1);
                }
                const x2 = toBox.x - 6;
                const y2 = cTo.y;
                const dist = Math.max(28, Math.min(Math.abs(x2 - x1) * 0.45, 90));
                pathD = `M ${x1} ${y1} C ${x1 + dist} ${y1}, ${x2 - dist} ${y2}, ${x2} ${y2}`;
              } else {

                const x1 = fromBox.x;
                let y1 = cFrom.y;
                if (totalOut > 1) {
                  const spread = fromBox.height * 0.45;
                  y1 = cFrom.y - spread / 2 + (spread * outIdx) / (totalOut - 1);
                }
                const x2 = toBox.x + toBox.width + 6;
                const y2 = cTo.y;
                const dist = Math.max(28, Math.min(Math.abs(x1 - x2) * 0.45, 90));
                pathD = `M ${x1} ${y1} C ${x1 - dist} ${y1}, ${x2 + dist} ${y2}, ${x2} ${y2}`;
              }
            } else {
              if (dy >= 0) {

                let x1 = cFrom.x;
                if (totalOut > 1) {
                  const spread = fromBox.width - 64;
                  x1 = fromBox.x + 32 + (spread * outIdx) / (totalOut - 1);
                }
                const y1 = fromBox.y + fromBox.height;
                const x2 = cTo.x;
                const y2 = toBox.y - 6;
                const dist = Math.max(28, Math.min(Math.abs(y2 - y1) * 0.45, 90));
                pathD = `M ${x1} ${y1} C ${x1} ${y1 + dist}, ${x2} ${y2 - dist}, ${x2} ${y2}`;
              } else {

                let x1 = cFrom.x;
                if (totalOut > 1) {
                  const spread = fromBox.width - 64;
                  x1 = fromBox.x + 32 + (spread * outIdx) / (totalOut - 1);
                }
                const y1 = fromBox.y;
                const x2 = cTo.x;
                const y2 = toBox.y + toBox.height + 6;
                const dist = Math.max(28, Math.min(Math.abs(y1 - y2) * 0.45, 90));
                pathD = `M ${x1} ${y1} C ${x1} ${y1 - dist}, ${x2} ${y2 + dist}, ${x2} ${y2}`;
              }
            }

            const isHighlighted =
              hoveredNodeId === edge.from ||
              hoveredNodeId === edge.to ||
              selectedService?.id === edge.from ||
              selectedService?.id === edge.to;

            const hasActiveFocus = !!(hoveredNodeId || selectedService);
            const edgeOpacity = isHighlighted
              ? 1
              : hasActiveFocus
              ? 0.08
              : isVolume
              ? 0.7
              : 0.42;

            const markerId = isVolume
              ? "arrowhead-volume"
              : isRunning
              ? "arrowhead-active"
              : "arrowhead-muted";

            return (
              <g key={edge.id}>

                {isHighlighted && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isVolume ? "#38bdf8" : isRunning ? "#30d158" : isDark ? "#a855f7" : "#8b5cf6"}
                    strokeWidth="5"
                    opacity="0.4"
                    filter="url(#glow)"
                  />
                )}

                <path
                  d={pathD}
                  fill="none"
                  stroke={
                    isVolume
                      ? "#38bdf8"
                      : isRunning
                      ? isHighlighted
                        ? "#30d158"
                        : "url(#edge-running-gradient)"
                      : isDark
                      ? "#4b4b53"
                      : "#94a3b8"
                  }
                  strokeWidth={isHighlighted ? 2.6 : isVolume ? 1.4 : 1.6}
                  strokeDasharray={isVolume ? "4 3" : undefined}
                  opacity={edgeOpacity}
                  markerEnd={`url(#${markerId})`}
                  className="transition-opacity duration-200"
                />

                {isRunning && !isVolume && !hasActiveFocus && (
                  <circle r="2.5" fill="#30d158">
                    <animateMotion dur="2.8s" repeatCount="indefinite" path={pathD} />
                  </circle>
                )}
                {isRunning && !isVolume && isHighlighted && (
                  <circle r="3" fill="#30d158">
                    <animateMotion dur="2s" repeatCount="indefinite" path={pathD} />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {topology.services.map((svc) => {
          const pos = getServicePos(svc);
          const isSelected = selectedService?.id === svc.id;
          const isHovered = hoveredNodeId === svc.id;
          const effectiveState = optimisticStates[svc.id] || svc.state;
          const isRunning = effectiveState === "running";
          const isPaused = effectiveState === "paused";

          return (
            <div
              key={svc.id}
              onMouseDown={(e) => handleNodeMouseDown(e, svc.id, "service", pos)}
              onMouseEnter={() => setHoveredNodeId(svc.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{
                left: pos.x,
                top: pos.y,
                width: svc.width,
                minHeight: svc.height,
              }}
              className={`absolute rounded-xl border p-3 flex flex-col justify-between transition-shadow canvas-interactive cursor-grab active:cursor-grabbing  ${
                isSelected
                  ? "bg-surface/95 border-primary shadow-[0_0_22px_rgba(0,122,255,0.4)] ring-2 ring-primary/60"
                  : isHovered
                  ? "bg-surface/95 border-foreground/40 shadow-mac-segment"
                  : "bg-surface/85 backdrop-blur-xl border-border/80 shadow-mac-segment"
              }`}
            >

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isRunning
                        ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.8)]"
                        : isPaused
                        ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                        : "bg-status-stopped"
                    }`}
                  />
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <TechIcon image={svc.image} name={svc.name} role={svc.role} className="w-4 h-4" />
                    <span className="font-semibold text-xs text-foreground tracking-tight truncate">
                      {svc.name}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full border shrink-0 ${
                    getTechBadgeInfo(svc.image, svc.name, svc.role).badgeStyle
                  }`}
                >
                  {getTechBadgeInfo(svc.image, svc.name, svc.role).label}
                </span>
              </div>

              <div className="mt-1.5">
                <div className="text-[11px] font-mono text-muted-foreground truncate bg-surface-secondary/70 px-2 py-0.5 rounded-md border border-border/50">
                  {svc.image}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                <div className="flex items-center space-x-1 truncate">
                  {svc.ports.length > 0 ? (
                    svc.ports.map((p, i) => (
                      <span
                        key={i}
                        className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded truncate"
                      >
                        :{p.split(":")[0] || p}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground/60 italic text-[9px]">internal</span>
                  )}
                </div>

                {svc.volumes.length > 0 && (
                  <div className="flex items-center space-x-1 text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20 shrink-0">
                    <HardDrive className="w-2.5 h-2.5" />
                    <span>{svc.volumes.length}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {topology.volumes.map((vol) => {
          const pos = getVolumePos(vol);
          return (
            <div
              key={vol.id}
              onMouseDown={(e) => handleNodeMouseDown(e, vol.id, "volume", pos)}
              style={{
                left: pos.x,
                top: pos.y,
              }}
              className="absolute bg-surface/80 backdrop-blur-md border border-sky-500/30 rounded-lg px-2.5 py-1.5 flex items-center space-x-2 text-xs font-mono shadow-xs canvas-interactive cursor-grab active:cursor-grabbing "
            >
              <div className="w-5 h-5 rounded-md bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <HardDrive className="w-3 h-3" />
              </div>
              <div>
                <div className="font-semibold text-foreground text-[11px]">{vol.name}</div>
                <div className="text-[9px] text-muted-foreground">driver: {vol.driver}</div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedService && (
        <div className="absolute top-3 right-3 bottom-3 w-80 max-w-[calc(100%-24px)] bg-popover border border-popover-border rounded-2xl shadow-2xl shadow-black/80 flex flex-col z-30 animate-in slide-in-from-right duration-200 canvas-interactive">

          <div className="p-3.5 border-b border-border/70 flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  selectedService.state === "running"
                    ? "bg-status-running shadow-[0_0_8px_rgba(48,209,88,0.8)]"
                    : selectedService.state === "paused"
                    ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                    : "bg-status-stopped"
                }`}
              />
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <TechIcon
                    image={selectedService.image}
                    name={selectedService.name}
                    role={selectedService.role}
                    className="w-4 h-4"
                  />
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {selectedService.name}
                  </h3>
                </div>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span
                    className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full border shrink-0 ${
                      getTechBadgeInfo(selectedService.image, selectedService.name, selectedService.role).badgeStyle
                    }`}
                  >
                    {getTechBadgeInfo(selectedService.image, selectedService.name, selectedService.role).label}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    • {selectedService.state}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedServiceId(null)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">

            <div className="flex items-center space-x-2">
              {selectedService.state === "running" ? (
                <>
                  <button
                    disabled={actionLoading}
                    onClick={() =>
                      selectedService.containerId &&
                      handleServiceAction(selectedService.id, selectedService.containerId, "stop")
                    }
                    className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-surface border border-border text-status-restarting hover:bg-status-restarting/10 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Square className="w-3 h-3 fill-current" />
                    )}
                    <span>{t.containers.stop}</span>
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() =>
                      selectedService.containerId &&
                      handleServiceAction(selectedService.id, selectedService.containerId, "restart")
                    }
                    className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-surface border border-border text-sky-400 hover:bg-sky-400/10 transition-colors shadow-xs disabled:opacity-50"
                  >
                    <RotateCw className={`w-3 h-3 ${actionLoading ? "animate-spin" : ""}`} />
                    <span>{t.containers.restart}</span>
                  </button>
                </>
              ) : (
                <button
                  disabled={actionLoading}
                  onClick={() =>
                    selectedService.containerId &&
                    handleServiceAction(selectedService.id, selectedService.containerId, "start")
                  }
                  className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-status-running text-white hover:opacity-90 transition-opacity shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3 fill-current" />
                  )}
                  <span>{t.containers.start}</span>
                </button>
              )}

              {selectedService.containerId && (
                <>
                  <button
                    onClick={() =>
                      openRealNativeWindow({
                        id: `term-${selectedService.containerId}-${Date.now()}`,
                        title: `${selectedService.name} — Terminal`,
                        type: "terminal",
                        containerId: selectedService.containerId,
                        containerName: selectedService.name,
                      })
                    }
                    className="p-1.5 rounded-lg bg-surface border border-border text-foreground hover:text-primary transition-colors shadow-xs"
                    title="Open terminal window"
                  >
                    <Terminal className="w-3.5 h-3.5 text-primary" />
                  </button>
                  <button
                    onClick={() =>
                      openRealNativeWindow({
                        id: `logs-${selectedService.containerId}-${Date.now()}`,
                        title: `${selectedService.name} — Logs`,
                        type: "logs",
                        containerId: selectedService.containerId,
                        containerName: selectedService.name,
                      })
                    }
                    className="p-1.5 rounded-lg bg-surface border border-border text-foreground hover:text-sky-400 transition-colors shadow-xs"
                    title="Open logs window"
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                  </button>
                </>
              )}
            </div>

            {selectedService.containerId && (
              <button
                onClick={() => {
                  setActiveTab("containers");
                  setSelectedContainerId(selectedService.containerId!);
                }}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-primary-muted text-primary border border-primary/30 font-medium text-xs hover:bg-primary/20 transition-colors"
              >
                <span>{t.containers.selectToInspect}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}

            <div className="bg-surface-secondary/50 rounded-xl p-3 border border-border/60 space-y-2">
              <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                Image
              </div>
              <div className="font-mono text-xs text-foreground break-all">
                {selectedService.image}
              </div>
              {selectedService.command && (
                <>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold pt-1">
                    {t.compose.command}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground bg-surface p-1.5 rounded border border-border/50 break-all">
                    {selectedService.command}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                {t.compose.ports} ({selectedService.ports.length})
              </div>
              {selectedService.ports.length > 0 ? (
                <div className="space-y-1">
                  {selectedService.ports.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-surface-secondary/60 px-2 py-1 rounded-md border border-border/60 font-mono text-[11px] flex items-center justify-between"
                    >
                      <span className="text-foreground">:{p}</span>
                      <a
                        href={`http://localhost:${p.split(":")[0] || p}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center space-x-1"
                      >
                        <span>open</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground/70 italic text-[11px]">No exposed ports</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                {t.compose.networks}
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedService.networks.map((net, idx) => (
                  <span
                    key={idx}
                    className="bg-surface px-2 py-0.5 rounded-md border border-border font-mono text-[10px] text-foreground"
                  >
                    {net}
                  </span>
                ))}
              </div>
            </div>

            {selectedService.volumes.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  {t.compose.volumes} ({selectedService.volumes.length})
                </div>
                <div className="space-y-1 font-mono text-[10px]">
                  {selectedService.volumes.map((v, idx) => (
                    <div
                      key={idx}
                      className="bg-surface-secondary/50 p-1.5 rounded-md border border-border/60 text-muted-foreground break-all"
                    >
                      {v}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedService.environment && selectedService.environment.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  {t.compose.environment} ({selectedService.environment.length})
                </div>
                <div className="space-y-1 font-mono text-[10px] max-h-36 overflow-y-auto">
                  {selectedService.environment.map((env, idx) => (
                    <div
                      key={idx}
                      className="bg-surface-secondary/50 p-1.5 rounded-md border border-border/60 text-foreground break-all"
                    >
                      {env}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedService.dependsOn.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  {t.compose.dependsOn}
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedService.dependsOn.map((dep, idx) => (
                    <span
                      key={idx}
                      className="bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-md font-mono text-[10px]"
                    >
                      {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};