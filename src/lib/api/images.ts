import { DockerImage, ImageAnalysis } from "@/types";
import { DEFAULT_IMAGES } from "../engines";
import { apiFetch } from "./client";
import { getMockImageAnalysis } from "./mockData";

let localImages: DockerImage[] = [...DEFAULT_IMAGES];

export function getLocalImages(): DockerImage[] {
  return localImages;
}

export function setLocalImages(images: DockerImage[]): void {
  localImages = images;
}

export async function fetchImages(): Promise<DockerImage[]> {
  try {
    const response = await apiFetch("/api/images");
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        localImages = data;
        return data;
      }
    }
  } catch {}
  return localImages;
}

export async function removeImage(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/images/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (response.ok) return true;
  } catch {}

  localImages = localImages.filter((img) => img.id !== id);
  return true;
}

export { getMockImageAnalysis };

export async function fetchImageAnalysis(
  imageId: string,
): Promise<ImageAnalysis | null> {
  try {
    const response = await apiFetch(
      `/api/images/${encodeURIComponent(imageId)}/analysis`,
    );
    if (response.ok) {
      return await response.json();
    }
  } catch {}

  const match = localImages.find((img) => img.id === imageId);
  return getMockImageAnalysis(
    imageId,
    match ? match.repository : "app",
    match ? match.tag : "latest",
  );
}
