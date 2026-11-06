# Database setup

## Existing application database

`server/index.js` uses the legacy API when `DB_SCHEMA_PROFILE=legacy` (the
default) and the normalized API only when `DB_SCHEMA_PROFILE=normalized_v1` is
explicitly selected. Both the database name and schema profile must be selected
deliberately. Legacy mode refuses a database marked `normalized_v1`; normalized
mode verifies its schema marker and required tables before serving requests.
Production remains on `DB_NAME=snhs_lms` and `DB_SCHEMA_PROFILE=legacy` until a
migration is explicitly approved.

`setup.sql` is the existing non-destructive convenience script for creating
the empty `snhs_lms` database. It does not drop databases, tables, or records.

## Separate normalized database

The scripts `001_schema.sql` through `005_indexes.sql` create and seed only
`lms_clean`. They may be rerun: DDL uses `IF NOT EXISTS`, lookup/default data
uses `INSERT IGNORE`, and the supplemental indexes check the MySQL catalog.
The year seed is `2026-2027`, read from the current System Settings; school
calendar dates are not guessed. The section seed creates 20 requested sections
without creating student/teacher accounts or adviser assignments.

Apply with a MySQL client that reads SQL files in order:

```powershell
mysql -u root -p < database/001_schema.sql
mysql -u root -p < database/002_reference_data.sql
mysql -u root -p < database/003_academic_year.sql
mysql -u root -p < database/004_sections.sql
mysql -u root -p < database/005_indexes.sql
```

Use the authorized local MySQL account in place of `root` where appropriate.
Never put its password in a command, source file, or report. These scripts do
not copy data from `snhs_lms`.

For local normalized-schema development, set `DB_NAME=lms_clean` and
`DB_SCHEMA_PROFILE=normalized_v1` in the local `.env`. Never enable that
configuration in production before the normalized API and controlled migration
have been reviewed and explicitly approved. No data migration or database
selection change is performed by these settings.

## Migration plan

No records have been migrated. See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)
for the legacy-to-normalized mapping, known data exceptions, and approval
gates.

The legacy startup may perform additive schema changes. Back up the existing
database before deploying future changes, and never run a destructive reset
or migration against it.
