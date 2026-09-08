package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ilovecontainers/ilc/backend/internal/provider"
	"github.com/ilovecontainers/ilc/backend/internal/provider/docker"
)

type Server struct {
	provider provider.ContainerProvider
}

func enableCors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func (s *Server) handleOverview(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	overview, err := s.provider.GetOverview(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(overview)
}

func (s *Server) handleContainers(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/containers")
	path = strings.TrimPrefix(path, "/")

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if path == "" {
		if r.Method == http.MethodGet {
			containers, err := s.provider.ListContainers(ctx)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(containers)
			return
		}
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	segments := strings.Split(path, "/")
	containerID := segments[0]

	if len(segments) == 1 {
		switch r.Method {
		case http.MethodGet:
			container, err := s.provider.GetContainer(ctx, containerID)
			if err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(container)
			return
		case http.MethodDelete:
			if err := s.provider.RemoveContainer(ctx, containerID); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		}
	}

	if len(segments) == 2 {
		action := segments[1]
		switch action {
		case "start":
			if err := s.provider.StartContainer(ctx, containerID); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		case "stop":
			if err := s.provider.StopContainer(ctx, containerID); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		case "restart":
			if err := s.provider.RestartContainer(ctx, containerID); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		case "stats":
			stats, err := s.provider.GetContainerStats(ctx, containerID)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]*provider.ContainerStats{stats})
			return
		case "logs":
			reader, err := s.provider.GetContainerLogs(ctx, containerID, 200)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			defer reader.Close()
			rawLogs, _ := io.ReadAll(reader)
			lines := strings.Split(string(rawLogs), "\n")
			cleanedLines := make([]string, 0, len(lines))
			for _, line := range lines {
				if strings.TrimSpace(line) != "" {
					cleanedLines = append(cleanedLines, line)
				}
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(cleanedLines)
			return
		}
	}

	http.Error(w, "Endpoint not found", http.StatusNotFound)
}

func (s *Server) handleImages(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/images")
	path = strings.TrimPrefix(path, "/")

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if path == "" {
		if r.Method == http.MethodGet {
			images, err := s.provider.ListImages(ctx)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(images)
			return
		}
	} else if r.Method == http.MethodDelete {
		if err := s.provider.RemoveImage(ctx, path); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	http.Error(w, "Not found", http.StatusNotFound)
}

func (s *Server) handleVolumes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/volumes")
	path = strings.TrimPrefix(path, "/")

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if path == "" {
		if r.Method == http.MethodGet {
			volumes, err := s.provider.ListVolumes(ctx)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(volumes)
			return
		}
	} else if r.Method == http.MethodDelete {
		if err := s.provider.RemoveVolume(ctx, path); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	http.Error(w, "Not found", http.StatusNotFound)
}

func (s *Server) handleNetworks(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	networks, err := s.provider.ListNetworks(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(networks)
}

func (s *Server) handleEngines(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	if r.Method == http.MethodPost {
		var payload struct {
			EngineID string `json:"engineId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err == nil && payload.EngineID != "" {
			_ = s.provider.SetActiveEngine(payload.EngineID)
		}
	}

	engines, active, err := s.provider.DetectEngines(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"engines":      engines,
		"activeEngine": active,
	})
}

func main() {
	dockerProvider := docker.NewDockerProvider()
	server := &Server{
		provider: dockerProvider,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/engines", enableCors(server.handleEngines))
	mux.HandleFunc("/api/engines/select", enableCors(server.handleEngines))
	mux.HandleFunc("/api/engines/rescan", enableCors(server.handleEngines))
	mux.HandleFunc("/api/overview", enableCors(server.handleOverview))
	mux.HandleFunc("/api/containers", enableCors(server.handleContainers))
	mux.HandleFunc("/api/containers/", enableCors(server.handleContainers))
	mux.HandleFunc("/api/images", enableCors(server.handleImages))
	mux.HandleFunc("/api/images/", enableCors(server.handleImages))
	mux.HandleFunc("/api/volumes", enableCors(server.handleVolumes))
	mux.HandleFunc("/api/volumes/", enableCors(server.handleVolumes))
	mux.HandleFunc("/api/networks", enableCors(server.handleNetworks))

	listenPort := os.Getenv("PORT")
	if listenPort == "" {
		listenPort = "4567"
	}

	listenAddress := fmt.Sprintf("127.0.0.1:%s", listenPort)
	fmt.Printf("I Love Containers Core running on http://%s\n", listenAddress)

	httpServer := &http.Server{
		Addr:         listenAddress,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		fmt.Fprintf(os.Stderr, "Server failed: %v\n", err)
	}
}
