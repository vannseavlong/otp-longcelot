**Telegram OTP — Auth Service**

**Overview**
- **Purpose:** Lightweight, production-oriented authentication microservice that issues one-time passcodes (OTPs), supports Telegram account linking for OTP delivery, and provides recovery codes.
- **Intended use:** Run as a standalone service or embed inside a larger system; integrators provide a `TELEGRAM_BOT_TOKEN` and database connection to enable Telegram delivery and persistence.

**Tech Stack**
- **Runtime:** Node.js (v18+ recommended)
- **Language:** TypeScript
- **HTTP framework:** Express
- **Database:** Knex (supports sqlite3 and Postgres out of the box)
- **Telegram:** Telegraf
- **Auth primitives:** bcryptjs, jsonwebtoken
- **Rate limiting:** rate-limiter-flexible

**Quick Start (Local Development)**
- Clone repository and install dependencies:

	npm install

- Copy `.env.example` (or create `.env`) and set the required variables listed in **Environment** below.
- Run database migrations:

	npx knex migrate:latest --knexfile knexfile.js

- Build and start the server:

	pnpm run build
	pnpm run start

Or in development mode:

	pnpm run dev

**Environment**
- Provide these minimal environment variables (see `src/config.ts` for full list):
	- **PORT** — HTTP server port (default 3000)
	- **DATABASE_CLIENT** — `sqlite3` or `pg`
	- **DATABASE_URL** — connection string or sqlite path
	- **JWT_SECRET** — secret for signing JWTs
	- **TELEGRAM_BOT_TOKEN** — Telegram Bot token (required for OTP delivery through Telegram)
	- **HMAC_SECRET** — (recommended) secret used for HMAC deterministic lookup; falls back to `JWT_SECRET` if not set
	- **DEBUG_OTP** — `true` to surface OTP in responses for local testing

**Migrations**
- Migrations live in the `migrations/` folder and are automatically run on server start when configured. You can also run them manually with the Knex CLI:

	npx knex migrate:latest --knexfile knexfile.js

**API (summary)**
- **POST /auth/register** — register a new user (returns 201 or 409 on duplicate)
- **POST /auth/login** — validate password and create OTP challenge (returns `challengeId`, `expires_at`, and `otpSent` boolean)
- **POST /auth/login/verify-otp** — verify OTP and receive JWT
- **POST /auth/telegram/link/initiate** — create a Telegram link token (returns `link_token` and `link_url` deep link)
- **POST /auth/telegram/change/initiate** — initiate OTP flow to confirm changing Telegram
- **POST /auth/telegram/change/confirm** — confirm Telegram change using OTP
- **POST /auth/recover/verify** — verify recovery code and revoke Telegram

Refer to the `src/controllers` and `src/routes` for request/response shapes.

**Telegram Integration (how to integrate into another project)**
- To integrate this service into an existing system, you typically:
	1. Deploy this service (or containerize it) and expose the HTTP port.
	2. Provide environment variables for your target environment (see **Environment** above). The most important value is `TELEGRAM_BOT_TOKEN` — without it Telegram delivery will be disabled.
	3. If you want deep-linking to work, the service will return a `link_url` like `https://t.me/<your_bot>?start=<token>` — users must click this link or issue `/start <token>` to the bot from the intended Telegram account.
	4. The bot consumes the token and binds the Telegram `chat_id` to the user in the DB, enabling OTP delivery to that `chat_id`.
	5. If your system needs to trigger login flows programmatically, call the `/auth/login` endpoint and then wait for the `otpSent` boolean or use `DEBUG_OTP` in development to receive the OTP in the API response.

	**Embedding as a dependency**
	If you want your application to embed this service directly (so consumers can `yarn add otp-telegram-longcelot` and mount the auth endpoints inside their app), the library can be used in-process. The simplest pattern is:

	1. Install as a dependency in your project (example package name):

		yarn add otp-telegram-longcelot

	2. Provide minimal environment variables (see **Environment**). Most integrations only need:

		- `DATABASE_URL`
		- `JWT_SECRET`
		- `TELEGRAM_BOT_TOKEN` (to enable Telegram delivery)

	3. Mount the service in your Express app (example):

	```js
	import express from 'express';
	// Import the packaged app factory and adapters from the module
	import createApp from 'otp-telegram-longcelot/dist/app.js';
	import { KnexStorage } from 'otp-telegram-longcelot/dist/adapters/knexStorage.js';
	import { AuthService } from 'otp-telegram-longcelot/dist/services/authService.js';
	import { createBot } from 'otp-telegram-longcelot/dist/telegram/bot.js';

	const storage = new KnexStorage();
	const bot = createBot(); // will use TELEGRAM_BOT_TOKEN from env
	const authService = new AuthService(storage, bot, /* limiter */ null);

	const app = express();
	app.use('/auth', createApp({ storage, auth: authService, bot, limiter: null }));

	app.listen(4000, () => console.log('App listening on 4000'));
	```

	Notes:
	- The exact import path may differ depending on how the package is published — prefer the package's top-level exports if available (e.g., `import { createApp } from 'otp-telegram-longcelot'`).
	- When embedding, provide your own rate limiter or pass `null` to use the default in-memory limiter.

	This approach lets integrators mount the auth endpoints directly inside an existing app, or keep the service standalone and forward requests to it.

	**Quick test endpoints (for integrators)**
	- `GET /_health` — quick health check returning `{ ok: true }`.
	- `POST /auth/register` — create a user: `{ email, username, password }`.
	- `POST /auth/telegram/link/initiate` — create a link token for a user: `{ user_id }`.
	- `POST /auth/login` — create OTP challenge: `{ identifier, password }`.


**Security notes**
- Tokens and recovery codes are stored as bcrypt hashes for secrecy. To allow efficient lookup without scanning the DB, the service computes and stores an HMAC value (using `HMAC_SECRET`) beside each token/recovery code — this provides deterministic indexing while keeping the secret value unrecoverable.
- Ensure `JWT_SECRET` and `HMAC_SECRET` are different and strong keys in production.
- Rotate `HMAC_SECRET` carefully: it affects deterministic lookup; rotate with a migration strategy if needed.

**Testing**
- Unit tests for services are in `tests/`. Run them with:

	pnpm run test

**Operational tips**
- Run migrations before starting in production.
- Use a managed Postgres for production for reliability.
- If deploying behind a proxy, ensure `PORT` and trust proxy settings are configured as needed.

**Contributing & Support**
- Open issues or PRs for improvements. Keep changes small and focused; write tests for non-trivial behavior.

**License**
- MIT

