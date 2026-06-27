# ScanVul AI

ScanVul AI is a full-stack vulnerability scanning platform for repository, archive, and pasted-source scans. It combines a Next.js dashboard with a FastAPI scanner service, stores scan history and findings, and presents results with evidence, remediation guidance, status tracking, exports, and public badges.

## Features

- Email/password authentication with hashed OTP email verification.
- Optional Google OAuth login when Google credentials are configured.
- Protected dashboard routes, API route guards, project access checks, and first-pass organization/team RBAC.
- Project management for repositories and source inputs.
- Manual, guest, dashboard, and CI scan entry points.
- Hybrid scanner pipeline for SAST, dependency, configuration, secret, and optional AI triage findings.
- Evidence-rich findings with severity, confidence, source/sink context, vulnerable function, explanation, remediation, secure examples, and status actions.
- Semantic deduplication across repeated findings.
- Scan timeline, progress, heatmap, comparison, reports, and JSON/SARIF/PDF exports.
- Public scan badge publishing for completed scans.
- Local storage and thread-worker defaults for simple local development, with Redis/Celery and MinIO support for fuller deployments.

## Tech Stack

Frontend:

- Next.js 15, React 19, TypeScript
- Tailwind CSS, shadcn-style UI components, lucide-react, Recharts
- NextAuth, Prisma Client, Prisma Adapter
- Jest and Testing Library

Backend:

- FastAPI, Pydantic, SQLAlchemy
- Semgrep, Bandit, ESLint security checks, Trivy, secret scanner, OWASP pattern adapter
- Celery and Redis support
- Local filesystem or MinIO-compatible object storage
- Optional OpenAI-compatible LLM triage

## Project Structure

```text
apps/
  web/      Next.js app, dashboard UI, auth, RBAC helpers, Prisma schema
  api/      FastAPI app, scanner engines, worker tasks, exporters

docker-compose.yml
docker-compose.prod.yml
render.yaml
dev.ps1
start-all.ps1
.env.example
```

## Requirements

- Node.js 24.x for `apps/web`
- Python 3.11+ for `apps/api`
- MySQL-compatible database for the Prisma-backed web app
- Optional: Redis, MinIO, Semgrep, Bandit, Trivy, and ESLint security tooling depending on the scan path you want to exercise

## Environment

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` before running the app. Important values:

- `DATABASE_URL`: MySQL URL used by Prisma. The example is an Aiven MySQL template and must be given a real password.
- `NEXTAUTH_URL`: local web origin, usually `http://localhost:3000`.
- `NEXTAUTH_SECRET`: strong random secret for NextAuth sessions.
- `NEXT_PUBLIC_API_BASE_URL`: FastAPI origin, usually `http://localhost:8000`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: required for real registration OTP email delivery.
- `EMAIL_DEV_MODE`: set only for mocked/test flows; OTP values are not logged.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: optional. Google login is hidden/disabled when missing.
- `SCAN_WORKER_MODE`: `thread` is the simplest local default; `celery` uses Redis/Celery workers.
- `STORAGE_BACKEND`: `local` for local files or MinIO-compatible storage when configured.
- `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`: optional AI triage settings.
- `SECRET_VERIFY_ENABLED`: opt-in live secret verification. When enabled, the scanner makes short outgoing verification requests and stores only redacted outcomes.

Google OAuth callback URLs:

- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://YOUR_DOMAIN/api/auth/callback/google`

## Local Development

Install and prepare the web app:

```powershell
cd apps\web
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Start the API in another terminal:

```powershell
cd apps\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open:

- Web: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`
- API health: `http://localhost:8000/health`
- Engine health: `http://localhost:8000/health/engines`

For the common local path, keep these values in `.env`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
SCAN_WORKER_MODE=thread
STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=./storage
```

The repository also includes helper scripts:

```powershell
.\dev.ps1
.\start-all.ps1
```

`dev.ps1` starts the API in a new PowerShell window and runs the Next.js dev server in the current terminal. `start-all.ps1` also starts Celery worker and beat windows, so use it only after Redis/Celery settings are ready.

## Authentication Flow

1. A user registers with email and password.
2. The app hashes the password, creates an active user with `emailVerified = null`, stores a hashed 6-digit OTP, and sends the OTP through SMTP.
3. The user submits the OTP on the registration page.
4. A valid OTP sets `emailVerified`, consumes the OTP, signs the user in, and redirects to `/projects`.

OTP codes expire after 10 minutes, are stored only as hashes, and are rejected after 5 incorrect attempts.

## API Overview

FastAPI routes are mounted under `/api/v1`.

Common scanner endpoints:

- `POST /api/v1/scans`: create and queue a scan.
- `POST /api/v1/scans/guest`: create an unauthenticated guest scan with rate limiting.
- `GET /api/v1/scans`: list recent scans.
- `GET /api/v1/scans/{scan_id}`: read scan detail and findings.
- `GET /api/v1/scans/{scan_id}/status`: poll scan status.
- `GET /api/v1/scans/{scan_id}/findings`: page through findings.
- `GET /api/v1/scans/{scan_id}/heatmap`: get file hotspot data.
- `GET /api/v1/scans/{scan_id}/compare/{base_scan_id}`: compare two scans.
- `GET /api/v1/scans/{scan_id}/export?format=json|sarif|pdf`: export a report.
- `POST /api/v1/scans/{scan_id}/badge/publish`: publish a public badge for a completed scan.
- `GET /api/v1/public/scan/{token}`: public badge view.
- `POST /api/v1/uploads/init` and `POST /api/v1/uploads/complete`: archive upload flow.

The Next.js app also exposes protected proxy/API routes under `apps/web/app/api` for projects, scans, reports, findings, organizations, notifications, CI scans, and account operations.

## Scanner Pipeline

The backend scanner pipeline ingests the requested source and runs multiple stages:

- SAST: Semgrep, Bandit, ESLint security checks, and custom OWASP pattern rules.
- Dependency scan: Trivy-backed dependency vulnerability detection.
- Secret scan: local secret detection with optional live verification.
- Config scan: configuration and infrastructure-oriented checks from supported engines.
- AI triage: optional OpenAI-compatible enrichment and confidence adjustment.

Findings are normalized with fields such as `ruleId`, `scanCategory`, `source`, `sink`, `functionName`, `whyVulnerable`, `confidence`, `cvss4Score`, `dedupeHash`, and remediation content. The UI presents the aggregate score as `Risk Score`.

## Useful Commands

Frontend type check:

```powershell
cd apps\web
npx tsc --noEmit --pretty false
```

Frontend tests:

```powershell
cd apps\web
npm test -- --runInBand
```

Focused frontend test groups:

```powershell
cd apps\web
npm run test:rbac
npm run test:scan-workflow
```

Frontend build:

```powershell
cd apps\web
npm run build
```

API tests:

```powershell
cd apps\api
python -m pytest
```

API syntax check:

```powershell
cd apps\api
python -m py_compile app\main.py
```

## Docker

The compose file starts the web app, API, worker, Redis, MinIO, and database-related services.

```powershell
docker compose up --build
```

Before using Docker, make sure `.env` database settings match `apps/web/prisma/schema.prisma`, which currently uses the Prisma `mysql` provider.

## Deployment Notes

- `render.yaml` is included for Render-style deployment configuration.
- Set production `NEXTAUTH_URL`, `PUBLIC_BASE_URL`, `DATABASE_URL`, SMTP, storage, Redis, and LLM values in the hosting provider rather than committing them.
- Use a strong `NEXTAUTH_SECRET`.
- Keep `SECRET_VERIFY_ENABLED=false` unless live outgoing secret verification is explicitly approved for the environment.
- The frontend build may need network access because `apps/web/app/layout.tsx` imports the Google Geist font through `next/font/google`.

## Current Notes

- Dashboard theme switching is intended for authenticated pages.
- Login and register pages are intentionally forced to light mode.
- Google OAuth is optional and should remain absent from the UI when Google env values are missing.
- `.env.example` is a template only. Do not commit real database passwords, SMTP credentials, OAuth secrets, Redis tokens, MinIO secrets, or LLM API keys.
