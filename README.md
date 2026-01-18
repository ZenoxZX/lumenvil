# Lumenvil - WIP

<div align="center">

<img src=".github/Images/icon.png" alt="Lumenvil Logo" width="300">

![Lumenvil](https://img.shields.io/badge/Lumenvil-Unity%20Build%20Automation-blueviolet?style=for-the-badge)

**Self-hosted Unity build automation system for PC/Steam games**

*Where builds come to light*

[![.NET](https://img.shields.io/badge/.NET-6.0-512BD4?style=flat-square&logo=dotnet)](https://dotnet.microsoft.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## Overview

Lumenvil is a complete build automation solution designed for game development teams. Run Unity builds on a dedicated machine, monitor progress in real-time from any device, and deploy directly to Steam.

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Dashboard  │◄────►│   Backend   │◄────►│ Build Agent │
│  (Next.js)  │      │  (.NET API) │      │ (Win/Mac/Linux)
└─────────────┘      └─────────────┘      └─────────────┘
     Any Device         SignalR              Unity + Steam
```

---

## Screenshots

> **[View Full Dashboard Guide with all screenshots](docs/DASHBOARD_GUIDE.md)**

<details>
<summary><b>Dashboard Overview</b> - Monitor all your builds at a glance</summary>
<br>
<img src=".github/Images/ss/01-dashboard-overview.png" alt="Dashboard Overview">
</details>

<details>
<summary><b>Live Build Logs</b> - Real-time progress tracking with stage indicators</summary>
<br>
<img src=".github/Images/ss/04-build-detail-live-logs.png" alt="Build Detail with Live Logs">
</details>

<details>
<summary><b>Build Pipelines</b> - Configure pre-build and post-build processes</summary>
<br>
<img src=".github/Images/ss/18-pipeline-with-processes.png" alt="Pipeline with Processes">
</details>

<details>
<summary><b>Pipeline Script Preview</b> - Auto-generated Unity scripts for your pipeline</summary>
<br>
<img src=".github/Images/ss/15-pipeline-preview-prebuild.png" alt="Pipeline Script Preview">
</details>

<details>
<summary><b>Steam Integration</b> - Configure SteamCMD for automatic uploads</summary>
<br>
<img src=".github/Images/ss/20-settings-steam.png" alt="Steam Settings">
</details>

<details>
<summary><b>Notifications</b> - Discord, Slack, and custom webhook support</summary>
<br>
<img src=".github/Images/ss/21-settings-notifications.png" alt="Notification Settings">
</details>

<details>
<summary><b>Storage Management</b> - Disk space monitoring and automatic cleanup</summary>
<br>
<img src=".github/Images/ss/22-settings-cleanup-disk.png" alt="Cleanup and Disk Space">
</details>

---

## Features

### Build Automation
- **IL2CPP & Mono** scripting backend support
- **Git integration** with branch selection and commit tracking
- **Cross-platform** build agent (Windows, macOS, Linux)
- **Queue system** for managing multiple builds

### Build Pipelines
- **Pre-build processes** - run tasks before Unity starts building
- **Post-build processes** - run tasks after build completes
- **Define symbols** - add or remove scripting defines per build
- **Player settings** - modify company name, version, screen settings
- **Scene list** - configure which scenes to include
- **Custom code** - execute C# scripts during build
- **Shell commands** - run external scripts or commands
- **File operations** - copy/move files as part of the pipeline

### Build Templates
- **Save configurations** as reusable templates
- **Quick builds** - start builds with one click
- **Branch + backend + pipeline** combinations saved

### Real-time Monitoring
- **Live build logs** streaming via SignalR
- **Progress tracking** with stage indicators
- **Toast notifications** for build events
- **Multi-client sync** - watch from multiple devices

### Steam Integration
- **Automatic upload** via SteamCMD
- **Branch selection** (default, beta, staging)
- **Upload status tracking** in dashboard

### Notifications
- **Discord** webhooks with rich embeds
- **Slack** webhooks with formatted messages
- **Custom webhooks** with HMAC signing
- **Per-project overrides** for notification settings

### Storage Management
- **Automatic cleanup** of old builds
- **Disk space monitoring** with alerts
- **Configurable retention** (by age or count)
- **Steam upload protection** - keep deployed builds

### User Management
- **Role-based access**: Admin, Developer, Viewer
- **JWT authentication**
- **User invitation system**

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | .NET 6 Web API, SignalR, Entity Framework Core |
| **Dashboard** | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| **Build Agent** | .NET 6 Console App (cross-platform) |
| **Database** | SQLite |
| **Real-time** | SignalR WebSockets |

---

## Quick Start

### Prerequisites
- .NET 6 SDK
- Node.js 18+
- Unity (on build machine)
- Git

### 1. Clone & Setup
```bash
git clone https://github.com/yourusername/lumenvil.git
cd lumenvil

# Backend
cd src/Backend
cp .env.example .env  # Edit with your settings
dotnet restore

# Dashboard
cd ../Dashboard
npm install
```

### 2. Start All Services
```bash
./start.sh
```

Or manually:
```bash
# Terminal 1: Backend
cd src/Backend && dotnet run

# Terminal 2: Dashboard
cd src/Dashboard && npm run dev

# Terminal 3: Build Agent
cd src/BuildAgent && dotnet run
```

### 3. Access Dashboard
Open `http://localhost:3000`

Default credentials:
- Username: `admin`
- Password: `admin123`

---

## Architecture

```
lumenvil/
├── src/
│   ├── Backend/              # .NET Web API
│   │   ├── Controllers/      # REST endpoints
│   │   │   ├── AuthController.cs
│   │   │   ├── BuildController.cs
│   │   │   ├── BuildTemplateController.cs
│   │   │   ├── GitController.cs
│   │   │   ├── PipelineController.cs
│   │   │   ├── ProjectController.cs
│   │   │   ├── SettingsController.cs
│   │   │   └── UserController.cs
│   │   ├── Hubs/             # SignalR hub
│   │   ├── Models/           # Data models
│   │   └── Services/
│   │       ├── Notifications/  # Discord, Slack, Webhooks
│   │       └── Platforms/      # Steam uploader
│   │
│   ├── BuildAgent/           # Cross-platform build service
│   │   └── Services/
│   │       ├── UnityBuildRunner.cs
│   │       ├── GitService.cs
│   │       └── AgentHubClient.cs
│   │
│   └── Dashboard/            # Next.js frontend
│       ├── app/
│       │   └── dashboard/
│       │       ├── builds/
│       │       ├── pipelines/
│       │       ├── projects/
│       │       ├── settings/
│       │       ├── templates/
│       │       └── users/
│       ├── components/
│       └── lib/
│
├── database/                 # SQLite database
└── start.sh                  # Development startup script
```

---

## Configuration

### Environment Variables (Backend)
```env
# JWT
JWT_KEY=your-super-secret-key-min-32-characters
JWT_ISSUER=Lumenvil
JWT_AUDIENCE=Lumenvil

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
ADMIN_EMAIL=admin@example.com

# Database
DATABASE_PATH=../database/buildautomation.db
```

### Build Agent (appsettings.json)
```json
{
  "HubUrl": "http://localhost:5000/hubs/build",
  "AgentName": "build-agent-01",
  "UnityHubPath": "C:\\Program Files\\Unity\\Hub\\Editor",
  "BuildOutputBase": "./builds",
  "WorkspacePath": "./workspace"
}
```

Unity Hub paths by platform:
- **Windows**: `C:\Program Files\Unity\Hub\Editor`
- **macOS**: `/Applications/Unity/Hub/Editor`
- **Linux**: `~/Unity/Hub/Editor`

---

## Remote Access

### Option 1: Cloudflare Tunnel (Recommended)
```bash
cloudflared tunnel run lumenvil
```
Access via `https://lumenvil.yourdomain.com`

### Option 2: Tailscale
Install on all devices, access via Tailscale network.

### Option 3: Direct Port Forward
Open ports 3000 (Dashboard) and 5000 (API) on your router.

---

## API Reference

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User login |

### Projects
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/project` | GET | List all projects |
| `/api/project` | POST | Create project |
| `/api/project/{id}` | GET | Get project details |
| `/api/project/{id}` | PUT | Update project |
| `/api/project/{id}` | DELETE | Delete project |

### Builds
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/build` | GET | List builds |
| `/api/build` | POST | Start new build |
| `/api/build/{id}` | GET | Get build details + logs |
| `/api/build/{id}/cancel` | POST | Cancel build |

### Build Templates
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/buildtemplate` | GET | List templates |
| `/api/buildtemplate` | POST | Create template |
| `/api/buildtemplate/{id}/build` | POST | Start build from template |

### Pipelines
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pipeline` | GET | List pipelines |
| `/api/pipeline` | POST | Create pipeline |
| `/api/pipeline/{id}` | GET | Get pipeline details |
| `/api/pipeline/{id}/processes` | POST | Add process to pipeline |

### Settings
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/settings/steam` | GET/PUT | Steam configuration |
| `/api/settings/cleanup` | GET/PUT | Cleanup settings |
| `/api/settings/disk` | GET | Disk space info |
| `/api/settings/notifications` | GET/PUT | Notification settings |

### Git
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/git/branches` | GET | List branches for repository |

Full API documentation available at `/swagger` when running in development.

---

## Roadmap

- [ ] Parallel builds with library caching
- [ ] Email notifications (SMTP)
- [ ] Build analytics & statistics
- [ ] Windows Service installer
- [ ] Docker deployment
- [ ] macOS/Linux builds (currently agent supports all platforms)

---

## License

MIT License - see [LICENSE](LICENSE) for details.

### Commercial Use

This project is free and open source. If you're using Lumenvil commercially or as part of a paid service, I'd love to hear from you! While not required, reaching out helps me understand how the project is being used and prioritize features.

Contact: [aygunozmen@gmail.com](mailto:aygunozmen@gmail.com)

---

<div align="center">

**Built for game developers, by game developers**

</div>
