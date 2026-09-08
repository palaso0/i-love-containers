import { invoke } from "@tauri-apps/api/core";

export function handleWindowDragStart(e: React.MouseEvent) {
  if (e.button !== 0) return;

  const target = e.target as HTMLElement | null;
  if (
    target &&
    (target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("textarea") ||
      target.closest("a") ||
      target.closest('[role="button"]') ||
      target.closest(".no-drag"))
  ) {
    return;
  }

  invoke("drag_window").catch(() => {});
}
