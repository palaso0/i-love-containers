import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FolderGit2 } from "lucide-react";
import { ComposeTopology, ComposeServiceNode } from "@/lib/composeParser";
import { useAppStore } from "@/stores/useAppStore";
import { ComposeServiceDrawer } from "./canvas/ComposeServiceDrawer";
import { useCanvasInteraction } from "./canvas/useCanvasInteraction";
import { ServiceNodeItem } from "./canvas/ServiceNodeItem";
import { VolumeNodeItem } from "./canvas/VolumeNodeItem";
import { ComposeEdgeOverlay } from "./canvas/ComposeEdgeOverlay";
import { ComposeNetworkHull } from "./canvas/ComposeNetworkHull";
import { ComposeCanvasToolbar } from "./canvas/ComposeCanvasToolbar";

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
  } = useAppStore();

  const isDark = theme === "dark";

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [optimisticStates, setOptimisticStates] = useState<
    Record<string, "running" | "stopped" | "paused">
  >({});
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredNetworkId, setHoveredNetworkId] = useState<string | null>(null);

  const onSelectService = useCallback((id: string) => {
    setSelectedServiceId(id);
  }, []);

  const {
    view,
    isDragging,
    containerRef,
    getServicePos,
    getVolumePos,
    handleResetView,
    handleFitView,
    handleZoomStep,
    handleMouseDown,
    handleNodeMouseDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useCanvasInteraction({
    topology,
    projectName,
    onSelectService,
  });

  const selectedService = useMemo<ComposeServiceNode | null>(() => {
    if (!selectedServiceId) return null;
    const base =
      topology.services.find((s) => s.id === selectedServiceId) || null;
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
    action: "start" | "stop" | "restart",
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

  const hasRunningServices = useMemo(() => {
    return topology.services.some((s) => {
      const state = optimisticStates[s.id] || s.state;
      return state === "running";
    });
  }, [topology.services, optimisticStates]);

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
      <ComposeCanvasToolbar
        projectName={projectName}
        servicesCount={topology.services.length}
        networks={topology.networks}
        volumesCount={topology.volumes.length}
        zoom={view.zoom}
        t={t}
        isActive={hasRunningServices}
        onResetView={handleResetView}
        onFitView={handleFitView}
        onZoomStep={handleZoomStep}
        onHoverNetwork={setHoveredNetworkId}
      />

      <div
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`,
          transformOrigin: "0 0",
          width: topology.canvasWidth,
          height: topology.canvasHeight,
        }}
        className="absolute will-change-transform"
      >
        <ComposeNetworkHull
          networks={topology.networks}
          services={topology.services}
          isDark={isDark}
          hoveredNetworkId={hoveredNetworkId}
          hoveredNodeId={hoveredNodeId}
          selectedService={selectedService}
          getServicePos={getServicePos}
        />

        <ComposeEdgeOverlay
          topology={topology}
          isDark={isDark}
          hoveredNodeId={hoveredNodeId}
          selectedService={selectedService}
          optimisticStates={optimisticStates}
          getServicePos={getServicePos}
          getVolumePos={getVolumePos}
        />

        {topology.services.map((svc) => {
          const pos = getServicePos(svc);
          const isSelected = selectedService?.id === svc.id;
          const isHovered = hoveredNodeId === svc.id;
          const effectiveState = optimisticStates[svc.id] || svc.state;

          return (
            <ServiceNodeItem
              key={svc.id}
              svc={svc}
              pos={pos}
              isSelected={isSelected}
              isHovered={isHovered}
              effectiveState={effectiveState}
              onMouseDown={(e) =>
                handleNodeMouseDown(e, svc.id, "service", pos)
              }
              onMouseEnter={() => setHoveredNodeId(svc.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
            />
          );
        })}

        {topology.volumes.map((vol) => {
          const pos = getVolumePos(vol);
          return (
            <VolumeNodeItem
              key={vol.id}
              vol={vol}
              pos={pos}
              onMouseDown={(e) => handleNodeMouseDown(e, vol.id, "volume", pos)}
            />
          );
        })}

        {topology.services.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="bg-surface/90 backdrop-blur-md border border-border/80 rounded-2xl p-6 text-center max-w-sm shadow-lg pointer-events-auto">
              <FolderGit2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Sin servicios en el YAML
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Define servicios en la pestaña{" "}
                <span className="font-semibold text-foreground">YAML</span> o
                levanta un stack con Docker Compose.
              </p>
            </div>
          </div>
        )}
      </div>

      {selectedService && (
        <ComposeServiceDrawer
          selectedService={selectedService}
          actionLoading={actionLoading}
          t={t}
          onClose={() => setSelectedServiceId(null)}
          handleServiceAction={handleServiceAction}
        />
      )}
    </div>
  );
};
