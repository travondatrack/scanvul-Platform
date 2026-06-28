# ScanVul AI - Admin RBAC & Break-Glass Security Architecture

## 1. Executive Summary & Core Security Philosophy
In ScanVul AI, our paramount principle is **Least Privilege and Customer Data Privacy**. Although Global Administrators (`admin`, `super_admin`) hold system-wide responsibility for operational health, monitoring, and user management, **they do not possess default or blanket access to customer private data**.

Traditional SaaS platforms often implement "Global RBAC Bypass," allowing administrators unrestricted access to private tenant repositories, vulnerability reports, and CI/CD secrets. ScanVul AI strictly rejects this pattern to protect customer intellectual property and sensitive credentials against insider threats and compromised administrator credentials.

---

## 2. Default Administrative Boundaries

### Allowed by Default (Metadata & Operations)
Within `/admin` and `/api/admin/*`, global administrators can perform system upkeep:
- **Organizations & Projects**: View metadata (names, slugs, branch names, membership counts, creation dates).
- **Scans**: Inspect scan execution status, queue durations, runtime errors, and cancel hanging/stuck jobs.
- **Users**: View user profile status, lock/unlock accounts, and assign roles (subject to separation-of-duties protections).
- **System Health & Audit**: Monitor AI integration status, database health, and inspect immutable audit logs.

### Strictly Forbidden by Default
Without explicit authorization, global administrators **cannot**:
- View private repository source code, files, or snippets.
- Read vulnerability finding details containing unmasked secrets, environment variables, or API keys.
- Access raw CI/CD integration tokens, OAuth tokens, or password hashes.
- Modify project scanner policies or triage findings on behalf of customers.
- Permanently purge audit event histories or self-promote their own administrative privileges.

---

## 3. Break-Glass Support Access Mechanism

When a customer opens a support ticket requiring deep technical investigation (e.g., false positive debugging or custom rule tuning), a authorized **Super Administrator** (`super_admin`) can activate **Break-Glass Support Access**.

### How It Works
1. **Explicit Authorization**: Only `super_admin` accounts can issue a break-glass grant.
2. **Target Scoped**: Access must be explicitly bound to a specific `projectId` or `organizationId`.
3. **Time-Bound**: Grants automatically expire after a predefined TTL (e.g., 30 minutes to 24 hours).
4. **Scope Restricted**: Grants specify precise capabilities:
   - `view_metadata`: Enhanced inspection of project settings.
   - `view_findings`: Inspect vulnerability findings (sensitive tokens remain masked).
   - `view_source`: Temporary access to code snippets required for triage.
   - `manage_scan`: Trigger or re-run specific scans.
   - `manage_policy`: Modify rule overrides to assist customer onboarding.
5. **Mandatory Justification**: A detailed, verifiable business reason (e.g., ticket ID) must be provided.

---

## 4. Immutable Audit Logging

Every administrative action and break-glass lifecycle event produces an immutable record in the `audit_events` database table.

### Monitored Actions
- `ADMIN_SUPPORT_ACCESS_GRANTED`: Logged when break-glass access is initialized (includes actor, target, scopes, duration, reason).
- `ADMIN_SUPPORT_ACCESS_REVOKED`: Logged when support access is manually terminated early.
- `ADMIN_USER_LOCKED` / `ADMIN_USER_UNLOCKED`: Account status modifications.
- `ADMIN_USER_ROLE_CHANGED`: Role elevation or demotion events.
- `ADMIN_SCAN_CANCELLED`: Manual termination of stuck scan jobs.

Audit events cannot be modified or deleted via any user-facing or administrative API.

---

## 5. Separation of Duties & Protections
- **No Self-Promotion**: An administrator cannot elevate their own role from `admin` to `super_admin`.
- **Last Admin Protection**: The system blocks disabling, suspending, or demoting the last active global administrator account to prevent accidental system lockout.
