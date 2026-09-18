import React from "react";
import {
  ComposeTopology,
  ComposeServiceNode,
  ComposeVolumeNode,
} from "@/lib/composeParser";

interface ComposeEdgeOverlayProps {
  topology: ComposeTopology;
  isDark: boolean;
  hoveredNodeId: string | null;
  selectedService: ComposeServiceNode | null;
  optimisticStates: Record<string, "running" | "stopped" | "paused">;
  getServicePos: (svc: ComposeServiceNode) => { x: number; y: number };
  getVolumePos: (vol: ComposeVolumeNode) => { x: number; y: number };
}

export const ComposeEdgeOverlay: React.FC<ComposeEdgeOverlayProps> = ({
  topology,
  isDark,
  hoveredNodeId,
  selectedService,
  optimisticStates,
  getServicePos,
  getVolumePos,
}) => {
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: "visible" }}
      width={topology.canvasWidth}
      height={topology.canvasHeight}
    >
      <defs>
        <linearGradient
          id="edge-running-gradient"
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
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
          <polygon
            points="1 1, 7 4, 1 7"
            fill={isDark ? "#52525b" : "#94a3b8"}
            opacity="0.85"
          />
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
        const toVolume = !toService
          ? topology.volumes.find((v) => v.id === edge.to)
          : null;

        if (!fromService || (!toService && !toVolume)) return null;

        const fromPos = getServicePos(fromService);
        const toPos = toService
          ? getServicePos(toService)
          : toVolume
            ? getVolumePos(toVolume)
            : null;
        if (!toPos) return null;

        const isVolume = edge.type === "volume";
        const fromState = optimisticStates[fromService.id] || fromService.state;
        const toState = toService
          ? optimisticStates[toService.id] || toService.state
          : "running";
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

        const outgoingEdges = topology.edges.filter(
          (e) => e.from === edge.from,
        );
        const outIdx = outgoingEdges.findIndex((e) => e.id === edge.id);
        const totalOut = outgoingEdges.length;

        const cFrom = {
          x: fromBox.x + fromBox.width / 2,
          y: fromBox.y + fromBox.height / 2,
        };
        const cTo = {
          x: toBox.x + toBox.width / 2,
          y: toBox.y + toBox.height / 2,
        };
        const dx = cTo.x - cFrom.x;
        const dy = cTo.y - cFrom.y;

        const verticalOverlap =
          Math.max(fromBox.y, toBox.y) <
          Math.min(fromBox.y + fromBox.height, toBox.y + toBox.height);
        const isHorizontal =
          verticalOverlap || Math.abs(dx) > Math.abs(dy) * 1.15;

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
          const isObstacleBetween = (toY: number, fromY: number, checkX: number) => {
            const minY = Math.min(fromY, toY);
            const maxY = Math.max(fromY, toY);
            return topology.services.some((s) => {
              if (s.id === fromService.id || (toService && s.id === toService.id)) {
                return false;
              }
              const sPos = getServicePos(s);
              const cardTop = sPos.y;
              const cardBottom = sPos.y + s.height;
              const cardLeft = sPos.x;
              const cardRight = sPos.x + s.width;
              return cardTop > minY && cardBottom < maxY && checkX >= cardLeft && checkX <= cardRight;
            });
          };

          if (dy >= 0) {
            let x1 = cFrom.x;
            if (totalOut > 1) {
              const spread = fromBox.width - 64;
              x1 = fromBox.x + 32 + (spread * outIdx) / (totalOut - 1);
            }
            const y1 = fromBox.y + fromBox.height;
            const x2 = cTo.x;
            const y2 = toBox.y - 2;

            const hasBlock = isObstacleBetween(toBox.y, fromBox.y + fromBox.height, (x1 + x2) / 2);
            if (hasBlock) {
              const bypassX = Math.max(fromBox.x + fromBox.width, toBox.x + toBox.width) + 32;
              pathD = `M ${fromBox.x + fromBox.width} ${y1 - 16} C ${bypassX} ${y1}, ${bypassX} ${y2 - 20}, ${x2} ${y2}`;
            } else {
              const dist = Math.max(28, Math.min(Math.abs(y2 - y1) * 0.45, 90));
              pathD = `M ${x1} ${y1} C ${x1} ${y1 + dist}, ${x2} ${y2 - dist}, ${x2} ${y2}`;
            }
          } else {
            let x1 = cFrom.x;
            if (totalOut > 1) {
              const spread = fromBox.width - 64;
              x1 = fromBox.x + 32 + (spread * outIdx) / (totalOut - 1);
            }
            const y1 = fromBox.y;
            const x2 = cTo.x;
            const y2 = toBox.y + toBox.height + 2;

            const hasBlock = isObstacleBetween(fromBox.y, toBox.y + toBox.height, (x1 + x2) / 2);
            if (hasBlock) {
              const bypassX = Math.max(fromBox.x + fromBox.width, toBox.x + toBox.width) + 32;
              pathD = `M ${fromBox.x + fromBox.width} ${y1 + 16} C ${bypassX} ${y1}, ${bypassX} ${y2 + 20}, ${x2} ${y2}`;
            } else {
              const dist = Math.max(28, Math.min(Math.abs(y1 - y2) * 0.45, 90));
              pathD = `M ${x1} ${y1} C ${x1} ${y1 - dist}, ${x2 + dist} ${y2}, ${x2} ${y2}`;
            }
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
                stroke={
                  isVolume
                    ? "#38bdf8"
                    : isRunning
                      ? "#30d158"
                      : isDark
                        ? "#a855f7"
                        : "#8b5cf6"
                }
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
                <animateMotion
                  dur="2.8s"
                  repeatCount="indefinite"
                  path={pathD}
                />
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
  );
};
