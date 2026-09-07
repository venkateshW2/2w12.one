// Builds the 1200x630 link-preview card for each profile — the image that shows
// when someone pastes an /@handle link into WhatsApp, Slack or iMessage.
//
// Pointing og:image straight at the headshot did not work: the original is
// 2448x3264 and 3.6 MB, and scrapers skip images that large. They also expect
// landscape; a portrait gets cropped badly or dropped. So this composes a real
// card instead — dark ground, circular headshot, name, tagline, wordmark — and
// keeps it well under the size scrapers tolerate.
//
// Needs ImageMagick (`brew install imagemagick`). Output is committed, so
// production never runs this.
//
// Usage: npm run make:og
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig);

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

function buildCard(profile) {
  const slug = profile.slug;
  const out = path.join(OUT_DIR, `${slug}.jpg`);

  // Prefer the original over the .webp — ImageMagick handles jpg/png everywhere,
  // and webp support depends on how it was built.
  let portrait = null;
  if (profile.avatar_url && profile.avatar_url.startsWith('/')) {
    const rel = profile.avatar_url.replace(/^\//, '');
    for (const candidate of [rel.replace(/\.webp$/i, '.jpg'), rel.replace(/\.webp$/i, '.png'), rel]) {
      const abs = path.join(__dirname, '..', 'public', candidate);
      if (fs.existsSync(abs)) {
        portrait = abs;
        break;
      }
    }
  }

  const args = ['-size', `${W}x${H}`, `xc:${BG}`];

  // A hairline accent rule down the left edge, echoing the site's solo-credit cards.
  args.push('-fill', ACCENT, '-draw', `rectangle 0,0 6,${H}`);

  if (portrait) {
    // Square-crop from the upper part of the portrait — that's where the face
    // is — then mask to a circle.
    const tmpFace = '/tmp/og-face.png';
    execFileSync('magick', [
      portrait,
      '-resize', '520x520^',
      '-gravity', 'north',
      '-extent', '520x520',
      '(', '+clone', '-alpha', 'extract', '-draw', 'fill black polygon 0,0 0,260 260,0 fill white circle 260,260 260,0', '(', '+clone', '-flip', ')', '-compose', 'Multiply', '-composite', '(', '+clone', '-flop', ')', '-compose', 'Multiply', '-composite', ')',
      '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
      tmpFace
    ]);
    args.push(tmpFace, '-geometry', '+90+80', '-composite');
  }

  const textX = portrait ? 680 : 96;

  args.push('-font', 'Helvetica-Bold', '-pointsize', '30', '-fill', ACCENT, '-annotate', `+${textX}+150`, '2w12.one');
  args.push('-font', 'Helvetica-Bold', '-pointsize', '64', '-fill', INK, '-annotate', `+${textX}+250`, profile.name);

  wrap(profile.tagline || 'All things sound', 30).slice(0, 2).forEach((line, i) => {
    args.push('-font', 'Helvetica', '-pointsize', '32', '-fill', MUTED, '-annotate', `+${textX}+${310 + i * 44}`, line);
  });

  args.push('-fill', ACCENT, '-draw', `rectangle ${textX},${400} ${textX + 90},${403}`);
  args.push('-font', 'Helvetica', '-pointsize', '26', '-fill', MUTED, '-annotate', `+${textX}+460`, `2w12.one/@${slug}`);

  // Quality 82 with stripped metadata keeps this comfortably inside the size
  // scrapers will fetch.
  args.push('-quality', '82', '-strip', out);

  execFileSync('magick', args);
  return out;
}

async function main() {
  if (!have('magick')) {
    console.error('ImageMagick not found. Install it with:  brew install imagemagick');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const profiles = await knex('profiles').whereNotNull('slug');
  if (!profiles.length) {
    console.log('No profiles with a slug yet — nothing to build.');
    return;
  }

  for (const p of profiles) {
    const out = buildCard(p);
    const kb = Math.round(fs.statSync(out).size / 1024);
    console.log(`  ${p.name.padEnd(20)} -> /images/og/${p.slug}.jpg  (${kb} KB)`);
    if (kb > 300) console.log('    ! over 300 KB — some scrapers skip images this large');
  }
  console.log(`\n${profiles.length} card(s) built at ${W}x${H}.`);
}

main()
  .then(() => knex.destroy())
  .catch(async (err) => {
    console.error('\nFailed:', err.message);
    await knex.destroy();
    process.exit(1);
  });
