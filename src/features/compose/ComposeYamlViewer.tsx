import React, { useState, useMemo, useEffect } from "react";
import {
  Copy,
  Check,
  Code2,
  Edit3,
  Eye,
  RotateCcw,
  SlidersHorizontal,
  Play,
  RotateCw,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { sampleComposeYaml } from "@/lib/composeParser";
import {
  parseComposeYamlToConfig,
  serializeConfigToComposeYaml,
  ParsedComposeFile,
} from "@/lib/composeYamlHelper";
import { ComposeServiceForm } from "./ComposeServiceForm";
import { ComposeBulkApplyModal } from "./ComposeBulkApplyModal";

interface ComposeYamlViewerProps {
  yamlContent: string;
  onYamlChange?: (newYaml: string) => void;
  projectName: string;
  configFile?: string;
  onDeploy?: () => void;
  isDeploying?: boolean;
  deploySuccess?: boolean;
}

export const ComposeYamlViewer: React.FC<ComposeYamlViewerProps> = ({
  yamlContent,
  onYamlChange,
  projectName,
  configFile,
  onDeploy,
  isDeploying,
  deploySuccess,
}) => {
  const { t, theme } = useAppStore();
  const isDark = theme === "dark";

  const [viewerMode, setViewerMode] = useState<"form" | "code">("code");
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditingRaw, setIsEditingRaw] = useState(false);
  const [editedYaml, setEditedYaml] = useState(yamlContent);

  useEffect(() => {
    if (!isEditingRaw) {
      setEditedYaml(yamlContent);
    }
  }, [yamlContent, isEditingRaw]);

  const parsedConfig: ParsedComposeFile = useMemo(() => {
    try {
      return parseComposeYamlToConfig(yamlContent);
    } catch {
      return {
        version: "3.8",
        services: [],
        availableNetworks: [],
        availableVolumes: [],
      };
    }
  }, [yamlContent]);

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditingRaw ? editedYaml : yamlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyRawEdit = () => {
    if (onYamlChange) {
      onYamlChange(editedYaml);
    }
    setIsEditingRaw(false);
  };

  const handleResetToSample = () => {
    setEditedYaml(sampleComposeYaml);
    if (onYamlChange) {
      onYamlChange(sampleComposeYaml);
    }
    setIsEditingRaw(false);
  };

  const handleUpdateFromForm = (updatedConfig: ParsedComposeFile) => {
    const serialized = serializeConfigToComposeYaml(updatedConfig);
    setEditedYaml(serialized);
    if (onYamlChange) {
      onYamlChange(serialized);
    }
  };

  const handleApplyBulkYaml = (newYaml: string) => {
    setEditedYaml(newYaml);
    if (onYamlChange) {
      onYamlChange(newYaml);
    }
  };

  const lines = (isEditingRaw ? editedYaml : yamlContent).split("\n");

  const formatYamlLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return <span>&nbsp;</span>;
    if (trimmed.startsWith("#")) {
      return <span className="text-muted-foreground/60 italic">{line}</span>;
    }
    if (trimmed.startsWith("- ")) {
      const value = trimmed.slice(2);
      const indent = line.slice(0, line.indexOf("-"));
      return (
        <span>
          <span className="text-muted-foreground">{indent}- </span>
          <span className={isDark ? "text-emerald-400" : "text-emerald-700 font-medium"}>
            {value}
          </span>
        </span>
      );
    }
    if (trimmed.includes(":")) {
      const colonIdx = line.indexOf(":");
      const key = line.slice(0, colonIdx);
      const val = line.slice(colonIdx + 1);
      return (
        <span>
          <span className={isDark ? "text-sky-400 font-medium" : "text-sky-700 font-semibold"}>
            {key}:
          </span>
          <span className={isDark ? "text-amber-300" : "text-amber-800 font-medium"}>{val}</span>
        </span>
      );
    }
    return <span className="text-foreground/90">{line}</span>;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2 bg-surface/90 backdrop-blur-md border border-border/80 rounded-xl mb-3 flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Code2 className="w-4 h-4 text-primary" />
            <span
              className="text-xs font-mono font-semibold text-foreground max-w-sm truncate"
              title={configFile || `${projectName}/docker-compose.yml`}
            >
              {configFile || `${projectName}/docker-compose.yml`}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground bg-surface-secondary px-2 py-0.2 rounded-full border border-border/60">
              {parsedConfig.services.length} {t.compose.servicesCountLabel} • {lines.length} {t.compose.linesCount}
            </span>
          </div>

          <div className="h-3.5 w-[1px] bg-border/80 hidden sm:block" />

          <div className="inline-flex items-center bg-surface-secondary/80 border border-border/70 p-0.5 rounded-lg text-2xs">
            <button
              type="button"
              onClick={() => setViewerMode("code")}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-all ${
                viewerMode === "code"
                  ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Code2 className="w-3 h-3 text-sky-400" />
              <span>{t.compose.codeView || "Raw YAML"}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewerMode("form")}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-all ${
                viewerMode === "form"
                  ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <SlidersHorizontal className="w-3 h-3 text-primary" />
              <span>{t.compose.formView || "Formulario Visual"}</span>
            </button>
          </div>

          {onDeploy && (
            <button
              type="button"
              onClick={onDeploy}
              disabled={isDeploying}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 transition-colors shadow-xs disabled:opacity-50"
              title="docker compose up -d"
            >
              {isDeploying ? (
                <RotateCw className="w-3 h-3 animate-spin text-emerald-400" />
              ) : deploySuccess ? (
                <span className="text-[11px] font-semibold text-emerald-400">✓ {t.compose.deployed}</span>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current text-emerald-400" />
                  <span className="font-sans font-medium">{t.compose.deployStack || "Deploy"}</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {viewerMode === "code" && (
            <>
              {isEditingRaw ? (
                <>
                  <button
                    onClick={handleApplyRawEdit}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary text-white hover:opacity-90 transition-opacity shadow-xs"
                  >
                    <Eye className="w-3 h-3" />
                    <span>{t.compose.applyRaw}</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditedYaml(yamlContent);
                      setIsEditingRaw(false);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t.compose.cancelRaw}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditingRaw(true)}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface border border-border text-foreground hover:bg-surface-secondary hover:border-primary/40 transition-colors shadow-xs"
                    title={t.compose.editText}
                  >
                    <Edit3 className="w-3 h-3 text-primary" />
                    <span className="hidden sm:inline">{t.compose.editText}</span>
                  </button>
                  <button
                    onClick={handleResetToSample}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface border border-border transition-colors"
                    title={t.compose.resetSample}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-surface border border-border text-foreground hover:bg-surface-secondary transition-colors shadow-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-status-running" />
                <span className="text-status-running">{t.compose.copied}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t.compose.copyYaml}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {viewerMode === "form" ? (
          <ComposeServiceForm
            parsedConfig={parsedConfig}
            onUpdateConfig={handleUpdateFromForm}
            onOpenBulkModal={() => setIsBulkModalOpen(true)}
          />
        ) : (
          <div className="h-full flex flex-col bg-surface/80 backdrop-blur-xl border border-border/80 rounded-2xl overflow-hidden shadow-mac-segment">
            <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-background">
              {isEditingRaw ? (
                <div className="flex min-h-full font-mono text-xs">
                  <div className=" text-right pr-4 text-muted-foreground/45 text-[11px] font-mono w-10 shrink-0 border-r border-border/40 mr-3 py-0.5">
                    {editedYaml.split("\n").map((_, idx) => (
                      <div key={idx} className="leading-[21px] text-[11px] h-[21px]">
                        {idx + 1}
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={editedYaml}
                    onChange={(e) => setEditedYaml(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const target = e.currentTarget;
                        const start = target.selectionStart;
                        const end = target.selectionEnd;
                        const val = target.value;
                        setEditedYaml(val.substring(0, start) + "  " + val.substring(end));
                        setTimeout(() => {
                          target.selectionStart = target.selectionEnd = start + 2;
                        }, 0);
                      }
                    }}
                    className="flex-1 bg-transparent text-foreground font-mono text-[12px] leading-[21px] focus:outline-none resize-none selection:bg-primary/30 py-0.5 whitespace-pre"
                    style={{ minHeight: `${Math.max(480, editedYaml.split("\n").length * 21 + 40)}px` }}
                    spellCheck={false}
                  />
                </div>
              ) : (
                <div className="table w-full border-collapse select-text">
                  {lines.map((line, idx) => (
                    <div key={idx} className="table-row hover:bg-foreground/[0.04] transition-colors">
                      <span className="table-cell  text-right pr-4 text-muted-foreground/45 text-[11px] font-mono w-10">
                        {idx + 1}
                      </span>
                      <span className="table-cell whitespace-pre font-mono text-[12px] leading-[21px] select-text cursor-text">
                        {formatYamlLine(line)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ComposeBulkApplyModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        yamlContent={yamlContent}
        onApplyYaml={handleApplyBulkYaml}
        services={parsedConfig.services}
        availableNetworks={parsedConfig.availableNetworks}
      />
    </div>
  );
};