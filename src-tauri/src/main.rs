#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, Manager};

#[tauri::command]
fn check_fullscreen(window: tauri::Window) -> bool {
    if !window.is_fullscreen().unwrap_or(false) {
        return false;
    }
    if let Ok(Some(monitor)) = window.current_monitor() {
        if let Ok(size) = window.inner_size() {
            let mon_size = monitor.size();
            if size.width < mon_size.width.saturating_sub(20) || size.height < mon_size.height.saturating_sub(100) {
                return false;
            }
        }
    }
    true
}

#[tauri::command]
async fn open_native_window(
    app: tauri::AppHandle,
    window_id: String,
    title: String,
    url: String,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let sanitized_id: String = window_id
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();

    if let Some(existing) = app.get_webview_window(&sanitized_id) {
        let _ = existing.set_focus();
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(&app, &sanitized_id, tauri::WebviewUrl::App(url.into()))
        .title(&title)
        .inner_size(width, height)
        .min_inner_size(480.0, 320.0)
        .resizable(true)
        .decorations(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn broadcast_theme_settings(app: tauri::AppHandle, js_code: String) {
    for (_, window) in app.webview_windows() {
        let _ = window.eval(&js_code);
    }
}

use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NativeEngineInfo {
    pub id: String,
    pub name: String,
    pub socket_path: String,
    pub app_path: Option<String>,
    pub status: String,
    pub is_default: bool,
}

#[tauri::command]
fn detect_container_engines() -> Vec<NativeEngineInfo> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users".to_string());
    let mut engines = Vec::new();

    let docker_socket = format!("{}/.docker/run/docker.sock", home);
    let docker_app = "/Applications/Docker.app";
    let docker_socket_exists = Path::new(&docker_socket).exists() || Path::new("/var/run/docker.sock").exists();
    let docker_app_exists = Path::new(docker_app).exists();
    let docker_status = if docker_socket_exists {
        "running"
    } else if docker_app_exists {
        "stopped"
    } else {
        "not_installed"
    };
    engines.push(NativeEngineInfo {
        id: "docker-desktop".into(),
        name: "Docker Desktop".into(),
        socket_path: if Path::new(&docker_socket).exists() { docker_socket } else { "/var/run/docker.sock".into() },
        app_path: if docker_app_exists { Some(docker_app.into()) } else { None },
        status: docker_status.into(),
        is_default: true,
    });

    let orb_socket = format!("{}/.orbstack/run/docker.sock", home);
    let orb_app = "/Applications/OrbStack.app";
    let orb_socket_exists = Path::new(&orb_socket).exists();
    let orb_app_exists = Path::new(orb_app).exists();
    let orb_status = if orb_socket_exists {
        "running"
    } else if orb_app_exists {
        "stopped"
    } else {
        "not_installed"
    };
    engines.push(NativeEngineInfo {
        id: "orbstack".into(),
        name: "OrbStack".into(),
        socket_path: orb_socket,
        app_path: if orb_app_exists { Some(orb_app.into()) } else { None },
        status: orb_status.into(),
        is_default: false,
    });

    let rancher_socket = format!("{}/.rd/docker.sock", home);
    let rancher_app = "/Applications/Rancher Desktop.app";
    let rancher_socket_exists = Path::new(&rancher_socket).exists();
    let rancher_app_exists = Path::new(rancher_app).exists();
    let rancher_status = if rancher_socket_exists {
        "running"
    } else if rancher_app_exists {
        "stopped"
    } else {
        "not_installed"
    };
    engines.push(NativeEngineInfo {
        id: "rancher".into(),
        name: "Rancher Desktop".into(),
        socket_path: rancher_socket,
        app_path: if rancher_app_exists { Some(rancher_app.into()) } else { None },
        status: rancher_status.into(),
        is_default: false,
    });

    let colima_socket = format!("{}/.colima/default/docker.sock", home);
    let colima_exists = Path::new(&colima_socket).exists();
    engines.push(NativeEngineInfo {
        id: "colima".into(),
        name: "Colima".into(),
        socket_path: colima_socket,
        app_path: None,
        status: if colima_exists { "running".into() } else { "not_installed".into() },
        is_default: false,
    });

    let podman_socket = format!("{}/.local/share/containers/podman/machine/podman-machine-default/podman.sock", home);
    let podman_app = "/Applications/Podman Desktop.app";
    let podman_socket_exists = Path::new(&podman_socket).exists();
    let podman_app_exists = Path::new(podman_app).exists();
    let podman_status = if podman_socket_exists {
        "running"
    } else if podman_app_exists {
        "stopped"
    } else {
        "not_installed"
    };
    engines.push(NativeEngineInfo {
        id: "podman".into(),
        name: "Podman".into(),
        socket_path: podman_socket,
        app_path: if podman_app_exists { Some(podman_app.into()) } else { None },
        status: podman_status.into(),
        is_default: false,
    });

    engines
}

use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

struct BackgroundServer(Mutex<Option<Child>>);

fn find_node_binary() -> Option<PathBuf> {

    if let Ok(output) = Command::new("which").arg("node").output() {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() && Path::new(&path_str).exists() {
                return Some(PathBuf::from(path_str));
            }
        }
    }

    if let Ok(output) = Command::new("/bin/zsh").args(["-lc", "which node"]).output() {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() && Path::new(&path_str).exists() {
                return Some(PathBuf::from(path_str));
            }
        }
    }

    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users".to_string());
    let nvm_dir = Path::new(&home).join(".nvm/versions/node");
    if let Ok(entries) = std::fs::read_dir(nvm_dir) {
        let mut versions: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path().join("bin/node"))
            .filter(|p| p.is_file() && p.exists())
            .collect();
        versions.sort();
        if let Some(node_path) = versions.pop() {
            return Some(node_path);
        }
    }

    let candidates = [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ];
    for c in &candidates {
        let p = Path::new(c);
        if p.is_file() && p.exists() {
            return Some(p.to_path_buf());
        }
    }

    None
}

fn find_server_script(app: &tauri::AppHandle) -> Option<PathBuf> {

    if let Ok(res_dir) = app.path().resource_dir() {
        let candidates = [
            res_dir.join("server.mjs"),
            res_dir.join("resources/server.mjs"),
            res_dir.join("_up_/server.mjs"),
        ];
        for c in &candidates {
            if c.exists() {
                return Some(c.clone());
            }
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(macos_dir) = exe.parent() {
            let res_script = macos_dir.join("../Resources/server.mjs");
            if res_script.exists() {
                return Some(res_script);
            }
        }
    }

    let cwd_candidates = [
        PathBuf::from("server.mjs"),
        PathBuf::from("src-tauri/server.mjs"),
        PathBuf::from("../src-tauri/server.mjs"),
    ];
    for c in &cwd_candidates {
        if c.exists() {
            return Some(c.clone());
        }
    }

    None
}

fn main() {
    let app = tauri::Builder::default()
        .manage(BackgroundServer(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![open_native_window, detect_container_engines, broadcast_theme_settings, check_fullscreen])
        .setup(|app| {
            let app_handle = app.handle().clone();
            if let Some(node_bin) = find_node_binary() {
                if let Some(script) = find_server_script(&app_handle) {
                    println!("[Tauri] Starting background server with {:?} and {:?}", node_bin, script);
                    match Command::new(&node_bin)
                        .arg(&script)
                        .stdin(Stdio::piped())
                        .stdout(Stdio::inherit())
                        .stderr(Stdio::inherit())
                        .spawn()
                    {
                        Ok(child) => {
                            if let Some(server_state) = app.try_state::<BackgroundServer>() {
                                if let Ok(mut lock) = server_state.0.lock() {
                                    *lock = Some(child);
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("[Tauri] Failed to spawn background server: {}", e);
                        }
                    }
                } else {
                    eprintln!("[Tauri] server.mjs not found");
                }
            } else {
                eprintln!("[Tauri] node binary not found");
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Resized(size) = event {
                let mut is_fs = window.is_fullscreen().unwrap_or(false);
                if is_fs {
                    if let Ok(Some(monitor)) = window.current_monitor() {
                        let mon_size = monitor.size();
                        if size.width < mon_size.width.saturating_sub(20) || size.height < mon_size.height.saturating_sub(100) {
                            is_fs = false;
                        }
                    }
                }
                let _ = window.emit("fullscreen-changed", is_fs);
            }
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    if let Some(server_state) = window.app_handle().try_state::<BackgroundServer>() {
                        if let Ok(mut lock) = server_state.0.lock() {
                            if let Some(mut child) = lock.take() {
                                let _ = child.kill();
                            }
                        }
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(server_state) = app_handle.try_state::<BackgroundServer>() {
                if let Ok(mut lock) = server_state.0.lock() {
                    if let Some(mut child) = lock.take() {
                        let _ = child.kill();
                    }
                }
            }
        }
    });
}