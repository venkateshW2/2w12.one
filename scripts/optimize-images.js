// Converts the poster set to WebP and repoints the DB at the new files.
//
// The originals are 1-2 MB PNGs at full print-ish resolution; the public page
// shows them as ~350px-wide cards. That made the portfolio several megabytes
// per page load — the single biggest performance problem on the site, and
// independent of where the files are hosted.
//
// Originals are NOT deleted: they stay as the masters in case a bigger size is
// ever needed. Only the DB's cover_image_url changes.
//
// Usage:
//   npm run optimize:images -- --dry-run
//   npm run optimize:images
//   npm run optimize:images -- --quality=80 --width=900
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig);

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

const DRY_RUN = process.argv.includes('--dry-run');
const QUALITY = arg('quality', '82');
const MAX_WIDTH = arg('width', '900'); // ~2.5x the widest card, so retina stays sharp
const DIR = path.join(__dirname, '..', 'public', 'images', 'projects');

function haveCwebp() {
  try {
    execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!haveCwebp()) {
    console.error('cwebp not found. Install it with:  brew install webp');
    process.exit(1);
  }

  const sources = fs.readdirSync(DIR).filter((f) => /\.(png|jpe?g)$/i.test(f));
  console.log(`${sources.length} source images in ${DIR}${DRY_RUN ? '  [DRY RUN]' : ''}\n`);

  let before = 0;
  let after = 0;
  const remap = {};

  for (const file of sources) {
    const src = path.join(DIR, file);
    const outName = file.replace(/\.(png|jpe?g)$/i, '.webp');
    const out = path.join(DIR, outName);
    const srcBytes = fs.statSync(src).size;
    before += srcBytes;

    if (DRY_RUN) {
      console.log(`  would convert  ${file}  (${Math.round(srcBytes / 1024)} KB)  ->  ${outName}`);
      remap[`/images/projects/${file}`] = `/images/projects/${outName}`;
      continue;
    }

    // -resize W 0 keeps the aspect ratio; -q is visually lossless enough for
    // posters at this display size.
    execFileSync('cwebp', ['-q', QUALITY, '-resize', MAX_WIDTH, '0', '-quiet', src, '-o', out]);
    const outBytes = fs.statSync(out).size;
    after += outBytes;
    remap[`/images/projects/${file}`] = `/images/projects/${outName}`;
    const saved = Math.round((1 - outBytes / srcBytes) * 100);
    console.log(
      `  ${file.padEnd(26)} ${String(Math.round(srcBytes / 1024)).padStart(5)} KB  ->  ${String(Math.round(outBytes / 1024)).padStart(4)} KB  (-${saved}%)`
    );
  }

  // Repoint every track (and the headshot) that referenced an original.
  let repointed = 0;
  const tracks = await knex('tracks').whereNotNull('cover_image_url').select('id', 'cover_image_url');
  for (const t of tracks) {
    const next = remap[t.cover_image_url];
    if (!next) continue;
    if (!DRY_RUN) await knex('tracks').where({ id: t.id }).update({ cover_image_url: next });
    repointed++;
  }

  const profile = await knex('profiles').whereNotNull('user_id').first();
  if (profile && profile.avatar_url && remap[profile.avatar_url]) {
    if (!DRY_RUN) await knex('profiles').where({ id: profile.id }).update({ avatar_url: remap[profile.avatar_url] });
    console.log('  (headshot repointed too)');
  }

  console.log(`\n${repointed} track covers repointed to .webp`);
  if (!DRY_RUN) {
    console.log(
      `Total: ${(before / 1048576).toFixed(2)} MB  ->  ${(after / 1048576).toFixed(2)} MB  ` +
        `(-${Math.round((1 - after / before) * 100)}%)`
    );
    console.log('\nOriginal PNG/JPGs kept as masters. Re-run after adding new posters.');
  }
}

main()
  .then(() => knex.destroy())
  .catch(async (err) => {
    console.error('\nFailed:', err.message);
    await knex.destroy();
    process.exit(1);
  });
