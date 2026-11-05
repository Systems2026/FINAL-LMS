# SNHS LMS

SNHS LMS is a web-based learning management system for St. Nicholas Senior
High School. It provides role-based portals for administrators, teachers, and
students, backed by an Express API and MySQL database.

## Features

### Administrator

- Dashboard and activity log views
- Student and teacher management
- Subject and class-section management
- Announcements, reports, and system settings

### Teacher

- Assigned classes and class rosters
- Learning materials and resources
- Assignments, quizzes, and exams
- Submission review and gradebook
- Announcements and reports

### Student

- Dashboard and assigned classes
- Class materials and resources
- Assignments, quizzes, and exams
- Submissions, grades, announcements, and calendar

The feature list describes UI areas present in the current source; it is not a
claim that every workflow has been fully regression-tested.

## Technology

- HTML5, CSS, and JavaScript/TypeScript
- React 19 with TypeScript/TSX
- Vite 8 and Tailwind CSS 4
- Node.js 22 and Express 5
- MySQL with `mysql2`

The browser entry point is `index.html`; the application mounts from
`src/main.tsx`. The Express API and its MySQL schema initialization are in
`server/index.js`.

## Project layout

```text
.
├── .figma/                 # Figma Make project configuration and scripts
├── database/
│   ├── README.md           # Database setup and migration notes
│   └── setup.sql           # Non-destructive empty-database creation
├── server/
│   ├── index.js            # Express API, auth, and schema initialization
│   └── data.json           # Local JSON fallback data (ignored by Git)
├── src/
│   ├── assets/             # Application logo and default profile image
│   ├── App.tsx              # React application and role portals
│   ├── index.css
│   └── main.tsx
├── .env.example
├── index.html
├── package.json
└── vite.config.ts
```

## Requirements

- Node.js 22 (see `.mise.toml`)
- MySQL 8 or a compatible WAMP/MySQL installation
- npm (the checked-in `package-lock.json` is the reproducible install lock)

The repository currently also contains a `pnpm-lock.yaml`; its importer does
not list all dependencies in `package.json`. Use npm and `npm ci` unless that
lockfile is reconciled.

## Installation and local run

1. Install Node.js 22 and start MySQL.
2. From the project root, install the locked dependencies:

   ```powershell
   npm ci
   ```

3. Copy `.env.example` to `.env` and set the database connection values:

   ```powershell
   Copy-Item .env.example .env
   ```

   Do not commit `.env`.
4. For a first local setup, the backend creates the configured database and
   initializes its tables on startup. Its MySQL account needs database-create
   permission; `database/setup.sql` is also available to pre-create the empty
   database. See [database setup](database/README.md).
5. To create the first administrator, set all four `BOOTSTRAP_ADMIN_*`
   variables in `.env` before the first start. The password must be at least
   12 characters. The account is created only when the configured database has
   no users. Remove the bootstrap values, especially the password, from `.env`
   after the account is created.
6. Start the API and frontend together:

   ```powershell
   npm run dev
   ```

   The Vite frontend is available at <http://localhost:8443>; the API listens
   at <http://localhost:4000>. Vite proxies `/api` requests to the API.

To run only the backend, use `npm run dev:server`. To run only Vite, use
`npx vite --host 0.0.0.0 --port 8443`.

## Environment configuration

The backend reads `.env` from the project root. Supported variables:

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT` | MySQL host and port |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL credentials and database |
| `PORT` | Backend port; local Vite development uses port 8443 |
| `ALLOW_JSON_FALLBACK` | Set to `true` only for local fallback testing; keep `false` for MySQL use |
| `SNSHS_DATA_PATH` | Optional path for the JSON fallback data file |
| `BOOTSTRAP_ADMIN_ID` | First administrator's school ID |
| `BOOTSTRAP_ADMIN_NAME` | First administrator's name |
| `BOOTSTRAP_ADMIN_EMAIL` | First administrator's email |
| `BOOTSTRAP_ADMIN_PASSWORD` | One-time first administrator password (12+ characters) |
| `FIGMA_PUBLIC_URL`, `FIGMA_DEV_SERVER_HOST` | Optional Figma Make/Vite hosting settings |

Use a dedicated MySQL account and strong password outside local development;
do not use an empty password or a shared database administrator account in
production.

## Database behavior

On startup, the backend creates the configured database if needed and
initializes or additively migrates its tables and indexes. This may alter
existing table engines, columns, and indexes. Back up existing data before
deploying an updated backend. Do not run these migrations against production
without a reviewed backup and maintenance plan.

`server/data.json` is an optional local fallback store, not a MySQL backup.
The fallback is disabled by default and should not be enabled for production.

## Administrator account creation and recovery

The supported first-account creation path is the one-time
`BOOTSTRAP_ADMIN_*` configuration described above. The backend refuses
incomplete bootstrap details and hashes the supplied password before storing
it. Do not put actual credentials in this repository or share them in issues.

There is no documented in-app administrator password-recovery workflow in the
current source. For a lost administrator account, use the school's authorized
account-recovery procedure with a database administrator; do not enable
bootstrap on a populated database or edit live records without an approved
backup and change record.

## Build and deployment

Build the static frontend:

```powershell
npm run build
```

For the current single-process production arrangement, the Express server
serves the generated `dist/` files and the `/api` routes:

```powershell
npm run dev:server
```

Set production database and port values in the server environment, build the
frontend before starting the backend, and run the backend under an appropriate
process manager. Put the service behind HTTPS and a reverse proxy/firewall;
do not expose the MySQL port publicly. `dist/` is generated and is not tracked.

Before a public deployment, review the current server's permissive CORS
configuration and restrict cross-origin access to the intended frontend
origins. API sessions are in-memory bearer tokens with an eight-hour lifetime;
restarting the backend invalidates active sessions.

## Security notes

- `.env`, private keys, local fallback data, generated builds, dependencies,
  logs, and Figma attachment screenshots are excluded by `.gitignore`.
- `.env.example` contains placeholders only. Never commit production
  credentials, school user data, database dumps, or access tokens.
- Use HTTPS, least-privilege database credentials, backups, and a private
  database network for deployments.
- Rotate any credential if it is ever exposed. Removing a secret from the
  current tree does not remove it from published Git history.

## Verification

The repository has no automated test script at present. The backend can be
syntax-checked with `node --check server/index.js`, and `npm run build`
validates the frontend production bundle. A successful build alone does not
verify database connectivity, authentication, authorization, or all LMS
workflows.
