# ScanVul AI

ScanVul AI is a web platform for creating projects, triggering security scans, and reviewing vulnerability findings.

The current project is split into:

- `apps/web`: Next.js 15 dashboard, authentication, projects, scans, reports
- `apps/api`: FastAPI scanner API and background scan execution
- `docker-compose.yml`: optional full stack services

## Main Features

- Email/password authentication with NextAuth
- Project management for GitHub repositories
- Manual scan trigger per project
- Scan history and report detail pages
- Findings panel with severity, evidence, remediation, and status actions
- Scanner API for repo URL, archive, or pasted source input
- Light/dark theme inside authenticated dashboard
- Public login/register pages pinned to light mode

## Tech Stack

Frontend:

- Next.js 15
- React 19
- Tailwind CSS
- NextAuth
- Prisma Client

Backend:

- FastAPI
- SQLAlchemy
- Celery/Redis support
- Semgrep, Bandit, secret scanning, AI reviewer adapters
- Local storage or MinIO-compatible object storage

## Project Structure

```text
apps/
  web/      Next.js app, auth, dashboard, Prisma schema
  api/      FastAPI app, scanner engines, worker tasks
docker-compose.yml
.env.example
```

## Environment

Copy the example file and edit values for your machine:

```powershell
Copy-Item .env.example .env
```

Important:

- `apps/web/prisma/schema.prisma` currently uses `provider = "mysql"`.
- Set `DATABASE_URL` to a MySQL-compatible URL when running the web app with Prisma.
- The FastAPI API can run with SQLite for local scanner development, but the Next.js dashboard auth/project tables use Prisma.
- Set `LLM_API_KEY` only if you want AI triage enabled.

## Local Development

Install and prepare the web app:

```powershell
cd apps/web
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Start the API in another terminal:

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open:

- Web: http://localhost:3000
- API docs: http://localhost:8000/docs

## Useful Commands

Frontend type check:

```powershell
cd apps/web
npx tsc --noEmit --pretty false
```

Frontend build:

```powershell
cd apps/web
npm run build
```

API smoke tests:

```powershell
cd apps/api
python -m pytest
```

## Docker

The compose file starts web, API, worker, Redis, MinIO, and a database service.

```powershell
docker compose up --build
```

Before using Docker for a full run, make sure `.env` database settings match the Prisma provider used by `apps/web/prisma/schema.prisma`.

## Current Notes

- Build may require network access because `apps/web/app/layout.tsx` imports the Google `Geist` font through `next/font`.
- Dashboard theme switching is only intended after login.
- Login and register pages are intentionally forced to light mode.
