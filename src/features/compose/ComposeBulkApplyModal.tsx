import React, { useState } from "react";
import { Zap, X, CheckSquare, Square, Layers, Cpu, RotateCw, Globe, Wrench } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { ComposeServiceConfig, applyBulkServiceConfig } from "@/lib/composeYamlHelper";
import { DirectiveAutocompleteInput } from "./DirectiveAutocompleteInput";

interface ComposeBulkApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  yamlContent: string;
  onApplyYaml: (updatedYaml: string) => void;
  services: ComposeServiceConfig[];
  availableNetworks: string[];
}

export const ComposeBulkApplyModal: React.FC<ComposeBulkApplyModalProps> = ({
  isOpen,
  onClose,
  yamlContent,
  onApplyYaml,
  services,
  availableNetworks,
}) => {
  const { t } = useAppStore();

  const [selectedServices, setSelectedServices] = useState<string[]>(services.map((s) => s.name));
  const [selectedField, setSelectedField] = useState<"platform" | "restart" | "environment" | "network" | "custom">("platform");

  const [platformValue, setPlatformValue] = useState("linux/amd64");
  const [restartValue, setRestartValue] = useState("always");
  const [envKey, setEnvKey] = useState("");
  const [envVal, setEnvVal] = useState("");
  const [networkValue, setNetworkValue] = useState(availableNetworks[0] || "");
  const [customKey, setCustomKey] = useState("");
  const [customVal, setCustomVal] = useState("");

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedServices.length === services.length) {
      setSelectedServices([]);
    } else {
      setSelectedServices(services.map((s) => s.name));
    }
  };

  const toggleService = (name: string) => {
    setSelectedServices((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  };

  const handleApply = () => {
    if (selectedServices.length === 0) return;

    let valueToApply = "";
    let customK: string | undefined = undefined;

    switch (selectedField) {
      case "platform":
        valueToApply = platformValue;
        break;
      case "restart":
        valueToApply = restartValue;
        break;
      case "environment":
        if (!envKey.trim()) return;
        valueToApply = `${envKey.trim()}=${envVal.trim()}`;
        break;
      case "network":
        valueToApply = networkValue.trim();
        break;
      case "custom":
        if (!customKey.trim()) return;
        customK = customKey.trim();
        valueToApply = customVal.trim();
        break;
    }

    const updated = applyBulkServiceConfig(yamlContent, selectedServices, {
      field: selectedField,
      value: valueToApply,
      customKey: customK,
    });

    onApplyYaml(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="bg-popover border border-popover-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-100">

        <div className="px-5 py-4 border-b border-border/70 flex items-center justify-between bg-surface-secondary/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                {t.compose.bulkOptionsTitle || "Apply Bulk / Global Options"}
              </h3>
              <p className="text-2xs text-muted-foreground">
                {t.compose.bulkOptionsDesc || "Add or update directives across multiple services simultaneously"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>{t.compose.bulkSelectServices || "1. Select target services"}</span>
              </label>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-2xs text-primary hover:underline font-mono flex items-center gap-1"
              >
                {selectedServices.length === services.length ? (
                  <>
                    <Square className="w-3 h-3" />
                    <span>{t.compose.deselectAll || "Deselect all"}</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3 h-3" />
                    <span>{t.compose.selectAll || "Select all"}</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-surface-secondary/40 p-2.5 rounded-xl border border-border/70">
              {services.map((svc) => {
                const isSelected = selectedServices.includes(svc.name);
                return (
                  <button
                    key={svc.name}
                    type="button"
                    onClick={() => toggleService(svc.name)}
                    className={`flex items-center space-x-2 p-2 rounded-lg text-left transition-all border ${
                      isSelected
                        ? "bg-primary/15 border-primary/40 text-foreground font-medium"
                        : "bg-surface border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-primary border-primary text-white"
                          : "border-muted-foreground/40 bg-transparent"
                      }`}
                    >
                      {isSelected && <span className="text-[10px] leading-none">✓</span>}
                    </div>
                    <span className="truncate font-mono text-2xs">{svc.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.compose.bulkSelectDirective || "2. Directive to apply"}</span>
            </label>

            <div className="flex flex-wrap gap-1.5 bg-surface-secondary/70 p-1 rounded-xl border border-border/70">
              <button
                type="button"
                onClick={() => setSelectedField("platform")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-2xs transition-all ${
                  selectedField === "platform"
                    ? "bg-surface text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Cpu className="w-3 h-3 text-sky-400" />
                <span>platform</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedField("restart")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-2xs transition-all ${
                  selectedField === "restart"
                    ? "bg-surface text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <RotateCw className="w-3 h-3 text-emerald-400" />
                <span>restart</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedField("environment")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-2xs transition-all ${
                  selectedField === "environment"
                    ? "bg-surface text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-amber-400 font-mono text-[11px] font-bold">ENV</span>
                <span>environment</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedField("network")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-2xs transition-all ${
                  selectedField === "network"
                    ? "bg-surface text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Globe className="w-3 h-3 text-purple-400" />
                <span>networks</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedField("custom")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-2xs transition-all ${
                  selectedField === "custom"
                    ? "bg-surface text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{t.compose.otherDirective || "Other..."}</span>
              </button>
            </div>

            <div className="bg-surface p-3 rounded-xl border border-border/70 space-y-3">
              {selectedField === "platform" && (
                <div>
                  <label className="block text-2xs font-mono text-muted-foreground mb-1.5">
                    {t.compose.bulkPlatformDesc || "Architecture / Platform (e.g. linux/amd64 to emulate x86 on Apple Silicon)"}
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {[
                      { label: "linux/amd64 (x86_64)", value: "linux/amd64" },
                      { label: "linux/arm64 (Apple Silicon / ARM)", value: "linux/arm64" },
                      { label: "linux/arm/v7", value: "linux/arm/v7" },
                      { label: "linux/386", value: "linux/386" },
                    ].map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPlatformValue(p.value)}
                        className={`px-2.5 py-1.5 rounded-lg text-2xs font-mono text-left border transition-all ${
                          platformValue === p.value
                            ? "bg-primary/10 border-primary text-primary font-semibold"
                            : "bg-surface-secondary/60 border-border/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={platformValue}
                    onChange={(e) => setPlatformValue(e.target.value)}
                    placeholder="e.g. linux/amd64..."
                    className="w-full px-3 py-1.5 text-xs font-mono bg-surface-secondary/70 border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {selectedField === "restart" && (
                <div>
                  <label className="block text-2xs font-mono text-muted-foreground mb-1.5">
                    {t.compose.bulkRestartDesc || "Docker restart policy (restart)"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "always", label: "always", desc: t.compose.restartAlways || "Always restart" },
                      { value: "unless-stopped", label: "unless-stopped", desc: t.compose.restartUnlessStopped || "Unless stopped manually" },
                      { value: "on-failure", label: "on-failure", desc: t.compose.restartOnFailure || "On errors only" },
                      { value: "no", label: "no", desc: t.compose.restartNo || "Do not restart automatically" },
                    ].map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRestartValue(r.value)}
                        className={`p-2 rounded-lg text-left border transition-all ${
                          restartValue === r.value
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-surface-secondary/60 border-border/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="font-mono font-semibold text-2xs">{r.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedField === "environment" && (
                <div>
                  <label className="block text-2xs font-mono text-muted-foreground mb-1.5">
                    {t.compose.bulkEnvDesc || "Global or shared environment variable"}
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={envKey}
                      onChange={(e) => setEnvKey(e.target.value)}
                      placeholder="KEY (e.g. DEBUG)"
                      className="flex-1 px-3 py-1.5 text-xs font-mono bg-surface-secondary/70 border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary"
                    />
                    <span className="text-muted-foreground font-mono">=</span>
                    <input
                      type="text"
                      value={envVal}
                      onChange={(e) => setEnvVal(e.target.value)}
                      placeholder="value (e.g. true)"
                      className="flex-1 px-3 py-1.5 text-xs font-mono bg-surface-secondary/70 border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {selectedField === "network" && (
                <div>
                  <label className="block text-2xs font-mono text-muted-foreground mb-1.5">
                    {t.compose.bulkNetDesc || "Attach to Docker network"}
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {availableNetworks.map((net) => (
                      <button
                        key={net}
                        type="button"
                        onClick={() => setNetworkValue(net)}
                        className={`px-2.5 py-1 rounded-lg text-2xs font-mono border transition-all ${
                          networkValue === net
                            ? "bg-primary/10 border-primary text-primary font-semibold"
                            : "bg-surface-secondary border-border/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {net}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={networkValue}
                    onChange={(e) => setNetworkValue(e.target.value)}
                    placeholder="network name..."
                    className="w-full px-3 py-1.5 text-xs font-mono bg-surface-secondary/70 border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {selectedField === "custom" && (
                <div className="space-y-2">
                  <label className="block text-2xs font-mono text-muted-foreground">
                    {t.compose.bulkCustomDesc || "Custom directive (key : value)"}
                  </label>
                  <div className="flex items-center space-x-2">
                    <DirectiveAutocompleteInput
                      value={customKey}
                      onChange={(newKey) => setCustomKey(newKey)}
                      onSelectSuggestion={(selectedKey, defaultVal) => {
                        setCustomKey(selectedKey);
                        if (!customVal && defaultVal) {
                          setCustomVal(defaultVal);
                        }
                      }}
                      placeholder="directive (e.g. privileged)"
                      className="w-full px-3 py-1.5 text-xs font-mono bg-surface-secondary/70 border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary"
                    />
                    <span className="text-muted-foreground font-mono">:</span>
                    <input
                      type="text"
                      value={customVal}
                      onChange={(e) => setCustomVal(e.target.value)}
                      placeholder="value"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="flex-1 px-3 py-1.5 text-xs font-mono bg-surface-secondary/70 border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-border/70 bg-surface-secondary/40 flex items-center justify-between">
          <span className="text-2xs text-muted-foreground font-mono">
            {selectedServices.length} / {services.length} {t.compose.bulkSelectedCount || "services selected"}
          </span>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-surface border border-border/70 hover:bg-surface-secondary transition-colors"
            >
              {t.volumes?.cancel || "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={selectedServices.length === 0}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:opacity-95 transition-opacity shadow-xs disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>
                {t.compose.bulkApplyButton || `Apply to Selected (${selectedServices.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};