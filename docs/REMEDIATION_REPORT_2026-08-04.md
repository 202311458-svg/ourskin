# OS-COMS Remediation Report — 2026-08-04 (Interim)

## 1. Summary

Critical containment for doctor object authorization, unauthenticated staff
appointment feeds, JWT fallback configuration, and historical environment-file
handling has been implemented and covered by synthetic regression tests.
Application startup no longer creates tables. A conservative Alembic baseline
and PostgreSQL booking-integrity migration were added and offline SQL generation
was validated. Selected High findings were also remediated: admin paginated
contracts now use a shared typed client and pagination UI, staff history has an
explicit authorized API, doctor announcements are read-only, and browser
security headers are configured.

**Release decision remains NO-GO.** Significant High findings remain, including
the frontend localStorage session architecture, production dependency
vulnerabilities, incomplete global error/rate-limit/image/audit hardening, and
the need to validate migrations on a production-like PostgreSQL staging copy.

## 2. Files Changed

### Backend

- `backend/app/core/config.py`
- `backend/app/core/security.py`
- `backend/app/core/authorization.py`
- `backend/app/db.py`
- `backend/app/main.py`
- `backend/app/routes/ai_analysis.py`
- `backend/app/routes/appointments.py`
- `backend/app/routes/doctor.py`
- `backend/app/schemas/appointment.py`
- `backend/init_db.py`
- `backend/requirements.txt`
- `backend/requirements-dev.txt`

### Frontend

- `frontend/next.config.ts`
- `frontend/src/lib/admin-api.ts`
- `frontend/src/app/components/PaginationControls.tsx`
- `frontend/src/app/components/PaginationControls.module.css`
- `frontend/src/app/pages/admin/users/page.tsx`
- `frontend/src/app/pages/admin/appointments/page.tsx`
- `frontend/src/app/pages/admin/ai-logs/page.tsx`
- `frontend/src/app/pages/admin/audit-logs/page.tsx`
- `frontend/src/app/pages/staff/requests/page.tsx`
- `frontend/src/app/pages/staff/history/page.tsx`
- `frontend/src/app/pages/doctor/announcements/page.tsx`

### Database/migrations

- `backend/alembic.ini`
- `backend/alembic/env.py`
- `backend/alembic/script.py.mako`
- `backend/alembic/versions/20260803_0001_existing_schema_baseline.py`
- `backend/alembic/versions/20260803_0002_booking_integrity.py`

### Tests

- `backend/pytest.ini`
- `backend/tests/conftest.py`
- `backend/tests/test_critical_authorization.py`
- `backend/tests/test_jwt_security.py`

### CI

- `.github/workflows/security.yml`
- `.gitignore`
- `backend/.env.example`

### Documentation

- `docs/SECURITY_REMEDIATION.md`
- `docs/DATABASE_MIGRATIONS.md`
- this report

## 3. Audit Finding Status

| Finding | Status | Fix | Validation |
| --- | --- | --- | --- |
| C-01 | FIXED AND TESTED | SQL-scoped doctor appointment, patient, report, AI, follow-up, log, and dashboard access; object tampering returns 404 | Synthetic Doctor A/B and Patient A/B HTTP tests pass |
| C-02 | FIXED AND TESTED | Feed auth restricted to Staff/Admin; minimal DTO omits contact/address/guardian/concern data | Anonymous/patient/doctor denied; Staff/Admin allowed; DTO assertions pass |
| C-03 | FIXED AND TESTED | Required typed settings, strong key validation, fixed algorithm, issuer/audience and required claims | Valid, expired, malformed, wrong signature, issuer/audience, inactive and missing-config tests pass |
| C-04 | MANUAL ACTION REQUIRED | Ignore rules, sanitized example, CI Gitleaks and rotation runbook added | Ignore/CI config inspected; local Gitleaks unavailable; external rotation/history decision pending |
| H-01 | FIXED BUT REQUIRES STAGING VALIDATION | Shared `PaginatedResponse<T>` client contract; all four admin pages consume `.items`, retain totals/page size, and render reusable pagination controls | TypeScript and production build pass; browser/API contract test suite is not yet established |
| H-02 | FIXED BUT REQUIRES STAGING VALIDATION | PostgreSQL partial unique index, interval check and doctor overlap exclusion migration | Offline PostgreSQL SQL generated; no production-like PostgreSQL/concurrency run performed |
| H-03 | PARTIALLY FIXED | Startup DDL removed; Alembic existing-schema baseline and constraint migration added | Offline SQL passes; fresh-database bootstrap and staging upgrade remain |
| H-04/H-05 | NOT FIXED | Frontend still uses JavaScript-readable localStorage tokens | Release blocker |
| Security headers | FIXED BUT REQUIRES STAGING VALIDATION | CSP, frame protection, nosniff, referrer policy, permissions policy, and production HSTS configured; Turbopack root isolated from unrelated root lockfile | Production build passes; deployed API/storage/image origins and response headers require staging browser validation |
| H-06 | NOT FIXED | Installed tree is coherent at Next/ESLint config 16.1.6, but upstream advisories remain in `next`, nested `postcss`, and `sharp` | `npm ci` and build pass; `npm audit --omit=dev` still reports 3 High |
| H-07 | FIXED AND TESTED | Explicit Staff/Admin-only paginated `/appointments/history` endpoint and matching typed frontend consumer implemented | Anonymous/patient/doctor denied; Staff/Admin pagination response assertions pass |
| H-08 | PARTIALLY FIXED | Doctor generic completion bypass removed; atomic report completion retained; appointment logging coupled to transactions | New bypass regression passes; complete transition matrix still needed |
| H-09 | FIXED AND TESTED | Doctor page is read-only; management endpoints remain Staff/Admin-only | Anonymous/patient/doctor create denied; Staff/Admin create permitted in synthetic HTTP regression |
| H-10 | PARTIALLY FIXED | Readiness and appointment-email errors no longer reflect raw exceptions | Repository-wide exception leakage audit remains |
| H-11 | NOT FIXED | Durable rate limiting not implemented | Redis/infrastructure required |
| H-12 | PARTIALLY FIXED | Doctor AI reads/reviews now enforce appointment ownership | Upload byte/dimension/magic/decompression/storage/provenance controls remain |
| H-13 | PARTIALLY FIXED | Appointment logs now participate in business transactions | Centralized sensitive-access/auth audit coverage remains |
| H-14 | PARTIALLY FIXED | Core database/JWT/CORS settings typed; DB pool pre-ping enabled | Email/storage/AI/timezone settings not fully centralized |

## 4. Tests Added

- Doctor A cannot list, read, or mutate Doctor B's appointments, patients,
  diagnosis reports, AI analyses, logs, or follow-ups.
- Staff appointment feeds enforce the anonymous/patient/doctor/staff/admin role
  matrix and omit unnecessary PHI fields.
- Inactive users and malformed, expired, incorrectly signed, wrong-issuer, and
  wrong-audience JWTs are rejected.
- Missing and weak JWT secrets fail configuration validation.
- Doctors cannot mark an appointment Completed through the generic status route.
- Staff history rejects anonymous/patient/doctor access and returns an explicit
  paginated contract to Staff/Admin.
- Doctors and patients cannot create announcements; Staff/Admin management
  permission remains intact.

All fixtures are synthetic and run against disposable SQLite; no provider,
email, model, storage, or production database access occurs.

## 5. Validation Results

| Validation | Actual result |
| --- | --- |
| Frontend lint | PASS with 12 existing warnings, 0 errors |
| Frontend TypeScript | PASS — `tsc --noEmit` |
| Frontend production build | PASS — Next.js 16.1.6, 37 static routes generated |
| Frontend tests | NOT RUN — no repository test script established |
| Python compile | PASS for `backend/app` and `backend/init_db.py` |
| Backend tests | PASS — 16 tests; 6 Pydantic deprecation warnings |
| npm dependency audit | FAIL — 3 High (`next`, `postcss`, `sharp`) |
| Python dependency audit | NOT RUN — `pip-audit` not configured/installed |
| Migration validation | PARTIAL — Alembic graph has one head (`20260803_0002`); offline PostgreSQL SQL generated and expected constraints found; no staging upgrade performed |
| Secret scan | PARTIAL — no tracked `.env`/PEM/key/credential-pattern files found and `backend/.env` ignore verified; CI Gitleaks configured; no local Gitleaks scan claimed |
| Diff hygiene | PASS — `git diff --check` returned no whitespace errors (line-ending warning only) |

## 6. Manual Actions Remaining

- Rotate all historically exposed Supabase/database/storage/email/JWT credentials.
- Revoke old keys and sessions and update staging/production secret stores.
- Decide and coordinate remote Git history cleanup; none was performed here.
- Restore a production-like schema copy, verify/stamp the baseline, and run the
  migration and concurrent booking tests in staging before production.
- Provision Redis or another shared durable rate-limit backend.
- Verify private Supabase buckets, signed URL expiration, backup/restore, and
  approved retention/deletion policy.
- Run Gitleaks, `pip-audit`, penetration testing, and privacy/clinical governance
  review through approved environments.
- Do not apply these migrations or deploy automatically from this work session.

## 7. Remaining Risks

The following prevent production release: frontend bearer tokens in
localStorage; unresolved High npm advisories; absent durable abuse protection;
incomplete image upload/storage hardening; incomplete centralized audit logging
and exception sanitization; unvalidated PostgreSQL migration/concurrency
behavior; incomplete appointment transition matrix; and credentials exposed in
history that have not yet been externally rotated. Database lifecycle,
timezone, retention, accessibility, frontend test, and broad workflow
regression phases also remain incomplete. CSP and pagination behavior still
require staging/browser validation against actual API and private-storage
origins.

Unrelated pre-existing working-tree entries (including the deleted model file,
VS Code settings, audit report, and root lockfile) were not restored, deleted,
or committed by this remediation.