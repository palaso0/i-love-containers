# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-09-23

### Added
- Native PTY interactive terminal powered by direct duplex Unix socket streaming to container engines.
- Maximized terminal layout utilizing full viewport height with floating controls (Reconnect and Clear).
- Multiplatform container engine detection and support across macOS, Linux, and Windows.
- Compose stack management: save, run, inspect, and remove Compose projects and service groups.
- Drag & Drop support for window and panel organization.
- Standalone native OS pop-out windows for Terminal, Logs, Files, and Container Stats.

### Changed
- Universal shell resolution: default to standard interactive `sh` (with `/bin/sh` fallback) ensuring 100% compatibility across Alpine, Busybox, Debian, Ubuntu, and minimal images without crashing on missing `bash`.
- Streamlined terminal tab mounting lifecycle: WebSocket connections initialize only when the terminal view is active.
- Enhanced backend HTTP server and Unix socket request pipeline with strict Content-Length handling for container exec commands.

### Fixed
- Fixed container terminal session disconnecting automatically after running commands (e.g., `ls` or `cat`).
- Fixed `OCI runtime exec failed: exec: "bash": executable file not found in $PATH` error on Alpine-based containers.
- Fixed stack and compose deletion, file detection, and cleanup routines.
- Fixed log viewer clearing and cleanup behaviors.
- Fixed macOS initial installation edge cases and socket path discovery.

## [0.1.0] - 2026-09-18

### Added
- Initial release of I Love Containers.
- Container lifecycle management: Start, Stop, Pause, Restart, and Remove.
- Engine auto-detection and multi-engine support.
- Real-time container metrics, logs viewer, file manager, and system overview.
- Dark and light theme support with custom accents.
