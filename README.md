# I Love Containers (ILC)

A fast, lightweight, and modern cross-platform desktop client for managing local container engines (Docker Desktop / Docker Engine, OrbStack, Rancher Desktop, Colima, and Podman) built with **Tauri 2**, **React 18**, **TypeScript**, and **Tailwind CSS**.

---

## Features

### Multi-Engine Support
- Automatic detection and one-click switching between local container runtimes across **macOS**, **Windows**, and **Linux**:
  - **Docker Desktop / Docker Engine** (UNIX sockets & Windows Named Pipes)
  - **OrbStack** (macOS)
  - **Rancher Desktop** (macOS, Windows, Linux)
  - **Colima** (macOS / Linux)
  - **Podman** (macOS, Windows, Linux)
- Live engine health checks, socket/pipe detection, and daemon version status.

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
- Pop out any container view into independent native desktop windows:
  - Container Terminal
  - Live Logs
  - Live Stats
  - In-Container File Manager
  - Raw JSON Inspect
  - Overview Dashboard
- Shared theme, accent color, and language state synchronized live across all open native windows.

### Keyboard Shortcuts & Command Palette
- **Command Palette (`Cmd/Ctrl+K`)**: Quick navigation to any container, stack, image, volume, or setting.
- Global keyboard shortcuts:
  - `Cmd/Ctrl+K`: Open Command Palette
  - `Cmd/Ctrl+B`: Toggle Sidebar
  - `R`: Refresh all resources
  - `M`: Toggle Fleet / System view
  - `L`: Open Logs (when a container is selected)
  - `T`: Open Terminal (when a container is selected)
  - `S`: Open Stats (when a container is selected)
  - `Esc`: Dismiss modals and overlays

### Customization & Native Look
- Adaptive titlebar spacing: macOS traffic lights spacing on macOS, standard compact header on Windows and Linux.
- Responsive branding: logo dynamically adapts between windowed mode and fullscreen mode.
- Multiple themes (Dark, Light, System) and custom accent colors.
- Multilingual interface (English, Spanish).

---

## Tech Stack & Architecture

- **Desktop Shell**: [Tauri 2](https://v2.tauri.app/) (Rust + OS native Webview)
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Terminal**: [xterm.js](https://xtermjs.org/) (`@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`)
- **Charts**: [Recharts](https://recharts.org/)
- **Backend Service**: Node.js HTTP API server (`127.0.0.1:41785`).
  - `src-server/index.ts`: Bundled via esbuild to `src-tauri/server.mjs`.
  - `vite-engine-plugin.ts`: Unified Docker Engine API proxy communicating with local UNIX domain sockets and Windows named pipes (`//./pipe/docker_engine`).
  - During desktop execution, the Tauri Rust shell automatically spawns and manages the Node.js server child process.
  - During browser development (`npm run dev`), Vite dev middleware proxies the API directly without needing the desktop shell.
  - Offline fallback: if no engine daemon is reachable, the UI remains functional with optimistic state.

---

## Getting Started

### Prerequisites

- **macOS**, **Windows 10/11**, or **Linux**
- **Node.js** (v18+)
- **Rust** & Cargo (for compiling the desktop shell via Tauri)
- Any local container engine (Docker Desktop, Docker Engine, OrbStack, Colima, Podman, or Rancher)

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
Launches the full native desktop app using Tauri:
```bash
npm run desktop
```

### Building & Packaging

#### Build Frontend and Server
Bundles the background Node.js server (`server.mjs`), typechecks TypeScript, and builds the Vite production bundle:
```bash
npm run build
```

#### Package Desktop Application
Compiles the release desktop application with Tauri for your platform:
```bash
npm run tauri build
```
