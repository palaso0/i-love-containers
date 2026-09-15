import { DockerVolume } from "@/types";
import { apiFetch } from "./client";

let localVolumes: DockerVolume[] = [];

export function getLocalVolumes(): DockerVolume[] {
  return localVolumes;
}

export function setLocalVolumes(volumes: DockerVolume[]): void {
  localVolumes = volumes;
}

export async function fetchVolumes(): Promise<DockerVolume[]> {
  try {
    const response = await apiFetch("/api/volumes");
    if (response.ok) {
      return await response.json();
    }
  } catch {}
  return [];
}

export async function removeVolume(name: string): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/volumes/${encodeURIComponent(name)}`, { method: "DELETE" });
    if (response.ok) return true;
  } catch {}

  localVolumes = localVolumes.filter((vol) => vol.name !== name);
  return true;
}
