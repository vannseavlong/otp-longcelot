**Integration Guide — otp-telegram-longcelot**

This document explains how to integrate the `otp-telegram-longcelot` package into an existing service that may use a different database (not only PostgreSQL). It covers how the package creates tables, which environment variables are required, and how other developers can customize behavior.

**Supported Databases**:
- **Default:** PostgreSQL (recommended for CI and production).
- **Other supported via Knex:** SQLite, MySQL, MariaDB, MSSQL, etc. Knex determines the client via `DATABASE_CLIENT`.

**How the package creates tables**:
- **Migrations:** The package ships with Knex migrations in the `migrations/` folder. Run the Knex migration command from your project root to create the required tables in your database.
- **Files to run:** Use the repository's `knexfile.cjs` (see [knexfile.cjs](knexfile.cjs)). The package's migration files live in `migrations/` and will create the tables and indexes the package expects.
- **Commands:**
  - With pnpm (recommended): `pnpm run migrate` (this runs the script defined in `package.json`).
  - Or via Knex CLI: `npx knex migrate:latest --knexfile knexfile.cjs --env development`.

**Required environment variables** (minimum set to run):
- **DATABASE_CLIENT:** Client name for Knex (e.g., `pg`, `sqlite3`, `mysql2`). Default controlled by `DATABASE_CLIENT` in [src/config.ts](src/config.ts).
- **DATABASE_URL:** Connection string or path for the DB. For Postgres: `postgres://user:pass@host:5432/dbname`. For sqlite3: `./data/dev.sqlite`.
- **NODE_ENV:** `development|production|test` — controls config defaults.
- **JWT_SECRET:** Secret used by the package for token signing.
- **HMAC_SECRET:** (Recommended) secret used for deterministic HMAC lookups of tokens and codes. If not provided, `JWT_SECRET` is used as fallback.
- **TELEGRAM_BOT_TOKEN:** If using the Telegram bot integration, provide the bot token.

Optional / tuning variables:
- **PORT:** HTTP server port (default 3000).
- **BOT_MODE:** `polling|webhook` — controls Telegram bot startup mode.
- **RATE_LIMIT_WINDOW_MS** and **RATE_LIMIT_MAX:** Controls basic rate limiting defaults.
- **DEBUG_OTP:** `true|false` — when enabled, OTP generation may be logged for debugging (use only in dev/test).

Total variables you should provide in a typical production setup: ~7 primary variables (DATABASE_CLIENT, DATABASE_URL, NODE_ENV, JWT_SECRET, HMAC_SECRET, TELEGRAM_BOT_TOKEN, PORT) plus any optional tuning variables above.

**How to integrate the package into another service**:
- 1) Install the package:
   - `pnpm add otp-telegram-longcelot` (or `npm install otp-telegram-longcelot`)
- 2) Add or adapt environment variables for your project (see list above).
- 3) Run database migrations against your target DB so the required tables exist:
   - `pnpm run migrate` or `npx knex migrate:latest --knexfile knexfile.cjs`
- 4) Initialize the package in your code (example):
   - Import and start the app/server as documented in `README.md` (the package exposes an app factory). You can also import `LinkService`/`RecoveryService` to use in your own code and pass a storage adapter.

**Customization & extension points**:
- **Database client:** You can run migrations and use any Knex-supported DB by setting `DATABASE_CLIENT` and `DATABASE_URL`.
- **Custom storage adapter:** The package implements a `Storage` interface via `src/adapters/knexStorage.ts`. If your project needs different DB access patterns, implement the same `Storage` interface and pass your adapter into the services (the package's services accept a storage implementation).
- **Service-level overrides:** `LinkService` and `RecoveryService` accept optional provider callbacks (token/code providers). Use these hooks to integrate with alternate lookup logic or caching layers.
- **HMAC & hashing parameters:** You can control `HMAC_SECRET` and (in your own wrapper) bcrypt cost factors if you need stronger/weaker hashing tradeoffs.
- **Table names / SQL structure:** Currently the package uses fixed table names defined by the migrations. If you need different names, either:
  - Fork and adjust the migration + `knexStorage` implementation to use alternate table names, or
  - Implement a custom `Storage` adapter that maps your tables to the package's storage interface.

**Testing / CI recommendations**:
- Prefer running tests against Postgres in CI (GitHub Actions service), because native sqlite bindings can be environment-dependent.
- Locally you can use sqlite for quick iteration; set `DATABASE_CLIENT=sqlite3` and `DATABASE_URL=./data/dev.sqlite`.

**Troubleshooting**:
- If migrations fail, check `DATABASE_URL` format and ensure the DB user has permission to create tables.
- If your DB client requires native bindings (sqlite3) and CI runners fail to build them, either switch CI to a DB service (Postgres) or ensure build dependencies are installed in the runner.

**Quick checklist for integrators**:
- Install package.
- Add env vars: `DATABASE_CLIENT`, `DATABASE_URL`, `JWT_SECRET`, `HMAC_SECRET`, `TELEGRAM_BOT_TOKEN` (if using bot).
- Run migrations using `knexfile.cjs`.
- Start app or import services and wire a `Storage` implementation.

If you'd like, I can add an example integration snippet for a specific DB (MySQL, MariaDB, or SQLite) or a sample `docker-compose.yml` that starts Postgres and runs migrations for local development. Which would you prefer?
If you'd like, I can add an example integration snippet for a specific DB (MySQL, MariaDB, or SQLite) or a sample `docker-compose.yml` that starts Postgres and runs migrations for local development. Which would you prefer?

**Docker Compose (Postgres) — quick start**

We've provided a `docker-compose.yml` at the repository root to make local development straightforward. It defines three services:
- `db`: Postgres 15 database
- `migrate`: one-shot Node service that runs migrations (uses your local repository via a volume)
- `app`: development service which runs the app (`pnpm run dev`) after installing dependencies

Usage:

1. Start the database only (detached):
```bash
docker compose up -d db
```

2. Run migrations once using the `migrate` service:
```bash
docker compose run --rm migrate
```

3. Start the app (binds port `3000`) for local development:
```bash
docker compose up app
```

Environment variables used by the compose file (you can override via `.env`):
- `DATABASE_CLIENT` (default `pg`)
- `DATABASE_URL` (default `postgres://postgres:postgres@db:5432/otp_dev` as set in the compose file)
- `NODE_ENV` (default `development`)

Notes:
- The `migrate` service runs `pnpm install` and `pnpm run migrate` for convenience. If your machine uses a different package manager or you prefer building images, adapt the `command` accordingly.
- Volumes mount the current working directory so edits are visible inside the container. The `node_modules` mount is used to prevent accidentally overwriting host modules with container state.

This compose setup is intended for local development and testing. For CI and production, prefer running migrations in controlled deployments and using a managed Postgres instance.

**Makefile and `.env` convenience**

For convenience the repo includes a `Makefile` with common commands that wrap `docker compose`:

- `make db-up` — start the Postgres DB service in detached mode.
- `make migrate` — run the migration one-shot container.
- `make app-up` — start the app service (development mode).
- `make compose-down` — stop and remove compose services.

You can also create a local `.env` file from `.env.example` to override variables used by the compose override file:

```bash
cp .env.example .env
# edit .env to set secrets like JWT_SECRET, HMAC_SECRET, TELEGRAM_BOT_TOKEN
```

With `.env` present, the `docker-compose.override.yml` will inject the values into the `migrate` and `app` services so you don't need to edit `docker-compose.yml` directly.
