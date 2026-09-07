# 2w12.one

Audio community platform for Venkatesh Iyer (sound designer / music producer) and, eventually, other audio people/musicians who join. Real domain, real live site — this repo is the actual production source, not a prototype.

## Current status

**Phase 1 in progress**: converting the site from a static GitHub Pages site into a real Express/Postgres app with login, an admin CMS, and Backblaze B2 file storage — for the one current user first. Multi-user public signup is Phase 2, not started.

## Origin story (why this exists)

The site used to be 100% static (`docs/` folder, served via GitHub Pages, custom domain via `docs/CNAME`). `docs/portfolio/data.js` tried to load project data from a Google Sheets CSV at runtime, falling back to a hardcoded JS array if that failed — an "Excel sheet as CMS" workflow that stopped being workable as the number of projects grew. `docs/portfolio/images/projects/` already has ~24 real, purpose-made poster images worth reusing (not YouTube auto-thumbnails).

Separately, a throwaway prototype was built in a sibling repo (`showreel-builder`) this same session to work out the data model and UI before touching the real site: profiles/tracks schema with `role` + freeform `tags` + `parent_track_id` for nested "album" grouping (e.g. individual songs nested under a film), and a validated public catalog page (hover-play mosaic grid, role-annotation badges on every card, inline lightbox player that swaps tracks without leaving the page). That design is what's being ported in here, for real, with auth and file storage added.

## Stack

Express + EJS + Knex — deliberately **not** a framework rewrite. Server-rendered, so it's fast by default and needs no client-side JS framework. Postgres in production (via `DATABASE_URL`), SQLite locally (`better-sqlite3`) when it isn't set — `knexfile.js` branches automatically.

- **Auth**: email + password, `bcryptjs`, server-side sessions via `connect-session-knex` (backed by an explicit `sessions` table, not auto-created). No public signup route yet — the one account is created via `npm run seed:user`.
- **File storage**: Backblaze B2, S3-compatible API, `@aws-sdk/client-s3` + `@aws-sdk/lib-storage`. Public bucket (no signed URLs in Phase 1). Uploads stream from a multer disk-temp file straight to B2 — never fully buffered in memory, since these are audio/video files.
  - B2-specific gotchas already accounted for in `lib/storage.js`: `forcePathStyle: true`, `requestChecksumCalculation`/`responseChecksumValidation` set to `WHEN_REQUIRED` (newer AWS SDK v3 checksum defaults break against B2), no per-object ACL params (rely on the bucket's own Public setting instead), object keys preserve the original file extension (needed so `lib/sourceType.js`'s `classify()` keeps working unchanged for uploaded files, same as it does for pasted YouTube/Vimeo/direct links).
- **Static passthrough**: `docs/tools/*` (visualizer, keyfinder, youtube — self-contained client-side audio tools) and the landing page stay static, served by this same Express app via `express.static`. Not rebuilt, not touched.

## Data model

- `users` — email/password_hash. One user ↔ one `profiles` row (`profiles.user_id`, unique).
- `profiles` — name, tagline, `bio_long`, `education` (newline-separated), avatar/headshot, contact links. `token` column kept for the legacy anonymous collaborator-add-link flow (unrelated to login).
- `tracks` — one row per project. `source_url` (pasted link or B2 upload URL), `cover_image_url`, `role` (what you actually did — Sound Design / Score / Music Production / Mix & Recording / Film Mix — shown as a small badge on every card), `tags` (comma-separated category — FILM/SERIES/TVC/SHORT FILM/DOCUMENTARY/GALLERY/DIGITAL ADVT/LABS, taxonomy lives in `lib/taxonomy.js`), `parent_track_id` (self-FK — set on the individual pieces of an "album", e.g. each Gangs of Wasseypur song points at the GOW parent track so the public page renders it as one card with a track list, not N separate cards), plus richer metadata fields carried over from the real site's old data (`year`, `collaboration`, `location`, `technical`, `context`, `featured`) that the static site already used but showreel-builder's prototype didn't have.
- `sessions` — connect-session-knex's table, explicit migration (not auto-created).

## Conventions / things not to redo

- Don't reintroduce the Google Sheets CSV loading path — it's the exact workflow this rebuild exists to replace.
- Don't rebuild `docs/tools/*` or the landing page as part of this work — explicitly out of scope for Phase 1.
- Don't buffer uploaded files fully in memory (`multer.memoryStorage()`) — use the disk-temp-then-stream pattern in `routes/admin.js`/`lib/storage.js`. These are real audio/video files, not small form uploads.
- Category taxonomy and role-short-label mapping live in exactly one place (`lib/taxonomy.js`) — used by both the admin form and the public page. Don't duplicate the list.
- Render-specific requirements to keep in place once this deploys: `app.set('trust proxy', 1)`, migrations run via Render's Pre-Deploy Command (not Build Command), `engines.node` pinned in `package.json`. Render's free Postgres tier auto-deletes after 30 days — must be upgraded before this is treated as the real production DB.

## Full PRD

The complete Phase 1 PRD (context, goals, non-goals, architecture decisions, step-by-step sequencing, open items, verification plan) is preserved at `/Users/justmac/.claude/plans/composed-prancing-puppy.md` on the machine this was built on. Summarized above; read that file for the full detail if picking this up fresh.
