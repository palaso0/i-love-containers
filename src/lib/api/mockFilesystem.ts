export interface MockFsNode {
  name: string;
  isDirectory: boolean;
  size: number;
  mtime: string;
  permissions: string;
  content?: string;
}

export const mockFilesystem: Record<string, MockFsNode[]> = {
  "/": [
    {
      name: "app",
      isDirectory: true,
      size: 4096,
      mtime: "Sep 7 12:00",
      permissions: "drwxr-xr-x",
    },
    {
      name: "bin",
      isDirectory: true,
      size: 4096,
      mtime: "Sep 7 00:00",
      permissions: "drwxr-xr-x",
    },
    {
      name: "etc",
      isDirectory: true,
      size: 4096,
      mtime: "Sep 7 00:00",
      permissions: "drwxr-xr-x",
    },
    {
      name: "home",
      isDirectory: true,
      size: 4096,
      mtime: "Sep 7 00:00",
      permissions: "drwxr-xr-x",
    },
    {
      name: "var",
      isDirectory: true,
      size: 4096,
      mtime: "Sep 7 00:00",
      permissions: "drwxr-xr-x",
    },
    {
      name: "tmp",
      isDirectory: true,
      size: 4096,
      mtime: "Sep 7 00:00",
      permissions: "drwxrwxrwt",
    },
    {
      name: ".dockerenv",
      isDirectory: false,
      size: 0,
      mtime: "Sep 7 00:00",
      permissions: "-rw-r--r--",
      content: "",
    },
  ],
  "/app": [
    {
      name: "package.json",
      isDirectory: false,
      size: 482,
      mtime: "Sep 7 12:00",
      permissions: "-rw-r--r--",
      content:
        '{\n  "name": "container-app",\n  "version": "1.0.0",\n  "main": "index.js",\n  "scripts": {\n    "start": "node index.js"\n  }\n}',
    },
    {
      name: "index.js",
      isDirectory: false,
      size: 215,
      mtime: "Sep 7 12:05",
      permissions: "-rw-r--r--",
      content:
        'const http = require("http");\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { "Content-Type": "text/plain" });\n  res.end("Hello from container!");\n});\nserver.listen(8080);',
    },
    {
      name: "README.md",
      isDirectory: false,
      size: 310,
      mtime: "Sep 7 11:30",
      permissions: "-rw-r--r--",
      content:
        "# App in Container\n\nThis application is running inside your Docker container.",
    },
    {
      name: "config.json",
      isDirectory: false,
      size: 120,
      mtime: "Sep 7 11:45",
      permissions: "-rw-r--r--",
      content: '{\n  "port": 8080,\n  "environment": "production"\n}',
    },
    {
      name: "logs",
      isDirectory: true,
      size: 4096,
      mtime: "Sep 7 12:10",
      permissions: "drwxr-xr-x",
    },
  ],
  "/etc": [
    {
      name: "hosts",
      isDirectory: false,
      size: 158,
      mtime: "Sep 7 00:00",
      permissions: "-rw-r--r--",
      content:
        "127.0.0.1\tlocalhost\n::1\tlocalhost ip6-localhost ip6-loopback",
    },
    {
      name: "resolv.conf",
      isDirectory: false,
      size: 64,
      mtime: "Sep 7 00:00",
      permissions: "-rw-r--r--",
      content: "nameserver 127.0.0.11\noptions ndots:0",
    },
  ],
  "/var": [
    {
      name: "log",
      isDirectory: true,
      size: 4096,
      mtime: "Sep 7 00:00",
      permissions: "drwxr-xr-x",
    },
  ],
  "/var/log": [
    {
      name: "app.log",
      isDirectory: false,
      size: 1024,
      mtime: "Sep 7 12:00",
      permissions: "-rw-r--r--",
      content:
        "[INFO] 2026-09-07 Service started\n[INFO] 2026-09-07 Ready for requests",
    },
  ],
};
