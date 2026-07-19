# Say it — Anonymous Public Accountability Platform

Anonymous reporting of alleged misconduct by public officials in Kenya. No
accounts, no login — every report carries the disclaimer "Unverified
allegation — not proven fact."

The homepage (`/`) is a single WhatsApp-style chat stream: type anything and
send, no required fields. Politician name/position/county/category are
optional structured tags a post *can* carry (via the underlying data model)
but the primary composer never asks for them.

## Stack

- **Backend**: Node.js + Express + Prisma + PostgreSQL
- **Frontend**: React (Vite) + plain CSS, mobile-first, one-page WhatsApp-style
  chat UI (`src/pages/Chat.jsx`, `src/components/Bubble.jsx`)
- **Storage**: S3-compatible object storage — MinIO locally, swappable to
  Backblaze B2 / AWS S3 in production by changing env vars only

## Project layout

```
backend/    Express API, Prisma schema, evidence processing pipeline
frontend/   React app (Vite)
docker-compose.yml   Postgres + MinIO + (optional) ClamAV for local dev
```

## Local setup

### 1. Start supporting services

```
docker compose up -d
```

This starts Postgres (`localhost:5432`), MinIO (`localhost:9000`, console at
`:9001`, login `minioadmin`/`minioadmin`), and ClamAV (`localhost:3310`,
optional — see "Virus scanning" below).

Create the MinIO bucket referenced by `S3_BUCKET` in `.env` (default
`nuke-evidence`) once via the MinIO console at http://localhost:9001, or with
the `mc` CLI:

```
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/nuke-evidence
mc anonymous set download local/nuke-evidence   # public read for evidence files
```

### 2. Backend

```
cd backend
cp .env.example .env      # edit ADMIN_TOKEN and RATE_LIMIT_SECRET at minimum
npm install
npm run prisma:migrate    # creates tables
npm run dev                # http://localhost:4000
```

### 3. Frontend

```
cd frontend
npm install
npm run dev                # http://localhost:5173, proxies /api to :4000
```

Open http://localhost:5173 — that's the whole public app, one screen. The
admin view is reachable via the ⋮ menu in the header, or directly at
`/admin` — enter the `ADMIN_TOKEN` you set in `backend/.env`.

## How review works

- Text-only reports go live immediately.
- Any report with evidence attached is set to pending review (`approved =
  false`) and excluded from the public feed until an admin approves it from
  `/admin`.
- Reports and replies auto-hide once `flagCount >= 3`; admins can unhide or
  permanently remove from the "Flagged content" tab. This is unrelated to the
  "hot" (amber) bubble highlight in the UI — `hot` is an engagement signal
  (`status === "corroborated"` or `HOT_REPLY_THRESHOLD` replies, currently 5,
  set in `backend/src/constants.js`), computed server-side and returned as a
  boolean on each report so the client never derives it from `flagCount`.
- `POST /api/reports` returns a one-time `evidenceToken` alongside the report.
  Attaching evidence (`POST /:id/evidence`) requires that token in the
  `x-evidence-token` header. Without this, since there are no accounts,
  anyone could attach evidence to *any* existing public report id and knock
  it back into pending review as a griefing/censorship vector — the token
  scopes evidence uploads to whoever holds the response from the original
  creation call. It's never returned from any other endpoint.

## Evidence pipeline

On upload (`POST /api/reports/:id/evidence`), a file is:

1. Optionally virus-scanned via ClamAV (`clamscan` npm package talking to
   `clamd`) — if `clamd` isn't reachable, scanning is skipped and a warning
   is logged once; uploads are never blocked solely because a scanner isn't
   running locally.
2. Stripped of metadata:
   - Images: re-encoded via `sharp` (EXIF/XMP/ICC dropped by default;
     `.rotate()` bakes in the correct orientation first so images don't end
     up sideways).
   - Video: re-muxed via `ffmpeg` with `-map_metadata -1`, also transcoded to
     H.264/AAC mp4 capped at 720p to keep storage/bandwidth sane.
   - Documents (PDF/DOC/DOCX): stripped via `exiftool` if it's installed on
     the host; otherwise uploaded as-is with a logged warning.
3. Uploaded to the S3-compatible bucket, never touching local disk beyond a
   short-lived temp file that's deleted in a `finally` block.

**Host dependencies**: `ffmpeg` must be installed and on `PATH` for video
uploads to work (`brew install ffmpeg` / `apt install ffmpeg`). `exiftool` is
optional (document stripping). ClamAV is optional (virus scanning).

## Kenya politics news (sidebar)

The right sidebar's "Kenya politics news" card is a small proxy to
[NewsData.io](https://newsdata.io), scoped server-side to `country=ke` +
`category=politics` so it can only ever show Kenyan political headlines.

1. Sign up at newsdata.io and grab a free API key (200 requests/day).
2. Set `NEWSDATA_API_KEY` in `backend/.env`.
3. Restart the backend.

Without a key set, the card just says "not configured" — it never breaks the
rest of the app. Responses are cached in-memory for 15 minutes
(`backend/src/routes/news.js`) to stay well under the free-tier quota.

## Rate limiting

Report/reply/flag creation is throttled per IP using an in-memory counter
keyed on `HMAC(dailySalt, ip)`. The salt rotates every UTC day and is derived
from `RATE_LIMIT_SECRET` — raw IPs are never stored, and the resulting hash
is never attached to any report/reply row, so there's no queryable link
between a rate-limit bucket and the content someone submitted. This also
means limits reset across server restarts and don't scale past a single
process — fine for an MVP, revisit (e.g. Redis-backed) before running
multiple backend instances behind a load balancer.

## Anonymity notes

- No accounts, no sessions, no auth beyond the admin token.
- The frontend tracks a visitor's own past submissions locally
  (`localStorage`, `src/lib/pseudonym.js`) for potential future "your
  activity" views. It is never sent to the backend and never shown to other
  visitors. The chat UI deliberately shows no sender distinction at all —
  every bubble looks the same regardless of who posted it, matching "every
  voice is anonymous."
- Uploaded evidence has metadata stripped before storage (see above) so
  photos/videos don't leak GPS/device info about the submitter.

## Production deployment (Vercel frontend + Railway backend)

The backend needs `ffmpeg` and a persistent process (video transcoding, temp
files, in-memory rate limiting) — that rules out plain serverless functions,
so frontend and backend deploy as two separate services.

**Backend (Railway, Render, Fly, or any Docker host):**
1. Point the service at the `backend/` directory, using `backend/Dockerfile`
   (installs `ffmpeg` + `exiftool`, runs `prisma generate`, and runs pending
   migrations via `prisma migrate deploy` on every start).
2. Set all the env vars from `backend/.env.example` — `DATABASE_URL` (a real
   cloud Postgres, e.g. Neon/Supabase — **not** `localhost`),
   `ADMIN_TOKEN`, `RATE_LIMIT_SECRET`, `S3_*` (Backblaze B2 in production),
   `NEWSDATA_API_KEY`, and `CORS_ORIGIN` set to your Vercel frontend's URL.
3. Note the backend's public URL once deployed (e.g.
   `https://your-backend.up.railway.app`).

**Frontend (Vercel):**
1. Set the project's Root Directory to `frontend` — Vercel auto-detects Vite,
   no `vercel.json` needed.
2. Set `VITE_API_BASE_URL` to `<backend URL>/api` (from the step above).
3. Deploy.

## Production deployment notes

- Swap `S3_ENDPOINT` / credentials / `S3_PUBLIC_BASE_URL` for Backblaze B2 or
  AWS S3 — the client code (`backend/src/lib/s3.js`) is unchanged either way
  since both speak the S3 API.
- The admin token is an MVP mechanism (single shared secret via env var,
  constant-time compared). If you need per-admin accounts, audit logging, or
  token rotation, that's a deliberate upgrade — flag it and we can design
  that separately rather than bolting it on.
- Put a real reverse proxy (nginx, Caddy, etc.) in front in production;
  `app.set("trust proxy", true)` is already set so rate limiting sees the
  real client IP through `X-Forwarded-For`.
