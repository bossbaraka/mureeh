# Mureeh Server — Supabase + Render Setup Guide

This server now runs on **Postgres** (Supabase) instead of the old local
SQLite file, and stores uploaded project images in **Supabase Storage**
instead of local disk — both required for a stateless host like Render,
whose local filesystem is wiped on every deploy/restart.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Pick any name/region, set a database password (save it — you'll need it
   below), and wait ~2 minutes for provisioning.

## 2. Get your database connection string

1. In your Supabase project: **Project Settings → Database → Connection
   string**.
2. Choose the **URI** tab. For best compatibility with Render, use the
   **Session pooler** connection string (port `6543` or `5432` depending on
   mode shown) rather than the direct connection — it handles the kind of
   short-lived, bursty connections a web host makes much better.
3. Copy the string, e.g.:
   ```
   postgresql://postgres.xxxxxxxxxxxx:YOUR_PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres
   ```
4. This is your `DATABASE_URL`. **The app creates all tables automatically
   on first boot** (`users`, `projects`) — you do not need to run any SQL
   manually. It also seeds the admin account and 3 demo projects the first
   time it connects to an empty database.

## 3. Create the image storage bucket

Uploaded project images are stored in Supabase Storage so they survive
Render deploys (Render's disk is ephemeral).

1. In Supabase: **Storage → Create a new bucket**.
2. Name it `project-images` (or anything — just set
   `SUPABASE_STORAGE_BUCKET` to match).
3. **Toggle "Public bucket" ON.** This lets the public website load project
   images directly via a public URL, with no extra signing logic needed.
   (Only image *uploads* require the service-role key below — reading is
   public, same as directly linking to any static image.)

## 4. Get your service-role key

1. In Supabase: **Project Settings → API**.
2. Copy the **`service_role`** key (NOT the `anon` key — the service role
   key is required so the server can upload files on behalf of any user;
   never expose this key to the browser/frontend).
3. Also copy the **Project URL** shown on the same page (e.g.
   `https://xxxxxxxxxxxx.supabase.co`).

## 5. Environment variables

Copy `.env.example` to `.env` for local development, or set these directly
as environment variables in Render for production:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase Postgres connection string (step 2) |
| `JWT_SECRET` | Yes | Long random string signing login tokens — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `MUREEH_ADMIN_USER` | No (default `mureeh_admin`) | Seed admin username |
| `MUREEH_ADMIN_PASS` | No (default set in code — **change this**) | Seed admin password |
| `SUPABASE_URL` | Recommended | Project URL (step 4) — enables Supabase Storage for images |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Service role key (step 4) |
| `SUPABASE_STORAGE_BUCKET` | No (default `project-images`) | Bucket name from step 3 |
| `PORT` | No (default `4000`) | Render sets this automatically — no action needed |

If `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are **not** set, the app
falls back to storing uploaded images on local disk — this is fine for local
development, but **do not run production on Render without Supabase
Storage configured**, since every deploy wipes local files.

## 6. Deploy to Render

### Option A — Blueprint (recommended, uses `render.yaml`)

1. Push this repo to GitHub/GitLab.
2. In Render: **New → Blueprint**, connect the repo. Render reads
   `render.yaml` at the repo root automatically.
3. Render will prompt you to fill in the variables marked "sync: false" in
   `render.yaml` (`DATABASE_URL`, `MUREEH_ADMIN_PASS`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`) — paste in the values from steps 2 & 4
   above. `JWT_SECRET` is auto-generated for you.
4. Click **Apply** — Render builds `server/` with `npm ci` and starts it
   with `npm start`.

   The blueprint is validated against Render's official schema
   (`https://render.com/schema/render.yaml.json`), so the fields it uses are
   the ones Render currently accepts.

### Option B — Manual Web Service

1. In Render: **New → Web Service**, connect the repo.
2. **Root Directory:** `server`
3. **Build Command:** `npm ci`
4. **Start Command:** `npm start`
5. **Health Check Path:** `/healthz`
6. Add the environment variables from the table above under the service's
   **Environment** tab — including **`NODE_VERSION` = `22.22.0`**.
7. Deploy.

### Node.js version

`render.yaml` pins `NODE_VERSION=22.22.0`. Keep that pin explicit rather than
relying on Render's default, because:

- **Node 20 is end-of-life** (April 2026). Don't pin `20.x`.
- Render's *default* depends on when the service was first created (24.14.1
  for services created on/after 2026-04-21), so an unpinned service can drift
  onto a major version you never tested against.
- `package.json` declares `"engines": { "node": ">=20.0.0 <25.0.0" }` —
  Render's docs warn that an unbounded range (e.g. `>=20`) silently resolves to
  the newest release, so the upper bound is deliberate.
- Node 22 is active LTS and provides a native global `WebSocket`, which
  `@supabase/supabase-js` requires at startup. On Node <22 the app relies on
  the `ws` package passed as the realtime transport in `storage.js`; that shim
  is still present so local Node 20 development keeps working.

To move to Node 24, change `NODE_VERSION` in `render.yaml` and re-run the app
once locally with that version before deploying.

### After first deploy

- Visit `https://<your-service>.onrender.com/` — the public site should load
  with the 3 seeded demo projects.
- Visit `https://<your-service>.onrender.com/admin/` and log in with
  `MUREEH_ADMIN_USER` / `MUREEH_ADMIN_PASS`.
- **Change the admin password immediately** via the dashboard's "إعدادات
  الحساب" (Account Settings) screen, especially if you left
  `MUREEH_ADMIN_PASS` at its code default.

### Notes on Render's free plan

- Free-tier services spin down after ~15 minutes of inactivity and take
  10–30 seconds to wake up on the next request — this is normal, not a bug.
- Free tier has no persistent disk either way, which is exactly why images
  must go through Supabase Storage rather than local disk.

---

## Local development

```bash
cd server
cp .env.example .env
# edit .env with either a local Postgres, or your real Supabase DATABASE_URL
npm install     # use `npm install` locally (adds to the lockfile as needed);
                # Render uses `npm ci`, which only installs what the lockfile
                # already pins — run `npm install` first if you change deps.
npm run dev
```

The server auto-creates tables and seed data on first boot against whatever
`DATABASE_URL` you point it at — a local Postgres, or your real Supabase
project (handy for testing against production-like data before deploying).
