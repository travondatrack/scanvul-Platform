# CodeGuard AI

Production-ready hybrid SAST web platform with:

- Next.js 15 frontend dashboard
- FastAPI backend API
- Celery + Redis asynchronous scan workers
- PostgreSQL storage for scan metadata
- MinIO object storage for uploaded archives and reports

## Features

- Input methods: GitHub public repo URL, archive upload, direct file paste
- Hybrid scan engines: Semgrep, Bandit, ESLint security, Trivy, AI contextual analyzer
- OWASP Top 10 + CWE mapping
- CVSS 4.0 severity scoring model
- Reports: PDF, JSON, SARIF
- Scan history and scan comparison
- Public shareable scan badge links
- CI/CD API endpoint
- English and Vietnamese UI localization

## Input Workflows

- `repo_url`: paste a public GitHub URL (latest default branch is cloned)
- `archive`: upload `.zip` or `.tar.gz` up to 500MB
- `paste`: provide JSON files payload:

```json
[
  { "path": "src/app.py", "content": "print('hello')" },
  { "path": "src/routes.ts", "content": "export const x = 1;" }
]
```

## Scan Pipeline

1. Ingest source input into isolated temp workspace
2. Detect languages and frameworks from real source files
3. Run rule engines (Semgrep, Bandit, ESLint, Trivy)
4. Run contextual AI-style heuristics (IDOR/race-condition patterns)
5. Run secret/config scanner checks
6. Deduplicate and score findings
7. Save findings and generate export artifacts (JSON/PDF/SARIF)

## API Quick Reference

- `POST /api/v1/scans`
- `GET /api/v1/scans`
- `GET /api/v1/scans/{scanId}`
- `GET /api/v1/scans/{scanId}/findings`
- `GET /api/v1/scans/{scanId}/heatmap`
- `GET /api/v1/scans/{scanId}/compare/{baseScanId}`
- `GET /api/v1/scans/{scanId}/export?format=json|pdf|sarif`
- `POST /api/v1/scans/{scanId}/badge/publish`
- `GET /api/v1/public/scan/{token}`
- `POST /api/v1/uploads/init`
- `POST /api/v1/uploads/{uploadId}/data`
- `POST /api/v1/uploads/complete`
- `POST /api/scan` (CI/CD integration)

## Security Controls Included

- Request throttling with slowapi
- Optional CAPTCHA verification (Cloudflare Turnstile)
- Archive path traversal defenses
- Upload size enforcement
- Isolated temporary scan workspace with cleanup

## Quick Start: Local Development

This setup runs without Docker. Local development uses SQLite, local file storage,
and an in-process background scan thread by default.

1. Copy the environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Start the backend:

   ```powershell
   cd apps/api
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. In another terminal, start the frontend:

   ```powershell
   cd apps/web
   npm install
   npm run dev
   ```

4. Open:

   - Frontend: http://localhost:3000
   - Backend docs: http://localhost:8000/docs

Local runtime data is stored in:

- `apps/api/codeguard.db`
- `apps/api/storage/`

## Docker Option

If you prefer the full service stack with PostgreSQL, Redis, MinIO, and Celery:

```powershell
docker compose up --build
```

Docker Compose exposes:

- Frontend: http://localhost:3001
- Backend docs: http://localhost:8001/docs
- MinIO console: http://localhost:9001

## Service Layout

- apps/web: Next.js 15 frontend
- apps/api: FastAPI API + Celery worker + scanners
- infrastructure: deployment and ops docs

## Notes

- Scanner adapters are production-oriented scaffolds with clear extension points.
- Replace the demo AI analyzer with your preferred LLM provider credentials.
