# 2w12.one

Audio community platform for Venkatesh Iyer (sound designer / music producer) and, eventually, other audio people/musicians who join. Real domain, real live site — this repo is the actual production source, not a prototype.

## Current status

**Phase 1 code is written and committed** (commit `fd7ed8f`, the only Phase 1 commit; working tree clean). Converting the site from a static GitHub Pages site into a real Express/Postgres app with login, an admin CMS, and Backblaze B2 file storage — for the one current user first. Multi-user public signup is Phase 2, not started.

Verified working (app boots on `node server.js`, routes respond): `/` (static landing), `/portfolio` (dynamic, 200), `/login` (200), `/dashboard` (302 → login when signed out), `/tools/visualizer/` (static passthrough, 200), unknown path → 404 via `views/not-found.ejs`.

Built and in place:

- `migrations/20260907000001_init.js` — the single init migration: `users`, `profiles`, `tracks` (self-FK `parent_track_id`), `sessions`. Applied to the local SQLite DB (`data/2w12.sqlite3`, gitignored).
- Auth: `routes/auth.js` (login/logout), `lib/auth.js` (`requireAuth` loads the owner's profile onto `req.profile`, so admin routes are scoped automatically), `scripts/create-user.js` (`npm run seed:user`).
- Admin CMS: `routes/admin.js` + `views/dashboard.ejs` / `views/track-edit.ejs` — profile/bio editing, track create/edit/delete, paste-link *or* upload-file, parent-track ("album") selection, category checkboxes + role dropdown from `lib/taxonomy.js`.
- Uploads: `lib/storage.js` — multer disk-temp → streamed to B2 → temp file unlinked. Never buffered in memory.
- Public page: `routes/portfolio.js` + `views/portfolio.ejs` + `public/js/portfolio.js` — sectioned-by-tag mosaic, role badges, album piece counts, inline lightbox that swaps pieces without a page load. Also served at `/p/:token` for the legacy/Phase-2 token flow.
- The ~24 purpose-made poster images are preserved at `public/images/projects/` (moved out of `docs/portfolio/`).

Local DB state right now: 1 user (`rnd@frizzon.co`) with a fully populated profile, and **43 tracks** — 32 top-level projects plus 11 nested album pieces (6 Gangs of Wasseypur songs, 5 SoundTrippin segments). 21 have years, 22 have collaboration/technical/location metadata, 15 have an external project link, 15 are featured. All 8 taxonomy sections render.

### Where the content came from (three sources, merged)

**The Google Sheet is NOT dead.** The live site at `https://2w12.one/portfolio/` still renders from it, because the old static build is what's still deployed on GitHub Pages. Its published CSV endpoint is live and public:

```
https://docs.google.com/spreadsheets/d/e/2PACX-1vQOCH8WgkFC85dwlZZw_wkAW_IRUhzIa8859fJjgJ1YJi48fAEe3WMCHvqAE2fNkG_-hITUVvpL4f7J/pub?output=csv
```

(The URL is in git history at `git show fd7ed8f^:docs/portfolio/main.js`. `data.js`'s `loadFallbackData()` only ever held one project, so *that* is not a useful source — but the sheet behind it is.)

Content was assembled from three places, in this order:

1. **`npm run import:showreel`** — the showreel prototype's SQLite DB (`/Users/justmac/w2app/showreel/data/showreel.sqlite3`), 38 tracks. Best source for **roles** (already matching `lib/taxonomy.js`), **album nesting**, and playable YouTube links.
2. **`npm run import:sheet`** — the live Google Sheet, 22 rows. Best source for **everything else**: `year`, `collaboration`, `location`, `technical`, `context`, `featured`, full prose `details`, and the separate IMDb/official project link. It merges onto existing rows rather than duplicating them, matching by **YouTube video id first**, then normalized title, then title prefix, then an explicit `ALIASES` map (the sheet and the showreel DB spell things differently: `Cntrl`/`CTRL`, `Bandits of gollak`/`The Bandits of Golak`, `Tata Safari Campaign` vs `#Untamed Kaziranga Range Edition` — same YouTube link). It also **created the 4 projects that existed only in the sheet**: The Umesh Chronicle (`TUC.png`), Hyundai Kona Electric (`Hyndai.png`), MTV Rush Ep1 (`RUSH.jpg`), Folk 2.0 Documentary (`Folk.png`) — which is what those 4 "orphan" posters belonged to.
3. **Profile details** — recovered from `/Users/justmac/w2app/venkatesh-portfolio/index.html`'s About/Background panels.

Both importers are **idempotent** and **one-off migrations, not live data paths** — don't wire either into the app. Once a project is edited in the CMS, the DB is the source of truth.

### Images

`npm run optimize:images` converts `public/images/projects/*.{png,jpg}` to WebP (via `cwebp`, `brew install webp`), resizes to 900px wide, and repoints every `cover_image_url` at the `.webp`. This took the poster set from **24.91 MB to 0.84 MB (-97%)** — the originals were 1-2 MB PNGs rendering into ~350px cards, which was by far the site's biggest performance problem. **Originals are kept as masters**; re-run after adding new posters.

Cards with no stored cover fall back to `youtubeThumbnail()` at render time, so a project only needs a poster if it isn't a YouTube link.

### Software / Research sections

`npm run seed:software` seeds the Software section from the **real GitHub repos** (descriptions taken from `gh repo list` and the repos' own READMEs, not invented copy):

- **SonifyV1** (`sonifyv.1`, C++) — tempo-synchronized microtonal highway sonification; computer vision to audio.
- **Wall Harp Designer** (`wall-harpDesigner`, JS) — physics simulator/tuning calculator for a 144-string wall harp with dual-capo tuning.
- **Drive Audio Analyzer** (`drive-audio-analyzer`, JS + the `2w12-backend` Python analysis service) — audio analysis for files held in Google Drive.

The same script sets the solo credits. Other repos that could become cards when wanted: `showreel-builder`, `w2samps` (C++ audio plugins), `audio-sampler-v2` (ML sampler), `StyleBureau`.

Three categories were added for this and for work still to come: **SOFTWARE**, **RESEARCH** ("Research & Development" — for papers and write-ups, empty until populated), and **RECORDING** ("Recording & Tracking" — for the recording work not yet entered). Roles gained `Recording & Tracking`, `Concept / Development` and `Research`.

Cards with no poster and no YouTube fallback show a section-appropriate glyph — a code bracket for Software/Research, a music note elsewhere. The three software cards have no artwork yet; GitHub's OpenGraph image (`https://opengraph.githubassets.com/1/venkateshW2/<repo>`) is one option if real screenshots aren't wanted.

### Known content gaps

- **22 rows still have no year** — but those are the nested album pieces plus a couple of projects the sheet didn't cover. All 4 formerly-orphan posters now have years. Dashboard has a "Missing year" filter chip.
- 1 track has neither a cover nor a YouTube fallback.
- `Passage.jpg` is a duplicate of `Passage.png` (the `.png` is the one in use).
- 2 covers were hotlinked to `studio.camp`/`serendipityarts.org`; `npm run media:b2` rehosts them if/when B2 is set up.

### Public page: layout

- **Sidebar** — headshot (falls back to initials, since none is uploaded yet), name/tagline, bio, education, contacts, and the stream player below it. Inter for text, JetBrains Mono for the small uppercase labels; both loaded from Google Fonts.
- **Folder tabs** — sticky category tabs above the grid, in `TAG_ORDER`, with counts. Clicking one filters the grid **in place** so a category never requires scrolling, and scrolls the grid top into view only if it's already above the fold.
- **One flat, deduped grid** — the page used to render a project once per section, which duplicated anything multi-tagged (Passage appeared 3×). Now each project is a single card carrying all its categories in `data-tags`, and the tabs do the filtering. 35 cards, not 40.
- **Shuffle-and-settle animation** — filtering uses FLIP: measure every visible card, apply the filter, measure again, then animate each card from its old rect to its new one (420ms, `cubic-bezier(.22,1,.36,1)`). Newly revealed cards fade and scale in (320ms) instead of popping. Fully skipped under `prefers-reduced-motion`.
- **Stream player** — a single `<audio>` element with a playlist, seek bar, prev/next and click-to-play rows. Only `direct_audio` tracks are eligible; a YouTube link can't be fed to `<audio>`, so those stay in the lightbox. Cards with audio pieces get a **"Send to player"** button that replaces the queue with just that project's tracks. There are **0 streamable tracks right now** — the CNTRL and Schirkoa audio lives in the private `w2MusicStuff` B2 bucket — so the player shows an explicit empty state. It populates itself the moment any track has a reachable audio URL. The `error` handler surfaces a 401/403 from a private bucket rather than failing silently.

### Role badges

`ROLES` in `lib/taxonomy.js` is now the five badge labels themselves — **Sound Design + Mix**, **Score + Stem Mix**, **Stem Mix + Supervision**, **Music Production + Management**, **Developed**. The imported data used nine different spellings across two sources; `ROLE_SHORT` collapses all of them onto those five, so the stored values didn't need rewriting and the page stays consistent. If you add a role, add its `ROLE_SHORT` entry too or the raw string lands on the badge.

### Public page: card UI

`views/portfolio.ejs` is a **card grid**, not the earlier dense mosaic — the old static site's card interaction was deliberately ported back, since it's the thing worth keeping:

- Hover: card lifts 2px, an accent bar sweeps across the top edge, poster scales and brightens.
- **Click anywhere neutral on a card toggles `.expanded`** — CSS `max-height` + opacity transition reveals Collaboration / Technical / Location / Context, the album track list, and the action buttons. The `+` indicator rotates 45° into an ×. `prefers-reduced-motion` disables all of it.
- Clicks on a link, button, or track row **don't** toggle the card (`e.target.closest('a, button, .piece-play')`) — same guard the old `ui.js` used.
- Playing is explicit: the poster's play overlay, or the "Play" button inside the expanded card. Album track rows open the lightbox on that specific piece. Details-only projects (no link at all, e.g. Folk 2.0) just expand.
- `tracks.external_url` (migration `20260907000002`) holds the IMDb/official link behind the "View project" button, kept separate from `source_url`, which is the *playable* thing. The old sheet had both columns and the schema originally only covered one.

### What's left in Phase 1

1. **Headshot** — none exists anywhere on disk or in the DB, so the sidebar shows initials. The profile form now takes a **path or URL** as well as an upload, so dropping a file in `public/images/` and referencing it (`/images/me.webp`) works without B2.
2. **B2 blocked on Backblaze's side** — the public-bucket payment gate is failing with "error code 2": money is being deducted with nothing applied to the account. Support ticket open as of 2026-09-07. Nothing in this repo can fix that, and nothing needs to: uploads fail until B2 is configured, pasting links works fine, and the poster set is 0.84 MB served straight from `public/`. Don't spend time on B2 wiring until the account is sorted.
3. **Not deployed.** No `render.yaml`/`Procfile`; nothing has run against Postgres yet. `trust proxy` and `engines.node` are in place; still to do: Render service + Postgres, env vars, migrations as **Pre-Deploy** Command, and repointing the domain off GitHub Pages (which is still serving the old static site — that's why the sheet still appears to "work").
4. Tailwind still loads from `cdn.tailwindcss.com` — fine for now, not a production setup.

## Backblaze B2 setup

Nothing about B2 is guessable from the code, so the exact steps:

1. **Create the bucket** — B2 dashboard → Buckets → Create a Bucket. Files in Bucket: **Public** (Phase 1 serves objects directly, no signed URLs). Name it something unique, e.g. `2w12-media`.
   - Flipping a bucket from Private to Public asks for a card: *"A payment history is required, or pay a one-time fee ($1.00 + appl. taxes) that is credited to your account."* This is Backblaze's **anti-abuse gate**, not a storage charge — public buckets are what spammers use for free file hosting, so they want any prior payment on the account. The $1 is **credited back to the account balance**, and it is one-time. Storage itself stays free under 10 GB.
   - The existing `w2MusicStuff` bucket (1.4 GB, 32 files, `s3.us-east-005.backblazeb2.com`) is Private. Either flip it to Public or make a separate public bucket for web media and keep that one private — a separate bucket is cleaner, since everything in a public bucket is world-readable by URL.
2. **Create an application key** — App Keys → Add a New Application Key. Scope it to *just that bucket*, with Read and Write. You get `keyID` + `applicationKey`; **the key is shown once**.
3. **Read the endpoint off the bucket** — the bucket page shows an S3 endpoint like `s3.us-west-004.backblazeb2.com`. The region is the middle segment of that host (`us-west-004`) and must match exactly.
4. **Fill in `.env`** (copy `.env.example`):
   ```
   B2_KEY_ID=<keyID>
   B2_APP_KEY=<applicationKey>
   B2_BUCKET=2w12-media
   B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
   B2_REGION=us-west-004
   ```
   `B2_PUBLIC_BASE_URL` stays unset unless a CDN/custom domain fronts the bucket. Restart the server; the dashboard's amber banner disappears.
5. **Migrate the existing media** — `npm run media:b2 -- --dry-run` first, then `npm run media:b2`.

### Bucket layout

`routes/admin.js`'s `folderFor()` and `scripts/media-to-b2.js` together produce:

```
audio/<uuid>.wav             CMS uploads, by mimetype
video/<uuid>.mp4
images/<uuid>.png            cover/headshot uploaded through the CMS
files/<uuid>.<ext>
images/projects/<Name>.png   posters migrated from public/images/projects/ (filename preserved)
images/covers/<slug>.jpg     covers pulled down from third-party hosts, keyed by project slug
```

CMS uploads get a random UUID key (no collisions, no filename leakage). The migration script instead uses **stable keys derived from the filename or project slug**, which is what makes `npm run media:b2` safely re-runnable: a second pass overwrites the same object and leaves the DB URL unchanged, rather than orphaning the first upload. Every key keeps its original extension — `lib/sourceType.js`'s `classify()` reads the extension to decide how to play a file.

Tracks and images stay decoupled: `tracks.source_url` is the playable thing (a pasted YouTube/Vimeo/SoundCloud link, or a B2 URL for an uploaded file) and `tracks.cover_image_url` is the still image. Either can be a B2 URL, an external URL, or a root-relative local path like `/images/projects/GOW.png` — all three work, and the cover can be left empty for YouTube sources since the thumbnail is derived at render time.

## Origin story (why this exists)

The site used to be 100% static (`docs/` folder, served via GitHub Pages, custom domain via `docs/CNAME`). `docs/portfolio/data.js` tried to load project data from a Google Sheets CSV at runtime, falling back to a hardcoded JS array if that failed — an "Excel sheet as CMS" workflow that stopped being workable as the number of projects grew. `docs/portfolio/images/projects/` already had ~24 real, purpose-made poster images worth reusing (not YouTube auto-thumbnails) — they now live at `public/images/projects/`.

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
- `tracks.external_url` — the IMDb/GitHub/official project page, kept separate from `source_url` (the *playable* thing). Drives the card's "View project" button.
- `tracks.solo_credit` / `tracks.credit_note` — flags work where **every sound department was handled solo**, which is a materially different claim from one credit among many and so gets a flag rather than being buried in the freeform `role` text. Currently set on Folk 2.0 Documentary (also the Masters thesis project), A Passage Through Passages, and A Terrible Beauty. Renders as a "Solo · All departments" badge, a persistent accent edge on the card (not hover-only), and the full `credit_note` at the top of the expanded details.
- `sessions` — connect-session-knex's table, explicit migration (not auto-created).

## Conventions / things not to redo

- Don't reintroduce the Google Sheets CSV loading path — it's the exact workflow this rebuild exists to replace. (The sheet itself is gone; the project list now lives in `tracks`, seeded by `npm run import:showreel`.)
- Don't re-run `import:showreel` expecting it to refresh content from the showreel repo as a live source — it's a one-off migration. Once a project is edited in the CMS, the DB is the source of truth.
- Don't rebuild `docs/tools/*` or the landing page as part of this work — explicitly out of scope for Phase 1.
- Don't buffer uploaded files fully in memory (`multer.memoryStorage()`) — use the disk-temp-then-stream pattern in `routes/admin.js`/`lib/storage.js`. These are real audio/video files, not small form uploads.
- Category taxonomy and role-short-label mapping live in exactly one place (`lib/taxonomy.js`) — used by both the admin form and the public page. Don't duplicate the list. `TAG_ORDER` also controls **section order** on the public page; a section only renders if it has tracks, so adding a category doesn't create an empty heading.
- Render-specific requirements to keep in place once this deploys: `app.set('trust proxy', 1)`, migrations run via Render's Pre-Deploy Command (not Build Command), `engines.node` pinned in `package.json`. Render's free Postgres tier auto-deletes after 30 days — must be upgraded before this is treated as the real production DB.

## Full PRD

The complete Phase 1 PRD (context, goals, non-goals, architecture decisions, step-by-step sequencing, open items, verification plan) is preserved at `/Users/justmac/.claude/plans/composed-prancing-puppy.md` on the machine this was built on. Summarized above; read that file for the full detail if picking this up fresh.
