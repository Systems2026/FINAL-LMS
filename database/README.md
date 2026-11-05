# Database setup

The database schema is initialized and additively migrated by
`server/index.js` when the backend starts. It creates the application tables,
adds missing columns and indexes, and upgrades transaction-related tables to
InnoDB. There is intentionally no second, hand-maintained table schema here;
the backend initializer is the schema source of truth.

`setup.sql` is a safe, non-destructive convenience script that creates the
empty `snhs_lms` database if it does not exist. It does not drop databases,
tables, or records. If `DB_NAME` is configured to a different name, edit the
script before running it.

The database account used by the backend must be able to connect to MySQL,
create the database, and create/alter tables and indexes. The current backend
issues `CREATE DATABASE IF NOT EXISTS` during initial connection, so
pre-creating the database alone does not remove that privilege requirement.
Back up an existing database before starting a new or changed backend version:
startup migrations can alter table engines, columns, and indexes.
