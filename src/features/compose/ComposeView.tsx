import React, { useState, useMemo, useEffect } from "react";
import {
  FolderGit2,
  Play,
  Square,
  RotateCw,
  FileText,
  Terminal,
  Layers,
  Code2,
  ListFilter,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { openRealNativeWindow } from "@/lib/nativeWindow";
import { parseComposeYaml, sampleComposeYaml } from "@/lib/composeParser";
import * as api from "@/lib/api";
import { ComposeDiagramCanvas } from "./ComposeDiagramCanvas";
import { ComposeYamlViewer } from "./ComposeYamlViewer";
import { DockerDisconnected } from "@/components/DockerDisconnected";

export const ComposeView: React.FC = () => {
  const {
    t,
    composeProjects,
    systemOverview,
    setActiveTab,
    setSelectedContainerId,
    startContainer,
    stopContainer,
    restartContainer,
    refreshData,
  } = useAppStore();

  const isConnected = systemOverview?.dockerConnected ?? false;

  const [activeTabMode, setActiveTabMode] = useState<"diagram" | "yaml" | "services">("diagram");
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  if (!isConnected) {
    return <DockerDisconnected icon={FolderGit2} />;
  }

  const activeProject = composeProjects[selectedProjectIndex] || composeProjects[0];
  const projectName = activeProject?.name || "default";

  const [composeYaml, setComposeYaml] = useState<string>(() => {
    if (activeProject?.yamlContent) {
      return activeProject.yamlContent;
    }
    try {
      const saved = localStorage.getItem(`ilc-compose-yaml-${projectName}`);
      return saved || sampleComposeYaml;
    } catch {
      return sampleComposeYaml;
    }
  });

  useEffect(() => {
    if (activeProject?.name) {
      if (activeProject.yamlContent) {
        setComposeYaml(activeProject.yamlContent);
      } else {
        try {
          const saved = localStorage.getItem(`ilc-compose-yaml-${activeProject.name}`);
          setComposeYaml(saved || sampleComposeYaml);
        } catch {
          setComposeYaml(sampleComposeYaml);
        }
      }
    }
  }, [activeProject?.name, activeProject?.yamlContent]);

  const handleYamlChange = (newYaml: string) => {
    setComposeYaml(newYaml);
    const pName = activeProject?.name || "default";
    try {
      localStorage.setItem(`ilc-compose-yaml-${pName}`, newYaml);
    } catch {}

    if (activeProject?.configFile || activeProject?.workingDir) {
      api.saveComposeProjectYaml(
        pName,
        newYaml,
        activeProject.workingDir,
        activeProject.configFile
      );
    }
  };

  const handleDeploy = async () => {
    if (!activeProject || isDeploying) return;
    setIsDeploying(true);
    setDeploySuccess(false);
    try {
      const res = await api.upComposeProject(
        activeProject.name,
        activeProject.workingDir,
        activeProject.configFile
      );
      if (res.ok) {
        setDeploySuccess(true);
        setTimeout(() => setDeploySuccess(false), 3000);
      }
      await refreshData();
    } catch {
    } finally {
      setIsDeploying(false);
    }
  };

  const handleForget = async () => {
    if (!activeProject) return;
    if (window.confirm(`¿Quitar "${activeProject.name}" del historial de stacks guardados?`)) {
      await api.forgetComposeProject(activeProject.name);
      await refreshData();
      if (selectedProjectIndex > 0) {
        setSelectedProjectIndex(selectedProjectIndex - 1);
      }
    }
  };

  const topology = useMemo(() => {
    return parseComposeYaml(composeYaml, activeProject?.containers || []);
  }, [composeYaml, activeProject]);

  const handleStopAll = async (containerIds: string[]) => {
    for (const id of containerIds) {
      await stopContainer(id);
    }
  };

  const handleStartStack = async () => {
    if (!activeProject) return;
    await api.upComposeProject(
      activeProject.name,
      activeProject.workingDir,
      activeProject.configFile
    );
    await refreshData();
  };

  const handleRestartAll = async (containerIds: string[]) => {
    for (const id of containerIds) {
      await restartContainer(id);
    }
  };

  if (composeProjects.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-background max-w-4xl mx-auto">
        <div className="border-b border-border/70 pb-3">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">{t.compose.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t.compose.subtitle}</p>
        </div>

        <div className="bg-surface/60 border border-border/70 rounded-2xl p-8 text-center shadow-mac-card space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary shadow-xs">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t.compose.noStacks}</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              No se detectaron stacks en ejecución ni proyectos en el historial. Puedes cargar o registrar cualquier archivo docker-compose.yml de tu equipo.
            </p>
          </div>

          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={() => refreshData()}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-hover border border-border/80 text-foreground transition-all shadow-xs"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Escanear Stacks Locales</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeContainerIds = activeProject ? activeProject.containers.map((c) => c.id) : [];
  const runningCount = activeProject
    ? activeProject.containers.filter((c) => c.state === "running").length
    : 0;
  const isInactive = runningCount === 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background ">

      <div className="px-5 py-3 border-b border-border/70 bg-surface/50 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl border flex items-center justify-center shadow-xs shrink-0 ${
              isInactive
                ? "bg-muted/20 border-border text-muted-foreground"
                : "bg-primary/15 border-primary/30 text-primary"
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              {composeProjects.length > 1 ? (
                <div className="relative inline-flex items-center">
                  <select
                    value={selectedProjectIndex}
                    onChange={(e) => setSelectedProjectIndex(Number(e.target.value))}
                    className="appearance-none bg-surface-secondary/80 border border-border/80 text-foreground text-sm font-semibold rounded-lg pl-2.5 pr-7 py-0.5 focus:outline-none focus:border-primary cursor-pointer"
                  >
                    {composeProjects.map((p, idx) => {
                      const pActive = p.containers.some((c) => c.state === "running");
                      return (
                        <option key={p.name} value={idx} className="bg-surface text-foreground">
                          {pActive ? "● " : "○ "}
                          {p.name} {pActive ? `(${p.containers.length})` : "(inactivo)"}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 pointer-events-none" />
                </div>
              ) : (
                <h1 className="text-sm font-semibold text-foreground tracking-tight truncate">
                  {activeProject?.name || "Compose Stack"}
                </h1>
              )}

              {isInactive ? (
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.2 rounded-full border border-amber-500/20">
                  ○ Detenido (0/{activeProject?.containers.length || 0})
                </span>
              ) : (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.2 rounded-full border border-emerald-500/20">
                  ● {runningCount}/{activeProject?.containers.length || 0} {t.containers.active}
                </span>
              )}
            </div>
            <p
              className="text-[11px] font-mono text-muted-foreground truncate"
              title={activeProject?.configFile || activeProject?.workingDir || "/workspace"}
            >
              {activeProject?.configFile || activeProject?.workingDir || "/workspace"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="inline-flex items-center bg-surface-secondary/80 border border-border/70 p-0.5 rounded-lg shadow-xs">
            <button
              onClick={() => setActiveTabMode("diagram")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTabMode === "diagram"
                  ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>{t.compose.diagramView}</span>
            </button>

            <button
              onClick={() => setActiveTabMode("yaml")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTabMode === "yaml"
                  ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-sky-400" />
              <span>{t.compose.yamlView}</span>
            </button>

            <button
              onClick={() => setActiveTabMode("services")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTabMode === "services"
                  ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <ListFilter className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.compose.servicesView}</span>
            </button>
          </div>

          <div className="h-4 w-[1px] bg-border/80 hidden sm:block" />

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() =>
                openRealNativeWindow({
                  id: `stack-logs-${activeProject.name}-${Date.now()}`,
                  title: `${activeProject.name} — Unified Logs`,
                  type: "logs",
                  composeProject: activeProject.name,
                })
              }
              className="p-1.5 rounded-lg text-muted-foreground hover:text-sky-400 bg-surface border border-border/70 hover:border-sky-400/40 transition-colors shadow-xs"
              title={t.compose.stackLogs}
            >
              <FileText className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleStartStack}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-status-running bg-surface border border-border/70 hover:border-status-running/40 transition-colors shadow-xs"
              title={t.compose.startStack}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>

            <button
              onClick={() => handleStopAll(activeContainerIds)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-status-restarting bg-surface border border-border/70 hover:border-status-restarting/40 transition-colors shadow-xs"
              title={t.compose.stopStack}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>

            <button
              onClick={() => handleRestartAll(activeContainerIds)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-sky-400 bg-surface border border-border/70 hover:border-sky-400/40 transition-colors shadow-xs"
              title={t.compose.restartStack}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-[1px] bg-border/80 hidden sm:block" />

            {isInactive && (
              <button
                onClick={handleForget}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-status-danger bg-surface border border-border/70 hover:border-status-danger/40 transition-colors shadow-xs"
                title="Olvidar stack"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTabMode === "diagram" && (
          <ComposeDiagramCanvas
            topology={topology}
            projectName={activeProject.name}
          />
        )}

        {activeTabMode === "yaml" && (
          <div className="p-4 h-full">
            <ComposeYamlViewer
              yamlContent={composeYaml}
              onYamlChange={handleYamlChange}
              projectName={activeProject.name}
              configFile={activeProject.configFile}
              onDeploy={handleDeploy}
              isDeploying={isDeploying}
              deploySuccess={deploySuccess}
            />
          </div>
        )}

        {activeTabMode === "services" && (
          <div className="p-5 overflow-y-auto h-full space-y-3">
            {activeProject.containers.length === 0 ? (
              <div className="bg-surface/50 border border-border/60 rounded-xl p-8 text-center shadow-xs">
                <FolderGit2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">0 servicios en ejecución</h4>
              </div>
            ) : (
              <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl overflow-hidden shadow-xs">
                <div className="divide-y divide-border/60">
                {activeProject.containers.map((container) => {
                  const isRunning = container.state === "running";
                  return (
                    <div
                      key={container.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors text-xs group"
                    >
                      <div
                        className="flex items-center space-x-3 cursor-pointer truncate flex-1 mr-4"
                        onClick={() => {
                          setActiveTab("containers");
                          setSelectedContainerId(container.id);
                        }}
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            isRunning
                              ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.7)]"
                              : "bg-status-stopped"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors text-xs truncate">
                              {container.composeService || container.name}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground bg-surface-secondary px-1.5 py-0.2 rounded border border-border/50">
                              {container.id.substring(0, 10)}
                            </span>
                          </div>
                          <p className="text-2xs font-mono text-muted-foreground mt-0.5 truncate">
                            {container.image} • {container.status}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        {container.ports && container.ports.length > 0 && container.ports[0].publicPort && (
                          <span className="text-[10px] font-mono text-primary bg-primary-muted border border-primary/20 px-2 py-0.5 rounded-full">
                            :{container.ports[0].publicPort}
                          </span>
                        )}

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() =>
                              openRealNativeWindow({
                                id: `term-${container.id}-${Date.now()}`,
                                title: `${container.name} — Terminal`,
                                type: "terminal",
                                containerId: container.id,
                                containerName: container.name,
                              })
                            }
                            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-surface-secondary transition-colors"
                            title="Open terminal in native window"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              openRealNativeWindow({
                                id: `logs-${container.id}-${Date.now()}`,
                                title: `${container.name} — Logs`,
                                type: "logs",
                                containerId: container.id,
                                containerName: container.name,
                              })
                            }
                            className="p-1.5 rounded-md text-muted-foreground hover:text-sky-400 hover:bg-surface-secondary transition-colors"
                            title="Open logs in native window"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          {isRunning ? (
                            <button
                              onClick={() => stopContainer(container.id)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-status-restarting hover:bg-surface-secondary transition-colors"
                              title={t.containers.stop}
                            >
                              <Square className="w-3.5 h-3.5 fill-current" />
                            </button>
                          ) : (
                            <button
                              onClick={() => startContainer(container.id)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-status-running hover:bg-surface-secondary transition-colors"
                              title={t.containers.start}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};