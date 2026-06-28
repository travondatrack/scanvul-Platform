# ScanVul AI

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-scanner_service-009688)](https://fastapi.tiangolo.com/)
[![Prisma](https://img.shields.io/badge/Prisma-MySQL-2d3748)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

ScanVul AI is a full-stack vulnerability scanning platform for repositories, uploaded archives, and pasted source code. It helps teams run security scans, review evidence-rich findings, triage issues, export reports, and integrate scan results into CI workflows.

Live demo: [https://scanvul-platform.vercel.app/](https://scanvul-platform.vercel.app/)

## Table of Contents

- [Project Description](#project-description)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation and Local Development](#installation-and-local-development)
- [Environment Variables](#environment-variables)
- [How to Use](#how-to-use)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Credits](#credits)
- [License](#license)

## Project Description

ScanVul AI combines a Next.js dashboard with a FastAPI scanner service to make application security scanning easier to run, review, and integrate into development workflows. It supports authenticated projects, guest scans, dashboard and CI scan triggers, finding triage, exports, timelines, and public scan badges.

The project uses Next.js, React, TypeScript, Tailwind CSS, NextAuth, Prisma, FastAPI, SQLAlchemy, and a hybrid scanner pipeline. The web app handles product workflows and access control, while the API service coordinates source ingestion, scanner execution, worker tasks, and report generation.

Key challenges include keeping the web and API data models aligned, normalizing findings from multiple scanner engines, deduplicating repeated issues, and showing enough evidence for developers to act on each result.

Future improvements include stronger organization-level scanner policy enforcement, more CI templates, broader scanner coverage, deployment automation, and richer recurring-vulnerability analytics.

## Features

- Secure authentication with email OTP verification, optional Google OAuth, protected routes, and organization/team RBAC.
- Project-based scanning for repositories, uploaded archives, pasted source, guest scans, dashboard scans, and CI-triggered scans.
- Hybrid scanner pipeline covering SAST, dependencies, secrets, configuration issues, OWASP patterns, and optional AI triage.
- Evidence-rich findings with severity, confidence, CWE/OWASP mapping, code context, remediation guidance, comments, assignment, and status tracking.
- Risk Score, deduplication, scan timelines, severity charts, heatmaps, scan comparison, and JSON/SARIF/PDF exports.
- CI token management, public scan badges, notifications, and admin health checks for core services and scanner engines.
- Local-first development defaults with optional Redis/Celery workers and MinIO-compatible storage for fuller deployments.

## Tech Stack

Frontend:

- Next.js 15, React 19, TypeScript
- Tailwind CSS, shadcn-style UI components, lucide-react, Recharts
- NextAuth, Prisma Client, Prisma Adapter
- Jest and Testing Library

Backend:

- FastAPI, Pydantic, SQLAlchemy
- Semgrep, Bandit, ESLint security checks, Trivy, local secret scanner, custom OWASP pattern adapter
- Celery and Redis support
- Local filesystem or MinIO-compatible object storage
- Optional OpenAI-compatible LLM triage

Database and infrastructure:

- MySQL-compatible database for Prisma-backed web data
- Redis for Celery mode and rate-limit style integrations
- Docker Compose for local multi-service startup
- Vercel/Render-oriented deployment files

## Project Structure

```text
apps/
  web/      Next.js app, dashboard UI, auth, RBAC helpers, Prisma schema
  api/      FastAPI app, scanner engines, worker tasks, exporters

.env.example
dev.ps1
start-all.ps1
docker-compose.yml
docker-compose.prod.yml
render.yaml
vercel.json
```

Important note for contributors: this repo has two ORM layers against the same MySQL database. Prisma lives in `apps/web`, and SQLAlchemy lives in `apps/api`. When changing shared tables such as scans, findings, scan events, uploaded assets, public badges, notifications, scanner policy, or audit tables, update both model layers in the same change.

## Installation and Local Development

### Requirements

- Node.js 24.x
- Python 3.11+
- MySQL-compatible database
- Optional: Redis, MinIO, Semgrep, Bandit, Trivy, and ESLint security tooling

### 1. Clone and install dependencies

```powershell
git clone <your-repository-url>
cd scanvul-Platform
npm install
```

### 2. Configure environment values

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace all `CHANGE_ME` values before running the app.

### 3. Prepare and run the web app

```powershell
cd apps\web
npm install
npx prisma generate
npx prisma db push
npm run dev
```

The web app runs at:

```text
http://localhost:3000
```

### 4. Prepare and run the API service

Open a second terminal:

```powershell
cd apps\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Useful API URLs:

```text
http://localhost:8000/docs
http://localhost:8000/health
http://localhost:8000/health/engines
```

### 5. Optional helper scripts

From the repository root:

```powershell
.\dev.ps1
```

`dev.ps1` starts the API in a new PowerShell window and runs the Next.js development server in the current terminal.

```powershell
.\start-all.ps1
```

`start-all.ps1` also starts Celery worker and beat windows, so use it only after Redis/Celery settings are ready.

## Environment Variables

Common local values:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
SCAN_WORKER_MODE=thread
STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=./storage
```

Important variables:

- `DATABASE_URL`: MySQL URL used by Prisma. The example uses an Aiven-style MySQL template and must be given a real password.
- `NEXTAUTH_URL`: local or production web origin.
- `NEXTAUTH_SECRET`: strong secret for NextAuth sessions.
- `NEXT_PUBLIC_API_BASE_URL`: FastAPI origin.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: required for real registration OTP email delivery.
- `EMAIL_DEV_MODE`: development/test switch for mocked email flows.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: optional Google OAuth credentials.
- `SCAN_WORKER_MODE`: use `thread` for simple local runs or `celery` for Redis/Celery workers.
- `STORAGE_BACKEND`: use `local` for local files or MinIO-compatible storage when configured.
- `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`: optional AI triage configuration.
- `SECRET_VERIFY_ENABLED`: opt-in live secret verification. Keep this disabled unless the environment explicitly allows outgoing verification requests.

Google OAuth callback URLs:

```text
Local:      http://localhost:3000/api/auth/callback/google
Production: https://YOUR_DOMAIN/api/auth/callback/google
```

Do not commit real database passwords, SMTP credentials, OAuth secrets, Redis tokens, MinIO secrets, or LLM API keys.

## How to Use

### Authentication

1. Register with an email address and password.
2. The app creates the user, hashes the password, stores a hashed 6-digit OTP, and sends the OTP through SMTP.
3. Enter the OTP on the verification screen.
4. After verification, the app signs you in and redirects you to the dashboard.

OTP codes expire after 10 minutes and are rejected after 5 incorrect attempts.

### Dashboard scan flow

1. Create a project from the dashboard.
2. Start a scan from a repository URL, uploaded archive, or pasted source input.
3. Track scan progress through runtime events and status updates.
4. Review findings by severity, confidence, category, source, sink, vulnerable function, and remediation guidance.
5. Assign findings, leave comments, change status, request AI review when configured, and export reports.

### CI scan flow

Project API tokens are managed from the project token UI. Raw tokens are shown only when they are created.

Minimal CI trigger:

```powershell
curl -X POST https://scanvul.ai/api/ci/scan `
  -H "Authorization: Bearer $env:SCANVUL_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"sourceType":"repo_url"}'
```

After the scan finishes, CI can fetch SARIF through the CI report endpoint for upload to GitHub code scanning.

### Visual reference

The repository includes a product mockup at:

```text
apps/web/public/scanvul-mockup.png
```

You can use it in project pages or documentation that need a screenshot-style preview of the dashboard experience.

## Roadmap

- Enforce organization-level scanner policies in the worker pipeline.
- Add more ready-to-copy CI templates for GitHub Actions and other providers.
- Expand scanner coverage for additional languages and dependency ecosystems.
- Improve recurring vulnerability analytics across projects and organizations.
- Add stronger deployment automation and production health checks.
- Improve visual documentation with current dashboard screenshots.

## Contributing

Contributions are welcome. A good contribution flow for this repository is:

1. Create a feature branch.
2. Keep changes scoped to one feature or fix.
3. Update both Prisma and SQLAlchemy models when changing shared database tables.
4. Add or update tests for behavior changes.
5. Run the relevant verification commands before opening a pull request.
6. Document new environment variables, routes, scripts, or scanner behavior in this README.

Recommended quality checks before a pull request:

```powershell
cd apps\web
npx tsc --noEmit --pretty false
npm test -- --runInBand
```

```powershell
cd apps\api
python -m pytest
```

## Credits

Project implementation: ScanVul AI contributors.

Core technologies and tools used by this project:

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [NextAuth.js](https://next-auth.js.org/)
- [Prisma](https://www.prisma.io/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [SQLAlchemy](https://www.sqlalchemy.org/)
- [Semgrep](https://semgrep.dev/)
- [Bandit](https://bandit.readthedocs.io/)
- [Trivy](https://trivy.dev/)
- [shields.io](https://shields.io/)

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.
