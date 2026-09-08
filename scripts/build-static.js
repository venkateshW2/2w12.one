// Renders the whole site to dist/ as static HTML.
//
// Deliberately a plain Node script rather than a framework: the site is five
// page shapes, the existing EJS templates are reused untouched, and the routing
// is a list of permalinks. Adding Eleventy or Astro would mean porting the
// templates and inheriting a plugin's version churn for no gain here.
//
// Input is the data/ folder — profile.json, projects/*.json, status.json,
// gallery.json — which is exactly what the CMS edits. Nothing is queried at
// build time.
//
// Usage: npm run build            (SITE_URL=https://2w12.one by default)
//        SITE_URL=... npm run build
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { classify, soundcloudWidgetUrl, youtubeId, vimeoId, youtubeThumbnail, youtubeEmbedUrl, vimeoEmbedUrl } = require('../lib/sourceType');
const { TAG_ORDER, TAG_LABELS } = require('../lib/taxonomy');
const { slugify } = require('../lib/slug');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const VIEWS = path.join(ROOT, 'views');
const ORIGIN = (process.env.SITE_URL || 'https://2w12.one').replace(/\/$/, '');

// The lightbox can only play these; everything else opens in a new tab.
const EMBEDDABLE = ['youtube', 'vimeo', 'direct_video', 'direct_audio', 'soundcloud'];

function rimraf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function write(relPath, html) {
  const abs = path.join(OUT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, html);
  return abs;
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) n += copyDir(src, dst);
    else {
      fs.copyFileSync(src, dst);
      n++;
    }
  }
  return n;
}

// ------------------------------------------------------------------- content
// Read the same files the CMS writes. One project per file, so the CMS gets a
// real list view instead of one form with a 46-item widget.
function readContent() {
  const dataDir = path.join(ROOT, 'data');
  const readJson = (f, fallback) => {
    const abs = path.join(dataDir, f);
    return fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, 'utf8')) : fallback;
  };

  const projectsDir = path.join(dataDir, 'projects');
  const tracks = fs.existsSync(projectsDir)
    ? fs
        .readdirSync(projectsDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          const t = JSON.parse(fs.readFileSync(path.join(projectsDir, f), 'utf8'));
          // tags is a list in the files and a comma string in the templates.
          return { ...t, tags: Array.isArray(t.tags) ? t.tags.join(',') : t.tags || '' };
        })
    : [];

  return {
    profile: readJson('profile.json', {}),
    tracks,
    status_lines: (readJson('status.json', { lines: [] }).lines || []).slice().sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0)),
    gallery_items: readJson('gallery.json', { items: [] }).items || []
  };
}

// ---------------------------------------------------------------- view model
function enrich(t) {
  const src = t.source_url || '';
  const kind = src ? classify(src) : 'none';
  return {
    id: slugify(t.title),
    title: t.title,
    description: t.description || '',
    role: t.role || '',
    roleShort: t.role || '', // the badge is the role text verbatim
    year: t.year,
    collaboration: t.collaboration,
    location: t.location,
    technical: t.technical,
    context: t.context,
    externalUrl: t.external_url,
    soloCredit: !!t.solo_credit,
    creditNote: t.credit_note,
    sortOrder: t.sort_order || 0,
    featured: !!t.featured,
    embeddable: !!src && EMBEDDABLE.includes(kind),
    cover: t.cover_image_url || (kind === 'youtube' ? youtubeThumbnail(src) : null) || '',
    kind,
    src,
    widgetUrl: soundcloudWidgetUrl(t.audio_url || (kind === 'soundcloud' ? src : '')),
    embedUrl:
      kind === 'youtube'
        ? youtubeEmbedUrl(src)
        : kind === 'vimeo'
          ? vimeoEmbedUrl(src)
          : kind === 'soundcloud'
            ? soundcloudWidgetUrl(src)
            : null,
    youtubeId: kind === 'youtube' ? youtubeId(src) : null,
    vimeoId: kind === 'vimeo' ? vimeoId(src) : null
  };
}

function profileView(content) {
  const profile = content.profile;
  const all = content.tracks;

  // A hidden parent takes its pieces with it.
  const hiddenTitles = new Set(all.filter((t) => t.hidden).map((t) => t.title));
  const visible = all.filter((t) => !t.hidden && !(t.parent_title && hiddenTitles.has(t.parent_title)));

  const pieces = visible.filter((t) => t.parent_title);
  const topLevel = visible.filter((t) => !t.parent_title);

  const items = topLevel
    .map((t) => {
      const item = enrich(t);
      item.tags = (t.tags || '')
        .split(',')
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
      if (!item.tags.length) item.tags = ['MORE'];
      item.pieces = pieces.filter((p) => p.parent_title === t.title).map(enrich);
      item.isAlbum = item.pieces.length > 0;
      item.audioPieces = item.pieces.filter((p) => p.kind === 'direct_audio' || p.widgetUrl);
      if (item.kind === 'direct_audio' || item.widgetUrl) item.audioPieces = [item, ...item.audioPieces];
      return item;
    })
    .sort(
      (a, b) =>
        (b.sortOrder || 0) - (a.sortOrder || 0) ||
        (b.featured ? 1 : 0) - (a.featured ? 1 : 0) ||
        (b.year || 0) - (a.year || 0) ||
        a.title.localeCompare(b.title)
    );

  const counts = {};
  items.forEach((it) => it.tags.forEach((tag) => (counts[tag] = (counts[tag] || 0) + 1)));
  const categories = TAG_ORDER.filter((tag) => counts[tag]).map((tag) => ({
    tag,
    label: TAG_LABELS[tag] || tag,
    count: counts[tag]
  }));
  Object.keys(counts)
    .filter((tag) => !TAG_ORDER.includes(tag))
    .forEach((tag) => categories.push({ tag, label: tag.charAt(0) + tag.slice(1).toLowerCase(), count: counts[tag] }));

  const playlist = [];
  items.forEach((it) =>
    it.audioPieces.forEach((a) =>
      playlist.push({
        id: a.id,
        title: a.title,
        src: a.src,
        widgetUrl: a.widgetUrl || null,
        cover: it.cover,
        project: it.title,
        role: a.roleShort || ''
      })
    )
  );

  const lookup = {};
  const add = (it) => {
    lookup[it.id] = {
      kind: it.kind,
      src: it.src,
      embedUrl: it.embedUrl,
      title: it.title,
      cover: it.cover,
      isAlbum: !!it.isAlbum,
      playable: !!it.src,
      pieceIds: (it.pieces || []).map((p) => p.id)
    };
    (it.pieces || []).forEach(add);
  };
  items.forEach(add);

  const socials = [
    { url: profile.website_url, label: 'Website' },
    { url: profile.instagram_url, label: 'Instagram' },
    { url: profile.linkedin_url, label: 'LinkedIn' },
    { url: profile.twitter_url, label: 'Twitter' },
    { url: profile.substack_url, label: 'Substack' },
    { url: profile.soundcloud_url, label: 'SoundCloud' },
    { url: profile.spotify_url, label: 'Spotify' },
    { url: profile.imdb_url, label: 'IMDb' }
  ].filter((s) => s.url);

  return { profile, items, categories, socials, playlist, lookup };
}

function shareMeta(profile, items) {
  const shareUrl = `${ORIGIN}/@${profile.slug}`;
  const cardRel = `/images/og/${profile.slug}.jpg`;
  const cardAbs = path.join(ROOT, 'public', cardRel);
  let ogImage = null;
  if (fs.existsSync(cardAbs)) {
    ogImage = `${ORIGIN}${cardRel}?v=${Math.floor(fs.statSync(cardAbs).mtimeMs / 1000)}`;
  } else if (profile.avatar_url) {
    ogImage = ORIGIN + profile.avatar_url.replace(/\.webp$/i, '.jpg');
  }
  return {
    shareUrl,
    ogUrl: shareUrl,
    ogType: 'profile',
    ogImage,
    ogTitle: profile.name + (profile.tagline ? ' — ' + profile.tagline : ''),
    ogDescription:
      (profile.bio_long || '').slice(0, 180) ||
      `${items.length} projects — film, series, installations, instruments and software.`
  };
}

// -------------------------------------------------------------------- build
async function main() {
  const content = readContent();
  const view = profileView(content);
  const { profile } = view;

  rimraf(OUT);
  fs.mkdirSync(OUT, { recursive: true });

  // Nav needs the same shape on every page. There is no logged-in state on a
  // static site, so the nav's account link points at the CMS instead.
  const navProfiles = [{ name: profile.name, slug: profile.slug, token: null, user_id: 1 }];
  const base = { navProfiles, navIsAdmin: false, loggedIn: false };

  const render = (tpl, locals) => ejs.renderFile(path.join(VIEWS, tpl), locals, { views: [VIEWS] });

  const pages = [];

  // ---- landing ----
  pages.push({
    out: 'index.html',
    html: await render('home.ejs', {
      ...base,
      currentPath: '/',
      statusLines: content.status_lines || [],
      pageTitle: '2w12.one — the sound thing',
      ogTitle: '2w12.one — The Sound Thing',
      ogDescription: 'All things sound. A group of individuals who work on sound together.',
      ogUrl: ORIGIN + '/',
      ogType: 'website',
      ogImage: fs.existsSync(path.join(ROOT, 'public', `/images/og/${profile.slug}.jpg`))
        ? `${ORIGIN}/images/og/${profile.slug}.jpg`
        : null
    })
  });

  // ---- the person's page, at /@handle/ ----
  const meta = shareMeta(profile, view.items);
  pages.push({
    out: path.join(`@${profile.slug}`, 'index.html'),
    html: await render('portfolio.ejs', {
      ...base,
      currentPath: `/@${profile.slug}`,
      ...view,
      ...meta,
      pageTitle: `${profile.name} — 2w12.one`,
      playlistJson: JSON.stringify(view.playlist),
      itemsJson: JSON.stringify(view.lookup)
    })
  });

  // ---- galleries ----
  const gal = (content.gallery_items || []).map((g) => ({
    id: slugify(g.url),
    url: g.url,
    caption: g.caption,
    kind: g.kind === 'video' || classify(g.url) === 'direct_video' ? 'video' : 'image',
    scope: g.scope
  }));

  pages.push({
    out: path.join('gallery', 'index.html'),
    html: await render('gallery.ejs', {
      ...base,
      currentPath: '/gallery',
      heading: '2w12.one',
      subheading: 'Studio gallery — tests, experiments, work in progress',
      items: gal.filter((g) => g.scope === 'company'),
      backUrl: '/',
      backLabel: 'Back to 2w12.one',
      scopeNote: 'This is the studio gallery. Each portfolio keeps its own separate one.'
    })
  });

  pages.push({
    out: path.join(`@${profile.slug}`, 'gallery', 'index.html'),
    html: await render('gallery.ejs', {
      ...base,
      currentPath: `/@${profile.slug}/gallery`,
      heading: profile.name,
      subheading: 'Gallery — tests, experiments, work in progress',
      items: gal.filter((g) => g.scope !== 'company'),
      backUrl: `/@${profile.slug}`,
      backLabel: 'Back to portfolio',
      scopeNote: null
    })
  });

  // ---- work (coming soon) ----
  pages.push({
    out: path.join('work', 'index.html'),
    html: await render('work.ejs', { ...base, currentPath: '/work' })
  });

  // ---- 404 (Cloudflare Pages serves this automatically) ----
  pages.push({
    out: '404.html',
    html: await render('not-found.ejs', { ...base, currentPath: '/404' })
  });

  pages.forEach((p) => {
    write(p.out, p.html);
    console.log(`  ${String(Math.round(p.html.length / 1024)).padStart(4)} KB  /${p.out.replace(/index\.html$/, '')}`);
  });

  // ---- assets ----
  const assets = copyDir(path.join(ROOT, 'public'), OUT);
  const admin = copyDir(path.join(ROOT, 'admin'), path.join(OUT, 'admin'));
  const tools = copyDir(path.join(ROOT, 'docs', 'tools'), path.join(OUT, 'tools'));
  console.log(`\n  ${assets} files from public/, ${tools} from docs/tools/, ${admin} from admin/`);
  console.log(`  ${pages.length} pages -> dist/  (origin ${ORIGIN})`);
}

main().catch((err) => {
  console.error('\nBuild failed:', err.message);
  process.exit(1);
});
