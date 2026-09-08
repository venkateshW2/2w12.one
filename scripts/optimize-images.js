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
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

const DRY_RUN = process.argv.includes('--dry-run');
const QUALITY = arg('quality', '82');
const MAX_WIDTH = arg('width', '900'); // ~2.5x the widest card, so retina stays sharp
// Both the poster set and any loose images (a headshot, gallery stills) dropped
// straight into public/images/.
const IMG_ROOT = path.join(__dirname, '..', 'public', 'images');
const DIRS = [
  { abs: path.join(IMG_ROOT, 'projects'), web: '/images/projects' },
  { abs: IMG_ROOT, web: '/images' }
];

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

  let before = 0;
  let after = 0;
  const remap = {};

  for (const dir of DIRS) {
    if (!fs.existsSync(dir.abs)) continue;
    const sources = fs
      .readdirSync(dir.abs, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.(png|jpe?g)$/i.test(e.name))
      .map((e) => e.name);
    if (!sources.length) continue;

    console.log(`${sources.length} source image(s) in ${dir.web}${DRY_RUN ? '  [DRY RUN]' : ''}`);

    for (const file of sources) {
      const src = path.join(dir.abs, file);
      const outName = file.replace(/\.(png|jpe?g)$/i, '.webp');
      const out = path.join(dir.abs, outName);
      const srcBytes = fs.statSync(src).size;
      before += srcBytes;
      remap[`${dir.web}/${file}`] = `${dir.web}/${outName}`;

      if (DRY_RUN) {
        console.log(`  would convert  ${file}  (${Math.round(srcBytes / 1024)} KB)  ->  ${outName}`);
        continue;
      }

      // -resize W 0 keeps the aspect ratio; -q is visually lossless enough at
      // the sizes these render at.
      execFileSync('cwebp', ['-q', QUALITY, '-resize', MAX_WIDTH, '0', '-quiet', src, '-o', out]);
      const outBytes = fs.statSync(out).size;
      after += outBytes;
      const saved = Math.round((1 - outBytes / srcBytes) * 100);
      console.log(
        `  ${file.padEnd(26)} ${String(Math.round(srcBytes / 1024)).padStart(5)} KB  ->  ${String(Math.round(outBytes / 1024)).padStart(4)} KB  (-${saved}%)`
      );
    }
    console.log('');
  }

  // Rewrite the data files that referenced an original. The JSON is the source
  // of truth, so this is where paths have to be updated.
  let repointed = 0;
  const dataDir = path.join(__dirname, '..', 'data');

  const rewrite = (file, mutate) => {
    const abs = path.join(dataDir, file);
    if (!fs.existsSync(abs)) return;
    const json = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const before = JSON.stringify(json);
    mutate(json);
    const after = JSON.stringify(json);
    if (before !== after && !DRY_RUN) fs.writeFileSync(abs, JSON.stringify(json, null, 2) + '\n');
    if (before !== after) repointed++;
  };

  const projectsDir = path.join(dataDir, 'projects');
  if (fs.existsSync(projectsDir)) {
    for (const f of fs.readdirSync(projectsDir).filter((x) => x.endsWith('.json'))) {
      rewrite(path.join('projects', f), (t) => {
        if (remap[t.cover_image_url]) t.cover_image_url = remap[t.cover_image_url];
      });
    }
  }

  rewrite('profile.json', (p) => {
    if (remap[p.avatar_url]) p.avatar_url = remap[p.avatar_url];
  });

  rewrite('gallery.json', (g) => {
    (g.items || []).forEach((item) => {
      if (remap[item.url]) item.url = remap[item.url];
    });
  });

  console.log(`${repointed} references repointed to .webp`);
  if (!DRY_RUN) {
    console.log(
      `Total: ${(before / 1048576).toFixed(2)} MB  ->  ${(after / 1048576).toFixed(2)} MB  ` +
        `(-${Math.round((1 - after / before) * 100)}%)`
    );
    console.log('\nOriginal PNG/JPGs kept as masters. Re-run after adding new posters.');
  }
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
