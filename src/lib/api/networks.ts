import { DockerNetwork } from "@/types";
import { apiFetch } from "./client";

export async function fetchNetworks(): Promise<DockerNetwork[]> {
  try {
    const response = await apiFetch("/api/networks");
    if (response.ok) {
      return await response.json();
    }
  } catch {}
  return [];
}
