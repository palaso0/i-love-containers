import React, { useState } from "react";
import { Network as NetworkIcon, Search, Box } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { DockerDisconnected } from "@/components/DockerDisconnected";

export const NetworksView: React.FC = () => {
  const { t, networks, systemOverview, setActiveTab, setSelectedContainerId } = useAppStore();
  const isConnected = systemOverview?.dockerConnected ?? false;
  const [searchQuery, setSearchQuery] = useState("");

  if (!isConnected) {
    return <DockerDisconnected icon={NetworkIcon} />;
  }

  const filteredNetworks = networks.filter(
    (network) =>
      network.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      network.driver.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-semibold text-foreground tracking-tight">{t.networks.title}</h1>
            <span className="text-xs font-mono text-muted-foreground bg-surface-secondary/70 border border-border/60 px-2 py-0.5 rounded-full">
              {networks.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.networks.subtitle}
          </p>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.networks.search}
            className="pl-8 pr-3 py-1 text-xs bg-surface border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 w-48 sm:w-56 transition-all shadow-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredNetworks.map((network) => (
          <div
            key={network.id}
            className="bg-surface/80 backdrop-blur-sm border border-border/70 hover:border-border hover:bg-surface rounded-xl p-4 flex flex-col justify-between shadow-xs transition-all group"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center space-x-2 truncate">
                  <NetworkIcon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-foreground font-mono truncate">
                    {network.name}
                  </span>
                </div>

                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-secondary/70 text-muted-foreground border border-border/60 shrink-0">
                  {network.containers.length} {t.networks.connected}
                </span>
              </div>

              <div className="text-2xs text-muted-foreground font-mono mb-3">
                {t.networks.driver.toUpperCase()}: <span className="text-foreground">{network.driver}</span> • {t.networks.scope.toUpperCase()}:{" "}
                <span className="text-foreground">{network.scope}</span>
              </div>

              {network.containers.length > 0 ? (
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider mb-2">
                    {t.networks.containers}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {network.containers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setActiveTab("containers");
                          setSelectedContainerId(c.id);
                        }}
                        className="flex items-center space-x-1.5 px-2 py-1 rounded-md text-2xs font-mono bg-surface-secondary/70 border border-border/60 text-foreground hover:border-primary/50 hover:bg-surface-hover transition-colors shadow-2xs"
                      >
                        <Box className="w-3 h-3 text-muted-foreground" />
                        <span>{c.name}</span>
                        {c.ipv4 && (
                          <span className="text-muted-foreground/70 text-[10px]">({c.ipv4})</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-2xs text-muted-foreground italic">
                  {t.networks.noContainers}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-2xs font-mono text-muted-foreground">
              <span>ID: {network.id.substring(0, 12)}</span>
              <span>{network.driver === "bridge" ? t.networks.defaultBridge : t.networks.customDriver}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};