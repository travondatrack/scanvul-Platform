# ScanVul AI - Thiet Ke He Thong Hien Tai

Tai lieu nay mo ta thiet ke he thong hien tai cua project `scanvul-Platform`, bao gom kien truc tong quan, database schema, login/auth, project/scan flow va scanner backend.

## 1. Tong Quan Kien Truc

```text
Browser
  |
  | Next.js UI: login, register, dashboard, projects, scan detail
  v
apps/web - Next.js 15
  |
  | 1. Auth + dashboard thao tac database truc tiep qua Prisma
  | 2. /api/v1/* proxy sang backend Python
  v
Database - Prisma schema hien dung MySQL
  ^
  |
apps/api - FastAPI scanner backend
  |
  | Thread/Celery worker
  v
Scanner engines: Semgrep, Bandit, ESLint, Trivy/OSV, Secret scanner,
OWASP patterns, AI triage
```

He thong hien tai gom 2 ung dung chinh:

- `apps/web`: frontend Next.js, dashboard, auth, project management, scan pages.
- `apps/api`: backend FastAPI, scan API, upload, report export, scanner worker.

Database duoc dinh nghia chinh bang Prisma trong `apps/web/prisma/schema.prisma`. Backend Python dung SQLAlchemy model de doc/ghi cac bang scan, finding, upload va public badge.

## 2. Thanh Phan He Thong

### 2.1 Frontend - `apps/web`

Cong nghe chinh:

- Next.js 15 App Router
- React 19
- Tailwind CSS
- NextAuth
- Prisma Client
- bcryptjs

Vai tro:

- Hien thi landing/login/register/dashboard.
- Xu ly dang ky, dang nhap, session.
- Tao project.
- Trigger scan theo project.
- Doc dashboard/report/finding tu database.
- Proxy cac request `/api/v1/*` sang FastAPI backend.

### 2.2 Backend - `apps/api`

Cong nghe chinh:

- FastAPI
- SQLAlchemy
- Celery optional
- Redis optional
- MinIO/local storage
- Semgrep, Bandit, ESLint, Trivy/OSV, secret scanner

Vai tro:

- Quan ly API scan.
- Upload archive source code.
- Trigger worker scan.
- Chay scanner pipeline.
- Luu findings vao database.
- Export report JSON/SARIF/PDF.
- Publish public scan badge.

### 2.3 Database

Prisma datasource hien tai:

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

Luu y: `docker-compose.yml` hien co service Postgres, nhung Prisma schema lai cau hinh MySQL. Khi chay production/full Docker can thong nhat lai database provider va connection string.

## 3. Database Tables

## 3.1 `User`

Luu thong tin tai khoan nguoi dung.

Cot chinh:

- `id`: primary key, cuid.
- `name`: ten nguoi dung.
- `email`: email, unique.
- `emailVerified`: thoi diem verify email.
- `image`: avatar.
- `roleGlobal`: role toan he thong, mac dinh `user`.
- `status`: trang thai tai khoan, mac dinh `active`.
- `password`: bcrypt hash khi dang ky bang email/password.
- `createdAt`, `updatedAt`: timestamps.

Quan he:

- 1 user co nhieu `Account`.
- 1 user co nhieu `Session`.
- 1 user co nhieu `Project`.
- 1 user co nhieu `OrganizationMember`.
- 1 user co nhieu `FindingEvent`.

## 3.2 `Account`

Bang chuan cua NextAuth cho OAuth account.

Cot chinh:

- `id`
- `userId`
- `type`
- `provider`
- `providerAccountId`
- `refresh_token`
- `access_token`
- `expires_at`
- `token_type`
- `scope`
- `id_token`
- `session_state`

Rang buoc:

- Unique theo `provider` va `providerAccountId`.

Luu y: UI login co nut Google, nhung config NextAuth hien tai moi khai bao CredentialsProvider. GoogleProvider chua duoc bat trong `authOptions`.

## 3.3 `Session`

Bang chuan cua NextAuth cho database session.

Cot chinh:

- `id`
- `sessionToken`
- `userId`
- `expires`

Luu y: NextAuth hien dang dung:

```ts
session: {
  strategy: "jwt",
}
```

Vi vay JWT session la co che chinh, bang `Session` khong phai nguon session chinh trong flow hien tai.

## 3.4 `VerificationToken`

Bang chuan cua NextAuth cho email verification/passwordless.

Cot chinh:

- `identifier`
- `token`
- `expires`

Hien chua thay flow email verification duoc su dung trong app.

## 3.5 `Organization`

Luu thong tin to chuc/workspace.

Cot chinh:

- `id`
- `name`
- `slug`
- `plan`, mac dinh `free`
- `status`, mac dinh `active`
- `createdAt`
- `updatedAt`

Quan he:

- 1 organization co nhieu `OrganizationMember`.
- 1 organization co nhieu `Project`.

Hien tai schema co san organization, nhung UI/logic chinh van dang theo user ca nhan.

## 3.6 `OrganizationMember`

Luu thanh vien trong organization.

Cot chinh:

- `id`
- `organizationId`
- `userId`
- `role`, mac dinh `viewer`
- `createdAt`
- `updatedAt`

Rang buoc:

- Unique theo `organizationId` va `userId`.

## 3.7 `Project`

Luu repository/project cua nguoi dung.

Cot chinh:

- `id`: uuid.
- `organizationId`: nullable.
- `createdBy`: user tao project.
- `name`
- `description`
- `repoUrl`
- `sourceType`, mac dinh `github`
- `defaultBranch`
- `visibility`, mac dinh `private`
- `status`, mac dinh `active`
- `createdAt`
- `updatedAt`

Quan he:

- Thuoc ve `User` thong qua `createdBy`.
- Co the thuoc `Organization`.
- Co nhieu `Scan`.
- Co nhieu `Finding`.

Dashboard hien tai loc project theo `createdBy`.

## 3.8 `scans`

Prisma model: `Scan`, map xuong table `scans`.

Cot chinh:

- `id`: uuid.
- `project_id`: project lien quan, nullable.
- `triggered_by`: user trigger scan, nullable.
- `source_type`: `repo_url`, `archive`, hoac `paste`.
- `source_value`: URL repo, upload id, hoac code paste.
- `status`: `queued`, `running`, `completed`, `failed`.
- `risk_level`: `Unknown`, `Low`, `Medium`, `High`, `Critical`.
- `risk_percent`: diem risk 0-100.
- `language_summary`: JSON text.
- `framework_summary`: JSON text.
- `created_at`
- `updated_at`

Quan he:

- Thuoc `Project`.
- Co nhieu `Finding`.
- Co nhieu `PublicBadge`.

## 3.9 `findings`

Prisma model: `Finding`, map xuong table `findings`.

Bang nay luu tung lo hong phat hien trong mot scan.

Nhom cot dinh danh:

- `id`
- `scan_id`
- `project_id`
- `rule_id`
- `scan_category`
- `engine`
- `title`
- `vuln_type`

Nhom severity/risk:

- `severity`
- `cvss4_score`
- `confidence`
- `verification_status`
- `status`

Nhom CWE/OWASP:

- `cwe_id`
- `owasp_category`

Nhom vi tri code:

- `file_path`
- `line_number`
- `line_start`
- `line_end`
- `function_name`

Nhom dataflow/evidence:

- `source`
- `sink`
- `dataflow_trace`
- `evidence`
- `code_snippet`

Nhom giai thich:

- `why_vulnerable`
- `attack_scenario`
- `impact`
- `poc`
- `remediation`
- `secure_example`
- `pentest_hint`
- `ext_references`

Nhom triage:

- `dedupe_hash`: dung de chong trung lap findings.
- `verification_status`: `unverified`, `verified`, `failed`, `skipped`, `needs_review`, `false_positive_likely`.

## 3.10 `finding_events`

Prisma model: `FindingEvent`, map xuong table `finding_events`.

Cot chinh:

- `id`
- `finding_id`
- `user_id`
- `event_type`
- `old_value`
- `new_value`
- `comment`
- `created_at`

Muc dich:

- Ghi lich su thay doi trang thai finding.
- Ghi comment/triage event.

Luu y: route update status hien tai chua tao `FindingEvent`, moi chi update truc tiep `Finding.status`.

## 3.11 `public_badges`

Prisma model: `PublicBadge`, map xuong table `public_badges`.

Cot chinh:

- `id`: autoincrement.
- `scan_id`
- `token`: unique.
- `is_active`, mac dinh `true`.
- `expires_at`

Muc dich:

- Tao link public summary cho mot scan.
- Backend model dat token bang UUID khong dau `-`.
- Mac dinh het han sau 30 ngay.

## 3.12 `uploaded_assets`

Luu file archive upload.

Cot chinh:

- `id`
- `file_name`
- `object_key`
- `size_bytes`
- `status`: `initialized`, `uploaded`, `completed`.
- `created_at`

Flow:

1. Init upload.
2. Upload data.
3. Complete upload.
4. Scan source type `archive` co the dung uploaded asset nay.

## 4. Login, Register Va Auth Logic

## 4.1 Dang Ky Tai Khoan

File chinh:

- `apps/web/app/api/auth/register/route.ts`
- `apps/web/app/register/page.tsx`

Luồng:

1. User nhap `name`, `email`, `password`.
2. Client goi `POST /api/auth/register`.
3. API validate:
   - `email` va `password` bat buoc.
   - `password.length >= 6`.
   - Email chua ton tai trong bang `User`.
4. Hash password:

```ts
const hashedPassword = await bcrypt.hash(password, 10);
```

5. Tao user:

```ts
await prisma.user.create({
  data: {
    name,
    email,
    password: hashedPassword,
  },
});
```

6. Tra ve user khong kem password.
7. Trang register tu dong goi:

```ts
signIn("credentials", {
  redirect: false,
  email,
  password,
});
```

8. Neu login thanh cong, redirect sang `/projects`.

## 4.2 Dang Nhap Bang Email/Password

File chinh:

- `apps/web/lib/auth.ts`
- `apps/web/app/api/auth/[...nextauth]/route.ts`
- `apps/web/app/login/page.tsx`

Provider dang dung:

```ts
CredentialsProvider({
  name: "credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" }
  },
  async authorize(credentials) {
    ...
  }
})
```

Luồng:

1. Client goi:

```ts
signIn("credentials", {
  redirect: false,
  email,
  password,
});
```

2. NextAuth goi `authorize(credentials)`.
3. Kiem tra email/password co ton tai.
4. Tim user:

```ts
const user = await prisma.user.findUnique({
  where: { email: credentials.email }
});
```

5. Neu khong co user hoac user khong co password thi throw `Invalid credentials`.
6. So sanh password:

```ts
const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
```

7. Neu dung, return user.
8. NextAuth tao JWT session.
9. Client redirect sang `/projects`.

## 4.3 Session Strategy

Config hien tai:

```ts
session: {
  strategy: "jwt",
}
```

Callback session gan them user id:

```ts
async session({ session, token }) {
  if (session.user && token.sub) {
    (session.user as any).id = token.sub;
  }
  return session;
}
```

Nghia la trong server component/API route co the lay user id bang:

```ts
const session = await getServerSession(authOptions);
const userId = (session.user as any).id;
```

## 4.4 Middleware Bao Ve Route

File:

- `apps/web/middleware.ts`

Config:

```ts
export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/team/:path*"],
};
```

Logic:

- Dung `withAuth`.
- Neu request khong co token thi chuyen ve `/login`.
- Callback:

```ts
authorized: ({ token }) => !!token
```

Luu y:

- Middleware chi match `/dashboard/*`, `/projects/*`, `/team/*`.
- Cac route khac nhu `/reports` neu khong nam trong matcher thi can duoc bao ve rieng bang `getServerSession` trong page/API.

## 4.5 Google Login

UI login co nut:

```ts
signIn("google", { callbackUrl: "/projects" })
```

Nhung `authOptions` hien tai chua khai bao `GoogleProvider` trong `providers`. Vi vay Google login chua san sang hoat dong dung neu chua bo sung:

```ts
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
})
```

## 5. Authorization Logic

## 5.1 Project Ownership

Khi tao project:

1. Lay session bang `getServerSession(authOptions)`.
2. Neu khong co session hoac khong co `session.user.id`, tra `401 Unauthorized`.
3. Tao project voi:

```ts
createdBy: userId
```

Khi list project/dashboard:

- Query theo `createdBy = userId`.

Khi trigger scan theo project:

1. Lay `projectId` va `repoUrl`.
2. Tim project.
3. Kiem tra:

```ts
if (!project || project.createdBy !== userId) {
  return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
}
```

4. Chi user tao project moi trigger duoc scan cho project do.

## 5.2 Finding Status Update

Route:

- `apps/web/app/api/findings/[id]/status/route.ts`

Hien tai route co goi:

```ts
const session = await getServerSession(authOptions);
```

Nhung chua enforce auth/ownership that su. Code hien update truc tiep:

```ts
await prisma.finding.update({
  where: { id },
  data: { status }
});
```

Day la diem can sua neu dua len production:

- Bat buoc login.
- Kiem tra finding thuoc scan/project cua user.
- Ghi `FindingEvent`.
- Validate status hop le.

## 6. Project Flow

Route:

- `POST /api/projects`

Input:

```json
{
  "name": "Project name",
  "githubUrl": "https://github.com/org/repo"
}
```

Luồng:

1. Kiem tra session.
2. Validate `name` va `githubUrl`.
3. Tao `Project`:

```ts
{
  name,
  repoUrl: githubUrl,
  sourceType: "github",
  createdBy: userId,
}
```

4. Tra ve project moi.

## 7. Scan Flow

## 7.1 Scan Tu Dashboard Project

Route frontend:

- `POST /api/scans/trigger`

Luồng:

1. User dang nhap bam trigger scan.
2. Next.js route kiem tra session.
3. Kiem tra project thuoc user.
4. Tao record `Scan` trong database:

```ts
{
  projectId,
  triggeredBy: userId,
  sourceType: "repo_url",
  sourceValue: repoUrl,
  status: "queued",
}
```

5. Goi FastAPI backend:

```text
http://127.0.0.1:8001/api/v1/scan/{scan.id}/trigger
```

6. Neu backend trigger loi, scan duoc update thanh `failed`.
7. Neu thanh cong, tra ve scan vua tao.

Luu y: URL backend dang hard-code port `8001`. Trong README local backend chay port `8000`. Nen thong nhat lai port hoac dung bien moi truong `BACKEND_API_BASE_URL`.

## 7.2 Scan Truc Tiep Qua FastAPI

Route backend:

- `POST /api/v1/scans`

Input:

```json
{
  "sourceType": "repo_url",
  "sourceValue": "https://github.com/org/repo"
}
```

`sourceType` hop le:

- `repo_url`
- `archive`
- `paste`

Luồng:

1. Validate input bang Pydantic.
2. Neu `repo_url`, chi cho phep URL bat dau bang:
   - `https://github.com/`
   - `http://github.com/`
3. Tao `Scan`.
4. Queue worker theo `SCAN_WORKER_MODE`:
   - `celery`: `run_scan.delay(scan.id)`.
   - `inline`: chay truc tiep `execute_scan(scan.id)`.
   - mac dinh/thread: tao background thread.
5. Tra ve scan summary.

## 7.3 Guest Scan

Route:

- `POST /api/scans/guest`

Luồng:

1. Rate limit in-memory theo IP: toi da 5 guest scans/gio.
2. Nhan `sourceType`, `sourceValue`, `codeSnippet`, `language`.
3. Gioi han input toi da 500 KB.
4. Tao `Scan` khong gan user/project.
5. Co gang goi Python worker qua:

```text
http://127.0.0.1:8001/api/v1/scan/trigger
```

Luu y: backend hien co `POST /api/v1/scan/{scan_id}/trigger`, khong thay endpoint `POST /api/v1/scan/trigger` nhan JSON body. Do do guest scan trigger co kha nang dang lech endpoint.

## 8. Backend API Endpoints

Prefix chinh:

```text
/api/v1
```

Endpoints:

- `GET /scans`: lay danh sach scan.
- `POST /scans`: tao scan moi.
- `GET /scans/{scan_id}`: lay chi tiet scan va findings.
- `GET /scans/{scan_id}/findings`: lay findings cua scan, co filter severity.
- `GET /scans/{scan_id}/heatmap`: thong ke findings theo file.
- `GET /scans/{scan_id}/compare/{base_scan_id}`: so sanh 2 scan.
- `GET /scans/{scan_id}/export?format=json|sarif|pdf`: export report.
- `POST /scans/{scan_id}/badge/publish`: tao public badge.
- `GET /public/scan/{token}`: lay public scan summary.
- `POST /uploads/init`: khoi tao upload archive.
- `POST /uploads/{upload_id}/data`: upload archive data.
- `POST /uploads/complete`: danh dau upload completed.
- `POST /scan`: CI scan alias.
- `POST /scan/{scan_id}/trigger`: trigger scan da ton tai.

Health endpoints:

- `GET /health`
- `GET /health/engines`

## 9. Upload Flow

## 9.1 Init Upload

Route:

- `POST /api/v1/uploads/init`

Input:

```json
{
  "fileName": "source.zip",
  "size": 123456
}
```

Validate:

- Size khong vuot `MAX_UPLOAD_BYTES`.
- File chi chap nhan `.zip`, `.tar.gz`, `.tgz`.

Xu ly:

- Tao `UploadedAsset`.
- Tao `object_key`.
- Tao upload URL.
- Tra ve `uploadId`, `objectKey`, `uploadUrl`, `status`.

## 9.2 Upload Data

Route:

- `POST /api/v1/uploads/{upload_id}/data`

Input:

- Multipart file field: `archive`.

Xu ly:

- Kiem tra upload ton tai.
- Kiem tra upload chua completed.
- Kiem tra size.
- Luu object vao storage.
- Update status thanh `uploaded`.

## 9.3 Complete Upload

Route:

- `POST /api/v1/uploads/complete`

Input:

```json
{
  "uploadId": "..."
}
```

Xu ly:

- Kiem tra object ton tai trong storage.
- Update `UploadedAsset.status = completed`.

## 10. Worker Va Scanner Pipeline

File chinh:

- `apps/api/app/worker/tasks.py`
- `apps/api/app/services/scanner_orchestrator.py`

## 10.1 Worker Execute Scan

Ham:

```py
execute_scan(scan_id: str)
```

Luồng:

1. Mo DB session.
2. Lay scan theo `scan_id`.
3. Set `scan.status = "running"`.
4. Neu `source_type = archive`, lay `UploadedAsset`.
5. Ingest source:
   - clone repo;
   - giai nen archive;
   - tao file tam cho paste.
6. Goi:

```py
run_hybrid_scan(source_dir)
```

7. Xoa findings cu cua scan, co retry neu MySQL deadlock.
8. Bulk insert findings moi theo batch 200.
9. Update scan summary:
   - `language_summary`
   - `framework_summary`
   - `risk_level`
   - `risk_percent`
   - `status = "completed"`
10. Neu loi:
   - rollback;
   - set `status = "failed"`.
11. Cleanup source temp.

## 10.2 Scanner Pipeline

Ham:

```py
run_hybrid_scan(source_dir)
```

Pipeline:

1. SAST:
   - Semgrep
   - Bandit
   - ESLint security
   - OWASP pattern scan
2. Dependency scan:
   - Trivy adapter / OSV logic
3. Secret scan:
   - Secret scanner
   - Co the verify live neu `SECRET_VERIFY_ENABLED=true`
4. Attack-chain correlation:
   - Vi du SSRF + leaked credential thanh finding Critical.
5. Enrichment:
   - Gan scan category.
   - Infer source/sink.
   - Infer function name.
   - Bo sung context code.
   - Tao rule id.
   - Calibrate severity.
6. Deduplication:
   - Deduplicate theo `dedupe_hash`.
7. AI triage:
   - Chay neu co `LLM_API_KEY`.
   - Dieu chinh confidence/status.
8. Risk summary:
   - Detect language/framework.
   - Tinh `risk_level` va `risk_percent`.

## 10.3 Risk Calculation

Neu khong co finding:

- `risk_level = Low`
- `risk_percent = 5.0`

Neu co finding:

- Critical: weight 30
- High: weight 14
- Medium: weight 6
- Low: weight 2
- Info: weight 1

Diem tong duoc nhan voi confidence va cap toi da 100.

Rule nang nguong:

- Co Critical thi risk it nhat 85.
- Co High thi risk it nhat 60.
- Co Medium thi risk it nhat 35.

Mapping:

- `>= 85`: Critical
- `>= 70`: High
- `>= 40`: Medium
- con lai: Low

## 11. Report Va Public Badge

## 11.1 Export Report

Route:

- `GET /api/v1/scans/{scan_id}/export?format=json`
- `GET /api/v1/scans/{scan_id}/export?format=sarif`
- `GET /api/v1/scans/{scan_id}/export?format=pdf`

Backend lay scan va findings roi goi:

- `export_json`
- `export_sarif`
- `export_pdf`

## 11.2 Public Badge

Route publish:

- `POST /api/v1/scans/{scan_id}/badge/publish`

Tao record `PublicBadge`, tra ve:

```json
{
  "scanId": "...",
  "token": "...",
  "publicUrl": "/public/scan/{token}",
  "expiresAt": "..."
}
```

Route public:

- `GET /api/v1/public/scan/{token}`

Validate:

- Badge ton tai.
- `is_active = true`.
- Chua het han.

Tra ve public summary:

- `scanId`
- `status`
- `riskLevel`
- `riskPercent`
- `findingsCount`

## 12. Cau Hinh Moi Truong

File mau:

- `.env.example`

Bien quan trong:

```env
APP_NAME=CodeGuard AI
PUBLIC_BASE_URL=http://localhost:3000

NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_DEFAULT_LOCALE=en

API_HOST=0.0.0.0
API_PORT=8000
DATABASE_URL=sqlite:///./codeguard.db
SCAN_WORKER_MODE=thread
STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=./storage

REDIS_URL=redis://localhost:6379/0
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=scans

LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=
LLM_BASE_URL=

ENABLE_DEV_AUTO_MIGRATION=false
SECRET_VERIFY_ENABLED=false

MAX_UPLOAD_BYTES=524288000
RATE_LIMIT_PER_MINUTE=60
PRESIGNED_UPLOAD_EXPIRY_SECONDS=900
CAPTCHA_SECRET_KEY=
```

Luu y:

- Frontend Prisma can `DATABASE_URL` tuong thich MySQL vi schema dang la MySQL.
- Backend co the chay SQLite de dev scanner rieng.
- Neu database khong phai SQLite, backend khong tu `create_all`; schema duoc xem la do Prisma quan ly.

## 13. Nhung Diem Can Chu Y / Technical Debt

1. Database provider dang lech giua Prisma va Docker Compose

- Prisma: MySQL.
- Docker Compose: Postgres.
- Can thong nhat truoc khi deploy/chay full stack Docker.

2. Port backend dang lech

- README local chay API port `8000`.
- Mot so Next route hard-code `127.0.0.1:8001`.
- Nen dung `BACKEND_API_BASE_URL` thay vi hard-code.

3. Google login UI chua khop voi auth config

- UI co nut Google.
- `authOptions` chua bat `GoogleProvider`.

4. Finding status update chua bao ve du

- Chua enforce user ownership.
- Chua validate status.
- Chua ghi `FindingEvent`.

5. Guest scan trigger co kha nang sai endpoint

- Guest route goi `POST /api/v1/scan/trigger`.
- Backend hien co `POST /api/v1/scan/{scan_id}/trigger`.

6. NextAuth PrismaAdapter import nhung chua dung

- `auth.ts` import `PrismaAdapter` nhung `authOptions` chua khai bao `adapter`.
- Neu dung Credentials + JWT thi van chay, nhung OAuth/database account flow se can adapter.

7. Organization schema co san nhung flow chua khai thac

- Hien project chu yeu theo `createdBy`.
- Role org/member chua duoc dung nhieu trong authorization.

## 14. Tom Tat Ngan Gon

ScanVul AI hien la he thong gom Next.js dashboard va FastAPI scanner backend. Next.js quan ly UI, auth, project va mot phan scan workflow truc tiep bang Prisma. FastAPI dam nhiem scan engine, upload, report export va worker. Auth hien tai dung NextAuth CredentialsProvider voi JWT session; password duoc hash bang bcrypt. Database schema chinh nam trong Prisma va hien cau hinh MySQL. Scanner pipeline ket hop nhieu engine nhu Semgrep, Bandit, ESLint, dependency scan, secret scan, AI triage, sau do luu findings va tinh risk score.
