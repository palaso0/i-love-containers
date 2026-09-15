import React, { useState } from "react";
import { ContainerDetail } from "@/types";
import { Copy, Check, Search } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";

interface InspectTabProps {
  container: ContainerDetail;
}

export const InspectTab: React.FC<InspectTabProps> = ({ container }) => {
  const { t } = useAppStore();
  const ot = t.containers.overviewTab;
  const [copied, setCopied] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  const formattedJson =
    container.rawInspectJson || JSON.stringify(container, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lines = formattedJson.split("\n");
  const filteredLines = filterQuery
    ? lines.filter((line) =>
        line.toLowerCase().includes(filterQuery.toLowerCase()),
      )
    : lines;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-xs">
      <div className="px-3 py-2 bg-surface-secondary border-b border-border flex items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3 h-3 text-muted-foreground absolute left-2.5 top-2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={ot.searchAttributes}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            className="w-full pl-7 pr-2.5 py-0.5 text-2xs bg-surface border border-border rounded text-foreground focus:outline-none font-mono"
          />
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 px-2.5 py-1 text-2xs font-mono rounded bg-surface border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <Check className="w-3 h-3 text-status-running" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          <span>{copied ? ot.copied : ot.copyJson}</span>
        </button>
      </div>

      <pre className="p-3 font-mono text-2xs text-muted-foreground overflow-x-auto max-h-[460px] overflow-y-auto leading-relaxed select-text bg-surface-secondary/20">
        <code>{filteredLines.join("\n")}</code>
      </pre>
    </div>
  );
};
