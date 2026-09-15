import { ComposeProject } from "@/types";
import { apiFetch } from "./client";

export async function fetchComposeProjects(): Promise<ComposeProject[]> {
  try {
    const response = await apiFetch("/api/compose");
    if (response.ok) {
      return await response.json();
    }
  } catch {}
  return [];
}

export async function saveComposeProjectYaml(
  projectName: string,
  yamlContent: string,
  workingDir?: string,
  configFile?: string
): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/compose/${encodeURIComponent(projectName)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yamlContent, workingDir, configFile }),
    });
    if (response.ok) return true;
  } catch {}
  return false;
}

export async function upComposeProject(
  projectName: string,
  workingDir?: string,
  configFile?: string,
  customCommand?: string
): Promise<{ ok: boolean; stdout?: string; stderr?: string }> {
  try {
    const response = await apiFetch(`/api/compose/${encodeURIComponent(projectName)}/up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workingDir, configFile, customCommand }),
    });
    if (response.ok) return await response.json();
  } catch {}
  return { ok: false, stderr: "Failed to run docker compose up" };
}

export async function removeComposeProject(
  projectName: string,
  workingDir?: string,
  configFile?: string
): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/compose/${encodeURIComponent(projectName)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workingDir, configFile }),
    });
    if (response.ok) return true;
  } catch {}
  return false;
}

export async function forgetComposeProject(projectName: string): Promise<boolean> {
  try {
    const response = await apiFetch(`/api/compose/${encodeURIComponent(projectName)}?forget=true`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forget: true }),
    });
    if (response.ok) return true;
  } catch {}
  return false;
}
