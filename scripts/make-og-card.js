// Builds the 1200x630 link-preview card for each profile — the image that shows
// when someone pastes an /@handle link into WhatsApp, Slack or iMessage.
//
// Pointing og:image straight at the headshot did not work: the original is
// 2448x3264 and 3.6 MB, and scrapers skip images that large. They also expect
// landscape; a portrait gets cropped badly or dropped.
//
// So this composes a card: a 6x4 mosaic of the project posters in page order,
// darkened hard with a left scrim, and the name, tagline, handle and project
// count over it. The posters are texture and evidence of a body of work — a
// headshot says who, a wall of film posters says what, and the second reads
// better on a link someone sends a client.
//
// Needs ImageMagick (`brew install imagemagick`). Output is committed, so
// production never runs this.
//
// Usage: npm run make:og
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const W = 1200;
const H = 630;
const BG = '#0c0c0c';
const INK = '#e8e6e1';
const MUTED = '#86837c';
const ACCENT = '#c98a3f';

const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'og');

function have(cmd) {
  try {
    execFileSync(cmd, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ImageMagick's -annotate does not wrap, so break the tagline by hand.
function wrap(text, perLine) {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((w) => {
    if ((line + ' ' + w).trim().length > perLine) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  });
  if (line) lines.push(line.trim());
  return lines;
}

// Tiles are laid out 6x4 at 200x158, which fills 1200x632 and gets cropped to
// 630. Fewer covers than tiles just cycles the list.
const COLS = 6;
const ROWS = 4;
const TW = 200;
const TH = 158;

function readProjects() {
  const dir = path.join(__dirname, '..', 'data', 'projects');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

// Page order, so the mosaic matches what a visitor sees: pinned, then
// featured, then newest. Hidden projects and album pieces are excluded.
function coversFor(projects) {
  const ordered = projects
    .filter((t) => !t.hidden && !t.parent_title)
    .sort(
      (a, b) =>
        (b.sort_order || 0) - (a.sort_order || 0) ||
        (b.featured ? 1 : 0) - (a.featured ? 1 : 0) ||
        (b.year || 0) - (a.year || 0)
    );

  const files = [];
  for (const t of ordered) {
    if (!t.cover_image_url || !t.cover_image_url.startsWith('/images/')) continue;
    const rel = t.cover_image_url.replace(/^\//, '');
    // Prefer a png/jpg master — ImageMagick's webp support depends on the build.
    for (const candidate of [rel.replace(/\.webp$/i, '.png'), rel.replace(/\.webp$/i, '.jpg'), rel]) {
      const abs = path.join(__dirname, '..', 'public', candidate);
      if (fs.existsSync(abs)) {
        files.push(abs);
        break;
      }
    }
  }
  return files;
}

function buildMosaic(files) {
  const need = COLS * ROWS;
  const tiles = [];
  for (let i = 0; i < need; i++) {
    const src = files[i % files.length];
    const out = `/tmp/og-tile-${i}.jpg`;
    // Fill the tile and centre-crop, so posters of different aspect ratios
    // don't letterbox.
    execFileSync('magick', [src, '-resize', `${TW}x${TH}^`, '-gravity', 'center', '-extent', `${TW}x${TH}`, '-quality', '88', out]);
    tiles.push(out);
  }
  const mosaic = '/tmp/og-mosaic.jpg';
  execFileSync('magick', ['montage', '-mode', 'concatenate', '-tile', `${COLS}x${ROWS}`, ...tiles, '-quality', '90', mosaic]);
  tiles.forEach((t) => fs.unlinkSync(t));
  return mosaic;
}

function buildCard(profile, projects) {
  const slug = profile.slug;
  const out = path.join(OUT_DIR, `${slug}.jpg`);
  const files = coversFor(projects);

  const args = [];

  if (files.length) {
    const mosaic = buildMosaic(files);

    // `gradient:` always renders top-to-bottom, so a left-to-right scrim has to
    // be built tall and rotated. Without this the scrim silently did nothing.
    const scrim = '/tmp/og-scrim.png';
    execFileSync('magick', ['-size', `${H}x${W}`, `gradient:${BG}-none`, '-rotate', '270', '-resize', `${W}x${H}!`, scrim]);

    // Darkened hard, because the text has to win. The posters are texture and
    // evidence of a body of work, not the subject of the card.
    args.push(mosaic, '-resize', `${W}x${H}^`, '-gravity', 'north', '-extent', `${W}x${H}`,
              '-fill', BG, '-colorize', '58%', '-modulate', '96,90,100');
    args.push(scrim, '-gravity', 'northwest', '-geometry', '+0+0', '-composite');
  } else {
    args.push('-size', `${W}x${H}`, `xc:${BG}`);
  }

  // Every -annotate below is an absolute offset from the top-left, so gravity
  // must be cleared — it was still 'north' from the mosaic extent, which
  // centred all the text instead of left-aligning it.
  args.push('-gravity', 'none');
  args.push('-fill', ACCENT, '-draw', `rectangle 0,0 6,${H}`);

  const textX = 90;
  args.push('-font', 'Helvetica-Bold', '-pointsize', '30', '-fill', ACCENT, '-annotate', `+${textX}+150`, '2w12.one');
  args.push('-font', 'Helvetica-Bold', '-pointsize', '68', '-fill', INK, '-annotate', `+${textX}+248`, profile.name);

  wrap(profile.tagline || 'All things sound', 32).slice(0, 2).forEach((line, i) => {
    args.push('-font', 'Helvetica', '-pointsize', '32', '-fill', MUTED, '-annotate', `+${textX}+${306 + i * 44}`, line);
  });

  args.push('-fill', ACCENT, '-draw', `rectangle ${textX},396 ${textX + 90},399`);
  args.push('-font', 'Helvetica', '-pointsize', '26', '-fill', MUTED, '-annotate', `+${textX}+456`, `2w12.one/@${slug}`);

  const count = projects.filter((t) => !t.hidden && !t.parent_title).length;
  args.push('-font', 'Helvetica', '-pointsize', '22', '-fill', MUTED, '-annotate', `+${textX}+512`, `${count} projects`);

  args.push('-quality', '80', '-strip', out);
  execFileSync('magick', args);
  return out;
}

function main() {
  if (!have('magick')) {
    console.error('ImageMagick not found. Install it with:  brew install imagemagick');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const profile = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'profile.json'), 'utf8'));
  if (!profile.slug) {
    console.error('data/profile.json has no slug — the card is named after it.');
    process.exit(1);
  }

  const projects = readProjects();
  const out = buildCard(profile, projects);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`  ${profile.name.padEnd(20)} -> /images/og/${profile.slug}.jpg  (${kb} KB)`);
  if (kb > 300) console.log('    ! over 300 KB — some scrapers skip images this large');
  console.log(`\n1 card built at ${W}x${H}.`);
}

try {
  main();
} catch (err) {
  console.error('\nFailed:', err.message);
  process.exit(1);
}
