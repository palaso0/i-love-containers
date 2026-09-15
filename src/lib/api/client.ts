export const BACKEND_PORT = 41785;

export function getApiUrl(path: string): string {
  if (typeof window !== "undefined" && window.location.port === "5173") {
    return path;
  }
  return `http://127.0.0.1:${BACKEND_PORT}${path}`;
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
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
