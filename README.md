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
