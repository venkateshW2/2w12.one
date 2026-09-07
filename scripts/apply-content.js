// Applies data/content.json to whichever database DATABASE_URL points at (or
// the local SQLite when it's unset). The mirror of export-content.js.
//
// This is how curation reaches production: the importers build a baseline, you
// curate wherever you like, export, then apply. Tracks are matched by title,
// so ids differing between databases doesn't matter.
//
// Idempotent, and prints a diff of what it changes rather than working silently.
//
// Usage: npm run apply:content [-- --dry-run]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig);

const DRY_RUN = process.argv.includes('--dry-run');
const SRC = path.join(__dirname, '..', 'data', 'content.json');

const TRACK_FIELDS = [
  'type', 'source_url', 'external_url', 'cover_image_url', 'role', 'tags',
  'description', 'year', 'collaboration', 'location', 'technical', 'context',
  'featured', 'hidden', 'solo_credit', 'credit_note', 'sort_order'
];

const same = (a, b) => {
  if (typeof a === 'boolean' || typeof b === 'boolean') return !!a === !!b;
  return (a === null || a === undefined ? null : a) === (b === null || b === undefined ? null : b);
};

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`${SRC} not found — run npm run export:content first.`);
  const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));

  const profile = await knex('profiles').whereNotNull('user_id').first();
  if (!profile) throw new Error('No profile with a user_id — run npm run seed:user first.');

  console.log(`Applying ${data.tracks.length} tracks to ${process.env.DATABASE_URL ? 'postgres' : 'sqlite'}${DRY_RUN ? '  [DRY RUN]' : ''}\n`);

  // ---- profile ----
  const profileChanges = {};
  Object.entries(data.profile).forEach(([k, v]) => {
    if (!same(profile[k], v)) profileChanges[k] = v;
  });
  if (Object.keys(profileChanges).length) {
    console.log(`  profile: ${Object.keys(profileChanges).join(', ')}`);
    if (!DRY_RUN) await knex('profiles').where({ id: profile.id }).update(profileChanges);
  }

  // ---- tracks, pass 1: fields ----
  let updated = 0;
  let created = 0;
  let unchanged = 0;
  for (const row of data.tracks) {
    const existing = await knex('tracks').where({ profile_id: profile.id, title: row.title }).first();
    const payload = {};
    TRACK_FIELDS.forEach((f) => (payload[f] = row[f] === undefined ? null : row[f]));

    if (!existing) {
      console.log(`  create  ${row.title}`);
      if (!DRY_RUN) await knex('tracks').insert({ profile_id: profile.id, title: row.title, ...payload });
      created++;
      continue;
    }

    const diff = Object.keys(payload).filter((f) => !same(existing[f], payload[f]));
    if (!diff.length) {
      unchanged++;
      continue;
    }
    console.log(`  update  ${row.title.padEnd(42)} ${diff.join(', ')}`);
    if (!DRY_RUN) await knex('tracks').where({ id: existing.id }).update(payload);
    updated++;
  }

  // ---- tracks, pass 2: album nesting, once every row exists ----
  let nested = 0;
  for (const row of data.tracks) {
    const self = await knex('tracks').where({ profile_id: profile.id, title: row.title }).first();
    if (!self) continue;
    const parent = row.parent_title
      ? await knex('tracks').where({ profile_id: profile.id, title: row.parent_title }).first()
      : null;
    const want = parent ? parent.id : null;
    if (self.parent_track_id === want) continue;
    if (!DRY_RUN) await knex('tracks').where({ id: self.id }).update({ parent_track_id: want });
    nested++;
  }

  // ---- status lines: replaced wholesale, they're a short ordered list ----
  const existingLines = await knex('status_lines').count({ c: '*' }).first();
  if (data.status_lines.length && !DRY_RUN) {
    await knex('status_lines').del();
    await knex('status_lines').insert(data.status_lines);
  }

  // ---- gallery: added if missing, matched on url ----
  let gallery = 0;
  for (const g of data.gallery_items) {
    const hit = await knex('gallery_items').where({ url: g.url }).first();
    if (hit) continue;
    if (!DRY_RUN) {
      await knex('gallery_items').insert({
        profile_id: g.scope === 'company' ? null : profile.id,
        url: g.url, kind: g.kind, caption: g.caption, sort_order: g.sort_order
      });
    }
    gallery++;
  }

  console.log(`\n${created} created, ${updated} updated, ${unchanged} already matching.`);
  console.log(`${nested} parent links set, ${data.status_lines.length} status lines (replacing ${existingLines.c}), ${gallery} gallery items added.`);
  if (DRY_RUN) console.log('\nDry run — nothing written.');
}

main()
  .then(() => knex.destroy())
  .catch(async (err) => {
    console.error('\nFailed:', err.message);
    await knex.destroy();
    process.exit(1);
  });
