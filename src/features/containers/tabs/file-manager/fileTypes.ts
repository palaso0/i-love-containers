import {
  Folder,
  File,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Link2,
} from "lucide-react";
import { ContainerFileItem, ContainerState } from "@/types";

export interface FileManagerTabProps {
  containerId: string;
  containerName?: string;
  containerState?: ContainerState;
}

export function getFileIcon(item: ContainerFileItem) {
  if (item.isDirectory) return Folder;
  if (item.isSymlink) return Link2;
  const ext = item.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "json":
    case "html":
    case "css":
    case "py":
    case "sh":
    case "yaml":
    case "yml":
    case "sql":
    case "dockerfile":
      return FileCode;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return ImageIcon;
    case "tar":
    case "gz":
    case "zip":
    case "rar":
    case "7z":
      return FileArchive;
    case "md":
    case "txt":
    case "log":
    case "env":
      return FileText;
    default:
      return File;
  }
}

export function getUniqueDuplicateName(originalName: string, existingNames: Set<string>): string {
  if (!existingNames.has(originalName)) return originalName;
  let base = originalName;
  let ext = "";
  const lastDot = originalName.lastIndexOf(".");
  if (lastDot > 0) {
    base = originalName.substring(0, lastDot);
    ext = originalName.substring(lastDot);
  }
  let candidate = `${base} copy${ext}`;
  let counter = 2;
  while (existingNames.has(candidate)) {
    candidate = `${base} copy ${counter}${ext}`;
    counter++;
  }
  return candidate;
}
