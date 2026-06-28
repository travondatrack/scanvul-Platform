# ScanVul AI - Database and Feature Status

Last verified: 2026-06-28

This file reflects the code currently present in the repository. The previous status notes were older than the implementation and incorrectly listed several completed features as missing.

## Sources Checked

- `apps/web/prisma/schema.prisma`
- `apps/api/app/models/scan.py`
- `apps/web/app/api/**`
- `apps/api/app/api/v1/scans.py`
- Scanner worker and ingestion code in `apps/api/app/worker` and `apps/api/app/services`
- Dashboard UI for scan report, team, rules, notifications, settings, and scan trigger

## Completed

- Finding comments are persisted through `FindingEvent`; `/api/findings/[id]/comment` writes DB records and audit events.
- Finding timeline is real; `/api/findings/[id]/events` returns `FindingEvent` rows with user metadata.
- Finding triage status, verification status, assignment, and comments create `FindingEvent` and `AuditEvent` records inside transactions.
- Assignee validation is scoped to the finding project. Organization projects only allow organization members; personal projects allow the project owner.
- Scan report UI shows timeline/comment controls and assignee controls using the eligible assignee API.
- Notifications exist for scan completed/failed, finding assignment, finding comments, organization invites, invite accept/reject, member removed/left, team deleted, and project deleted.
- Organization invites are backed by `OrganizationInvite` with `pending`, `accepted`, `rejected`, `cancelled`, and `expired` states. Team UI lists pending invites and supports cancel.
- Notifications page supports invite accept/reject through idempotent action state checks.
- Rules page persists scanner policy through `ScannerPolicy` and `/api/scanner-policy`.
- FastAPI worker reads scanner policy by project and applies `enabledEngines`, `severityThreshold`, `aiTriageEnabled`, and `secretVerificationEnabled`.
- Settings profile form persists name/avatar through `PATCH /api/account`; sensitive user fields are not accepted.
- Archive upload is wired from UI to FastAPI upload endpoints and scan trigger. Worker resolves `uploadId` to `UploadedAsset.object_key`.
- Archive ingestion guards path traversal, symlinks/hardlinks/devices, extraction size, and file count, and cleans temporary files in `finally`.
- `/api/debug-env` is development-only and masks SMTP password presence.
- Public badge output intentionally returns summary-only data without file paths or snippets.
- Report export requires scan access and masks secret-like snippets/evidence/PoC.

## Fixed During Latest Verification

- FastAPI `/api/v1/scans/{scan_id}/findings` used an invalid SQLAlchemy count expression. It now uses `func.count()` and applies severity/status filters consistently.
- Scan completed/failed notifications could be duplicated on retry. Worker now checks for an existing notification for the scan/status before creating another one.
- Stale scan cleanup now emits failed scan notifications.
- Avatar update validation now rejects arbitrary `data:image/*` and only accepts http(s) URLs or PNG/JPEG/GIF/WebP data URIs.
- Scan trigger now rejects invalid `sourceType` instead of silently defaulting to `repo_url`, and blocks duplicate queued/running project scans.
- Python tests exist, so `pytest==8.3.4` was added to `apps/api/requirements.txt`.

## Product Upgrade Added During 2026-06-28 Follow-up

- Scan report finding detail now includes code links/fallback file locations, line ranges, confidence, CWE/OWASP labels, secure examples, pentest guidance, copy actions, and a previously-false-positive indicator.
- `GET/POST /api/findings/[id]/ai-review` was added. It checks finding RBAC, disables gracefully when `LLM_API_KEY` is missing, masks/truncates code before provider calls, and stores AI review output in `FindingEvent` plus `AuditEvent`.
- Finding timeline renders `ai_review` events as readable review summaries instead of raw JSON.
- Scan trigger and CI trigger now create an initial `queued` `ScanEvent`.
- FastAPI worker/orchestrator now logs source resolution, per-engine completed/skipped events, AI triage completed/skipped, report generation, and final completion/failure events.
- Project detail now includes a server-rendered Security Overview with latest scan status/risk, unresolved critical/high count, top vulnerable files, engine/OWASP breakdowns, last duration, policy summary, trend bars, and compare summary against the previous scan.
- Rules page now has scanner policy presets: Fast Scan, Balanced, Strict Security, and AI Assisted.
- Notifications API/page now support all/unread/scan/finding/team filters, mark-all-as-read, and entity links that safely fall back when payload data is missing.
- Report export now includes risk score, top affected files, engine/OWASP breakdowns, secure examples, pentest guidance, code links, source/sink, and dedupe metadata while keeping secret masking.
- Admin health now reports FastAPI, database, Redis/Celery broker, storage backend, scanner engines, and AI config availability without returning secret values.
- Project API token manager now includes GitHub Actions, curl, and npm script CI examples while preserving one-time raw token display semantics.

## Partial / Remaining Risks

- Python `pytest` is declared but not installed in the current environment, so Python tests could not be executed until dependencies are installed.
- Web lint is not configured. `npm run lint` invokes deprecated `next lint` and prompts because `eslint`/`eslint-config-next` are not installed. No ESLint config was added to avoid a broad dependency/config change.
- Scanner policy is currently applied at project level. Organization-level policy schema exists, but no merge/fallback behavior is implemented in the worker.
- Upload assets are not linked to the uploading user/project in schema, so access is enforced by authenticated proxy plus later scan project permission, not by upload ownership.
- FastAPI and Prisma still duplicate shared schema definitions. The README now documents that shared tables must be changed in both ORM layers.
- Compare scan is currently exposed as a project overview summary. A dedicated drill-down page for new/fixed/unchanged/severity-changed finding lists is still future work.
- Dashboard archive upload is wired; CI archive upload is not yet supported by `/api/ci/scan`, which currently accepts JSON source metadata.

## Shared Tables Checked

| Table | Prisma | SQLAlchemy | Notes |
| --- | --- | --- | --- |
| `scans` | Yes | Yes | Shared worker/web table; names mapped consistently. |
| `findings` | Yes | Yes | SQLAlchemy maps `references` to `ext_references`; triage fields align. |
| `scan_events` | Yes | Yes | Runtime scan timeline. |
| `uploaded_assets` | Yes | Yes | `id` aligned to `VARCHAR(191)`. |
| `public_badges` | Yes | Yes | Shared public badge metadata. |
| `scanner_policies` | Yes | Yes | FastAPI reads project policy. |
| `notifications` | Yes | Yes | FastAPI worker writes scan notifications. |

## Verification

- `npm exec prisma generate`: pass
- `npm exec tsc -- --noEmit`: pass after product-upgrade changes
- `npm test -- --runInBand`: pass, 55 tests
- `python -m compileall app`: pass after product-upgrade changes
- `python -m pytest`: failed in current environment, `No module named pytest`; dependency has been added to requirements.
- `npm run lint`: failed because Next.js prompts for ESLint setup and repo lacks ESLint dependencies/config.
