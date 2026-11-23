# Bunker Outreach

A reviewed public export of a self-hosted outreach application: React frontend, Express API, PostgreSQL data access, JWT authentication and a per-user message queue. This repository starts with fresh history and contains no production data or environment files. Read [PROVENANCE.md](PROVENANCE.md) and [SECURITY.md](SECURITY.md) before running it.

## Reproduce the isolated demonstration

Requires Bun 1.4.4 (tested on Linux x86_64). The committed Bun lockfiles are canonical; npm lockfiles from the private original are deliberately not included.

```sh
bun install --frozen-lockfile --ignore-scripts
cd client
bun install --frozen-lockfile --ignore-scripts
cd ..
bun run build
# Choose a local demonstration password, at least 12 characters:
export DEMO_PASSWORD='local-demo-only-1234'
bun run demo
```

Open http://127.0.0.1:3001 and log in as `operator@example.com` with the local DEMO_PASSWORD you set. A second fictional account, `second@example.org`, uses that same local password. These are demonstration accounts created only in an ephemeral, embedded PostgreSQL database (PGlite). Restarting the demo resets the data and signing key. No external PostgreSQL service is used or modified.

The original UI is in Portuguese. Leads use reserved example domains. AI drafting returns fixed demonstration text. Email delivery is simulated before any SMTP transporter is created. Discovery, document upload and public registration are disabled in demo mode. A simulated success changes queue state but sends no email. API keys and SMTP credentials are unnecessary for this mode.

## Verification

```sh
bun test --timeout 20000 tests/smoke.test.js
bun audit
cd client && bun audit
```

The smoke test boots the real API against ephemeral PostgreSQL, logs in two fictional users, checks unauthenticated rejection and cross-user lead/queue separation, checks admin rejection, verifies discovery is disabled, exercises simulated SMTP and reads back the stored result. It stops its server afterwards. The test uses localhost port 8973; keep it free.

## Architecture

Browser → authenticated Express API → per-user PostgreSQL tables.

Discovery and email work have separate in-process state. The email loop distinguishes drafting and sending; persisted numeric states represent pending, draft, queued, sent and failed records. SMTP adapter results update message state. See `server.js`, `db.js`, `auth.js` and `mailer.js`.

This design has limits: it does not provide PostgreSQL RLS, durable scheduling, an atomic queue claim, exactly-once delivery, or a mandatory human-approval gate. Drafting currently queues messages directly. SMTP acceptance is not inbox delivery. Do not infer production readiness from the demonstration.

## Optional dedicated PostgreSQL setup

Outside demo mode, supply DATABASE_URL for a **new, dedicated database**, a random JWT_SECRET with at least 32 characters, and optionally PORT/HOST. The server defaults to localhost. Schema initialization runs on startup. No original deployment script, database URL, private font kit, scraper installer or administrator email is included. Provider-backed operations require your own explicit configuration and independent review. This optional mode was not integration-tested against a standalone PostgreSQL server in this export; the smoke test uses its embedded PostgreSQL engine.

Do not connect an existing production database. Never commit credentials, uploaded documents or real contacts. No cloud deploy workflow is shipped. Creating this source repository does not deploy the app or the portfolio website.
