import { invoke } from "@tauri-apps/api/core";

interface NativeWindowOptions {
  id: string;
  title: string;
  type: "terminal" | "logs" | "files" | "stats" | "inspect" | "overview";
  containerId?: string;
  containerName?: string;
  composeProject?: string;
  width?: number;
  height?: number;
}

export async function openRealNativeWindow(options: NativeWindowOptions) {
  const width = options.width || 840;
  const height = options.height || 560;

  const params = new URLSearchParams();
  params.set("window", options.type);

  if (options.containerId) params.set("containerId", options.containerId);
  if (options.containerName) params.set("name", options.containerName);
  if (options.composeProject) params.set("project", options.composeProject);

  const currentTheme = localStorage.getItem("ilc-app-theme");
  if (currentTheme) params.set("theme", currentTheme);
  const currentMode = localStorage.getItem("ilc-color-mode");
  if (currentMode) params.set("mode", currentMode);
  const currentAccent = localStorage.getItem("ilc-app-accent");
  if (currentAccent) params.set("accent", currentAccent);
  const currentLang = localStorage.getItem("ilc-language");
  if (currentLang) params.set("lang", currentLang);

  const relativeUrl = `index.html?${params.toString()}`;
  const fullUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

  const sanitizedId = options.id.replace(/[^a-zA-Z0-9_-]/g, "-");

  try {
    await invoke("open_native_window", {
      windowId: sanitizedId,
      title: options.title,
      url: relativeUrl,
      width,
      height,
    });
  } catch (tauriError) {
    window.open(fullUrl, sanitizedId, `width=${width},height=${height},menubar=no,toolbar=no,location=no`);
  }
}