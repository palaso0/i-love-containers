import React from "react";
import { ContainerFileItem } from "@/types";
import { formatBytes } from "@/lib/utils";
import { getFileIcon } from "./fileTypes";

interface FileGridViewProps {
  sortedFiles: ContainerFileItem[];
  selectedPaths: Set<string>;
  dropTarget: ContainerFileItem | null;
  gridContainerRef: React.RefObject<HTMLDivElement>;
  onDragStart: (e: React.DragEvent, item: ContainerFileItem) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onItemDragOver: (e: React.DragEvent, item: ContainerFileItem) => void;
  onItemDragLeave: (e: React.DragEvent, item: ContainerFileItem) => void;
  onItemDrop: (e: React.DragEvent, item: ContainerFileItem) => void;
  onSelect: (e: React.MouseEvent, item: ContainerFileItem) => void;
  onDoubleClick: (item: ContainerFileItem) => void;
  onContextMenu: (e: React.MouseEvent, item: ContainerFileItem) => void;
}

export const FileGridView: React.FC<FileGridViewProps> = ({
  sortedFiles,
  selectedPaths,
  dropTarget,
  gridContainerRef,
  onDragStart,
  onDragEnd,
  onItemDragOver,
  onItemDragLeave,
  onItemDrop,
  onSelect,
  onDoubleClick,
  onContextMenu,
}) => {
  return (
    <div ref={gridContainerRef} className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2 p-2">
      {sortedFiles.map((file) => {
        const Icon = getFileIcon(file);
        const isSelected = selectedPaths.has(file.path);
        const isDropTarget = dropTarget?.path === file.path;
        return (
          <div
            key={file.path}
            draggable={true}
            onDragStart={(e) => onDragStart(e, file)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => onItemDragOver(e, file)}
            onDragLeave={(e) => onItemDragLeave(e, file)}
            onDrop={(e) => onItemDrop(e, file)}
            onClick={(e) => onSelect(e, file)}
            onDoubleClick={() => onDoubleClick(file)}
            onContextMenu={(e) => onContextMenu(e, file)}
            className={`flex flex-col items-center justify-center p-2 rounded-xl cursor-pointer border transition-all text-center min-w-0 ${
              isDropTarget
                ? "bg-primary/30 border-primary ring-2 ring-primary scale-[1.03]"
                : isSelected
                ? "bg-primary/20 border-primary ring-2 ring-primary/60 shadow-md scale-[1.02]"
                : "bg-surface/50 hover:bg-surface border-border/60 hover:border-border"
            }`}
            title={`${file.name}${file.isDirectory ? "" : `\n${formatBytes(file.size)}`}\n${file.mtime}`}
          >
            <Icon
              className={`w-9 h-9 mb-1.5 transition-transform shrink-0 ${
                isSelected
                  ? "text-primary fill-primary/20 scale-105"
                  : file.isDirectory
                  ? "text-amber-400 fill-amber-400/20"
                  : "text-muted-foreground"
              }`}
            />
            <span
              className={`text-xs w-full break-words line-clamp-2 leading-tight px-1 py-0.5 rounded transition-colors ${
                isSelected
                  ? "bg-primary text-white font-semibold"
                  : "text-foreground font-medium"
              }`}
            >
              {file.name}
            </span>
            {!file.isDirectory && (
              <span
                className={`text-[10px] font-mono mt-0.5 truncate max-w-full ${
                  isSelected ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                {formatBytes(file.size)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
