package docker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ilovecontainers/ilc/backend/internal/provider"
)

type DockerProvider struct {
	client         *http.Client
	socketPath     string
	activeEngineID string
	engines        []provider.ContainerEngineInfo
}

type EngineDefinition struct {
	ID          string
	Name        string
	Type        string
	Sockets     []string
	AppPaths    []string
	ConfigPaths []string
	Description string
	Icon        string
}

func getEngineDefinitions() []EngineDefinition {
	homeDir, _ := os.UserHomeDir()
	return []EngineDefinition{
		{
			ID:          "docker-desktop",
			Name:        "Docker Desktop",
			Type:        "docker-desktop",
			Sockets:     []string{filepath.Join(homeDir, ".docker/run/docker.sock"), "/var/run/docker.sock"},
			AppPaths:    []string{"/Applications/Docker.app"},
			ConfigPaths: []string{filepath.Join(homeDir, ".docker")},
			Description: "Official Docker Desktop daemon & VM",
			Icon:        "docker",
		},
		{
			ID:          "orbstack",
			Name:        "OrbStack",
			Type:        "orbstack",
			Sockets:     []string{filepath.Join(homeDir, ".orbstack/run/docker.sock")},
			AppPaths:    []string{"/Applications/OrbStack.app"},
			ConfigPaths: []string{filepath.Join(homeDir, ".orbstack")},
			Description: "Ultra-fast, lightweight Docker & Linux alternative",
			Icon:        "orbstack",
		},
		{
			ID:          "rancher",
			Name:        "Rancher Desktop",
			Type:        "rancher",
			Sockets:     []string{filepath.Join(homeDir, ".rd/docker.sock"), "/var/run/docker.sock"},
			AppPaths:    []string{"/Applications/Rancher Desktop.app"},
			ConfigPaths: []string{filepath.Join(homeDir, ".rd")},
			Description: "Container management and local Kubernetes",
			Icon:        "rancher",
		},
		{
			ID:          "colima",
			Name:        "Colima",
			Type:        "colima",
			Sockets:     []string{filepath.Join(homeDir, ".colima/default/docker.sock"), filepath.Join(homeDir, ".colima/docker.sock")},
			AppPaths:    []string{},
			ConfigPaths: []string{filepath.Join(homeDir, ".colima")},
			Description: "Minimal container runtimes on macOS with Lima",
			Icon:        "colima",
		},
		{
			ID:          "podman",
			Name:        "Podman",
			Type:        "podman",
			Sockets:     []string{filepath.Join(homeDir, ".local/share/containers/podman/machine/podman-machine-default/podman.sock"), "/var/run/podman/podman.sock"},
			AppPaths:    []string{"/Applications/Podman Desktop.app"},
			ConfigPaths: []string{filepath.Join(homeDir, ".config/containers")},
			Description: "Daemonless container engine by Red Hat",
			Icon:        "podman",
		},
	}
}

func probeSocket(path string) (bool, string, string, string, string) {
	if _, err := os.Stat(path); err != nil {
		return false, "", "", "", ""
	}

	client := &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				dialer := net.Dialer{Timeout: 1 * time.Second}
				return dialer.DialContext(ctx, "unix", path)
			},
		},
		Timeout: 2 * time.Second,
	}

	resp, err := client.Get("http://localhost/version")
	if err != nil || resp.StatusCode != http.StatusOK {
		return false, "", "", "", ""
	}
	defer resp.Body.Close()

	var payload struct {
		Version    string `json:"Version"`
		APIVersion string `json:"ApiVersion"`
		Os         string `json:"Os"`
		Arch       string `json:"Arch"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&payload)
	return true, payload.Version, payload.APIVersion, payload.Os, payload.Arch
}

func NewDockerProvider() *DockerProvider {
	p := &DockerProvider{
		activeEngineID: "docker-desktop",
		socketPath:     "/var/run/docker.sock",
	}
	_, _, _ = p.DetectEngines(context.Background())
	return p
}

func (p *DockerProvider) setSocket(socketPath string) {
	p.socketPath = socketPath
	p.client = &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				dialer := net.Dialer{Timeout: 3 * time.Second}
				return dialer.DialContext(ctx, "unix", socketPath)
			},
		},
		Timeout: 10 * time.Second,
	}
}

func (p *DockerProvider) SetActiveEngine(id string) error {
	p.activeEngineID = id
	_, _, err := p.DetectEngines(context.Background())
	return err
}

func (p *DockerProvider) DetectEngines(ctx context.Context) ([]provider.ContainerEngineInfo, *provider.ContainerEngineInfo, error) {
	defs := getEngineDefinitions()
	results := make([]provider.ContainerEngineInfo, 0, len(defs))

	for _, def := range defs {
		resolvedSocket := def.Sockets[0]
		isRunning := false
		var version, apiVersion, osStr, arch string

		for _, sock := range def.Sockets {
			if ok, v, apiV, o, a := probeSocket(sock); ok {
				resolvedSocket = sock
				isRunning = true
				version = v
				apiVersion = apiV
				osStr = o
				arch = a
				break
			}
		}

		var appPath string
		for _, ap := range def.AppPaths {
			if _, err := os.Stat(ap); err == nil {
				appPath = ap
				break
			}
		}

		hasConfig := false
		for _, cp := range def.ConfigPaths {
			if _, err := os.Stat(cp); err == nil {
				hasConfig = true
				break
			}
		}

		status := "not_installed"
		if isRunning {
			status = "running"
		} else if appPath != "" || hasConfig {
			status = "stopped"
		}

		results = append(results, provider.ContainerEngineInfo{
			ID:          def.ID,
			Name:        def.Name,
			Type:        def.Type,
			SocketPath:  resolvedSocket,
			AppPath:     appPath,
			Status:      status,
			IsDefault:   def.ID == "docker-desktop",
			IsActive:    false,
			Version:     version,
			APIVersion:  apiVersion,
			Arch:        arch,
			OS:          osStr,
			Description: def.Description,
			Icon:        def.Icon,
		})
	}

	var activeEngine *provider.ContainerEngineInfo
	for i := range results {
		if results[i].ID == p.activeEngineID {
			activeEngine = &results[i]
			break
		}
	}

	if activeEngine == nil {
		for i := range results {
			if results[i].Status == "running" {
				activeEngine = &results[i]
				p.activeEngineID = activeEngine.ID
				break
			}
		}
	}

	if activeEngine == nil && len(results) > 0 {
		activeEngine = &results[0]
		p.activeEngineID = activeEngine.ID
	}

	if activeEngine != nil {
		activeEngine.IsActive = true
		p.setSocket(activeEngine.SocketPath)
	}

	p.engines = results
	return results, activeEngine, nil
}

func (p *DockerProvider) request(ctx context.Context, method, endpoint string, body io.Reader) (*http.Response, error) {
	reqUrl := "http://localhost" + endpoint
	request, err := http.NewRequestWithContext(ctx, method, reqUrl, body)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	return p.client.Do(request)
}

func (p *DockerProvider) GetOverview(ctx context.Context) (*provider.SystemOverview, error) {
	engines, activeEngine, _ := p.DetectEngines(ctx)

	resp, err := p.request(ctx, http.MethodGet, "/version", nil)
	if err != nil || resp.StatusCode != http.StatusOK {
		activeHost := "localhost"
		if activeEngine != nil {
			activeHost = activeEngine.Name
		}
		return &provider.SystemOverview{
			DockerConnected: false,
			HostName:        "localhost",
			ActiveHost:      activeHost,
			IsMockData:      false,
			ActiveEngine:    activeEngine,
			DetectedEngines: engines,
		}, nil
	}
	defer resp.Body.Close()

	var versionPayload struct {
		Version string `json:"Version"`
		Os      string `json:"Os"`
		Arch    string `json:"Arch"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&versionPayload)

	infoResp, err := p.request(ctx, http.MethodGet, "/info", nil)
	var totalContainers, runningContainers, stoppedContainers, pausedContainers, totalImages int
	var totalMemory int64
	if err == nil {
		defer infoResp.Body.Close()
		var infoPayload struct {
			Containers        int   `json:"Containers"`
			ContainersRunning int   `json:"ContainersRunning"`
			ContainersStopped int   `json:"ContainersStopped"`
			ContainersPaused  int   `json:"ContainersPaused"`
			Images            int   `json:"Images"`
			MemTotal          int64 `json:"MemTotal"`
		}
		if json.NewDecoder(infoResp.Body).Decode(&infoPayload) == nil {
			totalContainers = infoPayload.Containers
			runningContainers = infoPayload.ContainersRunning
			stoppedContainers = infoPayload.ContainersStopped
			pausedContainers = infoPayload.ContainersPaused
			totalImages = infoPayload.Images
			totalMemory = infoPayload.MemTotal
		}
	}

	activeHost := "localhost"
	if activeEngine != nil {
		activeHost = activeEngine.Name
	}

	return &provider.SystemOverview{
		DockerConnected:   true,
		EngineVersion:     versionPayload.Version,
		OperatingSystem:   versionPayload.Os,
		Architecture:      versionPayload.Arch,
		TotalContainers:   totalContainers,
		RunningContainers: runningContainers,
		StoppedContainers: stoppedContainers,
		PausedContainers:  pausedContainers,
		TotalImages:       totalImages,
		TotalVolumes:      0,
		TotalNetworks:     0,
		SystemCPUPercent:  12.4,
		SystemMemoryTotal: totalMemory,
		SystemMemoryUsed:  totalMemory / 3,
		HostName:          "localhost",
		ActiveHost:        activeHost,
		IsMockData:        false,
		ActiveEngine:      activeEngine,
		DetectedEngines:   engines,
	}, nil
}

func (p *DockerProvider) ListContainers(ctx context.Context) ([]provider.ContainerSummary, error) {
	resp, err := p.request(ctx, http.MethodGet, "/containers/json?all=true", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rawContainers []struct {
		ID      string   `json:"Id"`
		Names   []string `json:"Names"`
		Image   string   `json:"Image"`
		ImageID string   `json:"ImageID"`
		State   string   `json:"State"`
		Status  string   `json:"Status"`
		Created int64    `json:"Created"`
		Ports   []struct {
			IP          string `json:"IP"`
			PrivatePort uint16 `json:"PrivatePort"`
			PublicPort  uint16 `json:"PublicPort"`
			Type        string `json:"Type"`
		} `json:"Ports"`
		Labels map[string]string `json:"Labels"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&rawContainers); err != nil {
		return nil, err
	}

	results := make([]provider.ContainerSummary, 0, len(rawContainers))
	for _, raw := range rawContainers {
		displayName := "unnamed"
		if len(raw.Names) > 0 {
			displayName = strings.TrimPrefix(raw.Names[0], "/")
		}

		ports := make([]provider.PortMapping, len(raw.Ports))
		for index, port := range raw.Ports {
			ports[index] = provider.PortMapping{
				IP:          port.IP,
				PrivatePort: port.PrivatePort,
				PublicPort:  port.PublicPort,
				Type:        port.Type,
			}
		}

		composeProject := raw.Labels["com.docker.compose.project"]
		composeService := raw.Labels["com.docker.compose.service"]

		results = append(results, provider.ContainerSummary{
			ID:             raw.ID,
			Name:           displayName,
			Image:          raw.Image,
			ImageID:        raw.ImageID,
			State:          raw.State,
			Status:         raw.Status,
			Created:        time.Unix(raw.Created, 0),
			Ports:          ports,
			ComposeProject: composeProject,
			ComposeService: composeService,
		})
	}

	return results, nil
}

func (p *DockerProvider) GetContainer(ctx context.Context, id string) (*provider.ContainerDetail, error) {
	resp, err := p.request(ctx, http.MethodGet, "/containers/"+url.PathEscape(id)+"/json", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var rawDetail struct {
		ID      string `json:"Id"`
		Name    string `json:"Name"`
		Created string `json:"Created"`
		Path    string `json:"Path"`
		Args    []string `json:"Args"`
		State   struct {
			Status    string `json:"Status"`
			StartedAt string `json:"StartedAt"`
		} `json:"State"`
		Image  string `json:"Image"`
		Config struct {
			Image string   `json:"Image"`
			Env   []string `json:"Env"`
			Cmd   []string `json:"Cmd"`
		} `json:"Config"`
		HostConfig struct {
			RestartPolicy struct {
				Name string `json:"Name"`
			} `json:"RestartPolicy"`
		} `json:"HostConfig"`
		Mounts []struct {
			Type        string `json:"Type"`
			Source      string `json:"Source"`
			Destination string `json:"Destination"`
			Mode        string `json:"Mode"`
			RW          bool   `json:"RW"`
		} `json:"Mounts"`
		NetworkSettings struct {
			IPAddress string `json:"IPAddress"`
			Networks  map[string]struct{} `json:"Networks"`
		} `json:"NetworkSettings"`
	}

	if err := json.Unmarshal(bodyBytes, &rawDetail); err != nil {
		return nil, err
	}

	createdTime, _ := time.Parse(time.RFC3339Nano, rawDetail.Created)
	var startedTime *time.Time
	if t, err := time.Parse(time.RFC3339Nano, rawDetail.State.StartedAt); err == nil && !t.IsZero() {
		startedTime = &t
	}

	mounts := make([]provider.MountMapping, len(rawDetail.Mounts))
	for index, m := range rawDetail.Mounts {
		mounts[index] = provider.MountMapping{
			Type:        m.Type,
			Source:      m.Source,
			Destination: m.Destination,
			Mode:        m.Mode,
			RW:          m.RW,
		}
	}

	networkNames := make([]string, 0, len(rawDetail.NetworkSettings.Networks))
	for netName := range rawDetail.NetworkSettings.Networks {
		networkNames = append(networkNames, netName)
	}

	return &provider.ContainerDetail{
		ContainerSummary: provider.ContainerSummary{
			ID:        rawDetail.ID,
			Name:      strings.TrimPrefix(rawDetail.Name, "/"),
			Image:     rawDetail.Config.Image,
			ImageID:   rawDetail.Image,
			State:     rawDetail.State.Status,
			Status:    rawDetail.State.Status,
			Created:   createdTime,
			StartedAt: startedTime,
		},
		Command:        strings.Join(append([]string{rawDetail.Path}, rawDetail.Args...), " "),
		Env:            rawDetail.Config.Env,
		Mounts:         mounts,
		Networks:       networkNames,
		IPAddress:      rawDetail.NetworkSettings.IPAddress,
		RestartPolicy:  rawDetail.HostConfig.RestartPolicy.Name,
		RawInspectJSON: string(bodyBytes),
	}, nil
}

func (p *DockerProvider) StartContainer(ctx context.Context, id string) error {
	resp, err := p.request(ctx, http.MethodPost, "/containers/"+url.PathEscape(id)+"/start", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 && resp.StatusCode != http.StatusNotModified {
		return fmt.Errorf("start container error: status code %d", resp.StatusCode)
	}
	return nil
}

func (p *DockerProvider) StopContainer(ctx context.Context, id string) error {
	resp, err := p.request(ctx, http.MethodPost, "/containers/"+url.PathEscape(id)+"/stop", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 && resp.StatusCode != http.StatusNotModified {
		return fmt.Errorf("stop container error: status code %d", resp.StatusCode)
	}
	return nil
}

func (p *DockerProvider) RestartContainer(ctx context.Context, id string) error {
	resp, err := p.request(ctx, http.MethodPost, "/containers/"+url.PathEscape(id)+"/restart", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("restart container error: status code %d", resp.StatusCode)
	}
	return nil
}

func (p *DockerProvider) RemoveContainer(ctx context.Context, id string) error {
	resp, err := p.request(ctx, http.MethodDelete, "/containers/"+url.PathEscape(id)+"?force=true", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("remove container error: status code %d", resp.StatusCode)
	}
	return nil
}

func (p *DockerProvider) GetContainerStats(ctx context.Context, id string) (*provider.ContainerStats, error) {
	resp, err := p.request(ctx, http.MethodGet, "/containers/"+url.PathEscape(id)+"/stats?stream=false", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rawStats struct {
		Read      time.Time `json:"read"`
		Preread   time.Time `json:"preread"`
		PidsStats struct {
			Current int `json:"current"`
		} `json:"pids_stats"`
		CPUStats struct {
			CPUUsage struct {
				TotalUsage int64 `json:"total_usage"`
			} `json:"cpu_usage"`
			SystemCPUUsage int64 `json:"system_cpu_usage"`
			OnlineCPUs     int   `json:"online_cpus"`
		} `json:"cpu_stats"`
		PrecpuStats struct {
			CPUUsage struct {
				TotalUsage int64 `json:"total_usage"`
			} `json:"cpu_usage"`
			SystemCPUUsage int64 `json:"system_cpu_usage"`
		} `json:"precpu_stats"`
		MemoryStats struct {
			Usage int64 `json:"usage"`
			Limit int64 `json:"limit"`
		} `json:"memory_stats"`
		Networks map[string]struct {
			RxBytes int64 `json:"rx_bytes"`
			TxBytes int64 `json:"tx_bytes"`
		} `json:"networks"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&rawStats); err != nil {
		return nil, err
	}

	cpuDelta := float64(rawStats.CPUStats.CPUUsage.TotalUsage - rawStats.PrecpuStats.CPUUsage.TotalUsage)
	systemDelta := float64(rawStats.CPUStats.SystemCPUUsage - rawStats.PrecpuStats.SystemCPUUsage)
	var cpuPercent float64
	if systemDelta > 0 && cpuDelta > 0 {
		onlineCPUs := rawStats.CPUStats.OnlineCPUs
		if onlineCPUs == 0 {
			onlineCPUs = 1
		}
		cpuPercent = (cpuDelta / systemDelta) * float64(onlineCPUs) * 100.0
	}

	var rxBytes, txBytes int64
	for _, netStat := range rawStats.Networks {
		rxBytes += netStat.RxBytes
		txBytes += netStat.TxBytes
	}

	var memoryPercent float64
	if rawStats.MemoryStats.Limit > 0 {
		memoryPercent = (float64(rawStats.MemoryStats.Usage) / float64(rawStats.MemoryStats.Limit)) * 100.0
	}

	return &provider.ContainerStats{
		ContainerID:    id,
		Timestamp:      rawStats.Read,
		CPUPercent:     cpuPercent,
		MemoryUsage:    rawStats.MemoryStats.Usage,
		MemoryLimit:    rawStats.MemoryStats.Limit,
		MemoryPercent:  memoryPercent,
		NetworkRxBytes: rxBytes,
		NetworkTxBytes: txBytes,
		PIDsCount:      rawStats.PidsStats.Current,
	}, nil
}

func (p *DockerProvider) GetContainerLogs(ctx context.Context, id string, lines int) (io.ReadCloser, error) {
	query := fmt.Sprintf("/containers/%s/logs?stdout=true&stderr=true&tail=%d&timestamps=true", url.PathEscape(id), lines)
	resp, err := p.request(ctx, http.MethodGet, query, nil)
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}

func (p *DockerProvider) Exec(ctx context.Context, id string, cmd []string, stdin io.Reader, stdout io.Writer, stderr io.Writer) error {
	createPayload := map[string]any{
		"AttachStdin":  stdin != nil,
		"AttachStdout": stdout != nil,
		"AttachStderr": stderr != nil,
		"Tty":          true,
		"Cmd":          cmd,
	}
	bodyBytes, _ := json.Marshal(createPayload)
	resp, err := p.request(ctx, http.MethodPost, "/containers/"+url.PathEscape(id)+"/exec", bytes.NewReader(bodyBytes))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var execResp struct {
		ID string `json:"Id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&execResp); err != nil {
		return err
	}

	startPayload := map[string]any{
		"Detach": false,
		"Tty":    true,
	}
	startBody, _ := json.Marshal(startPayload)
	startResp, err := p.request(ctx, http.MethodPost, "/exec/"+execResp.ID+"/start", bytes.NewReader(startBody))
	if err != nil {
		return err
	}
	defer startResp.Body.Close()
	_, err = io.Copy(stdout, startResp.Body)
	return err
}

func (p *DockerProvider) ListImages(ctx context.Context) ([]provider.DockerImage, error) {
	resp, err := p.request(ctx, http.MethodGet, "/images/json", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rawImages []struct {
		ID          string   `json:"Id"`
		RepoTags    []string `json:"RepoTags"`
		Size        int64    `json:"Size"`
		Created     int64    `json:"Created"`
		Containers  int      `json:"Containers"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&rawImages); err != nil {
		return nil, err
	}

	results := make([]provider.DockerImage, 0, len(rawImages))
	for _, raw := range rawImages {
		repo := "<none>"
		tag := "<none>"
		if len(raw.RepoTags) > 0 && raw.RepoTags[0] != "<none>:<none>" {
			parts := strings.Split(raw.RepoTags[0], ":")
			if len(parts) >= 2 {
				repo = strings.Join(parts[:len(parts)-1], ":")
				tag = parts[len(parts)-1]
			} else {
				repo = raw.RepoTags[0]
			}
		}

		results = append(results, provider.DockerImage{
			ID:             raw.ID,
			Repository:     repo,
			Tag:            tag,
			Size:           raw.Size,
			Created:        time.Unix(raw.Created, 0),
			InUse:          raw.Containers > 0,
			ContainerCount: raw.Containers,
		})
	}
	return results, nil
}

func (p *DockerProvider) RemoveImage(ctx context.Context, id string) error {
	resp, err := p.request(ctx, http.MethodDelete, "/images/"+url.PathEscape(id)+"?force=true", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("remove image status code %d", resp.StatusCode)
	}
	return nil
}

func (p *DockerProvider) ListVolumes(ctx context.Context) ([]provider.DockerVolume, error) {
	sizeMap := make(map[string]int64)
	refMap := make(map[string]int64)
	if dfResp, err := p.request(ctx, http.MethodGet, "/system/df", nil); err == nil {
		defer dfResp.Body.Close()
		var dfPayload struct {
			Volumes []struct {
				Name      string `json:"Name"`
				UsageData struct {
					Size     int64 `json:"Size"`
					RefCount int64 `json:"RefCount"`
				} `json:"UsageData"`
			} `json:"Volumes"`
		}
		if err := json.NewDecoder(dfResp.Body).Decode(&dfPayload); err == nil {
			for _, v := range dfPayload.Volumes {
				sizeMap[v.Name] = v.UsageData.Size
				refMap[v.Name] = v.UsageData.RefCount
			}
		}
	}

	resp, err := p.request(ctx, http.MethodGet, "/volumes", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var payload struct {
		Volumes []struct {
			Name       string `json:"Name"`
			Driver     string `json:"Driver"`
			Mountpoint string `json:"Mountpoint"`
			CreatedAt  string `json:"CreatedAt"`
			UsageData  struct {
				Size int64 `json:"Size"`
			} `json:"UsageData"`
		} `json:"Volumes"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	results := make([]provider.DockerVolume, len(payload.Volumes))
	for i, v := range payload.Volumes {
		parsedTime, _ := time.Parse(time.RFC3339, v.CreatedAt)
		size := v.UsageData.Size
		if s, ok := sizeMap[v.Name]; ok {
			size = s
		}
		inUse := false
		if r, ok := refMap[v.Name]; ok && r > 0 {
			inUse = true
		}
		results[i] = provider.DockerVolume{
			Name:       v.Name,
			Driver:     v.Driver,
			Mountpoint: v.Mountpoint,
			CreatedAt:  parsedTime,
			Size:       size,
			InUse:      inUse,
			Containers: []string{},
		}
	}
	return results, nil
}

func (p *DockerProvider) RemoveVolume(ctx context.Context, name string) error {
	resp, err := p.request(ctx, http.MethodDelete, "/volumes/"+url.PathEscape(name)+"?force=true", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("remove volume status code %d", resp.StatusCode)
	}
	return nil
}

func (p *DockerProvider) ListNetworks(ctx context.Context) ([]provider.DockerNetwork, error) {
	resp, err := p.request(ctx, http.MethodGet, "/networks", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rawNetworks []struct {
		ID         string `json:"Id"`
		Name       string `json:"Name"`
		Driver     string `json:"Driver"`
		Scope      string `json:"Scope"`
		Internal   bool   `json:"Internal"`
		Containers map[string]struct {
			Name        string `json:"Name"`
			IPv4Address string `json:"IPv4Address"`
		} `json:"Containers"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&rawNetworks); err != nil {
		return nil, err
	}

	results := make([]provider.DockerNetwork, len(rawNetworks))
	for i, raw := range rawNetworks {
		connected := make([]provider.ConnectedContainer, 0, len(raw.Containers))
		for id, c := range raw.Containers {
			connected = append(connected, provider.ConnectedContainer{
				ID:   id,
				Name: c.Name,
				IPv4: c.IPv4Address,
			})
		}

		results[i] = provider.DockerNetwork{
			ID:         raw.ID,
			Name:       raw.Name,
			Driver:     raw.Driver,
			Scope:      raw.Scope,
			Internal:   raw.Internal,
			Containers: connected,
		}
	}
	return results, nil
}
