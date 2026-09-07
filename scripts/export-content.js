// Exports everything editable through the CMS to data/content.json.
//
// The importers build a baseline from the showreel DB and the Google Sheet, but
// everything done since — pinning, featuring, hiding, retyped badges, corrected
// tags, edited copy — exists only in whichever database it was typed into. That
// is why production came up looking nothing like local.
//
// Run this after curating, commit the JSON, then apply-content.js pushes the
// same state into any other database. The JSON is the source of truth for
// curation; the importers only ever provide the starting point.
//
// Usage: npm run export:content
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig);

const OUT = path.join(__dirname, '..', 'data', 'content.json');

const PROFILE_FIELDS = [
  'name', 'slug', 'tagline', 'bio_long', 'education', 'avatar_url',
  'email', 'phone', 'location', 'website_url', 'linkedin_url', 'instagram_url',
  'twitter_url', 'substack_url', 'soundcloud_url', 'spotify_url', 'imdb_url'
];

const TRACK_FIELDS = [
  'type', 'source_url', 'external_url', 'cover_image_url', 'role', 'tags',
  'description', 'year', 'collaboration', 'location', 'technical', 'context',
  'featured', 'hidden', 'solo_credit', 'credit_note', 'sort_order'
];

async function main() {
  const profile = await knex('profiles').whereNotNull('user_id').first();
  if (!profile) throw new Error('No profile with a user_id.');

  const tracks = await knex('tracks').where({ profile_id: profile.id });
  const byId = {};
  tracks.forEach((t) => (byId[t.id] = t));

  // Tracks are keyed by title rather than id — ids differ between databases.
  const exported = tracks.map((t) => {
    const row = { title: t.title };
    TRACK_FIELDS.forEach((f) => {
      const v = t[f];
      row[f] = typeof v === 'number' && (f === 'featured' || f === 'hidden' || f === 'solo_credit') ? !!v : v;
    });
    row.parent_title = t.parent_track_id && byId[t.parent_track_id] ? byId[t.parent_track_id].title : null;
    return row;
  });

  const payload = {
    exported_from: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
    profile: Object.fromEntries(PROFILE_FIELDS.map((f) => [f, profile[f]])),
    tracks: exported,
    status_lines: (await knex('status_lines').orderBy('sort_order', 'desc')).map((l) => ({
      label: l.label, body: l.body, note: l.note, sort_order: l.sort_order
    })),
    gallery_items: (await knex('gallery_items')).map((g) => ({
      url: g.url, kind: g.kind, caption: g.caption, sort_order: g.sort_order,
      scope: g.profile_id ? 'mine' : 'company'
    }))
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));

  console.log(`Wrote ${path.relative(process.cwd(), OUT)}`);
  console.log(`  profile      : ${payload.profile.name} (/@${payload.profile.slug})`);
  console.log(`  tracks       : ${payload.tracks.length}`);
  console.log(`  featured     : ${payload.tracks.filter((t) => t.featured).length}`);
  console.log(`  pinned       : ${payload.tracks.filter((t) => t.sort_order).length}`);
  console.log(`  hidden       : ${payload.tracks.filter((t) => t.hidden).length}`);
  console.log(`  solo credits : ${payload.tracks.filter((t) => t.solo_credit).length}`);
  console.log(`  status lines : ${payload.status_lines.length}`);
  console.log(`  gallery      : ${payload.gallery_items.length}`);
}

main()
  .then(() => knex.destroy())
  .catch(async (err) => {
    console.error('\nFailed:', err.message);
    await knex.destroy();
    process.exit(1);
  });
