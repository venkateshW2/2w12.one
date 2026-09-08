# 2w12.one

Audio community platform for Venkatesh Iyer and the other audio people in the group. Real domain, real live site — this repo is the actual production source.

## What this is, in one line

**A static site whose content is a folder of files in this repo, edited through a browser CMS that commits to GitHub.** No server, no database, no monthly bill.

## Architecture

```
Sveltia CMS  (browser, at /admin — logs in with GitHub)
     │  edits data/ (profile, one file per project) + commits images
     ▼
GitHub repo  (the content IS the repo)
     │  push triggers a build
     ▼
Static build (renders every page to HTML)
     │
     ▼
Cloudflare Pages  (global CDN, $0)

SoundCloud — private sets stream the audio; nothing large lives in the repo
```

| Concern | How it's handled | Cost |
|---|---|---|
| Hosting | Cloudflare Pages | $0 |
| Content store | the `data/` folder in this repo | $0 |
| Editing UI | Sveltia CMS at `/admin` | $0 |
| Logins | GitHub repo collaborators + a `sveltia-cms-auth` Worker | $0 |
| Images | committed to `public/images/` | $0 |
| Audio | private SoundCloud sets, played through their widget | $0 (3h upload cap) |
| Large video (later) | Cloudflare R2 — Sveltia integrates with it directly | ~$0 |

**There is no user table, no session store, no invite flow and no password anywhere.** Sveltia has no auth of its own by design — it "relies on the Git backend for user authentication and access control". A login *is* write access to this repo. Add a collaborator in GitHub → they can edit. Remove them → they can't. That is the whole access model; don't rebuild one.

### Why static

The site is a portfolio plus a shared page per person. It has no feature that needs a request-time server: no comments, no uploads from the public, no per-visitor state. Everything dynamic that was planned — sending files, collecting timestamped feedback on mixes — is being built separately, not here.

The measured content is **0.10 MB** and a full page visit is **~1 MB**. Any always-on server for that is paying for its own existence.

### The one trade-off

Saving in the CMS is a git commit, so **an edit takes ~40s to appear live** rather than being instant. That's the price of having no server. It's fine for a portfolio; it would not be fine for anything conversational.

## Live setup — the real values

| | |
|---|---|
| Site | <https://2w12.one> — Cloudflare Pages project **`2w12-one`**, also at `2w12-one.pages.dev` |
| Build | `npm run build` → `dist`, `NODE_VERSION=24`, production branch `main` |
| **Shareable link** | **`https://2w12.one/@venkatesh`** — it's just the handle; there is no dashboard to copy it from |
| CMS | <https://2w12.one/admin> — **no link to it anywhere in the public UI**, reached by typing the URL |
| CMS auth relay | `https://sveltia-cms-auth.w2-dc4.workers.dev` (Cloudflare Worker, free tier) |
| Worker vars | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (secret), `ALLOWED_DOMAINS` |
| DNS | Cloudflare — nameservers `keanu` / `maeve.ns.cloudflare.com`; registrar is Squarespace |
| Email | Google Workspace on this domain — 5 MX + SPF + DKIM, all in Cloudflare DNS |
| Editors | GitHub collaborators on `venkateshW2/2w12.one` |
| Cost | **$0/month** |

**There is deliberately no "Login" or "Edit" item in the nav.** Sveltia authenticates against GitHub, so hiding the link protects nothing — but showing one tells a client there's a back office and invites them to try it. Bookmark `/admin` instead. Don't re-add it to the nav.

### DNS: the mistake that took the domain down

Moving nameservers to Cloudflare broke the whole domain — website **and email** — for a while, and it's the one failure worth never repeating.

The domain already had **DNSSEC** enabled from its Google DNS setup, which publishes a `DS` record at the registry: a fingerprint saying *only trust answers signed by these keys*. Point the domain at new nameservers and those keys no longer match, so every validating resolver returns SERVFAIL for everything — MX included. The symptom is `DNSKEY Missing: no SEP matching the DS found`.

**Before any nameserver move: `dig DS <domain>` and disable DNSSEC at the registrar if anything comes back.** A `DS` record does **not** appear in a normal record listing, which is exactly why the pre-flight check missed it. Re-enable afterwards from the *new* provider's side: enable DNSSEC in Cloudflare → it issues a DS record → add that at the registrar. Never the other way round.

Two smaller things from the same migration:

- **Cloudflare's DNS scan misses records.** It imported 13 of 15 — it dropped `api.2w12.one` (a live service on another host) and the `k2ibe27i4e5y` Google-verification CNAME. Compare against the old provider's list by hand.
- **Verification and mail records must be `DNS only`**, never proxied. Proxying a verification CNAME makes Cloudflare answer with its own IPs and the verification fails.

## Content model

The `data/` folder is the single source of truth, and it is exactly what the CMS
edits:

```
data/profile.json          the person — bio, links, handle, headshot
data/projects/<slug>.json  one file per project (46 of them)
data/status.json           the landing page's status lines
data/gallery.json          loose images and video
```

**One file per project on purpose.** A single JSON blob holding 46 projects
would give the CMS one enormous form with a 46-item list widget; a folder gives
a searchable list with per-project edit pages — the shape a CMS is for.
Filenames are the slugified title. A project file:

```json
{
  "title": "Schirkoa: In Lies We Trust",
  "year": 2023,
  "role": "Music Production + Score",
  "tags": ["FILM", "RECORDING"],
  "cover_image_url": "/images/projects/Schirkoa.webp",
  "source_url": "https://www.youtube.com/watch?v=pTHbdXAZcPU",
  "external_url": "https://schirkoamovie.com/",
  "description": "...",
  "collaboration": "Dissidenz, Red Cigarette Media",
  "location": "Mumbai",
  "technical": "Instrument Design,Sampling,VocalDesign,Score Edit",
  "context": "",
  "featured": true,
  "hidden": false,
  "solo_credit": false,
  "credit_note": "",
  "sort_order": 100,
  "parent_title": ""
}
```

`profile.json` is a flat object of the fields listed in the CMS config.
`status.json` is `{ "lines": [{ label, body, note, sort_order }] }` and
`gallery.json` is `{ "items": [{ url, kind, caption, scope, sort_order }] }`.

Current contents: **46 tracks** — 35 top-level projects plus 11 nested album pieces (6 Gangs of Wasseypur songs, 5 SoundTrippin segments) — 17 featured, 18 pinned, 1 hidden, 3 solo credits, 4 status lines.

Field notes:

- **`parent_title`** nests album pieces under a parent by title, not id. Titles are the keys throughout, because ids are meaningless in a file.
- **`source_url`** is the *playable* thing; **`external_url`** is the IMDb/official/GitHub page behind "View project". Keep them separate.
- **`audio_url`** is the SoundCloud set or track that feeds the sidebar player — a **third** concern, not a replacement for `source_url`. Schirkoa has a YouTube trailer in `source_url` *and* a private set in `audio_url`: **Play** opens the trailer, the card opening loads the album. Paste the whole `src="…"` from SoundCloud's Share ▸ Embed box; the build pulls the resource back out of it, so nothing has to be hand-assembled and the secret token survives.
- **`role` is the badge text, verbatim.** Free text, no lookup table — what's typed is what the card shows. Empty means no badge. The five in use: Sound Design + Mix, Score + Stem Mix, Stem Mix + Supervision, Music Production + Management, Developed — plus hand-typed ones like "MultiChannel Mix", "Sound Design + Atmos Mix".
- **`tags`** is a **list** in the files (so the CMS offers checkboxes) and joined to a comma string for the templates. It drives the section tabs and their order.
- **`hidden`** takes a project off the site without deleting it. **A hidden parent hides its nested pieces too**, or an album loses its card but keeps feeding the lightbox.
- **`solo_credit` / `credit_note`** flag work where every sound department was one person — a materially different claim from one credit among many, so it gets a flag rather than being buried in `role`. Set on Folk 2.0 Documentary (also the Masters thesis project), A Passage Through Passages, and A Terrible Beauty.
- **`sort_order`** pins a card; page order is pinned → featured → newest → title.

### Category taxonomy

In order, which is also the order the section tabs appear:

`FILM · SERIES · TVC · DIGITAL ADVT · SHORT FILM · DOCUMENTARY · RECORDING · GALLERY · SOFTWARE · RESEARCH · LABS`

A section only renders if something is tagged with it, so an unused category costs nothing. RESEARCH is deliberately empty, waiting on papers and write-ups.

## Where the content came from

Three sources, merged once. Neither importer is a live data path — the JSON is the source of truth now.

1. **The showreel prototype's SQLite DB** (`/Users/justmac/w2app/showreel/data/showreel.sqlite3`), 38 tracks. Best source for roles, album nesting, playable links.
2. **A Google Sheet**, still published as CSV, which the *old* static site rendered from:
   `https://docs.google.com/spreadsheets/d/e/2PACX-1vQOCH8WgkFC85dwlZZw_wkAW_IRUhzIa8859fJjgJ1YJi48fAEe3WMCHvqAE2fNkG_-hITUVvpL4f7J/pub?output=csv`
   Best source for year, collaboration, location, technical, context, featured, prose descriptions and the separate project link. Matching it to the showreel data needed **YouTube video id first**, then normalized title, then an alias map — the two spell things differently (`Cntrl`/`CTRL`, `Bandits of gollak`/`The Bandits of Golak`, and `Tata Safari Campaign` vs `#Untamed Kaziranga Range Edition`, which are the same video). It also supplied the four projects that existed nowhere else: The Umesh Chronicle, Hyundai Kona Electric, MTV Rush Ep1, Folk 2.0 Documentary.
3. **Profile text** recovered from `/Users/justmac/w2app/venkatesh-portfolio/index.html`'s About/Background panels.

Software cards came from the **real GitHub repos**, descriptions taken from `gh repo list` and the repos' own READMEs: **SonifyV1** (`sonifyv.1`, C++ — computer vision to MIDI/OSC), **Wall Harp Designer** (`wall-harpDesigner` — 144-string physics simulator, live demo at `venkateshw2.github.io/wall-harpDesigner/`), **Drive Audio Analyzer**. Other candidates: `showreel-builder`, `w2samps`, `audio-sampler-v2`, `StyleBureau`.

### Known gaps

- 22 rows have no year — mostly the nested album pieces.
- Drive Audio Analyzer has no artwork and is currently `hidden`.
- `Passage.jpg` duplicates `Passage.png` (the `.png` is in use).
- Two covers were hotlinked to `studio.camp`/`serendipityarts.org`.

## The company copy — what it must not say

2w12.one is **not a studio** and must not be described as one; that framing was rejected outright. It's a **group of individuals** who share work, work on each other's, and build what a project needs. Two things carry equal weight and neither gets dropped: **custom instruments** (pipe instruments built and sampled for a composer on a Netflix series, out December 2026) **and custom software for artists**. Most of the work has not been commercial, but the site should still read as open to commissions — hence the quiet "Open to commissions and collaborations" line rather than a pitch.

**Don't claim a single location** — the group isn't all in Mumbai. Tagline is **"The Sound Thing"** with **"All Things Sound"** beneath it. ("SOUND THINGS" was the old static site's.)

Client-facing wording: **never show the word "portfolio"**. The header menu says **Team**, and picking a person opens their page.

## Pages

- **`/`** — wordmark, the two taglines, the spectral fingerprint, and the self-typing terminal. Nothing else.
- **`/@handle`** — a person's page. `/@venkatesh`. Category tabs, cards, sidebar with bio/links.
- **`/work`** — the group's work as a company, distinct from individual pages. Marked **coming soon**.
- **`/gallery`** — the group's gallery. **`/@handle/gallery`** — an individual's, back-linking to their page.
- **`/tools/*`** — the three self-contained browser audio tools (visualizer, keyfinder, youtube). Static already, untouched.
- **`/admin`** — Sveltia CMS.

Header menu is the only navigation surface: wordmark, a **Team** dropdown listing each person, Work, Gallery, a **Tools** dropdown, and an accent rule marking the current section. Dropdowns are **click-to-open, not hover** — hover menus are unusable on touch. Collapses to a burger below `md`.

## Landing page — decisions not to re-litigate

Five layouts were tried. Recording them so none gets re-attempted:

1. 1152px column + narrow rail + 11px type — cramped, read as an app screen.
2. Full-width numbered accordion — read as a stock template, and it dropped the tagline.
3. Sidebar restored at larger scale — duplicated the header nav.
4. Centered hero with a copy paragraph, CTA buttons, stats and a portfolios list — too much, and the copy was placeholder-grade.
5. **Current:** wordmark + tagline + self-typing terminal, nothing else.

### The glitch — and how it went wrong

**Slice displacement.** Two `::before`/`::after` copies sit **on top** of the text, painted with the page background (`#0c0c0c`) so they occlude what's beneath, clipped to `inset(50% 0 50% 0)` — collapsed to nothing — except on a slip frame, when a copy is clipped to a thin band, shoved sideways, and given a one-sided magenta/cyan `text-shadow`. A band of the word jumps while the rest holds still.

**The earlier version was wrong:** it parked the coloured copies *behind* the text with `z-index: -1/-2`, so the fringes showed permanently and it read as a coloured overlay, not a glitch. If it ever looks like a drop shadow again, that's the bug. **Chromatic offsets must appear only on slip frames, never at rest.**

Two intensities: `.glitch` (landing wordmark) slips several times a cycle; `.logo-glitch` (nav) uses the same technique roughly once every 7–9s. Don't make the nav heavier — a permanently glitching header reads as a broken page. All of it off under `prefers-reduced-motion`.

### The terminal

Types `$ cat status`, then each status line character by character, with scrambled characters at the head of the cursor so lines look like they're *resolving*. The cadence is uneven — fixed intervals read as a progress bar — with brief catches at punctuation and the occasional stall. When it finishes the cursor parks on a trailing `$` prompt, and prompt and cursor blink on the same 1.05s beat (the prompt dips to 28% rather than 0, so they read as one caret). A `live` LED pulses on a slower 1.9s cycle. It should never look like a finished screenshot.

Rows are `display:none` and revealed one at a time inside a **bottom-anchored** (`justify-end`) container with a reserved `min-height`, so each row appears at the bottom and pushes the earlier ones up, the way a terminal scrolls. **`visibility:hidden` does not work** — it reserves space, so nothing moves.

Line text is rendered **in the HTML** and the script empties and retypes it, so no-JS and reduced-motion get the full content immediately.

**No window chrome.** An earlier version wrapped it in a fake terminal window — border, title bar, traffic-light dots, scanlines — which read as a gimmick. Don't re-add it.

### The spectral fingerprint (still a prototype)

`public/js/fingerprint.js` — a **constellation map**: spectral peaks as time × log-frequency, with anchor→target pair lines and a slow scan line, in Canvas 2D. Placed above the title as a wide, short strip (820 × 58px, ~1050 peaks).

**The point set is generated, not measured** — a deliberate fake to test the direction. What makes it read as data rather than decoration is that its *structure* matches real peak-picking: **harmonic stacks** at f0/2f0/3f0 compressing on a log axis, **onsets** as broadband vertical smears, **sustains** as decaying horizontal runs, a **sparse noise floor** (real peak-picking always leaves scattered survivors; a field without them looks synthetic), and **anchor→target pair lines**, the relationship a Shazam-style fingerprint hashes.

The PRNG seed is **fixed** — a field that re-randomises each visit reads as arbitrary; a stable one reads as a measurement of a specific thing. Peaks are cool steel-cyan while the scan line keeps the brand amber; the contrast is what makes it read as instrument data. `PEAK` at the top of the file swaps the palette in one line.

**To make it real:** replace `buildPeaks()` with a precomputed JSON of peaks from an actual 2w12 recording, analysed offline, and leave the renderer alone. Specific data is the one thing generic output can't imitate.

Rejected on the way here: an oscilloscope (3 traces, then 1), a DAW-style bar waveform, and a physics-accurate propagating wave packet — all dropped because **they encode nothing**. A sine sum has no relationship to any real sound and anyone who works with audio reads that as decoration instantly. Don't reintroduce a synthetic waveform.

## Cards

**Output in a template is escaped.** The category line joined names with the
string `&middot;`, which rendered as the literal characters `&middot;` on every
multi-category card. Use the actual `·` character, not an HTML entity, inside
`<%= %>`.


- Hover: card lifts 2px, an accent bar sweeps the top edge, poster scales and brightens.
- **Clicking anywhere neutral toggles `.expanded`**, revealing Collaboration / Technical / Location / Context, the album track list and the actions. The `+` rotates 45° into an ×.
- Clicks on a link, button or track row **don't** toggle the card.
- **Grid needs `items-start`.** A grid row defaults to `align-items: stretch`, so expanding one card grew the row and stretched its neighbours — which looked like every card in the row had opened.
- **Uniform size** comes from the card, not the row. `.card-head` — the block holding the meta row, title, role and blurb — has a **fixed `8rem` height and clips**; the details panel sits outside it so expanding can still grow the card. A `min-height` was tried first and isn't enough: it's only a floor, so a two-line title or a longer blurb pushed a card past its neighbours.
- **The details panel animates `grid-template-rows: 0fr → 1fr`**, which resolves to the content's exact height. `max-height: 0 → 640px` looked like it stalled, because content shorter than 640px finished early and the rest of the duration did nothing.
- **The blurb stays clamped at two lines.** It used to unclamp on expand with `transition: -webkit-line-clamp` — not an animatable property, so it snapped and shunted everything below it mid-animation.
- **No play overlay.** It used to appear on any card with a URL, but 10 of 34 point at IMDb or GitHub and can't play. Playback is an explicit button inside the expanded card, shown **only** for genuinely embeddable sources (YouTube, Vimeo, direct audio/video, SoundCloud); external links get "Open ↗"; a card with no source just expands.
- Category tabs filter **in place** so a category never needs scrolling, animated with **FLIP** — measure every visible card, apply the filter, measure again, animate each from its old rect to its new one (420ms). Newly revealed cards fade and scale in. Skipped under reduced-motion. The tab strip gains chevrons and edge fades only when it actually overflows.

## The sidebar player and SoundCloud

Audio streams from **private SoundCloud sets**, played through SoundCloud's own
widget in a hidden iframe that the sidebar UI drives via the **Widget API**. The
visitor never sees a SoundCloud player.

**Why not a direct file.** SoundCloud's real audio URL is signed and expiring
and needs an API `client_id`; registration has been closed for years. So it can
never be fed to `<audio>` — the widget is the only route. Google Drive is the
same story for a different reason: the share link is an HTML page, and the
`uc?export=download` form sends no CORS header and no `Range` support, so
seeking is impossible even when playback starts. Drive would need a credentialed
proxy doing Range passthrough; `api.2w12.one` (still missing from DNS after the
nameserver move) was the candidate host.

**"Private" here means unlisted.** The secret token has to be in the published
HTML for the widget to play it, so anyone who views source can listen. No
download button, not searchable, but not secret. Fine for showreel material;
not for unreleased client stems.

Four things that each broke this, none of which threw an error:

- **`SC.Widget()` cannot bind to an `about:blank` iframe.** It talks to the
  player over `postMessage`, so the iframe must *already be* a SoundCloud player
  before it is wrapped. The boot is therefore two steps: set `frame.src` to the
  player URL, wait for `load`, *then* wrap and bind.
- **`widget.load()` takes the resource URL, not the player URL** — the playlist
  URL from inside the player URL's own `url=` param. Handing it the player URL
  loads nothing at all, silently. This only showed up on the *second* album,
  because the first one arrives via the iframe's `src`, which does want the
  player URL.
- **`getSounds()` is lazy.** It returns title-less placeholder objects for
  sounds SoundCloud has not hydrated yet, so an empty answer usually means "not
  yet". It retries 6× at 400ms. Without that, the one-row fallback disguised the
  `load()` bug above as a data problem.
- **The hidden iframe must not be `display:none`** — that can stop the widget
  initialising, the same trap as the landing terminal's rows. It is positioned
  off-screen instead.

### The player's shape, and why

- **The sidebar is a library, not one album's transport.** Every album's header
  is always listed and expands into its tracks. It only holds *one album's*
  tracks at a time because the widget holds one resource at a time — clicking
  the album that is already playing therefore just folds the list away rather
  than reloading it, so collapsing never interrupts playback.
- **Track names come from SoundCloud at runtime**, so the build cannot know
  them or count them. That is why the card badge reads `♪ AUDIO` rather than
  `6 TRACKS`, and why the count only appears on an album header once opened. If
  the raw upload names ever need overriding, they have to move into `data/`.
- **No player inside the card.** It was tried in discussion and rejected:
  collapsing a card animates `grid-template-rows` to `0fr` but leaves the iframe
  in the DOM, and `filterTo()` strips `.expanded` from *every* card on a
  category change — so switching tabs would leave audio playing from a player
  nobody can see or stop. The transport staying outside the card is also what
  lets playback survive browsing, which is the whole point of having one.
- **Below `md` the player is a bar pinned to the bottom**, appearing only once
  something is loaded. The sidebar stacks *above* the grid at that width, so the
  player used to sit on top of 34 cards and every card tap scrolled the page
  back up and away from the card just opened. The player's `scrollIntoView` was
  deleted outright: it is sticky on desktop and pinned on mobile, so there is
  nothing to scroll to.

## Images

`npm run optimize:images` converts `public/images/**.{png,jpg}` to WebP via `cwebp` (`brew install webp`), resizes to 900px wide, and rewrites the paths it finds. This took the poster set from **24.91 MB to 0.84 MB (−97%)** — the originals were 1–2 MB PNGs rendering into ~350px cards, by far the biggest performance problem the site had. **Originals are kept as masters.** Re-run after adding posters.

Cards with no stored cover fall back to the YouTube thumbnail, so a project only needs artwork if it isn't a YouTube link.

## Where the assets live

Everything is in this repo and served by Cloudflare Pages from the build. There
is no object storage in the picture yet.

| | Path | Size |
|---|---|---|
| Content | `data/` | ~200 KB |
| Images the site serves | `public/images/**.webp` | **1.0 MB**, 26 files |
| Originals, kept as masters, never served | `public/images/**.{png,jpg}` | **29.3 MB**, 28 files |
| Git history | `.git` | ~34 MB |

CMS uploads commit into `public/images/projects/`. The gallery is currently
**empty** — `data/gallery.json` has zero items.

GitHub's limits are 100 MB per file and roughly 1 GB per repo, so images have
plenty of headroom. **Audio and video do not** — a few GB of stems would exceed
what a git repo should hold, and every version stays in history permanently.
That is what **R2** is for: Sveltia uploads to it directly, so the media lives
there while only its URL lives in `data/`. Set that up *before* adding the
CNTRL/Schirkoa material, not after.

## Share cards (Open Graph)

This is what makes a pasted link render as a card in WhatsApp/Slack/iMessage instead of a bare URL — the whole point of handing someone `/@venkatesh`.

`npm run make:og` builds it: a **6×4 mosaic of the project posters in page order**, darkened 58% with a left-to-right scrim, and the wordmark, name, tagline, handle and project count over it. 1200×630, ~95 KB, committed. Re-run after curating, since the mosaic follows pin/feature/hidden order.

Why a mosaic rather than the headshot: a headshot says *who*, a wall of film posters says *what*, and on a link sent to a client the second lands harder.

Five things that each broke this, none of which failed loudly:

- `og:image` must be an **absolute** URL.
- Pointing it at the headshot itself failed silently — the original is 2448×3264 and **3.6 MB**, and WhatsApp skips images that large. Title and description rendered; the image didn't. Keep cards **under ~300 KB**; `make:og` warns past that.
- `-gravity` **persists across an ImageMagick command**. It was left at `north` from the mosaic's `-extent`, which centred every `-annotate` instead of left-aligning it.
- `gradient:` only renders **top-to-bottom**. A left-to-right scrim must be built tall and `-rotate 270`'d, or it composites invisibly and the text sits unreadable over the artwork.
- Chat apps **cache a preview against the exact URL and never re-check**. Force a refresh with [Facebook's Sharing Debugger](https://developers.facebook.com/tools/debug/) → *Scrape Again* (WhatsApp shares that crawler cache), or share `?v=2`. `og:image` also carries `?v=<mtime>` so a regenerated card is fetched fresh.

## Email signature

`npm run make:signature` builds an animated glitching wordmark and the
paste-able signature HTML sits in `docs/email-signature.html` (two variants,
dark card and light badge, with per-client paste instructions).

**Motion in email means a GIF and nothing else.** Every client strips
`@keyframes`, so the site's CSS glitch cannot travel. The GIF reproduces the
same slice-displacement technique frame by frame, and the same rule holds:
chromatic offsets on slip frames only, never at rest.

- **Frame 0 is deliberately the clean wordmark.** Outlook on Windows renders
  GIFs through Word and shows *only the first frame*, so the worst case degrades
  to a correct static logo rather than a frozen slip.
- **The wordmark's background cannot be transparent.** The glitch works by
  painting displaced copies with the background so they occlude what is beneath
  — that is the technique, not a shortcut. Hence the dark card, where there is
  no seam.
- **Intermediates are MIFF, not PNG.** A white word on a black ground is pure
  grey, so PNG's encoder writes it as Grayscale — it re-detects type on write
  and ignores `-type` — and compositing the magenta fringe onto a greyscale base
  discards every trace of colour. The glitch rendered perfectly and came out
  black and white. This failed silently twice.
- **Write negative offsets as `-5+29`, not `+-5+29`.** ImageMagick geometry
  built by string interpolation produces the latter.
- The wordmark is real **Inter ExtraBold**, in `assets/fonts/`, instanced from
  Google's variable Inter with `fontTools` so it matches the site's face. Kept
  in the repo so the script needs no network.
- **`optimize:images` must never touch `public/images/email/`.** Its `DIRS` is
  an explicit allowlist and the email folder is not in it — leave it that way. A
  WebP wordmark would silently stop rendering in most mail clients.
- An email refetches that URL forever. **Moving the GIF's path breaks every
  signature already sent.**

## Handles

Each person's page is **`/@handle`** — `2w12.one/@venkatesh`. Handles default to the first name.

The **`@` prefix is deliberate**: a bare `/venkatesh` would compete with every real and future top-level path, and would have to be the last route registered. With `@` it can shadow nothing. `lib/slug.js`'s reserved list therefore only keeps handles sensible (no `/@admin`), rather than protecting routing.

## The CMS

`admin/index.html` loads Sveltia CMS from a CDN — one client-side script, no
build step — and `admin/config.yml` declares what it edits. Saving commits to
`main`, which rebuilds the site. **An edit is live in ~40s, not instantly.**

- **Projects** — searchable list of all 46, one form each, with filters for
  Featured / Hidden / Solo credit and sorting by title, year or pin.
- **Site → Profile / Landing status lines / Gallery** — the single files.
- Uploads go to `public/images/projects` and are referenced root-relative,
  which is what the templates expect.

`backend.base_url` must point at a deployed `sveltia-cms-auth` Worker; a
browser-only app can't do GitHub's OAuth secret exchange alone. `DEPLOY.md` has
the steps.

**Adding an editor is a GitHub collaborator invite.** Write access is the login.

Two things the CMS can't do, which stay local commands: `npm run make:og` after
re-ordering (the mosaic follows pin/feature/hidden order) and
`npm run optimize:images` after adding artwork.

## What's in the repo

```
data/            the content — profile, one file per project, status lines, gallery
views/           EJS templates the build renders
lib/             taxonomy, source-type detection, slug rules
scripts/         build-static, preview, make-og-card, optimize-images
admin/           the CMS page and its config
public/          images and client JS, copied into the build
docs/tools/      the three browser audio tools, untouched
dist/            build output (gitignored)
```

`ejs` is the only dependency. The Express/Knex/Postgres server, its routes,
migrations, session store, admin panel, invite flow and the database scripts
were all removed at cutover — the site needs none of it.

## Conventions

- **Don't reintroduce the Google Sheets CSV loading path** — the sheet-as-CMS workflow is what this rebuild exists to replace.
- **Don't re-run the importers** expecting fresh content. They were one-off migrations; the `data/` folder is the source of truth.
- **Don't rebuild `docs/tools/*`** — self-contained and out of scope.
- **Category taxonomy lives in exactly one place** and is used by both the CMS config and the pages. Don't duplicate the list.
- **Anything editable must be data, not code.** The status lines, badges, tags, copy and ordering all live in `data/` precisely so a change doesn't need a developer. The recurring mistake through this project was state existing only where someone typed it — four separate times. If it's content, it goes in the file.
- **Validate generated assets.** A broken shader mounts nothing and looks identical to a disabled effect; an oversized OG image renders no preview and reports no error. Both were found only by checking output, not by the code running without throwing.

## Still to do

1. **Only one person has a page.** The group's other members need `profile.json`-equivalents; the content model assumes one profile today, so adding a second means the build looping over profiles rather than reading one file.
2. **22 tracks have no year** — mostly nested album pieces.
3. **Drive Audio Analyzer has no artwork** and is `hidden` because of it.
4. **The fingerprint is still synthetic** — see above for what would make it real.
5. **`/work` is a coming-soon page.**
6. **Audio is on SoundCloud, and its ceiling is 3 hours.** B2 and R2 were both blocked by card payments failing, so private SoundCloud sets host the audio instead — see the player section. Schirkoa and CTRL are up. Past 3 hours of total uploads it becomes SoundCloud Pro (~$12/mo) and stops being $0, which is the point to revisit R2.
7. **`ALLOWED_DOMAINS` on the Worker still includes `*.pages.dev`** from testing. Trim to just `2w12.one`.
8. **A DMARC record** would complete the email setup — SPF and DKIM are in place, `_dmarc` was never set.
