import React from "react";
import { ComposeNetworkNode, ComposeServiceNode } from "@/lib/composeParser";

interface ComposeNetworkHullProps {
  networks: ComposeNetworkNode[];
  services: ComposeServiceNode[];
  isDark: boolean;
  hoveredNetworkId: string | null;
  hoveredNodeId: string | null;
  selectedService: ComposeServiceNode | null;
  getServicePos: (svc: ComposeServiceNode) => { x: number; y: number };
}

export const ComposeNetworkHull: React.FC<ComposeNetworkHullProps> = ({
  networks,
  services,
  isDark,
  hoveredNetworkId,
  hoveredNodeId,
  selectedService,
  getServicePos,
}) => {
  return (
    <>
      {networks.map((net, netIdx) => {
        const memberServices = net.services
          .map((sId) => services.find((s) => s.id === sId))
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
          (selectedService &&
            memberServices.some((s) => s.id === selectedService.id));

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
              borderColor: isNetHovered
                ? net.color
                : isDark
                  ? `${net.color}45`
                  : `${net.color}65`,
              backgroundColor: isNetHovered
                ? `${net.color}0f`
                : isDark
                  ? `${net.color}04`
                  : `${net.color}0a`,
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
                borderColor: isNetHovered
                  ? net.color
                  : isDark
                    ? `${net.color}50`
                    : `${net.color}75`,
              }}
              className="absolute px-2.5 py-0.5 rounded-md border flex items-center space-x-1.5 text-[10px] font-mono tracking-tight shadow-xs z-10"
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: net.color }}
              />
              <span className="font-semibold">{net.name}</span>
              <span className="text-[9px] opacity-70 font-sans">
                • {net.driver || "bridge"}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
};
