## Summary

Describe the user-facing or operational change and why it is needed.

## Validation

- [ ] Backend tests added/updated when backend behavior changed
- [ ] Frontend lint/typecheck/build considered when frontend behavior changed
- [ ] Accessibility impact reviewed for interactive UI changes
- [ ] Database migration added/reviewed when schema behavior changed
- [ ] No credential, token, production URL secret, or private key was committed
- [ ] Authorization/privacy impact reviewed for protected data or role changes

## Deployment impact

- [ ] No environment-variable change is required, or the required change is documented below
- [ ] No migration is required, or the migration/rollback implications are documented below
- [ ] No destructive data transformation is introduced without a backup/restore plan
- [ ] Rollback target/strategy is understood for production-impacting changes

### Environment / migration notes

None.

### Production smoke tests

List the flows that should be checked after deployment. See `docs/PRODUCTION_READINESS.md` for the release checklist.
