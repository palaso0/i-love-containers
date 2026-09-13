export interface FileManagerCachedState {
  currentPath: string;
  history: string[];
  historyIdx: number;
  viewMode: "list" | "grid";
  sortField: "name" | "size" | "mtime";
  sortAsc: boolean;
}

const cache = new Map<string, FileManagerCachedState>();

export function getFileManagerCache(containerId: string): FileManagerCachedState | undefined {
  return cache.get(containerId);
}

export function setFileManagerCache(
  containerId: string,
  state: Partial<FileManagerCachedState>
): void {
  const existing = cache.get(containerId) || {
    currentPath: "/",
    history: ["/"],
    historyIdx: 0,
    viewMode: "grid",
    sortField: "name",
    sortAsc: true,
  };

  cache.set(containerId, {
    ...existing,
    ...state,
  });
}

export function clearFileManagerCache(containerId: string): void {
  cache.delete(containerId);
}
