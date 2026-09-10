import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Folder,
  FolderPlus,
  FilePlus,
  File,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Upload,
  Download,
  RotateCw,
  ChevronRight,
  ChevronLeft,
  ArrowUp,
  Home,
  Search,
  LayoutGrid,
  List as ListIcon,
  Copy,
  Scissors,
  ClipboardPaste,
  Trash2,
  Edit2,
  X,
  Eye,
  Save,
  HardDrive,
  Link2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ContainerFileItem } from "@/types";
import {
  fetchContainerFiles,
  fetchFileContent,
  saveContainerFile,
  createContainerFolder,
  createContainerFile,
  renameContainerFile,
  deleteContainerFiles,
  copyContainerFile,
  uploadContainerFile,
  downloadContainerFile,
  copyHostFileToContainer,
} from "@/lib/api";
import { useAppStore } from "@/stores/useAppStore";

interface FileManagerTabProps {
  containerId: string;
  containerName?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(item: ContainerFileItem) {
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

function getUniqueDuplicateName(originalName: string, existingNames: Set<string>): string {
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

export const FileManagerTab: React.FC<FileManagerTabProps> = ({
  containerId,
}) => {
  const { t } = useAppStore();
  const fm = t.containers.fileManager;

  const [currentPath, setCurrentPath] = useState<string>("/");
  const [history, setHistory] = useState<string[]>(["/"]);
  const [historyIdx, setHistoryIdx] = useState<number>(0);
  const [files, setFiles] = useState<ContainerFileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [sortField, setSortField] = useState<"name" | "size" | "mtime">("name");
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isEditingPath, setIsEditingPath] = useState<boolean>(false);
  const [pathInput, setPathInput] = useState<string>("/");
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const [dropStatus, setDropStatus] = useState<{
    type: "loading" | "success" | "error";
    message: string;
  } | null>(null);

  const lastProcessedPathsRef = useRef<{ timestamp: number; key: string }>({
    timestamp: 0,
    key: "",
  });

  const [clipboard, setClipboard] = useState<{
    action: "copy" | "cut";
    items: ContainerFileItem[];
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item?: ContainerFileItem;
  } | null>(null);

  const [viewerModal, setViewerModal] = useState<{
    item: ContainerFileItem;
    content: string;
    originalContent: string;
    isBinary: boolean;
    isSaving: boolean;
  } | null>(null);

  const [renameModal, setRenameModal] = useState<{
    item: ContainerFileItem;
    newName: string;
  } | null>(null);

  const [newFolderModal, setNewFolderModal] = useState<{ name: string } | null>(null);
  const [newFileModal, setNewFileModal] = useState<{ name: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ items: ContainerFileItem[] } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const lastClickedIndexRef = useRef<number>(-1);
  const shiftAnchorIndexRef = useRef<number>(-1);
  const cursorIndexRef = useRef<number>(-1);

  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;

  const fmRef = useRef(fm);
  fmRef.current = fm;

  const loadFiles = useCallback(
    async (path: string) => {
      setIsLoading(true);
      try {
        const res = await fetchContainerFiles(containerId, path);
        setFiles(res.entries || []);
        setCurrentPath(res.currentPath || path);
        setPathInput(res.currentPath || path);
        setSelectedPaths(new Set());
      } catch {
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    },
    [containerId]
  );

  useEffect(() => {
    loadFiles(currentPath);
  }, [loadFiles, currentPath]);

  // Listen to native Tauri OS drag-drop events (from Finder/Desktop)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isMounted = true;

    async function handleTauriDrop(paths: string[]) {
      if (!isMounted || !paths || paths.length === 0) return;
      const dedupeKey = paths.slice().sort().join("|");
      lastProcessedPathsRef.current = { timestamp: Date.now(), key: dedupeKey };

      const targetDir = currentPathRef.current;
      const count = paths.length;
      setDropStatus({
        type: "loading",
        message: `${fmRef.current.uploading} (${count})`,
      });

      let anyError = "";
      let successCount = 0;

      for (const hostPath of paths) {
        try {
          // Try Tauri IPC command (docker cp via Rust)
          const res = await copyHostFileToContainer(containerId, targetDir, hostPath);
          if (res.ok) {
            successCount++;
          } else {
            anyError = res.error || fmRef.current.uploadFailed;
          }
        } catch (e) {
          anyError = String(e);
        }
      }

      await loadFiles(targetDir);

      if (anyError && successCount === 0) {
        setDropStatus({ type: "error", message: anyError });
      } else if (anyError) {
        setDropStatus({
          type: "error",
          message: `${fmRef.current.uploadSuccess} (${successCount}/${count}) - ${anyError}`,
        });
      } else {
        setDropStatus({ type: "success", message: fmRef.current.uploadSuccess });
      }

      setTimeout(() => {
        if (isMounted) setDropStatus(null);
      }, 4000);
    }

    async function initTauriDragDrop() {
      // Strategy 1: try getCurrentWebview().onDragDropEvent (scoped to this webview)
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const currentWebview = getCurrentWebview();
        const unlistenFn = await currentWebview.onDragDropEvent(async (event) => {
          if (!isMounted) return;
          if (event.payload.type === "over" || event.payload.type === "enter") {
            setIsDraggingOver(true);
          } else if (event.payload.type === "drop") {
            setIsDraggingOver(false);
            await handleTauriDrop(event.payload.paths);
          } else {
            setIsDraggingOver(false);
          }
        });
        if (isMounted) {
          unlisten = unlistenFn;
        } else {
          unlistenFn();
        }
        return;
      } catch (e) {
      }

      // Strategy 2: global listen on tauri://drag-drop
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const unlistenFn = await listen<any>("tauri://drag-drop", async (event) => {
          if (!isMounted) return;
          const payload = event.payload;
          if (payload.type === "over" || payload.type === "enter") {
            setIsDraggingOver(true);
          } else if (payload.type === "drop") {
            setIsDraggingOver(false);
            await handleTauriDrop(payload.paths);
          } else {
            setIsDraggingOver(false);
          }
        });
        if (isMounted) {
          unlisten = unlistenFn;
        } else {
          unlistenFn();
        }
      } catch (e2) {
      }
    }

    initTauriDragDrop();

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [containerId, loadFiles]);

  // Fallback: native DOM drag listeners (works in Tauri WKWebView where React synthetic events don't fire for OS file drops)
  useEffect(() => {
    let dragEnterCount = 0;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
      setIsDraggingOver(true);
    };

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragEnterCount++;
      setIsDraggingOver(true);
    };

    const onDragLeave = () => {
      dragEnterCount--;
      if (dragEnterCount <= 0) {
        dragEnterCount = 0;
        setIsDraggingOver(false);
      }
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragEnterCount = 0;
      setIsDraggingOver(false);

      if (Date.now() - lastProcessedPathsRef.current.timestamp < 1500) {
        return;
      }

      const droppedFiles = e.dataTransfer?.files;
      if (!droppedFiles || droppedFiles.length === 0) return;

      const filesList = Array.from(droppedFiles);
      const targetDir = currentPathRef.current;
      setDropStatus({ type: "loading", message: `${fmRef.current.uploading} (${filesList.length})` });
      setIsLoading(true);

      let anyError = false;
      let successCount = 0;
      for (const file of filesList) {
        try {
          const res = await uploadContainerFile(containerId, targetDir, file);
          if (res.ok) successCount++;
          else anyError = true;
        } catch {
          anyError = true;
        }
      }

      await loadFiles(targetDir);
      setIsLoading(false);

      if (anyError && successCount === 0) {
        setDropStatus({ type: "error", message: fmRef.current.uploadFailed });
      } else if (anyError) {
        setDropStatus({
          type: "error",
          message: `${fmRef.current.uploadSuccess} (${successCount}/${filesList.length}) - ${fmRef.current.uploadFailed}`,
        });
      } else {
        setDropStatus({ type: "success", message: fmRef.current.uploadSuccess });
      }

      setTimeout(() => setDropStatus(null), 4000);
    };

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);

    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, [containerId, loadFiles]);

  const navigateTo = (newPath: string) => {
    if (newPath === currentPath) return;
    const newHistory = history.slice(0, historyIdx + 1);
    newHistory.push(newPath);
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
    setCurrentPath(newPath);
  };

  const handleBack = () => {
    if (historyIdx > 0) {
      const prev = history[historyIdx - 1];
      setHistoryIdx(historyIdx - 1);
      setCurrentPath(prev);
    }
  };

  const handleForward = () => {
    if (historyIdx < history.length - 1) {
      const next = history[historyIdx + 1];
      setHistoryIdx(historyIdx + 1);
      setCurrentPath(next);
    }
  };

  const handleUp = () => {
    if (currentPath === "/") return;
    const segments = currentPath.split("/").filter(Boolean);
    segments.pop();
    const upPath = segments.length === 0 ? "/" : "/" + segments.join("/");
    navigateTo(upPath);
  };

  const handleRefresh = () => {
    loadFiles(currentPath);
  };

  const handleItemDoubleClick = async (item: ContainerFileItem) => {
    if (item.isDirectory) {
      navigateTo(item.path);
    } else {
      setIsLoading(true);
      try {
        const data = await fetchFileContent(containerId, item.path);
        setViewerModal({
          item,
          content: data.content || "",
          originalContent: data.content || "",
          isBinary: data.isBinary,
          isSaving: false,
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const sortedFiles = [...files]
    .filter((f) =>
      searchQuery ? f.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
    )
    .sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "size") {
        cmp = a.size - b.size;
      } else if (sortField === "mtime") {
        cmp = a.mtime.localeCompare(b.mtime);
      }
      return sortAsc ? cmp : -cmp;
    });

  const handleSelect = (e: React.MouseEvent, item: ContainerFileItem) => {
    e.stopPropagation();
    setContextMenu(null);
    const clickedIndex = sortedFiles.findIndex((f) => f.path === item.path);
    cursorIndexRef.current = clickedIndex;

    if (e.shiftKey && lastClickedIndexRef.current >= 0) {
      const start = Math.min(lastClickedIndexRef.current, clickedIndex);
      const end = Math.max(lastClickedIndexRef.current, clickedIndex);
      const rangePaths = sortedFiles.slice(start, end + 1).map((f) => f.path);
      if (e.metaKey || e.ctrlKey) {
        const next = new Set(selectedPaths);
        rangePaths.forEach((p) => next.add(p));
        setSelectedPaths(next);
      } else {
        setSelectedPaths(new Set(rangePaths));
      }
    } else if (e.metaKey || e.ctrlKey) {
      const next = new Set(selectedPaths);
      if (next.has(item.path)) next.delete(item.path);
      else next.add(item.path);
      setSelectedPaths(next);
      lastClickedIndexRef.current = clickedIndex;
    } else {
      setSelectedPaths(new Set([item.path]));
      lastClickedIndexRef.current = clickedIndex;
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item?: ContainerFileItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (item && !selectedPaths.has(item.path)) {
      setSelectedPaths(new Set([item.path]));
    }
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  useEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const el = contextMenuRef.current;
    const rect = el.getBoundingClientRect();
    let x = contextMenu.x;
    let y = contextMenu.y;
    let changed = false;
    if (x + rect.width > window.innerWidth) {
      x = window.innerWidth - rect.width - 4;
      changed = true;
    }
    if (y + rect.height > window.innerHeight) {
      y = window.innerHeight - rect.height - 4;
      changed = true;
    }
    if (x < 0) { x = 4; changed = true; }
    if (y < 0) { y = 4; changed = true; }
    if (changed) {
      el.style.left = x + "px";
      el.style.top = y + "px";
    }
  }, [contextMenu]);

  useEffect(() => {
    const handleDismiss = (e: MouseEvent | TouchEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handleDismiss, true);
    window.addEventListener("touchstart", handleDismiss, true);
    return () => {
      window.removeEventListener("mousedown", handleDismiss, true);
      window.removeEventListener("touchstart", handleDismiss, true);
    };
  }, []);

  const handleCopy = useCallback((item?: ContainerFileItem) => {
    const targetItems = item
      ? [item]
      : files.filter((f) => selectedPaths.has(f.path));
    if (targetItems.length > 0) {
      setClipboard({ action: "copy", items: targetItems });
    }
    setContextMenu(null);
  }, [files, selectedPaths]);

  const handleCut = useCallback((item?: ContainerFileItem) => {
    const targetItems = item
      ? [item]
      : files.filter((f) => selectedPaths.has(f.path));
    if (targetItems.length > 0) {
      setClipboard({ action: "cut", items: targetItems });
    }
    setContextMenu(null);
  }, [files, selectedPaths]);

  const handlePaste = useCallback(async () => {
    if (!clipboard || clipboard.items.length === 0) return;
    setIsLoading(true);
    const existingNames = new Set(files.map((f) => f.name));
    for (const item of clipboard.items) {
      let destName = item.name;
      if (clipboard.action === "copy") {
        destName = getUniqueDuplicateName(item.name, existingNames);
        existingNames.add(destName);
      } else if (
        existingNames.has(item.name) &&
        item.path !== (currentPath === "/" ? `/${item.name}` : `${currentPath}/${item.name}`)
      ) {
        destName = getUniqueDuplicateName(item.name, existingNames);
        existingNames.add(destName);
      }
      const target =
        currentPath === "/" ? `/${destName}` : `${currentPath}/${destName}`;
      if (clipboard.action === "copy") {
        await copyContainerFile(containerId, item.path, target);
      } else {
        await renameContainerFile(containerId, item.path, target);
      }
    }
    if (clipboard.action === "cut") setClipboard(null);
    await loadFiles(currentPath);
    setIsLoading(false);
    setContextMenu(null);
  }, [clipboard, containerId, currentPath, files, loadFiles]);

  const handleDownload = async (item?: ContainerFileItem) => {
    const target = item || files.find((f) => selectedPaths.has(f.path));
    if (target && !target.isDirectory) {
      await downloadContainerFile(containerId, target.path, target.name);
    }
    setContextMenu(null);
  };

  const handleCopyPath = (item?: ContainerFileItem) => {
    const target = item || files.find((f) => selectedPaths.has(f.path));
    if (target) {
      navigator.clipboard.writeText(target.path);
    }
    setContextMenu(null);
  };

  const handleFileDragStart = async (e: React.DragEvent, file: ContainerFileItem) => {
    e.stopPropagation();
    if (file.isDirectory) return;

    const filesToDrag = selectedPaths.has(file.path)
      ? files.filter((f) => selectedPaths.has(f.path) && !f.isDirectory)
      : [file];

    if (filesToDrag.length === 0) return;

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const { startDrag } = await import("@crabnebula/tauri-plugin-drag");

      setDropStatus({ type: "loading", message: `Preparing ${filesToDrag.length} file(s)...` });

      const tempPaths: string[] = [];
      for (const f of filesToDrag) {
        const tempPath = await invoke<string>("copy_file_from_container", {
          containerId,
          filePath: f.path,
        });
        tempPaths.push(tempPath);
      }

      setDropStatus(null);

      await startDrag({
        item: tempPaths,
        icon: tempPaths[0],
      });
    } catch (err) {
      setDropStatus(null);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    // If Tauri already handled this drop in the last 1.5 seconds, skip duplicate
    if (Date.now() - lastProcessedPathsRef.current.timestamp < 1500) {
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesList = Array.from(e.dataTransfer.files);
      const targetDir = currentPathRef.current;
      setDropStatus({
        type: "loading",
        message: `${fm.uploading} (${filesList.length})`,
      });
      setIsLoading(true);

      let anyError = false;
      let successCount = 0;
      for (const file of filesList) {
        try {
          const res = await uploadContainerFile(containerId, targetDir, file);
          if (res.ok) {
            successCount++;
          } else {
            anyError = true;
          }
        } catch {
          anyError = true;
        }
      }

      await loadFiles(targetDir);
      setIsLoading(false);

      if (anyError && successCount === 0) {
        setDropStatus({ type: "error", message: fm.uploadFailed });
      } else if (anyError) {
        setDropStatus({
          type: "error",
          message: `${fm.uploadSuccess} (${successCount}/${filesList.length}) - ${fm.uploadFailed}`,
        });
      } else {
        setDropStatus({ type: "success", message: fm.uploadSuccess });
      }

      setTimeout(() => {
        setDropStatus(null);
      }, 4000);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      const filesList = Array.from(selectedFiles);
      const targetDir = currentPathRef.current;
      setDropStatus({
        type: "loading",
        message: `${fm.uploading} (${filesList.length})`,
      });
      setIsLoading(true);

      let anyError = false;
      let successCount = 0;
      try {
        for (const file of filesList) {
          try {
            const res = await uploadContainerFile(containerId, targetDir, file);
            if (res.ok) {
              successCount++;
            } else {
              anyError = true;
            }
          } catch {
            anyError = true;
          }
        }
        await loadFiles(targetDir);
        if (anyError && successCount === 0) {
          setDropStatus({ type: "error", message: fm.uploadFailed });
        } else if (anyError) {
          setDropStatus({
            type: "error",
            message: `${fm.uploadSuccess} (${successCount}/${filesList.length}) - ${fm.uploadFailed}`,
          });
        } else {
          setDropStatus({ type: "success", message: fm.uploadSuccess });
        }
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => {
          setDropStatus(null);
        }, 4000);
      }
    }
  };

  const handleSaveAndClose = async () => {
    if (!viewerModal) return;
    setViewerModal((prev) => (prev ? { ...prev, isSaving: true } : null));
    await saveContainerFile(containerId, viewerModal.item.path, viewerModal.content);
    setViewerModal(null);
    await loadFiles(currentPath);
  };

  const handleDownloadChanges = () => {
    if (!viewerModal) return;
    const blob = new Blob([viewerModal.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = viewerModal.item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        viewerModal ||
        renameModal ||
        newFolderModal ||
        newFileModal ||
        deleteModal
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopy();
      } else if (cmdKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        handleCut();
      } else if (cmdKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePaste();
      } else if (cmdKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedPaths(new Set(files.map((f) => f.path)));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedPaths.size > 0) {
          e.preventDefault();
          const itemsToDelete = files.filter((f) => selectedPaths.has(f.path));
          if (itemsToDelete.length > 0) {
            setDeleteModal({ items: itemsToDelete });
          }
        }
      } else if (e.key === "Enter") {
        if (selectedPaths.size === 1) {
          const selectedPath = Array.from(selectedPaths)[0];
          const item = files.find((f) => f.path === selectedPath);
          if (item) {
            e.preventDefault();
            handleItemDoubleClick(item);
          }
        }
    } else if (e.key === "Escape") {
      setSelectedPaths(new Set());
      setContextMenu(null);
      shiftAnchorIndexRef.current = -1;
      lastClickedIndexRef.current = -1;
      cursorIndexRef.current = -1;
      } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        if (sortedFiles.length === 0) return;

        const currentIdx = cursorIndexRef.current >= 0
          ? cursorIndexRef.current
          : (selectedPaths.size > 0
            ? sortedFiles.findIndex((f) => selectedPaths.has(f.path))
            : -1);

        let nextIdx: number;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          nextIdx = currentIdx < sortedFiles.length - 1 ? currentIdx + 1 : 0;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : sortedFiles.length - 1;
        }

        cursorIndexRef.current = nextIdx;

        if (e.shiftKey) {
          if (shiftAnchorIndexRef.current < 0) {
            shiftAnchorIndexRef.current = currentIdx >= 0 ? currentIdx : 0;
          }
          const anchor = shiftAnchorIndexRef.current;
          const start = Math.min(anchor, nextIdx);
          const end = Math.max(anchor, nextIdx);
          const rangePaths = sortedFiles.slice(start, end + 1).map((f) => f.path);
          setSelectedPaths(new Set(rangePaths));
        } else {
          shiftAnchorIndexRef.current = nextIdx;
          setSelectedPaths(new Set([sortedFiles[nextIdx].path]));
          lastClickedIndexRef.current = nextIdx;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    files,
    sortedFiles,
    selectedPaths,
    clipboard,
    currentPath,
    handleCopy,
    handleCut,
    handlePaste,
    viewerModal,
    renameModal,
    newFolderModal,
    newFileModal,
    deleteModal,
  ]);

  const pathBreadcrumbs = currentPath === "/" ? [""] : currentPath.split("/");

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-background overflow-hidden relative"
      onClick={() => {
        setSelectedPaths(new Set());
        setContextMenu(null);
      }}
      onContextMenu={(e) => handleContextMenu(e)}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDraggingOver(false);
        }
      }}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="absolute -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-px h-px"
        tabIndex={-1}
        multiple
      />

      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-surface/40 border-b border-border/70 shrink-0">
        <div className="flex items-center space-x-1">
          <button
            onClick={handleBack}
            disabled={historyIdx <= 0}
            className="p-1.5 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors shadow-xs"
            title="Back"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleForward}
            disabled={historyIdx >= history.length - 1}
            className="p-1.5 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors shadow-xs"
            title="Forward"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleUp}
            disabled={currentPath === "/"}
            className="p-1.5 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors shadow-xs"
            title="Up one level"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigateTo("/")}
            disabled={currentPath === "/"}
            className="p-1.5 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors shadow-xs"
            title={fm.rootDirectory}
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground transition-colors shadow-xs"
            title={fm.refresh}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex-1 min-w-[180px] max-w-xl mx-1">
          {isEditingPath ? (
            <input
              type="text"
              value={pathInput}
              autoFocus
              onChange={(e) => setPathInput(e.target.value)}
              onBlur={() => {
                setIsEditingPath(false);
                navigateTo(pathInput || "/");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setIsEditingPath(false);
                  navigateTo(pathInput || "/");
                } else if (e.key === "Escape") {
                  setIsEditingPath(false);
                  setPathInput(currentPath);
                }
              }}
              className="w-full px-2.5 py-1 text-xs font-mono bg-surface border border-primary/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingPath(true);
              }}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs font-mono bg-surface/70 border border-border/70 rounded-md cursor-text hover:border-border text-muted-foreground overflow-x-auto"
              title="Click to edit path"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateTo("/");
                }}
                className="hover:opacity-80 transition-opacity flex items-center shrink-0 mr-1"
                title={fm.rootDirectory}
              >
                <HardDrive className="w-3.5 h-3.5 text-primary" />
              </button>
              {pathBreadcrumbs.map((seg, idx) => {
                const isLast = idx === pathBreadcrumbs.length - 1;
                const segPath =
                  idx === 0
                    ? "/"
                    : pathBreadcrumbs.slice(0, idx + 1).join("/") || "/";
                return (
                  <React.Fragment key={segPath}>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateTo(segPath);
                      }}
                      className={`hover:text-primary cursor-pointer hover:underline ${
                        isLast ? "text-foreground font-semibold" : ""
                      }`}
                    >
                      {seg === "" ? "/" : seg}
                    </span>
                    {!isLast && idx !== 0 && (
                      <span className="text-muted-foreground/50">/</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={fm.searchPlaceholder}
              value={searchQuery}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-2 py-1 text-xs bg-surface/70 border border-border/70 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-32 sm:w-40"
            />
          </div>

          <div className="h-4 w-[1px] bg-border/60 mx-0.5" />

          <button
            onClick={(e) => {
              e.stopPropagation();
              setNewFolderModal({ name: "" });
            }}
            className="flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-md bg-surface border border-border/70 hover:bg-surface-secondary text-foreground transition-colors shadow-xs"
            title={fm.newFolder}
          >
            <FolderPlus className="w-3.5 h-3.5 text-primary" />
            <span className="hidden md:inline">{fm.newFolder}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setNewFileModal({ name: "" });
            }}
            className="flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-md bg-surface border border-border/70 hover:bg-surface-secondary text-foreground transition-colors shadow-xs"
            title={fm.newFile}
          >
            <FilePlus className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">{fm.newFile}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
                fileInputRef.current.click();
              }
            }}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 transition-colors shadow-xs"
            title={fm.upload}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{fm.upload}</span>
          </button>

          <div className="h-4 w-[1px] bg-border/60 mx-0.5" />

          <div className="flex items-center bg-surface-secondary/70 border border-border/60 p-0.5 rounded-lg shadow-xs">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewMode("list");
              }}
              className={`p-1 rounded ${
                viewMode === "list"
                  ? "bg-surface text-foreground shadow-mac-segment"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={fm.listView}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewMode("grid");
              }}
              className={`p-1 rounded ${
                viewMode === "grid"
                  ? "bg-surface text-foreground shadow-mac-segment"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={fm.gridView}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div
        className="flex-1 overflow-auto p-2 relative"
        onClick={() => {
          setSelectedPaths(new Set());
          setContextMenu(null);
        }}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            handleContextMenu(e);
          }
        }}
      >
        {dropStatus && (
          <div
            className={`fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-2.5 rounded-xl border shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200 ${
              dropStatus.type === "loading"
                ? "bg-surface/90 border-border text-foreground"
                : dropStatus.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
            }`}
          >
            {dropStatus.type === "loading" && <Loader2 className="w-4 h-4 animate-spin shrink-0 text-primary" />}
            {dropStatus.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />}
            {dropStatus.type === "error" && <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />}
            <span className="text-xs font-medium">{dropStatus.message}</span>
            <button
              onClick={() => setDropStatus(null)}
              className="ml-2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {sortedFiles.length === 0 && !isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <Folder className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-xs font-medium">{fm.emptyDirectory}</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="min-w-[600px] text-xs font-mono">
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 font-sans font-semibold text-2xs text-muted-foreground border-b border-border/60 ">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (sortField === "name") setSortAsc(!sortAsc);
                  else {
                    setSortField("name");
                    setSortAsc(true);
                  }
                }}
                className="col-span-6 flex items-center space-x-1 cursor-pointer hover:text-foreground"
              >
                <span>{fm.name}</span>
                {sortField === "name" && (
                  <span>{sortAsc ? "↑" : "↓"}</span>
                )}
              </div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (sortField === "size") setSortAsc(!sortAsc);
                  else {
                    setSortField("size");
                    setSortAsc(true);
                  }
                }}
                className="col-span-2 text-right cursor-pointer hover:text-foreground"
              >
                <span>{fm.size}</span>
                {sortField === "size" && (
                  <span>{sortAsc ? "↑" : "↓"}</span>
                )}
              </div>
              <div className="col-span-2 text-center">{fm.permissions}</div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (sortField === "mtime") setSortAsc(!sortAsc);
                  else {
                    setSortField("mtime");
                    setSortAsc(true);
                  }
                }}
                className="col-span-2 text-right cursor-pointer hover:text-foreground"
              >
                <span>{fm.modified}</span>
                {sortField === "mtime" && (
                  <span>{sortAsc ? "↑" : "↓"}</span>
                )}
              </div>
            </div>

            <div className="divide-y divide-border/30">
              {sortedFiles.map((file) => {
                const Icon = getFileIcon(file);
                const isSelected = selectedPaths.has(file.path);
                return (
                  <div
                    key={file.path}
                    draggable={!file.isDirectory}
                    onDragStart={(e) => handleFileDragStart(e, file)}
                    onClick={(e) => handleSelect(e, file)}
                    onDoubleClick={() => handleItemDoubleClick(file)}
                    onContextMenu={(e) => handleContextMenu(e, file)}
                    className={`grid grid-cols-12 gap-2 px-3 py-2 items-center cursor-pointer rounded-lg transition-colors ${
                      isSelected
                        ? "bg-primary text-white font-semibold shadow-xs"
                        : "hover:bg-surface-secondary/60 text-foreground"
                    }`}
                  >
                    <div className="col-span-6 flex items-center space-x-2 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isSelected
                            ? "text-white fill-white/20"
                            : file.isDirectory
                            ? "text-amber-400 fill-amber-400/20"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="truncate">{file.name}</span>
                      {file.isSymlink && file.linkTarget && (
                        <span className={`text-2xs truncate ${isSelected ? "text-white/70" : "text-muted-foreground opacity-60"}`}>
                          → {file.linkTarget}
                        </span>
                      )}
                    </div>
                    <div className={`col-span-2 text-right truncate ${isSelected ? "text-white/90" : "text-muted-foreground"}`}>
                      {file.isDirectory ? "—" : formatBytes(file.size)}
                    </div>
                    <div className={`col-span-2 text-center text-2xs font-mono truncate ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                      {file.permissions}
                    </div>
                    <div className={`col-span-2 text-right text-2xs truncate ${isSelected ? "text-white/90" : "text-muted-foreground"}`}>
                      {file.mtime}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 p-2">
            {sortedFiles.map((file) => {
              const Icon = getFileIcon(file);
              const isSelected = selectedPaths.has(file.path);
              return (
                <div
                  key={file.path}
                  draggable={!file.isDirectory}
                  onDragStart={(e) => handleFileDragStart(e, file)}
                  onClick={(e) => handleSelect(e, file)}
                  onDoubleClick={() => handleItemDoubleClick(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer border transition-all text-center ${
                    isSelected
                      ? "bg-primary/20 border-primary ring-2 ring-primary/60 shadow-md scale-[1.02]"
                      : "bg-surface/50 hover:bg-surface border-border/60 hover:border-border"
                  }`}
                  title={`${file.name}${file.isDirectory ? "" : `\n${formatBytes(file.size)}`}\n${file.mtime}`}
                >
                  <Icon
                    className={`w-10 h-10 mb-2 transition-transform ${
                      isSelected
                        ? "text-primary fill-primary/20 scale-105"
                        : file.isDirectory
                        ? "text-amber-400 fill-amber-400/20"
                        : "text-muted-foreground"
                    }`}
                  />
                  <span
                    className={`text-xs truncate w-full break-all line-clamp-2 leading-tight px-1.5 py-0.5 rounded transition-colors ${
                      isSelected
                        ? "bg-primary text-white font-semibold"
                        : "text-foreground font-medium"
                    }`}
                  >
                    {file.name}
                  </span>
                  {!file.isDirectory && (
                    <span
                      className={`text-[10px] font-mono mt-1 ${
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
        )}
      </div>

      {isDraggingOver && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md border-2 border-dashed border-primary pointer-events-none animate-in fade-in duration-150">
          <Upload className="w-12 h-12 text-primary animate-bounce mb-2" />
          <p className="text-sm font-semibold text-primary">{fm.dragDropHint}</p>
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-1 bg-surface/50 border-t border-border/70 text-2xs font-mono text-muted-foreground shrink-0 ">
        <div className="flex items-center space-x-2">
          <span>{fm.itemsCount.replace("{count}", String(files.length))}</span>
          {selectedPaths.size > 0 && (
            <span className="font-semibold text-primary">• {selectedPaths.size} selected</span>
          )}
        </div>
        <div>{currentPath}</div>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 min-w-[160px] bg-popover/95 backdrop-blur-md border border-border rounded-lg shadow-xl py-1 text-xs text-foreground font-sans animate-in fade-in zoom-in-95 duration-75"
        >
          {contextMenu.item && (
            <button
              onClick={() => {
                handleItemDoubleClick(contextMenu.item!);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
            >
              {contextMenu.item.isDirectory ? (
                <Folder className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              <span>{fm.open}</span>
            </button>
          )}

          {contextMenu.item && !contextMenu.item.isDirectory && (
            <button
              onClick={() => handleDownload(contextMenu.item)}
              className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{fm.download}</span>
            </button>
          )}

          {contextMenu.item && (
            <>
              <button
                onClick={() => handleCopy(contextMenu.item)}
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{fm.copy}</span>
              </button>
              <button
                onClick={() => handleCut(contextMenu.item)}
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>{fm.cut}</span>
              </button>
            </>
          )}

          {clipboard && (
            <button
              onClick={handlePaste}
              className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>{fm.paste}</span>
            </button>
          )}

          {contextMenu.item && (
            <>
              <button
                onClick={() => {
                  setRenameModal({
                    item: contextMenu.item!,
                    newName: contextMenu.item!.name,
                  });
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{fm.rename}</span>
              </button>
              <button
                onClick={() => handleCopyPath(contextMenu.item)}
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{fm.copyPath}</span>
              </button>
              <div className="h-[1px] bg-border/60 my-1" />
              <button
                onClick={() => {
                  const itemsToDelete = selectedPaths.has(contextMenu.item!.path)
                    ? files.filter((f) => selectedPaths.has(f.path))
                    : [contextMenu.item!];
                  setDeleteModal({ items: itemsToDelete });
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{fm.delete}</span>
              </button>
            </>
          )}

          {!contextMenu.item && (
            <>
              <button
                onClick={() => {
                  setNewFolderModal({ name: "" });
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{fm.newFolder}</span>
              </button>
              <button
                onClick={() => {
                  setNewFileModal({ name: "" });
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
              >
                <FilePlus className="w-3.5 h-3.5" />
                <span>{fm.newFile}</span>
              </button>
              <button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                    fileInputRef.current.click();
                  }
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{fm.upload}</span>
              </button>
              <div className="h-[1px] bg-border/60 my-1" />
              <button
                onClick={() => {
                  handleRefresh();
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{fm.refresh}</span>
              </button>
            </>
          )}
        </div>
      )}

      {viewerModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setViewerModal(null)}
        >
          <div
            className="bg-popover border border-border rounded-xl flex flex-col w-full max-w-3xl h-[80vh] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-border">
              <div className="flex items-center space-x-2 min-w-0">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-xs text-foreground truncate">
                  {viewerModal.item.name}
                </span>
                <span className="text-2xs font-mono text-muted-foreground truncate">
                  ({viewerModal.item.path})
                </span>
                {viewerModal.content !== viewerModal.originalContent && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
                )}
              </div>
              <div className="flex items-center space-x-2">
                {!viewerModal.isBinary && viewerModal.content !== viewerModal.originalContent && (
                  <button
                    onClick={handleDownloadChanges}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition-colors shadow-xs"
                    title={fm.downloadChanges}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{fm.downloadChanges}</span>
                  </button>
                )}
                {!viewerModal.isBinary && (
                  <button
                    onClick={handleSaveAndClose}
                    disabled={viewerModal.isSaving}
                    className="flex items-center space-x-1 px-3 py-1 rounded bg-primary hover:bg-primary/90 text-white text-xs font-medium transition-colors shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{viewerModal.isSaving ? fm.saving : fm.save}</span>
                  </button>
                )}
                <button
                  onClick={() =>
                    downloadContainerFile(
                      containerId,
                      viewerModal.item.path,
                      viewerModal.item.name
                    )
                  }
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-surface-secondary border border-border text-xs text-foreground hover:bg-surface-hover transition-colors shadow-xs"
                  title={fm.download}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{fm.download}</span>
                </button>
                <button
                  onClick={() => setViewerModal(null)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-3 overflow-hidden bg-background">
              {viewerModal.isBinary ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <File className="w-12 h-12 mb-2 opacity-40" />
                  <p className="text-xs font-medium">{fm.readOnlyWarning}</p>
                </div>
              ) : (
                <textarea
                  value={viewerModal.content}
                  onChange={(e) => {
                    const val = e.target.value;
                    setViewerModal((prev) =>
                      prev ? { ...prev, content: val } : null
                    );
                  }}
                  className="w-full h-full p-2 bg-transparent text-foreground font-mono text-xs resize-none focus:outline-none leading-relaxed"
                  spellCheck={false}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {renameModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setRenameModal(null)}
        >
          <div
            className="bg-popover border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-foreground">{fm.rename}</h3>
            <div>
              <label className="text-2xs text-muted-foreground mb-1 block">
                {fm.renamePrompt}
              </label>
              <input
                type="text"
                autoFocus
                value={renameModal.newName}
                onChange={(e) =>
                  setRenameModal({ ...renameModal, newName: e.target.value })
                }
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && renameModal.newName.trim()) {
                    const parent =
                      currentPath === "/" ? "" : currentPath;
                    const target = `${parent}/${renameModal.newName.trim()}`;
                    await renameContainerFile(
                      containerId,
                      renameModal.item.path,
                      target
                    );
                    setRenameModal(null);
                    await loadFiles(currentPath);
                  }
                }}
                className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setRenameModal(null)}
                className="px-3 py-1 text-xs font-medium rounded-md bg-surface border border-border hover:bg-surface-secondary text-foreground transition-colors"
              >
                {fm.close}
              </button>
              <button
                onClick={async () => {
                  if (renameModal.newName.trim()) {
                    const parent = currentPath === "/" ? "" : currentPath;
                    const target = `${parent}/${renameModal.newName.trim()}`;
                    await renameContainerFile(
                      containerId,
                      renameModal.item.path,
                      target
                    );
                    setRenameModal(null);
                    await loadFiles(currentPath);
                  }
                }}
                className="px-3 py-1 text-xs font-medium rounded-md bg-primary hover:bg-primary/90 text-white transition-colors"
              >
                {fm.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {newFolderModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setNewFolderModal(null)}
        >
          <div
            className="bg-popover border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-foreground">{fm.newFolder}</h3>
            <div>
              <label className="text-2xs text-muted-foreground mb-1 block">
                {fm.folderNamePrompt}
              </label>
              <input
                type="text"
                autoFocus
                value={newFolderModal.name}
                onChange={(e) =>
                  setNewFolderModal({ name: e.target.value })
                }
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newFolderModal.name.trim()) {
                    const parent = currentPath === "/" ? "" : currentPath;
                    const target = `${parent}/${newFolderModal.name.trim()}`;
                    await createContainerFolder(containerId, target);
                    setNewFolderModal(null);
                    await loadFiles(currentPath);
                  }
                }}
                className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setNewFolderModal(null)}
                className="px-3 py-1 text-xs font-medium rounded-md bg-surface border border-border hover:bg-surface-secondary text-foreground transition-colors"
              >
                {fm.close}
              </button>
              <button
                onClick={async () => {
                  if (newFolderModal.name.trim()) {
                    const parent = currentPath === "/" ? "" : currentPath;
                    const target = `${parent}/${newFolderModal.name.trim()}`;
                    await createContainerFolder(containerId, target);
                    setNewFolderModal(null);
                    await loadFiles(currentPath);
                  }
                }}
                className="px-3 py-1 text-xs font-medium rounded-md bg-primary hover:bg-primary/90 text-white transition-colors"
              >
                {fm.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {newFileModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setNewFileModal(null)}
        >
          <div
            className="bg-popover border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-foreground">{fm.newFile}</h3>
            <div>
              <label className="text-2xs text-muted-foreground mb-1 block">
                {fm.fileNamePrompt}
              </label>
              <input
                type="text"
                autoFocus
                value={newFileModal.name}
                onChange={(e) =>
                  setNewFileModal({ name: e.target.value })
                }
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newFileModal.name.trim()) {
                    const parent = currentPath === "/" ? "" : currentPath;
                    const target = `${parent}/${newFileModal.name.trim()}`;
                    await createContainerFile(containerId, target);
                    setNewFileModal(null);
                    await loadFiles(currentPath);
                  }
                }}
                className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setNewFileModal(null)}
                className="px-3 py-1 text-xs font-medium rounded-md bg-surface border border-border hover:bg-surface-secondary text-foreground transition-colors"
              >
                {fm.close}
              </button>
              <button
                onClick={async () => {
                  if (newFileModal.name.trim()) {
                    const parent = currentPath === "/" ? "" : currentPath;
                    const target = `${parent}/${newFileModal.name.trim()}`;
                    await createContainerFile(containerId, target);
                    setNewFileModal(null);
                    await loadFiles(currentPath);
                  }
                }}
                className="px-3 py-1 text-xs font-medium rounded-md bg-primary hover:bg-primary/90 text-white transition-colors"
              >
                {fm.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setDeleteModal(null)}
        >
          <div
            className="bg-popover border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-foreground">
              {fm.confirmDeleteTitle}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {deleteModal.items.length === 1
                ? <>{fm.confirmDeleteDesc}{" "}<span className="font-mono text-rose-500 font-semibold">{deleteModal.items[0].name}</span>?</>
                : <>{fm.confirmDeleteDesc}{" "}<span className="font-mono text-rose-500 font-semibold">{deleteModal.items.length} files</span>?</>
              }
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-3 py-1 text-xs font-medium rounded-md bg-surface border border-border hover:bg-surface-secondary text-foreground transition-colors"
              >
                {fm.close}
              </button>
              <button
                onClick={async () => {
                  const paths = deleteModal.items.map((i) => i.path);
                  await deleteContainerFiles(containerId, paths);
                  setDeleteModal(null);
                  await loadFiles(currentPath);
                }}
                className="px-3 py-1 text-xs font-medium rounded-md bg-rose-500 hover:bg-rose-600 text-white transition-colors"
              >
                {fm.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};