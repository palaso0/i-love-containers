import React from "react";
import { Server, Keyboard, Sparkles, Check, Box, Globe, Zap, Compass, Layers, RefreshCw, Sun, Moon, Laptop } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { AppTheme, AccentColor, Language } from "@/types";

function getEngineIcon(type: string, className = "w-4 h-4") {
  switch (type) {
    case "docker-desktop":
      return <Box className={`${className} text-sky-400`} />;
    case "orbstack":
      return <Zap className={`${className} text-amber-400`} />;
    case "rancher":
      return <Compass className={`${className} text-emerald-400`} />;
    case "colima":
      return <Layers className={`${className} text-purple-400`} />;
    case "podman":
      return <Box className={`${className} text-purple-400`} />;
    default:
      return <Server className={`${className} text-primary`} />;
  }
}

export const SettingsView: React.FC = () => {
  const {
    colorMode,
    setColorMode,
    appTheme,
    setAppTheme,
    accentColor,
    setAccentColor,
    language,
    setLanguage,
    t,
    selectedHost,
    setSelectedHost,
    detectedEngines,
    activeEngine,
    switchEngine,
    rescanEngines,
    isActionInProgress,
  } = useAppStore();

  const themes: {
    id: AppTheme;
    name: string;
    description: string;
    colorSwatch: string;
    accentSwatch: string;
    badge?: string;
  }[] = [
    {
      id: "liquid-glass",
      name: t.settings.themes.liquidGlass.name,
      description: t.settings.themes.liquidGlass.desc,
      colorSwatch: "bg-white/10 backdrop-blur-md border-white/30",
      accentSwatch: "bg-[#007aff]",
      badge: t.settings.themes.liquidGlass.badge,
    },
    {
      id: "material-flow",
      name: t.settings.themes.materialFlow.name,
      description: t.settings.themes.materialFlow.desc,
      colorSwatch: "bg-[#f0f4f9] border-[#0b57d0]/40",
      accentSwatch: "bg-[#0b57d0]",
      badge: t.settings.themes.materialFlow.badge,
    },
    {
      id: "pixel-arcade",
      name: t.settings.themes.pixelArcade.name,
      description: t.settings.themes.pixelArcade.desc,
      colorSwatch: "bg-[#10121a] border-2 border-[#ffcc00]",
      accentSwatch: "bg-[#ffcc00]",
      badge: t.settings.themes.pixelArcade.badge,
    },
    {
      id: "neo-brutalist",
      name: t.settings.themes.neoBrutalist.name,
      description: t.settings.themes.neoBrutalist.desc,
      colorSwatch: "bg-[#ffd60a] border-2 border-black",
      accentSwatch: "bg-black",
      badge: t.settings.themes.neoBrutalist.badge,
    },
    {
      id: "retro-console",
      name: t.settings.themes.retroConsole.name,
      description: t.settings.themes.retroConsole.desc,
      colorSwatch: "bg-[#050a06] border-[#00ff66]/60",
      accentSwatch: "bg-[#00ff66]",
      badge: t.settings.themes.retroConsole.badge,
    },
  ];

  const accents: {
    id: AccentColor;
    name: string;
    hex: string;
  }[] = [
    { id: "blue", name: t.settings.accents.blue, hex: "#007aff" },
    { id: "sky", name: t.settings.accents.sky, hex: "#38bdf8" },
    { id: "mint", name: t.settings.accents.mint, hex: "#30d158" },
    { id: "orange", name: t.settings.accents.orange, hex: "#ff9f0a" },
    { id: "pink", name: t.settings.accents.pink, hex: "#ff375f" },
    { id: "purple", name: t.settings.accents.purple, hex: "#a855f7" },
    { id: "graphite", name: t.settings.accents.graphite, hex: "#98989d" },
  ];

  const languages: { id: Language; label: string }[] = [
    { id: "en", label: "English" },
    { id: "es", label: "Español" },
  ];

  const hosts = [
    { id: "localhost", name: "Local Engine", socket: "unix:///var/run/docker.sock" },
    { id: "production", name: "Production Swarm", socket: "ssh://root@prod.internal" },
    { id: "server-01", name: "Staging Cluster", socket: "tcp://192.168.1.100:2375" },
    { id: "raspberrypi", name: "Homelab Pi", socket: "ssh://pi@pi.local" },
  ];

  const shortcuts = [
    { key: "⌘K", action: "Open Command Palette / Spotlight" },
    { key: "⌘B", action: "Toggle Sidebar navigation" },
    { key: "M", action: "Toggle Minimalist / Detailed view mode" },
    { key: "R", action: "Refresh all active runtime states" },
    { key: "L", action: "Jump to container Logs" },
    { key: "T", action: "Jump to container Terminal" },
    { key: "S", action: "Jump to container Stats" },
    { key: "Esc", action: "Dismiss modals and overlays" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4 max-w-3xl bg-background select-none">
      <div className="border-b border-border/70 pb-3">
        <h1 className="text-base font-semibold text-foreground tracking-tight">{t.settings.title}</h1>
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-semibold text-foreground">
              {t.settings.languageSection}
            </h2>
          </div>

          <div className="inline-flex items-center bg-surface-secondary/80 border border-border/60 p-0.5 rounded-lg shadow-xs">
            {languages.map((lang) => {
              const isSelected = language === lang.id;
              return (
                <button
                  key={lang.id}
                  onClick={() => setLanguage(lang.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  <span>{lang.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 space-y-4 shadow-xs">

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sun className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-semibold text-foreground">
              {t.settings.appearanceModeSection}
            </h2>
          </div>

          <div className="inline-flex items-center bg-surface-secondary/80 border border-border/60 p-0.5 rounded-lg shadow-xs">
            {[
              { id: "light" as const, label: t.settings.lightMode, icon: Sun },
              { id: "dark" as const, label: t.settings.darkMode, icon: Moon },
              { id: "system" as const, label: t.settings.systemMode, icon: Laptop },
            ].map((mode) => {
              const isSelected = colorMode === mode.id;
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setColorMode(mode.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-3 border-t border-border/60">
          <div className="flex items-center space-x-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {t.settings.themeSection}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {themes.map((themeItem) => {
              const isSelected = appTheme === themeItem.id;
              return (
                <div
                  key={themeItem.id}
                  onClick={() => setAppTheme(themeItem.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                    isSelected
                      ? "bg-surface border-primary shadow-mac-segment ring-1 ring-primary/40"
                      : "bg-surface-secondary/40 hover:bg-surface border-border/60 hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-4 h-4 rounded-full border ${themeItem.colorSwatch} flex items-center justify-center`}>
                        <div className={`w-2 h-2 rounded-full ${themeItem.accentSwatch}`} />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{themeItem.name}</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {themeItem.badge && (
                        <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-primary-muted text-primary border border-primary/20">
                          {themeItem.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {themeItem.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs font-semibold text-foreground">{t.settings.accentSection}</div>

            <div className="flex items-center space-x-1.5 bg-surface-secondary/80 p-1 rounded-lg border border-border/60">
              {accents.map((acc) => {
                const isActive = accentColor === acc.id;
                return (
                  <button
                    key={acc.id}
                    onClick={() => setAccentColor(acc.id)}
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                      isActive ? "scale-110 shadow-mac-segment ring-2 ring-white/30" : "hover:scale-105 opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: acc.hex }}
                    title={acc.name}
                  >
                    {isActive && <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-xs font-semibold text-foreground">
                {t.settings.enginesSection}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t.settings.enginesSectionDesc}
              </p>
            </div>
          </div>

          <button
            onClick={() => rescanEngines()}
            disabled={isActionInProgress}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border/70 text-xs font-medium text-foreground hover:bg-surface-secondary transition-colors shadow-xs disabled:opacity-50"
            title={t.engines.rescan}
          >
            <RefreshCw className={`w-3 h-3 ${isActionInProgress ? "animate-spin text-primary" : ""}`} />
            <span>{t.engines.rescan}</span>
          </button>
        </div>

        <div className="space-y-2">
          {detectedEngines.map((engine) => {
            const isSelected = activeEngine?.id === engine.id;
            const isRunning = engine.status === "running";
            const isStopped = engine.status === "stopped";

            return (
              <div
                key={engine.id}
                onClick={() => switchEngine(engine.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  isSelected
                    ? "bg-surface border-primary shadow-mac-segment ring-1 ring-primary/40"
                    : "bg-surface-secondary/40 hover:bg-surface border-border/60 hover:border-border"
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="p-2 rounded-lg bg-surface-secondary border border-border/60 shrink-0">
                    {getEngineIcon(engine.type, "w-4 h-4")}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-foreground text-xs">{engine.name}</span>
                      {engine.version && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          v{engine.version}
                        </span>
                      )}
                      {engine.appPath && (
                        <span className="text-[10px] font-mono text-muted-foreground hidden md:inline">
                          ({engine.appPath})
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate max-w-sm">
                      {engine.socketPath}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span
                    className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full border ${
                      isRunning
                        ? "border-status-running/30 text-status-running bg-status-running/10"
                        : isStopped
                        ? "border-amber-500/30 text-amber-500 bg-amber-500/10"
                        : "border-border/60 text-muted-foreground"
                    }`}
                  >
                    {isRunning
                      ? t.engines.running
                      : isStopped
                      ? t.engines.stopped
                      : t.engines.notInstalled}
                  </span>

                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 space-y-3 shadow-xs">
        <div className="flex items-center space-x-2">
          <Server className="w-4 h-4 text-primary" />
          <h2 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
            {t.settings.hostsSection}
          </h2>
        </div>

        <div className="divide-y divide-border/60 border border-border/70 rounded-lg overflow-hidden bg-surface/50 text-xs">
          {hosts.map((host) => {
            const isSelected = selectedHost === host.id;
            return (
              <div
                key={host.id}
                onClick={() => setSelectedHost(host.id)}
                className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected ? "bg-surface-secondary/80 text-foreground" : "hover:bg-surface-hover text-muted-foreground"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isSelected
                        ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.6)]"
                        : "bg-status-stopped"
                    }`}
                  />
                  <div>
                    <div className="font-medium text-foreground text-xs">{host.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{host.socket}</div>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full border ${
                    isSelected
                      ? "border-status-running/30 text-status-running bg-status-running/10"
                      : "border-border/60 text-muted-foreground"
                  }`}
                >
                  {isSelected ? t.settings.activeHost : t.settings.readyHost}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 space-y-3 shadow-xs">
        <div className="flex items-center space-x-2">
          <Keyboard className="w-4 h-4 text-primary" />
          <h2 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
            {t.settings.shortcutsSection}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key}
              className="bg-surface-secondary/50 p-2.5 rounded-lg border border-border/60 flex items-center justify-between"
            >
              <span className="text-muted-foreground text-xs">{shortcut.action}</span>
              <kbd className="px-2 py-0.5 rounded-md bg-surface text-foreground border border-border/70 text-2xs font-mono shadow-2xs">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-surface-secondary border border-border/60 flex items-center justify-center overflow-hidden shadow-xs">
            <img src="/ilc-logo.png" alt="ILC" className="w-5 h-5 rounded object-contain" />
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground">{t.settings.aboutTitle}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{t.settings.aboutSubtitle}</div>
          </div>
        </div>

        <div className="text-2xs text-muted-foreground font-medium bg-surface-secondary/70 border border-border/60 px-2 py-0.5 rounded-full">
          {t.settings.aboutBadge}
        </div>
      </div>
    </div>
  );
};