# I Love Containers (ILC)

A fast, lightweight, and modern macOS desktop client for managing local container engines (Docker Desktop, OrbStack, Rancher Desktop, Colima, and Podman) built with **Tauri 2**, **React 18**, **TypeScript**, and **Tailwind CSS**.

---

## Features

### Multi-Engine Support
- Automatic detection and one-click switching between local container runtimes:
  - **Docker Desktop**
  - **OrbStack**
  - **Rancher Desktop**
  - **Colima**
  - **Podman Desktop**
- Live engine health checks, socket detection, and daemon version status.

### Containers Management
- **Fleet & System Views**: Grid and table views of all containers with real-time status badges (`running`, `stopped`, `paused`, `restarting`).
- **Lifecycle Controls**: Start, stop, restart, pause, and delete containers individually or in bulk.
- **Detailed Inspector**:
  - **Overview**: Container metadata, image tags, port bindings, volume mounts, entrypoint, and environment variables.
  - **Logs**: Streaming logs with pause/resume, text filtering, regex search, timestamps, and log file export.
  - **Terminal**: Interactive shell powered by **xterm.js** with ANSI colors, terminal resize, and auto-fit.
  - **Stats**: Live utilization charts for CPU % and Memory using **Recharts**, plus Network I/O and active PID tracking.
  - **Inspect**: Formatted, searchable JSON inspection with one-click clipboard copying.
  - **Files (In-Container File Manager)**: Browse filesystem hierarchy, breadcrumb navigation, root/home navigation, file upload & download, in-place file editor with line numbers, context menu actions, and duplicate collision handling.

### Docker Compose & Stacks
- Automatic stack discovery and hierarchical grouping.
- Expand / collapse all stacks.
- Stack-level controls: bulk start, stop, restart, and delete.
- Raw Compose YAML viewer and editor with line numbering and clipboard copy.

### Native Multi-Window Experience
- Pop out any container view into independent native macOS windows:
  - Container Terminal
  - Live Logs
  - Live Stats
  - In-Container File Manager
  - Raw JSON Inspect
  - Overview Dashboard
- Shared theme, accent color, and language state synchronized live across all open native windows.

### Keyboard Shortcuts & Command Palette
- **Command Palette (`⌘K`)**: Quick navigation to any container, stack, image, volume, or setting.
- Global keyboard shortcuts:
  - `⌘K`: Open Command Palette
  - `⌘B`: Toggle Sidebar
  - `R`: Refresh all resources
  - `M`: Toggle Fleet / System view
  - `L`: Open Logs (when a container is selected)
  - `T`: Open Terminal (when a container is selected)
  - `S`: Open Stats (when a container is selected)
  - `Esc`: Dismiss modals and overlays

### Customization & macOS Native Feel
- Native macOS `Overlay` titlebar with drag region and window controls (traffic lights) spacing.
- Responsive branding: logo dynamically adapts between windowed mode and fullscreen mode.
- Multiple themes (Dark, Light, System) and custom accent colors.
- Multilingual interface (English, Spanish).

---

## Tech Stack & Architecture

- **Desktop Shell**: [Tauri 2](https://v2.tauri.app/) (Rust + macOS WebKit)
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Terminal**: [xterm.js](https://xtermjs.org/) (`@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`)
- **Charts**: [Recharts](https://recharts.org/)
- **Backend Service**: Node.js HTTP API server (`127.0.0.1:41785`).
  - `src-server/index.ts`: Bundled via esbuild to `src-tauri/server.mjs`.
  - `vite-engine-plugin.ts`: Unified Docker Engine API proxy communicating with local UNIX domain sockets (`/var/run/docker.sock`, OrbStack, Colima, Podman).
  - During desktop execution, the Tauri Rust shell automatically spawns and manages the Node.js server child process.
  - During browser development (`npm run dev`), Vite dev middleware proxies the API directly without needing the desktop shell.
  - Offline fallback: if no engine daemon is reachable, the UI remains functional with optimistic state.

---

## Getting Started

### Prerequisites

- **macOS** (Apple Silicon or Intel)
- **Node.js** (v18+)
- **Rust** & Cargo (for compiling the desktop shell via Tauri)
- Any local container engine (Docker Desktop, OrbStack, Colima, Podman, or Rancher)

### Installation

```bash
npm install
```

### Development

#### Run in Browser (Frontend + Dev Server)
Runs Vite on port 5173 with API served via Vite middleware:
```bash
npm run dev
```

#### Run Full Desktop Application
Launches the full native macOS desktop app using Tauri:
```bash
npm run desktop
```

### Building & Packaging

#### Build Frontend and Server
Bundles the background Node.js server (`server.mjs`), typechecks TypeScript, and builds the Vite production bundle:
```bash
npm run build
```

#### Export macOS `.dmg` Installer
Compiles the release desktop application, packages the `.dmg` installer, and places it at the project root:
```bash
npm run export
```
