# Deploying 2w12.one

Static site on Cloudflare Pages, edited through Sveltia CMS, authenticated by
GitHub repo access. Total cost: **$0**.

**Done — the site is live on `2w12.one`.** This is kept as the record of how it
was set up, and what to repeat for another domain or another person's page.

## Read this before touching DNS on any domain

**If DNSSEC is enabled, disable it at the registrar *before* moving
nameservers.** This took `2w12.one` — website *and* email — completely offline
during the migration.

A `DS` record at the registry is a fingerprint saying *only trust DNS answers
signed by these keys*. Move to new nameservers and the keys no longer match, so
every validating resolver returns SERVFAIL for everything, MX included. The
error reads `DNSKEY Missing: no SEP matching the DS found`.

```bash
dig DS <domain>            # do this FIRST — a DS record is invisible in a
                           # normal record listing, which is how it was missed
```

If anything comes back: turn DNSSEC off at the registrar, wait for it to clear,
*then* move nameservers. Re-enable afterwards from the new provider's side —
enable DNSSEC in Cloudflare, it issues a DS record, add that at the registrar.
Never the reverse.

Two more from the same migration:

- **Cloudflare's DNS import misses records.** It brought over 13 of 15 —
  dropping `api.2w12.one` (a live service on another host) and the
  `k2ibe27i4e5y` Google-verification CNAME. Compare against the old provider's
  list by hand before switching.
- **Mail and verification records must be `DNS only`, never proxied.** A
  proxied verification CNAME makes Cloudflare answer with its own IPs and the
  verification fails.

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

## 3. The domain — done, and what it took

`2w12.one` was on GitHub Pages with DNS at Google (via Squarespace). Now:
Cloudflare DNS, nameservers `keanu` / `maeve.ns.cloudflare.com`, apex and `www`
as proxied CNAMEs to `2w12-one.pages.dev`.

The sequence that worked:

1. **`dig DS 2w12.one`** → a DS record existed → disable DNSSEC at Squarespace
2. Cloudflare → **Add a site** → *Connect a domain* → let it import DNS, then
   **check the import by hand** and add what it missed
3. Squarespace → **Use custom nameservers** → Cloudflare's two. (Squarespace
   won't let you delete its defaults individually; switching to custom replaces
   the set.) **Decline the DNSSEC prompt it shows afterwards.**
4. Wait for the zone to go **Active**, then Pages → **Custom domains** →
   `2w12.one`
5. **Delete the four old `185.199.x.x` A records** — a CNAME can't coexist with
   A records on the same name, so the apex can't point at Pages until they're
   gone. Then add the CNAME Cloudflare asks for (`@` → `2w12-one.pages.dev`).
6. Repoint `www` from `venkateshw2.github.io` to `2w12-one.pages.dev`
7. GitHub → repo → Settings → Pages → **Remove** the custom domain, then
   **Unpublish site**

TLS is automatic. One thing to expect: **your own machine will keep showing the
old site** for up to an hour — the old records had a 1-hour TTL and local
resolvers hold them. Check on a phone with wi-fi off to see the truth.

---

## Editing, once it's up

Go to **2w12.one/admin** and click **Login with GitHub**.

**There is no link to it on the site.** That's deliberate — Sveltia
authenticates against GitHub so hiding the URL protects nothing, but a "Login"
item in the nav tells a client there's a back office. Bookmark it.

The shareable link for a person is simply **`2w12.one/@<handle>`** —
`2w12.one/@venkatesh`. The handle is editable under Site → Profile.

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
