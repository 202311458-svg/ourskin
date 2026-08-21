# OS-COMS Security Remediation and Manual Actions

This document records security actions that must not be automated from a local
repository remediation session. It contains no credential values or patient
information.

## Historical environment-file incident

The 2026-08-03 audit identified credentials historically stored in
`backend/.env`. Ignoring the file now prevents a future accidental commit but
does **not** revoke values already exposed in Git history.

### Mandatory credential rotation checklist

Perform these actions through approved provider and deployment consoles:

- [ ] Inventory every credential that was ever present in the historical file.
- [ ] Rotate Supabase database credentials and revoke the old credentials.
- [ ] Rotate Supabase service-role/storage keys and verify buckets remain private.
- [ ] Rotate email-provider credentials and revoke the old API keys.
- [ ] Generate and deploy a new high-entropy JWT signing secret.
- [ ] Revoke existing sessions/tokens after the JWT key change.
- [ ] Update production and staging secret stores; never place values in GitHub
      workflow YAML, issue trackers, documentation, or source files.
- [ ] Restart services in a controlled order and validate authentication,
      private storage, email, and database readiness in staging.
- [ ] Review provider audit logs for suspicious historical use.
- [ ] Decide with repository owners whether remote Git history should be purged.
      History rewriting is disruptive and is intentionally not performed here.
- [ ] Run an independent secret scan after any approved history-cleanup process.

## JWT deployment requirements

`DATABASE_URL` and `SECRET_KEY` are required at startup. `SECRET_KEY` must be at
least 32 bytes and must not be a known placeholder. The JWT algorithm is fixed
in application code. Tokens include and validate issuer, audience, expiry,
issued-at, subject, and unique-token claims.

Deployments changing issuer/audience or signing key invalidate older tokens.
Schedule this as an explicit session-revocation event rather than silently
falling back to legacy token validation.

## Secret scanning

The repository GitHub Actions workflow runs Gitleaks across Git history. Local
developers should install Gitleaks using their organization-approved method and
run:

```text
gitleaks git --redact --no-banner
```

Do not paste findings containing actual values into tickets or chat. Refer to
the provider, credential type, file path, and commit ID only.

## Production validation still required

- Apply database migrations to a staging copy before production.
- Provision durable rate-limiting infrastructure (for example Redis) before
  claiming multi-worker abuse protection.
- Validate private buckets and signed-URL expiry in Supabase.
- Configure backup/restore testing and approved clinical-data retention policy.
- Commission penetration testing and privacy/clinical-governance review before
  production release.