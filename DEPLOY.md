# Deploying 2w12.one

Static site on Cloudflare Pages, edited through Sveltia CMS, authenticated by
GitHub repo access. Total cost: **$0**.

Three things need your accounts, so they can't be scripted:

1. A GitHub OAuth app + the auth Worker — so the CMS can log you in
2. The Cloudflare Pages project — so the site builds and serves
3. The DNS change — so `2w12.one` points at it

Do them in that order. Nothing on Render is touched until step 4.

---

## 1. The GitHub login relay

Sveltia CMS runs entirely in the browser, and a browser can't complete GitHub's
OAuth secret exchange on its own. It needs a tiny relay — one Cloudflare Worker,
free tier, deployed once and then forgotten.

**a. Deploy the Worker** — done.

`https://sveltia-cms-auth.w2-dc4.workers.dev`

Useful check: opening `<worker-url>/auth` returns a small script containing
`trustedPatterns` and `hasToken`. Empty patterns means `ALLOWED_DOMAINS` isn't
set; `hasToken = false` means the client credentials aren't. Both should change
once step c is done.

**b. Register a GitHub OAuth app**

- GitHub → Settings → Developer settings → **OAuth Apps** → **New OAuth App**
- Homepage URL: `https://2w12.one`
- Authorization callback URL: `https://sveltia-cms-auth.w2-dc4.workers.dev/callback`
- Create it, then **Generate a new client secret**

**c. Give the Worker the credentials**

In the Worker's **Settings → Variables**, add:

| Variable | Value |
|---|---|
| `GITHUB_CLIENT_ID` | from the OAuth app |
| `GITHUB_CLIENT_SECRET` | from the OAuth app (encrypt this one) |
| `ALLOWED_DOMAINS` | `2w12.one,*.pages.dev` |

The `*.pages.dev` entry matters while testing: the CMS will be served from the
Cloudflare preview URL before the domain is switched, and the Worker refuses
any origin not on this list. Trim it to just `2w12.one` once the domain is live.

**d. Point the CMS at it** — done, `admin/config.yml` already has the Worker URL.

---

## 2. Cloudflare Pages

- Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
  **Connect to Git** → this repo

| Setting | Value |
|---|---|
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `24` (env var `NODE_VERSION=24`) |

Deploy. You get a preview URL like `2w12-one.pages.dev`.

**Check it before going further:** the landing page, `/@venkatesh`, both
galleries, `/work`, the three tools, and `/admin` (which should show a
*Login with GitHub* button once step 1 is done).

Every push to `main` rebuilds automatically — including pushes the CMS makes
when you save.

---

## 3. The domain

`2w12.one` currently points at GitHub Pages. Once the preview URL looks right:

- In the Pages project → **Custom domains** → **Set up a custom domain** → `2w12.one`
- Cloudflare tells you the DNS records. If the domain's DNS is already on
  Cloudflare it can do it itself; otherwise add the records at your registrar.
- Add `www.2w12.one` too if you want it to redirect.

TLS is issued automatically. Propagation is usually minutes.

**Then turn off GitHub Pages** for this repo (Settings → Pages → source: None),
so the old static site can't serve anything.

---

## 4. Retire Render — last

Only after the domain serves from Cloudflare and the CMS can save an edit:

- Delete the **web service**
- Delete the **Postgres database**
- Then strip the server from this repo: `server.js`, `knexfile.js`, `routes/`,
  `migrations/`, `lib/auth.js`, `lib/storage.js`, the dashboard/admin/login/signup
  views, and the `express`, `knex`, `pg`, `better-sqlite3`, `express-session`,
  `connect-session-knex`, `bcryptjs`, `multer`, `@aws-sdk/*` dependencies
- Delete the cutover section from `CLAUDE.md` and this file's step 4

---

## Editing, once it's up

Go to **2w12.one/admin**, click **Login with GitHub**.

- **Projects** — a searchable list of all 46, one form each. Filters for
  Featured / Hidden / Solo credit.
- **Site → Profile** — bio, links, headshot, handle
- **Site → Landing status lines** — the `>` lines on the front page
- **Site → Gallery** — loose images and video

Saving commits to `main`, which rebuilds. **An edit is live in about 40
seconds** — not instantly. That's the trade for having no server.

### Adding an editor

GitHub → repo → **Settings → Collaborators → Add people**. Write access *is*
the login. Remove them and they're out. There is no user list to maintain.

### After curating

Two things aren't automatic:

```
npm run make:og          # the share card follows pin/feature/hidden order
npm run optimize:images  # converts new posters to WebP
```

Run those locally and commit when you've added artwork or changed the ordering.
