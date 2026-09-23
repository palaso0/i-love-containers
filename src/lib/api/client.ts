export const BACKEND_PORT = 41785;

export function getApiUrl(path: string): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return path;
    }
  }
  return `http://127.0.0.1:${BACKEND_PORT}${path}`;
}

export function getTerminalWsUrl(containerId: string, forcePort?: number): string {
  if (forcePort) {
    return `ws://127.0.0.1:${forcePort}/api/containers/${containerId}/pty`;
  }
  if (typeof window !== "undefined") {
    const loc = window.location;
    if (loc.hostname === "localhost" || loc.hostname === "127.0.0.1") {
      const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${loc.host}/api/containers/${containerId}/pty`;
    }
  }
  return `ws://127.0.0.1:${BACKEND_PORT}/api/containers/${containerId}/pty`;
}

export function getAlternateTerminalWsUrl(containerId: string): string {
  if (typeof window !== "undefined") {
    const loc = window.location;
    if (loc.hostname === "localhost" || loc.hostname === "127.0.0.1") {
      return `ws://127.0.0.1:${BACKEND_PORT}/api/containers/${containerId}/pty`;
    }
  }
  return `ws://127.0.0.1:5173/api/containers/${containerId}/pty`;
}

export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const url = input.startsWith("/api") ? getApiUrl(input) : input;
  let attempts = 0;
  while (attempts < 3) {
    try {
      return await fetch(url, init);
    } catch (err) {
      attempts++;
      if (attempts >= 3) throw err;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  return fetch(url, init);
}
