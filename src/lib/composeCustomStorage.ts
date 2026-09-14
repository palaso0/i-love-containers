export interface CustomComposeConfig {
  command: string;
  useAsDefault: boolean;
}

const STORAGE_PREFIX = "ilc_compose_custom_";

export function getCustomComposeConfig(projectName: string): CustomComposeConfig {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${projectName.toLowerCase()}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        command: typeof parsed.command === "string" ? parsed.command : "",
        useAsDefault: Boolean(parsed.useAsDefault),
      };
    }
  } catch {}
  return { command: "", useAsDefault: false };
}

export function saveCustomComposeConfig(
  projectName: string,
  config: CustomComposeConfig
): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${projectName.toLowerCase()}`,
      JSON.stringify(config)
    );
  } catch {}
}
