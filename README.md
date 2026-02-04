# Tact Assessment Backend

NestJS + GraphQL API: auth (signUp/signIn/me), file uploads to MinIO, metadata in Postgres. Paginated file list, upload metrics, and a subscription for when a file is uploaded (only the uploader gets the event). Rate limit on uploads (10/min per user).

**Stack:** NestJS 11, Apollo/GraphQL (code-first), TypeORM, PostgreSQL, MinIO, Passport JWT, Throttler, graphql-ws for subscriptions.

---

## Setup

Node 18+, Postgres, MinIO. Copy `.env` from below and set `JWT_SECRET`.

**Required env:** `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`. Optional: `PORT`, `DB_PORT`, `MINIO_*`. Missing required = startup error.

`.env` example:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=tact_assessment
JWT_SECRET=your-secret
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=fileuploads
```

```bash
npm install
npm run start:dev
```

GraphQL at `http://localhost:3000/graphql`.

**Docker:** `docker compose up -d` runs Postgres + MinIO + app (set `JWT_SECRET` in `.env`). Or `docker compose up -d postgres minio` and run the app locally with the env above.

---

## API (quick)

- **Auth:** `signUp(createAuthInput)`, `signIn(loginInput)` — both take `{ email, password }`. `me` returns current user (needs JWT).
- **Files:** `uploadFile(input: { file: Upload })` — multipart, 10MB max, rate limited. `myFiles(pagination?)` — paginated list. `myUploadMetrics` — totals and per-day counts.
- **Subscription:** `fileUploaded` — fires for the user who just uploaded; send JWT in connection params.

Use `Authorization: Bearer <token>` for protected ops; subscriptions need JWT in connection params.

---

## Migrations

Migrations in `src/migrations/`; build first so they end up in `dist/migrations/` for the CLI.

Generate (DB up, env set):

```bash
npm run build
npx typeorm migration:generate src/migrations/YourName -d dist/config/typeormConfig.js
```

Run:

```bash
npm run build
npx typeorm migration:run -d dist/config/typeormConfig.js
```

If you get “No migrations are pending” but expect new tables, run `npm run build` after adding/editing migrations.

---

## Scripts

`build`, `start`, `start:dev`, `start:prod`, `lint`, `format`, `test`, `test:e2e`, `test:cov`.
