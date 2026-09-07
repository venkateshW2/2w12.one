// Moves every cover image referenced by the `tracks` table onto Backblaze B2 and
// rewrites the DB to point at the B2 URL. Handles both kinds of cover the
// importer leaves behind:
//
//   1. Local posters   — "/images/projects/GOW.png"  (files in public/)
//   2. Hotlinked remote — "https://studio.camp/..."   (downloaded, then re-uploaded)
//
// Keys are stable and derived from the filename (images/projects/GOW.png), not
// random UUIDs, so re-running this doesn't create duplicate objects — it just
// re-uploads over the same key and leaves the DB URL unchanged. Anything already
// pointing at B2 is skipped entirely.
//
// Usage:
//   npm run media:b2 -- --dry-run     # show what would move, touch nothing
//   npm run media:b2                  # do it
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig);
const { uploadToB2, configured, publicUrl } = require('../lib/storage');

const DRY_RUN = process.argv.includes('--dry-run');

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif'
};

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

function b2Base() {
  return (process.env.B2_PUBLIC_BASE_URL || `${process.env.B2_ENDPOINT}/${process.env.B2_BUCKET}`).replace(/\/$/, '');
}

// Local poster: keep the original filename as the B2 key so the mapping stays
// obvious when you're looking at the bucket.
async function fromLocal(url) {
  const rel = url.replace(/^\//, '');
  const abs = path.join(__dirname, '..', 'public', rel);
  if (!fs.existsSync(abs)) return { skip: `file missing on disk: ${rel}` };
  const ext = path.extname(abs).toLowerCase();
  return {
    key: rel, // e.g. images/projects/GOW.png
    body: () => fs.createReadStream(abs),
    mimetype: MIME[ext] || 'application/octet-stream',
    originalname: path.basename(abs),
    bytes: fs.statSync(abs).size
  };
}

// Remote hotlink: download it once, then store it under a key derived from the
// project title so the bucket doesn't fill up with someone else's filenames.
async function fromRemote(url, title) {
  let res;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch (err) {
    return { skip: `download failed: ${err.message}` };
  }
  if (!res.ok) return { skip: `download failed: HTTP ${res.status}` };

  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  if (!type.startsWith('image/')) return { skip: `not an image (content-type: ${type || 'unknown'})` };

  const buf = Buffer.from(await res.arrayBuffer());
  const extFromUrl = path.extname(new URL(url).pathname).toLowerCase();
  const ext = MIME[extFromUrl] ? extFromUrl : `.${type.split('/')[1].replace('jpeg', 'jpg')}`;

  return {
    key: `images/covers/${slugify(title)}${ext}`,
    body: () => Readable.from(buf),
    mimetype: type,
    originalname: `${slugify(title)}${ext}`,
    bytes: buf.length
  };
}

async function main() {
  if (!configured()) {
    console.error(
      'Backblaze B2 is not configured. Set these in .env (see .env.example), then re-run:\n' +
        '  B2_KEY_ID, B2_APP_KEY, B2_BUCKET, B2_ENDPOINT, B2_REGION\n' +
        'See the "Backblaze B2 setup" section of CLAUDE.md for where to get them.'
    );
    process.exit(1);
  }

  const tracks = await knex('tracks').whereNotNull('cover_image_url').whereNot('cover_image_url', '').select('id', 'title', 'cover_image_url');
  const base = b2Base();
  console.log(`${tracks.length} tracks have a cover. Target bucket base: ${base}${DRY_RUN ? '  [DRY RUN]' : ''}\n`);

  let moved = 0;
  let skipped = 0;
  let already = 0;

  for (const t of tracks) {
    const url = t.cover_image_url;

    if (url.startsWith(base)) {
      already++;
      continue;
    }

    const plan = url.startsWith('/') ? await fromLocal(url) : await fromRemote(url, t.title);

    if (plan.skip) {
      console.log(`  skip  ${t.title} — ${plan.skip}`);
      skipped++;
      continue;
    }

    const kb = Math.round(plan.bytes / 1024);
    if (DRY_RUN) {
      console.log(`  would move  ${t.title}\n              ${url}\n           -> ${base}/${plan.key}  (${kb} KB)`);
      moved++;
      continue;
    }

    try {
      const newUrl = await uploadToB2(
        { stream: plan.body(), mimetype: plan.mimetype, originalname: plan.originalname },
        'images',
        plan.key
      );
      await knex('tracks').where({ id: t.id }).update({ cover_image_url: newUrl });
      console.log(`  moved ${t.title}  (${kb} KB) -> ${newUrl}`);
      moved++;
    } catch (err) {
      console.log(`  FAIL  ${t.title} — ${err.message}`);
      skipped++;
    }
  }

  // The profile headshot lives outside `tracks`, so handle it separately.
  const profile = await knex('profiles').whereNotNull('user_id').first();
  if (profile && profile.avatar_url && !profile.avatar_url.startsWith(base)) {
    const plan = profile.avatar_url.startsWith('/')
      ? await fromLocal(profile.avatar_url)
      : await fromRemote(profile.avatar_url, `${profile.name}-headshot`);
    if (plan.skip) {
      console.log(`  skip  [headshot] — ${plan.skip}`);
    } else if (DRY_RUN) {
      console.log(`  would move  [headshot] -> ${base}/${plan.key}`);
    } else {
      const newUrl = await uploadToB2(
        { stream: plan.body(), mimetype: plan.mimetype, originalname: plan.originalname },
        'images',
        plan.key
      );
      await knex('profiles').where({ id: profile.id }).update({ avatar_url: newUrl });
      console.log(`  moved [headshot] -> ${newUrl}`);
    }
  }

  console.log(`\n${moved} ${DRY_RUN ? 'would move' : 'moved'}, ${already} already on B2, ${skipped} skipped.`);
  if (!DRY_RUN && moved > 0) {
    console.log(
      '\nNote: public/images/projects/* is left in place on purpose — it is the\n' +
        'original source of those posters. Nothing serves them once the DB points\n' +
        'at B2, but keep them until you have verified the B2 URLs load.'
    );
  }
}

main()
  .then(() => knex.destroy())
  .catch(async (err) => {
    console.error('\nFailed:', err.message);
    await knex.destroy();
    process.exit(1);
  });
