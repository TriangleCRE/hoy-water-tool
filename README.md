# Hoy Center — Water Bill-Back

A small internal tool for splitting the City of Staunton water bill for
729 Richmond Ave across the building's tenants, based on submeter
readings.

The whole site — the passcode gate, the static page, and the data API —
is served by one Express app (`server.js`), deployed as a single Vercel
serverless function (see `vercel.json`). That means every request,
including the `/api/*` routes described below, passes through the
passcode gate first.

## Data storage

Tenants, meter readings, and bills are stored in a **Neon Postgres**
database (added to this project through Vercel's Neon integration, which
sets `DATABASE_URL` / `POSTGRES_URL` and friends on the deployment
automatically — no credentials are hard-coded anywhere in this repo).

- `public/index.html` — the front end. It loads tenants/readings/bills
  from the `/api/*` routes on page load and calls them again on every
  add, edit, or delete, so changes persist in the database for everyone
  who visits.
- `lib/data-routes.js` — an Express router (mounted at `/api` in
  `server.js`) that reads and writes the three tables (`tenants`,
  `readings`, `bills`) using the `pg` client and whichever Postgres
  connection string is present in the environment.
- `lib/db.js` — shared Postgres access: connection pooling, the
  `CREATE TABLE IF NOT EXISTS` schema, and row↔API shape mapping.
- `scripts/migrate.mjs` — creates the tables and loads them with the
  starter data (the same data that used to be hard-coded in
  `index.html`). It's idempotent and also runs automatically the first
  time any `/api` route is hit on a fresh database, so running it by
  hand is optional.

### Running the migration by hand (optional)

```bash
vercel env pull .env.local        # pulls DATABASE_URL etc. from the Vercel project
node --env-file=.env.local scripts/migrate.mjs
```

or simply:

```bash
DATABASE_URL="postgres://..." node scripts/migrate.mjs
```

### API

All of these require a valid session cookie, same as the rest of the site.

| Method | Path                | Purpose                                   |
| ------ | ------------------- | ------------------------------------------ |
| GET    | `/api/tenants`       | List tenants                              |
| GET    | `/api/readings`      | List meter readings                       |
| POST   | `/api/readings`      | Add/upsert a reading (by date)            |
| PUT    | `/api/readings/:id`  | Edit a reading                            |
| DELETE | `/api/readings/:id`  | Delete a reading                          |
| GET    | `/api/bills`         | List bills                                |
| POST   | `/api/bills`         | Create a bill                             |
| PUT    | `/api/bills/:id`     | Edit a bill (incl. status changes)        |
| DELETE | `/api/bills/:id`     | Delete a bill                             |
| POST   | `/api/import`        | Bulk-replace readings + bills from a JSON export |

## Running locally

```bash
npm install
PASSCODE=whatever DATABASE_URL="postgres://..." npm run dev
```
