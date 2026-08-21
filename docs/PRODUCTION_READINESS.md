# OurSkin Production Readiness Runbook

This runbook is the final release checklist for the OurSkin web application and FastAPI service. A green CI build is necessary, but it is not sufficient by itself to approve production deployment.

## 1. Mandatory security actions before production

### Rotate every historically exposed credential

Credentials that were ever committed to Git history must be considered compromised even if the current tree no longer contains them.

Rotate and revoke, as applicable:

- PostgreSQL / Supabase database credentials
- Supabase service or API keys
- JWT / application signing secrets
- Google OAuth client secrets or related credentials
- Email / Resend credentials
- Any storage-provider or deployment tokens that appeared in repository history

After rotation:

1. Update the production secret store only; do not commit replacement secrets.
2. Revoke the old values at the provider.
3. Confirm the application can no longer authenticate with an old value.
4. Review provider access logs around the exposure window when available.
5. Decide separately whether repository history should be rewritten. History rewriting does not replace credential rotation.

## 2. Required production configuration

Verify these are provided by the deployment environment rather than source control:

- `ENVIRONMENT=production`
- production `DATABASE_URL`
- strong production `SECRET_KEY`
- expected `JWT_ISSUER`
- expected `JWT_AUDIENCE`
- `CLINIC_TIMEZONE=Asia/Manila`
- the canonical frontend URL
- only the intended production CORS origins
- Google OAuth configuration when Google sign-in is enabled
- email delivery credentials and sender configuration
- Supabase/storage configuration

Confirm session cookies are delivered only over HTTPS in production and that the production frontend/backend origins match the cookie and CORS policy.

## 3. Merge gate

Do not release a commit unless its required repository checks are green:

- current-change secret scan
- backend compile and full pytest suite
- Python dependency audit
- empty PostgreSQL `alembic upgrade head` integration test
- frontend lint
- frontend TypeScript check
- shared accessibility smoke check
- production Next.js build
- production npm dependency audit

Configure `main` branch protection in GitHub so these checks are required and direct unreviewed pushes are blocked. Repository settings are an operational control and are not established merely by committing the workflow file.

## 4. Database deployment

Before applying migrations:

1. Take or verify a recent recoverable production database backup.
2. Record the currently deployed application commit and Alembic revision.
3. Review the pending Alembic revisions for destructive operations.
4. Apply `alembic upgrade head` using production credentials from the secret store.
5. Verify `alembic current` reports the expected head.
6. Verify `/readyz` succeeds before routing normal traffic to the new backend.

Never use development bootstrap behavior as a substitute for production Alembic migrations.

## 5. Post-deploy smoke test

Test with non-production test accounts/data where possible.

### Authentication

- password login creates and uses the HttpOnly session cookie
- logout invalidates/clears the browser session
- a user cannot enter another role's portal
- Google sign-in, linking, and onboarding work when enabled
- password reset and email verification links function

### Patient workflow

- patient can view the canonical Dashboard
- patient can view services and valid future appointment slots
- patient can create an appointment request
- patient can view appointment status/history
- patient can view completed doctor records when eligible

### Staff/admin workflow

- staff sees the correct clinic-local “today” schedule
- staff can assign an initial evaluation to a valid future slot
- approval/cancellation/no-show timing rules behave correctly
- admin Profile & Security opens and account details load
- staff/admin list pages remain responsive with realistic data volumes

### Doctor workflow

- doctor sees only authorized appointments/patients
- doctor can review applicable AI analysis
- doctor can complete an eligible appointment with a diagnosis report
- future appointments cannot be completed early
- patient records/history load without per-row request fan-out

## 6. Monitoring and operations

At minimum, monitor:

- backend 5xx error rate
- `/healthz` and `/readyz`
- database connection failures and pool pressure
- authentication failures / rate-limit events
- email delivery failures
- storage/upload failures
- abnormal latency on appointment, history, and clinical-record routes
- deployment and migration failures

Application logs must not contain credentials, reset/verification tokens, bearer tokens, or sensitive provider responses.

## 7. Backup and restore verification

A backup is not considered sufficient until restore has been tested.

Document and periodically test:

- database backup schedule and retention
- who can initiate a restore
- target recovery time and recovery point objectives
- restore into an isolated environment
- application compatibility with the restored schema/data

## 8. Rollback procedure

If a release causes a critical regression:

1. Stop further rollout or traffic promotion.
2. Record the failing deployment commit and symptoms.
3. Re-deploy the last known-good application commit when the database schema remains backward compatible.
4. If the migration itself must be reversed, review the relevant Alembic downgrade before executing it. Do not automatically downgrade migrations that intentionally discard or transform data.
5. Restore from backup when a safe downgrade is impossible and data integrity is affected.
6. Verify `/healthz`, `/readyz`, login, booking, and the affected clinical path after rollback.
7. Document the incident and add a regression test before re-release.

## 9. Release sign-off

Before production promotion, record:

- release commit SHA
- CI check results
- deployed Alembic revision
- confirmation that historical credentials have been rotated
- backup timestamp / restore confidence
- smoke-test owner and result
- rollback target commit
- approver for production promotion

If any mandatory security action or critical smoke test is incomplete, the release remains **not production-ready** even when CI is green.
