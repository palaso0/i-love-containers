package provider

import (
	"context"
	"io"
	"time"
)

type PortMapping struct {
	IP          string `json:"ip,omitempty"`
	PrivatePort uint16 `json:"privatePort"`
	PublicPort  uint16 `json:"publicPort,omitempty"`
	Type        string `json:"type"`
}

type MountMapping struct {
	Type        string `json:"type"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Mode        string `json:"mode,omitempty"`
	RW          bool   `json:"rw"`
}

type ContainerSummary struct {
	ID             string        `json:"id"`
	Name           string        `json:"name"`
	Image          string        `json:"image"`
	ImageID        string        `json:"imageId"`
	State          string        `json:"state"`
	Status         string        `json:"status"`
	Created        time.Time     `json:"created"`
	StartedAt      *time.Time    `json:"startedAt,omitempty"`
	Ports          []PortMapping `json:"ports"`
	ComposeProject string        `json:"composeProject,omitempty"`
	ComposeService string        `json:"composeService,omitempty"`
	CPUPercent     float64       `json:"cpuPercent,omitempty"`
	MemoryUsage    int64         `json:"memoryUsage,omitempty"`
	MemoryLimit    int64         `json:"memoryLimit,omitempty"`
}

type ContainerDetail struct {
	ContainerSummary
	Command        string         `json:"command,omitempty"`
	Env            []string       `json:"env"`
	Mounts         []MountMapping `json:"mounts"`
	Networks       []string       `json:"networks"`
	IPAddress      string         `json:"ipAddress,omitempty"`
	RestartPolicy  string         `json:"restartPolicy,omitempty"`
	Platform       string         `json:"platform,omitempty"`
	RawInspectJSON string         `json:"rawInspectJson,omitempty"`
}

type ContainerStats struct {
	ContainerID     string    `json:"containerId"`
	Timestamp       time.Time `json:"timestamp"`
	CPUPercent      float64   `json:"cpuPercent"`
	MemoryUsage     int64     `json:"memoryUsage"`
	MemoryLimit     int64     `json:"memoryLimit"`
	MemoryPercent   float64   `json:"memoryPercent"`
	NetworkRxBytes  int64     `json:"networkRxBytes"`
	NetworkTxBytes  int64     `json:"networkTxBytes"`
	BlockReadBytes  int64     `json:"blockReadBytes"`
	BlockWriteBytes int64     `json:"blockWriteBytes"`
	PIDsCount       int       `json:"pidsCount"`
}

type DockerImage struct {
	ID             string    `json:"id"`
	Repository     string    `json:"repository"`
	Tag            string    `json:"tag"`
	Size           int64     `json:"size"`
	Created        time.Time `json:"created"`
	InUse          bool      `json:"inUse"`
	ContainerCount int       `json:"containerCount"`
}

type DockerVolume struct {
	Name       string    `json:"name"`
	Driver     string    `json:"driver"`
	Mountpoint string    `json:"mountpoint"`
	CreatedAt  time.Time `json:"createdAt,omitempty"`
	Size       int64     `json:"size,omitempty"`
	InUse      bool      `json:"inUse"`
	Containers []string  `json:"containers"`
}

type DockerNetwork struct {
	ID         string                  `json:"id"`
	Name       string                  `json:"name"`
	Driver     string                  `json:"driver"`
	Scope      string                  `json:"scope"`
	Internal   bool                    `json:"internal"`
	Containers []ConnectedContainer    `json:"containers"`
}

type ConnectedContainer struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	IPv4 string `json:"ipv4"`
}

type ContainerEngineInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	SocketPath  string `json:"socketPath"`
	AppPath     string `json:"appPath,omitempty"`
	Status      string `json:"status"`
	IsDefault   bool   `json:"isDefault"`
	IsActive    bool   `json:"isActive"`
	Version     string `json:"version,omitempty"`
	APIVersion  string `json:"apiVersion,omitempty"`
	Arch        string `json:"arch,omitempty"`
	OS          string `json:"os,omitempty"`
	Description string `json:"description,omitempty"`
	Icon        string `json:"icon,omitempty"`
}

type SystemOverview struct {
	DockerConnected   bool                  `json:"dockerConnected"`
	EngineVersion     string                `json:"engineVersion"`
	OperatingSystem   string                `json:"operatingSystem"`
	Architecture      string                `json:"architecture"`
	TotalContainers   int                   `json:"totalContainers"`
	RunningContainers int                   `json:"runningContainers"`
	StoppedContainers int                   `json:"stoppedContainers"`
	PausedContainers  int                   `json:"pausedContainers"`
	TotalImages       int                   `json:"totalImages"`
	TotalVolumes      int                   `json:"totalVolumes"`
	TotalNetworks     int                   `json:"totalNetworks"`
	SystemCPUPercent  float64               `json:"systemCpuPercent"`
	SystemMemoryTotal int64                 `json:"systemMemoryTotal"`
	SystemMemoryUsed  int64                 `json:"systemMemoryUsed"`
	HostName          string                `json:"hostName"`
	ActiveHost        string                `json:"activeHost"`
	IsMockData        bool                  `json:"isMockData"`
	ActiveEngine      *ContainerEngineInfo  `json:"activeEngine,omitempty"`
	DetectedEngines   []ContainerEngineInfo `json:"detectedEngines,omitempty"`
}

type ContainerProvider interface {
	GetOverview(ctx context.Context) (*SystemOverview, error)
	ListContainers(ctx context.Context) ([]ContainerSummary, error)
	GetContainer(ctx context.Context, id string) (*ContainerDetail, error)
	StartContainer(ctx context.Context, id string) error
	StopContainer(ctx context.Context, id string) error
	RestartContainer(ctx context.Context, id string) error
	RemoveContainer(ctx context.Context, id string) error
	GetContainerStats(ctx context.Context, id string) (*ContainerStats, error)
	GetContainerLogs(ctx context.Context, id string, lines int) (io.ReadCloser, error)
	Exec(ctx context.Context, id string, cmd []string, stdin io.Reader, stdout io.Writer, stderr io.Writer) error
	ListImages(ctx context.Context) ([]DockerImage, error)
	RemoveImage(ctx context.Context, id string) error
	ListVolumes(ctx context.Context) ([]DockerVolume, error)
	RemoveVolume(ctx context.Context, name string) error
	ListNetworks(ctx context.Context) ([]DockerNetwork, error)
	DetectEngines(ctx context.Context) ([]ContainerEngineInfo, *ContainerEngineInfo, error)
	SetActiveEngine(id string) error
}
