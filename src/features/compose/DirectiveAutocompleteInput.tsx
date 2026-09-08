import React, { useState, useRef, useEffect } from "react";

export interface DirectiveItem {
  key: string;
  defaultValue?: string;
  desc?: string;
}

export const COMPOSE_DIRECTIVES: DirectiveItem[] = [
  { key: "privileged", defaultValue: "true", desc: "Extended container privileges" },
  { key: "shm_size", defaultValue: "2gb", desc: "Shared memory size (/dev/shm)" },
  { key: "user", defaultValue: "1000:1000", desc: "UID:GID to run container" },
  { key: "mem_limit", defaultValue: "512m", desc: "Memory limit constraint" },
  { key: "mem_reservation", defaultValue: "256m", desc: "Memory soft reservation" },
  { key: "cpus", defaultValue: "1.5", desc: "Number of CPUs limit" },
  { key: "cpu_shares", defaultValue: "1024", desc: "CPU shares weight" },
  { key: "stdin_open", defaultValue: "true", desc: "Keep STDIN open (-i)" },
  { key: "tty", defaultValue: "true", desc: "Allocate pseudo-TTY (-t)" },
  { key: "working_dir", defaultValue: "/app", desc: "Working directory inside container" },
  { key: "hostname", defaultValue: "my-service", desc: "Container hostname" },
  { key: "domainname", defaultValue: "local", desc: "NIS domain name" },
  { key: "entrypoint", defaultValue: "/entrypoint.sh", desc: "Override container entrypoint" },
  { key: "stop_grace_period", defaultValue: "30s", desc: "Wait time before SIGKILL" },
  { key: "stop_signal", defaultValue: "SIGTERM", desc: "Stop signal" },
  { key: "init", defaultValue: "true", desc: "Use init process inside container" },
  { key: "read_only", defaultValue: "true", desc: "Mount rootfs read-only" },
  { key: "ipc", defaultValue: "host", desc: "IPC namespace mode" },
  { key: "pid", defaultValue: "host", desc: "PID namespace mode" },
  { key: "pull_policy", defaultValue: "always", desc: "always | missing | never" },
  { key: "security_opt", defaultValue: "no-new-privileges:true", desc: "Security options" },
  { key: "cap_add", defaultValue: "NET_ADMIN", desc: "Add kernel capabilities" },
  { key: "cap_drop", defaultValue: "ALL", desc: "Drop kernel capabilities" },
  { key: "healthcheck", defaultValue: "CMD curl -f http://localhost/ || exit 1", desc: "Health check" },
  { key: "extra_hosts", defaultValue: "host.docker.internal:host-gateway", desc: "Host mappings" },
  { key: "dns", defaultValue: "8.8.8.8", desc: "DNS servers" },
  { key: "logging.driver", defaultValue: "json-file", desc: "Logging driver" },
  { key: "sysctls", defaultValue: "net.core.somaxconn: 1024", desc: "Kernel sysctl options" },
];

interface DirectiveAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (key: string, defaultValue?: string) => void;
  placeholder?: string;
  className?: string;
}

export const DirectiveAutocompleteInput: React.FC<DirectiveAutocompleteInputProps> = ({
  value,
  onChange,
  onSelectSuggestion,
  placeholder = "key",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = value.trim().toLowerCase();
  const matches = trimmed
    ? COMPOSE_DIRECTIVES.filter((d) => d.key.toLowerCase().includes(trimmed))
    : COMPOSE_DIRECTIVES.slice(0, 10);

  const isExactSingleMatch = matches.length === 1 && matches[0].key.toLowerCase() === trimmed;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: DirectiveItem) => {
    onChange(item.key);
    if (onSelectSuggestion) {
      onSelectSuggestion(item.key, item.defaultValue);
    }
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || matches.length === 0) {
      if (e.key === "ArrowDown") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev <= 0 ? matches.length - 1 : prev - 1));
    } else if (e.key === "Enter" || e.key === "Tab") {
      const chosen = selectedIndex >= 0 ? matches[selectedIndex] : matches[0];
      if (chosen) {
        e.preventDefault();
        handleSelect(chosen);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setSelectedIndex(-1);
        }}
        onFocus={() => {
          if (!isExactSingleMatch) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className={className}
      />

      {isOpen && matches.length > 0 && !isExactSingleMatch && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 max-h-48 overflow-y-auto bg-popover/95 backdrop-blur-md border border-popover-border rounded-lg shadow-xl p-1 space-y-0.5 text-xs select-none animate-in fade-in zoom-in-95 duration-75">
          {matches.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.key}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
                className={`w-full px-2 py-1.5 rounded text-left flex items-center justify-between font-mono text-2xs transition-colors ${
                  isSelected
                    ? "bg-primary text-white"
                    : "text-foreground hover:bg-surface-secondary"
                }`}
              >
                <span className="font-medium truncate">{item.key}</span>
                {item.defaultValue && (
                  <span
                    className={`text-[10px] ml-2 shrink-0 truncate opacity-70 ${
                      isSelected ? "text-white/80" : "text-muted-foreground"
                    }`}
                  >
                    {item.defaultValue}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};