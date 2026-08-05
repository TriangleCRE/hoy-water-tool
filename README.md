# Hoy Center — Water Bill-Back

A small internal tool for splitting the City of Staunton water bill for
729 Richmond Ave across the building's tenants, based on submeter
readings.

## Data storage

Tenants, meter readings, and bills are stored in a **Neon Postgres**
database (added to this project through Vercel's Neon integration, which
sets `DATABASE_URL` / `POSTGRES_URL` and friends on the deployment
automatically — no credentials are hard-coded anywhere in this repo).

- `index.html` — the front end. It loads tenants/readings/bills from the
  `/api/*` endpoints on page load and calls them again on every add, edit,
  or delete, so changes persist in the database for everyone who visits.
- `/api` — Vercel serverless functions (Node.js) that read and write the
  three tables (`tenants`, `readings`, `bills`) using the `pg` client and
  whichever Postgres connection string is present in the environment.
- `/scripts/migrate.mjs` — creates the tables and loads them with the
  starter data (the same data that used to be hard-coded in `index.html`).
  It's idempotent and also runs automatically the first time any `/api`
  route is hit on a fresh database, so running it by hand is optional.

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
