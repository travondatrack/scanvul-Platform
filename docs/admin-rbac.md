# Admin RBAC & Security Architecture for ScanVul AI

This document details the Role-Based Access Control (RBAC), permission boundaries, immutable audit logging, and sensitive data protection enforced across the ScanVul AI platform for administrative accounts.

---

## 1. Role Classification (`roleGlobal`)

Global administrative access is governed by the `roleGlobal` column on the `User` table.

- **`user`**: Standard authenticated account. Restricted to personal workspace and organization memberships.
- **`admin`**: Global system administrator. Granted operational oversight, user account lifecycle control, and system health monitoring.
- **`support_admin`**: Customer technical support tier (read-only diagnostics and non-destructive assistance).
- **`security_admin`**: Specialized role focused on platform vulnerability policies, global scanner overrides, and rule engines.
- **`super_admin`**: Root authority capable of managing other global administrators and overriding strict system limits.

---

## 2. Permitted Admin Capabilities (What Admins CAN Do)

Global Administrators (`admin`, `super_admin`) are explicitly authorized to:
- **System Health & Engines**: View operational status of FastAPI scanner workers, MySQL database connections, and scanner availability (Semgrep, Bandit, ESLint, Trivy).
- **User Lifecycle Management**: Inspect basic account metadata (`id`, `name`, `email`, `roleGlobal`, `status`, timestamps). Lock/unlock suspicious or inactive accounts (`active` ↔ `disabled` / `suspended`).
- **Role Administration**: Assign global roles to standard accounts (protected by hierarchical constraints).
- **High-Level Overview**: View metadata lists of Organizations and Projects without exposing codebases or tokens.
- **Scan Debugging & Intervention**: Inspect stuck, failed, or queued scan jobs. Force-cancel hanging jobs.
- **Immutable Audit Inspection**: Review system-wide audit records and administrative actions.

---

## 3. Enforced Admin Restrictions (What Admins CANNOT Do)

To prevent privilege abuse and maintain compliance, the system enforces hard cryptographic and RBAC barriers against administrators:
- **No Plaintext Passwords or Tokens**: API endpoints and UI tables never serialize or transmit plaintext passwords, password hashes (`password`), API tokens (`tokenHash`), or NextAuth tokens (`access_token`, `refresh_token`, `id_token`).
- **No Source Code Access**: Admins cannot browse or download private project repositories or proprietary source code without explicit, auditable support grant tokens.
- **No Secret Unmasking**: Raw secrets detected by scanner engines (e.g. AWS keys, API keys) are masked before display.
- **No Silent Destructive Actions**: Projects, users, and organizations cannot be hard-deleted without extensive multi-step confirmation and audit trails. Soft-disabling (`status = disabled`) is prioritized.
- **No Audit Log Tampering**: All endpoints under `/api/admin/audit-events` are strictly read-only. Modification or deletion of historical `AuditEvent` records is programmatically blocked.
- **No Last-Admin Lockout**: System logic actively prevents demoting or locking the last remaining active `admin` or `super_admin` account.
- **No Unprivileged Elevation**: Standard `admin` accounts cannot self-promote to `super_admin` or grant `super_admin` privileges to third parties.

---

## 4. Admin API Endpoints

All endpoints require active global admin authentication via `requireGlobalAdmin()`.

| HTTP Method | Endpoint | Description | Audit Event Logged |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | System overview stats (users, projects, active scans, findings breakdown). | None (passive read) |
| `GET` | `/api/admin/users` | Paginated list of users with search and filters. | None (passive read) |
| `PATCH` | `/api/admin/users/[id]/status` | Lock or unlock target user account. | `ADMIN_USER_LOCKED` / `ADMIN_USER_UNLOCKED` |
| `PATCH` | `/api/admin/users/[id]/role` | Promote or demote user global role. | `ADMIN_USER_ROLE_CHANGED` |
| `GET` | `/api/admin/organizations` | Paginated list of organizations metadata. | `ADMIN_ORG_VIEWED` |
| `GET` | `/api/admin/projects` | Paginated list of projects metadata. | `ADMIN_PROJECT_VIEWED` |
| `GET` | `/api/admin/scans` | List and filter scan executions and failure traces. | None (passive read) |
| `POST` | `/api/admin/scans/[id]/cancel` | Force-cancel a hanging or queued scan job. | `ADMIN_SCAN_CANCELLED` |
| `GET` | `/api/admin/audit-events` | Read-only paginated audit log queries. | None (passive read) |

---

## 5. Audit Logging Policy

Every administrative intervention modifying state or querying privileged metadata generates an immutable record in the `AuditEvent` table.

### Registered Action Constants (`ADMIN_AUDIT_ACTIONS`)
- `ADMIN_USER_LOCKED`
- `ADMIN_USER_UNLOCKED`
- `ADMIN_USER_ROLE_CHANGED`
- `ADMIN_SCAN_CANCELLED`
- `ADMIN_PROJECT_VIEWED`
- `ADMIN_ORG_VIEWED`
- `ADMIN_HEALTH_VIEWED`
- `ADMIN_SETTINGS_UPDATED`
- `ADMIN_SUPPORT_ACCESS_USED`
