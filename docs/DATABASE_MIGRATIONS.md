# OS-COMS Database Migration Procedure

Application startup and `backend/init_db.py` do not issue DDL. Schema changes
are managed by Alembic from the `backend` directory.

## Existing database baseline (staging first)

The repository began using Alembic after tables already existed. Therefore the
first revision is a no-op marker, not permission to assume every deployed
schema matches the models.

1. Restore a production-like backup into an isolated staging database.
2. Compare tables, columns, constraints, indexes, and actual status values with
   SQLAlchemy metadata and the audit report.
3. Back up that staging database again before migration testing.
4. Mark the verified existing schema:

   ```text
   alembic stamp 20260803_0001
   ```

5. Review generated SQL without connecting to production:

   ```text
   alembic upgrade 20260803_0002 --sql
   ```

6. Apply to staging only:

   ```text
   alembic upgrade head
   ```

7. Run booking concurrency and workflow regression tests, inspect constraints,
   and rehearse the rollback. Production execution requires a separately
   approved change window and verified backup.

The booking migration intentionally fails if duplicate active patient/service
requests, invalid time intervals, or overlapping active doctor appointments
already exist. Do not delete clinical records to make migration pass; resolve
them through an approved correction process.

## Fresh database limitation

Revision `20260803_0001` does not create the historical schema. A full reviewed
bootstrap migration must be generated and validated before a fresh production-
like database can be created only with `alembic upgrade head`. Until then, this
is a release blocker and the migration work is classified as partial.