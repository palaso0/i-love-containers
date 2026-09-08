import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/App";
import { AppProvider } from "@/stores/useAppStore";
import { StandaloneTerminalWindow } from "@/features/windows/StandaloneTerminalWindow";
import { StandaloneLogsWindow } from "@/features/windows/StandaloneLogsWindow";
import { StandaloneFilesWindow } from "@/features/windows/StandaloneFilesWindow";
import { StandaloneStatsWindow } from "@/features/windows/StandaloneStatsWindow";
import { StandaloneInspectWindow } from "@/features/windows/StandaloneInspectWindow";
import { StandaloneOverviewWindow } from "@/features/windows/StandaloneOverviewWindow";
import "@/styles/globals.css";

const urlParams = new URLSearchParams(window.location.search);
const windowType = urlParams.get("window");
const containerId = urlParams.get("containerId") || "";
const containerName = urlParams.get("name") || "";
const composeProject = urlParams.get("project") || undefined;

import { ErrorBoundary } from "@/components/ErrorBoundary";

const RootComponent: React.FC = () => {
  return (
    <AppProvider>
      <ErrorBoundary fallbackTitle="Application Error">
        {windowType === "terminal" ? (
          <StandaloneTerminalWindow
            containerId={containerId}
            containerName={containerName || "container"}
          />
        ) : windowType === "logs" ? (
          <StandaloneLogsWindow
            containerId={containerId}
            containerName={containerName}
            composeProject={composeProject}
          />
        ) : windowType === "files" ? (
          <StandaloneFilesWindow
            containerId={containerId}
            containerName={containerName || "container"}
          />
        ) : windowType === "stats" ? (
          <StandaloneStatsWindow
            containerId={containerId}
            containerName={containerName || "container"}
          />
        ) : windowType === "inspect" ? (
          <StandaloneInspectWindow
            containerId={containerId}
            containerName={containerName || "container"}
          />
        ) : windowType === "overview" ? (
          <StandaloneOverviewWindow
            containerId={containerId}
            containerName={containerName || "container"}
          />
        ) : (
          <App />
        )}
      </ErrorBoundary>
    </AppProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
);