# ClipFetch

ClipFetch is a modern media downloader that allows users to paste a supported video URL, inspect metadata and formats, choose a target format, and start a download job. The app is designed for technically and legally permitted content only and clearly reminds users to ensure they have rights to download the media.

## Features

- Paste a supported URL and analyze metadata
- View title, thumbnail, duration, uploader, and available formats
- Select preferred quality presets and audio-only options
- Download media via a background job with polling-based progress updates
- Structured API responses and frontend-friendly error states
- Rate limiting, size caps, URL validation, temporary file cleanup, and secure configuration

## Tech Stack

- Frontend: Next.js 16 + TypeScript + Tailwind CSS
- Backend: FastAPI + Pydantic + yt-dlp
- Job handling: in-memory thread pool suitable for local development
- Container support: Docker + Docker Compose

## Folder Structure

```text
.
├── .env.example
├── .gitignore
├── docker-compose.yml
├── README.md
├── backend/
│   ├── app/
│   │   ├── config.py
│   │   ├── errors.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── routes/
│   │   │   └── health.py
│   │   ├── services/
│   │   │   ├── downloader.py
│   │   │   └── extractor.py
│   │   └── utils/
│   │       └── validation.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── tests/
│       ├── test_health.py
│       └── test_validation.py
├── frontend/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
└── .venv/
```

## Requirements

- Node.js 20+
- npm 10+
- Python 3.12+
- FFmpeg installed and available on PATH

## FFmpeg Installation

### Windows

Download FFmpeg from https://www.ffmpeg.org/download.html or via winget:

```powershell
winget install Gyan.Dev.FFmpeg
```

Then ensure `ffmpeg` and `ffprobe` are in PATH.

### macOS

```bash
brew install ffmpeg
```

### Linux

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
```

## Backend Setup

From the project root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

Run the server:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000.

## Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

For the Next.js app, copy `frontend/.env.example` to `frontend/.env.local`. The frontend variable is public by design because it is embedded in browser JavaScript.

Core variables:

- `BACKEND_PORT=8000`
- `FRONTEND_ORIGIN=http://localhost:3000`
- `NEXT_PUBLIC_API_URL=http://localhost:8000` (set this in Vercel to the deployed backend URL)

For production, set these values in the separate deployments:

- Vercel: `NEXT_PUBLIC_API_URL=https://<your-backend-domain>`
- Backend: `FRONTEND_ORIGIN=https://<your-vercel-domain>`
- Backend container: keep FFmpeg installed by using `backend/Dockerfile`; `yt-dlp` is installed from `backend/requirements.txt`.
- `MAX_DOWNLOAD_SIZE_MB=2048`
- `MAX_CONCURRENT_DOWNLOADS=2`
- `TEMP_FILE_RETENTION_MINUTES=30`

## Docker Setup

```bash
docker compose up --build
```

This starts both the frontend and backend containers. The frontend is served on http://localhost:3000 and the backend on http://localhost:8000.

## Deployment Architecture

The frontend is deployed to Vercel. The FastAPI backend must not be deployed as a Vercel Serverless Function. It is a persistent Docker service because it runs yt-dlp, FFmpeg, background download jobs, progress tracking, and cleanup.

Local:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

Production:

- Frontend: Vercel
- Backend: a separate Docker-compatible VPS, VM, or container host

### Deploy the Backend to a Docker-Compatible Server

1. Install Docker Engine and Docker Compose on the server.
2. Clone this repository and enter its directory.
3. Build the backend image:

	```bash
	docker build -t clipfetch-backend ./backend
	```

4. Start the backend, replacing the frontend origin with the real Vercel origin:

	```bash
	docker run -d --name clipfetch-backend --restart unless-stopped \
	  -p 8000:8000 \
	  -e FRONTEND_ORIGIN=https://your-app.vercel.app \
	  -v clipfetch-downloads:/app/downloads \
	  clipfetch-backend
	```

5. Put HTTPS in front of port 8000 with the server's reverse proxy or managed load balancer.
6. Verify `https://your-backend-domain.example.com/api/health` returns HTTP 200.
7. Set the Vercel environment variable `NEXT_PUBLIC_API_URL` to that HTTPS backend URL and redeploy the frontend.

The backend image installs Python 3.12, FastAPI, Uvicorn, yt-dlp, and FFmpeg. It starts with `uvicorn app.main:app --host 0.0.0.0 --port 8000`.

## API Documentation

FastAPI automatically exposes Swagger UI at:

- http://localhost:8000/docs
- http://localhost:8000/redoc

### Endpoints

- `GET /api/health`
- `POST /api/analyze`
- `POST /api/download`
- `GET /api/download/{job_id}/status`
- `GET /api/download/{job_id}/file`

The health response reports API, yt-dlp, and FFmpeg availability without exposing secrets or filesystem paths.

## Cloudflare Quick Tunnel to Vercel

For free development/testing without a custom domain, use a Cloudflare Quick Tunnel. It forwards a temporary HTTPS `trycloudflare.com` URL to the local FastAPI server. Do not deploy the backend to Vercel, do not configure nameservers, and do not create a named tunnel.

The connection is:

```text
Vercel frontend -> temporary HTTPS trycloudflare.com URL -> http://localhost:8000 -> FastAPI
```

Quick Tunnel URLs change whenever the tunnel restarts. The URL is intentionally never stored in source code. You copy the URL printed by the helper into Vercel's `NEXT_PUBLIC_API_URL` environment variable.

### One-Time Manual Setup

1. Install `cloudflared` for Windows from:
   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Confirm that `cloudflared` is available on `PATH`:

	```powershell
	cloudflared --version
	```

3. No Cloudflare login, custom domain, nameserver change, named tunnel, or account authorization is required for Quick Tunnels.
4. In Vercel Project Settings > Environment Variables, be ready to add `NEXT_PUBLIC_API_URL` for the Preview or Production environment. Its value will be the generated URL from the running Quick Tunnel.
5. Set the backend `FRONTEND_ORIGIN` to the exact Vercel origin, for example `https://your-project.vercel.app`. The backend uses explicit CORS origins and never uses `*`.

### Exact Windows Commands

From the repository root, use separate VS Code terminals. PowerShell execution policy is bypassed only for the individual script process:

```powershell
# Terminal 1: start FastAPI
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1

# Terminal 2: verify local FastAPI before exposing it
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-backend.ps1

# Terminal 3: start the free temporary Quick Tunnel
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-cloudflared.ps1
```

The tunnel command used by the helper is exactly:

```powershell
cloudflared tunnel --url http://localhost:8000
```

The helper checks local `/api/health`, starts the tunnel, detects the generated `https://...trycloudflare.com` URL, and prints the exact Vercel value. Keep Terminal 3 running while the Vercel frontend uses the backend. The laptop must remain powered on, connected to the internet, and running FastAPI.

### Vercel Environment Update

After Terminal 3 prints the public URL:

1. Open Vercel Project Settings > Environment Variables.
2. Set `NEXT_PUBLIC_API_URL` to the complete printed `https://...trycloudflare.com` URL.
3. Set `FRONTEND_ORIGIN` on the backend to the exact Vercel frontend origin.
4. Redeploy the Vercel frontend so Next.js embeds the new public API URL.
5. Repeat these steps whenever the Quick Tunnel restarts and its URL changes.

The local frontend example remains `NEXT_PUBLIC_API_URL=http://localhost:8000`. The production example contains only a placeholder and never a real temporary URL.

### Public Connection Health Checks

Replace the placeholder with the URL printed by the tunnel:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-backend.ps1 -BackendUrl https://generated-name.trycloudflare.com
```

The script verifies the HTML dashboard at `/` and JSON health at `/api/health`. After it passes, test `/docs` and Analyze from the Vercel frontend.

## Development Workflow

1. Create the virtual environment and install backend dependencies.
2. Install frontend packages with `npm install`.
3. Start the backend with `uvicorn`.
4. Start the frontend with `npm run dev`.
5. Run tests with `pytest` and `npm run test` when available.

## Troubleshooting

- If API calls fail, verify `NEXT_PUBLIC_API_URL` is set in the frontend build environment and points to the browser-reachable backend URL. Do not use the Docker-only hostname `backend` in this variable.
- If FFmpeg errors occur, confirm the binary is on PATH.
- If downloads are blocked, confirm the URL is supported and permitted.
- If cross-origin errors appear, verify `FRONTEND_ORIGIN` matches your app origin.

## Security Considerations

- User URLs are validated before processing.
- HTTP and HTTPS only are allowed.
- No localhost or internal network targets are accepted.
- Temporary files are stored in dedicated directories and cleaned up.
- Rate limiting and job concurrency are enforced in memory for local development.

## Legal/Usage Notice

Users are responsible for ensuring they have permission to download or extract media before using ClipFetch. This tool must not be used to bypass access controls, DRM, paywalls, authentication barriers, or other restrictions. Only use content that is legally and technically permitted to be downloaded by the user.
