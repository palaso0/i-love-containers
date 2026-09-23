import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const unitFactor = 1024;
  const unitDecimalPlaces = decimals < 0 ? 0 : decimals;
  const unitSizes = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(unitFactor));
  return `${parseFloat((bytes / Math.pow(unitFactor, index)).toFixed(unitDecimalPlaces))} ${unitSizes[index]}`;
}

export function formatRelativeTime(dateString: string): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const now = new Date();
  const elapsedSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

export function formatUptime(status: string = "", startedAt?: string): string {
  if (!status) return "";
  // Check if status is like "Up 2 hours", "Up About an hour", "Up 45 minutes", etc.
  const lower = status.toLowerCase();
  if (lower.startsWith("up ")) {
    // If it has health info like "Up 2 hours (healthy)", preserve or format
    return status;
  }
  if (startedAt) {
    const started = new Date(startedAt);
    if (!isNaN(started.getTime())) {
      const diffSec = Math.floor((Date.now() - started.getTime()) / 1000);
      if (diffSec < 60) return `Up ${diffSec}s`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `Up ${diffMin}m`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `Up ${diffHr}h`;
      const diffDays = Math.floor(diffHr / 24);
      return `Up ${diffDays}d`;
    }
  }
  return status;
}

export function normalizePath(p: string): string {
  const clean = (p || "").replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
  if (!clean || clean === "/") return "/";
  const segments = clean.split("/").filter(Boolean);
  return "/" + segments.join("/");
}

export function getParentPath(p: string): string | null {
  const norm = normalizePath(p);
  if (norm === "/") return null;
  const segments = norm.split("/").filter(Boolean);
  segments.pop();
  return segments.length === 0 ? "/" : "/" + segments.join("/");
}
