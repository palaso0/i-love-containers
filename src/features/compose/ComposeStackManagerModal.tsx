import React, { useState, useEffect } from "react";
import { FolderGit2, X, Save, Terminal, FileCode, Trash2 } from "lucide-react";
import {
  SavedStackProject,
  saveStackProject,
  deleteSavedStackProject,
  setProjectAlias,
  hideComposeProject,
  unhideComposeProject,
} from "@/lib/composeCustomStorage";

interface ComposeStackManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject?: {
    name: string;
    originalName?: string;
    workingDir?: string;
    configFile?: string;
  };
  editingStack?: SavedStackProject | null;
  onSelectStack?: (stack: SavedStackProject) => void;
  onSuccess?: () => void;
  onDelete?: () => void;
}

export const ComposeStackManagerModal: React.FC<ComposeStackManagerModalProps> = ({
  isOpen,
  onClose,
  currentProject,
  editingStack,
  onSuccess,
  onDelete,
}) => {
  const [name, setName] = useState("");
  const [configFile, setConfigFile] = useState("");
  const [command, setCommand] = useState("docker compose up -d");
  const [useAsDefault, setUseAsDefault] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (editingStack) {
      setName(editingStack.name);
      setConfigFile(editingStack.configFile || editingStack.workingDir || "");
      setCommand(editingStack.command || "docker compose up -d");
      setUseAsDefault(editingStack.useAsDefault ?? true);
    } else if (currentProject) {
      setName(currentProject.name || "");
      setConfigFile(currentProject.configFile || currentProject.workingDir || "");
      setCommand("docker compose up -d");
      setUseAsDefault(true);
    } else {
      setName("");
      setConfigFile("");
      setCommand("docker compose up -d");
      setUseAsDefault(true);
    }
    setErrorMsg(null);
  }, [isOpen, editingStack, currentProject]);

  if (!isOpen) return null;

  const handleSaveOnly = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("Nombre requerido");
      return;
    }

    const trimmedConfig = configFile.trim();
    let computedWorkingDir = editingStack?.workingDir || currentProject?.workingDir || "";
    if (trimmedConfig) {
      const lastSlash = trimmedConfig.lastIndexOf("/");
      if (lastSlash > 0) {
        computedWorkingDir = trimmedConfig.substring(0, lastSlash);
      } else if (!computedWorkingDir) {
        computedWorkingDir = trimmedConfig;
      }
    }

    const origProjectName = currentProject?.originalName || (editingStack?.id ? undefined : editingStack?.name);
    if (origProjectName) {
      setProjectAlias(origProjectName, trimmedName);
      unhideComposeProject(origProjectName);
    }
    unhideComposeProject(trimmedName);

    saveStackProject({
      id: editingStack?.id || undefined,
      name: trimmedName,
      workingDir: computedWorkingDir,
      configFile: trimmedConfig || undefined,
      command: command.trim() || "docker compose up -d",
      useAsDefault,
    });

    if (onSuccess) onSuccess();
    onClose();
  };

  const handleDelete = () => {
    const origProjectName = currentProject?.originalName || (editingStack?.id ? undefined : editingStack?.name);
    if (origProjectName) {
      setProjectAlias(origProjectName, "");
      hideComposeProject(origProjectName);
    }
    if (name.trim()) {
      hideComposeProject(name.trim());
    }

    if (editingStack?.id) {
      deleteSavedStackProject(editingStack.id);
    }

    if (onDelete) {
      onDelete();
    } else if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        className="relative z-10 bg-popover text-foreground border border-popover-border rounded-2xl p-5 max-w-lg w-full space-y-4 shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <FolderGit2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {editingStack ? "Editar Stack" : "Guardar Stack"}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. PROD"
              className="w-full px-3 py-1.5 text-xs bg-surface border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all shadow-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-2xs font-mono uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
              <FileCode className="w-3 h-3 text-muted-foreground" />
              <span>Archivo Compose</span>
            </label>
            <input
              type="text"
              value={configFile}
              onChange={(e) => setConfigFile(e.target.value)}
              placeholder="docker-compose.yml o ruta completa"
              className="w-full px-3 py-1.5 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all shadow-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-2xs font-mono uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
              <Terminal className="w-3 h-3 text-muted-foreground" />
              <span>Comando</span>
            </label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="docker compose up -d"
              className="w-full px-3 py-1.5 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all shadow-xs"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center space-x-2 text-xs text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useAsDefault}
                onChange={(e) => setUseAsDefault(e.target.checked)}
                className="w-4 h-4 rounded border-border/80 bg-surface text-primary focus:ring-primary accent-primary cursor-pointer"
              />
              <span>Aplicar a las acciones de Compose</span>
            </label>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-status-danger/10 border border-status-danger/30 text-status-danger text-2xs font-mono">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/70">
          <div>
            {editingStack && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center space-x-1 px-2.5 py-1.5 text-xs text-status-danger hover:bg-status-danger/10 rounded-lg transition-colors cursor-pointer"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleSaveOnly}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
