// Merges the live Google Sheet (the old static site's CMS) into `tracks`.
//
// The sheet is NOT dead — https://2w12.one/portfolio/ still renders from it, and
// it holds the richest metadata anywhere: year, collaboration, location,
// technical, context, featured, plus separate "project page" and "video" links.
// The showreel DB (imported by import-showreel.js) has better role values and
// the album nesting; the sheet has better everything else. This script layers
// the sheet on top without destroying either.
//
// It is a ONE-OFF migration, not a live data path — the whole point of Phase 1
// is that the DB becomes the source of truth. Don't wire this into the app.
//
// Usage:
//   npm run import:sheet -- --dry-run
//   npm run import:sheet
//   npm run import:sheet -- --file=/tmp/sheet.csv    # offline copy
require('dotenv').config();
const fs = require('fs');
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig);
const { youtubeId } = require('../lib/sourceType');
const { TAG_ORDER } = require('../lib/taxonomy');

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQOCH8WgkFC85dwlZZw_wkAW_IRUhzIa8859fJjgJ1YJi48fAEe3WMCHvqAE2fNkG_-hITUVvpL4f7J/pub?output=csv';

const DRY_RUN = process.argv.includes('--dry-run');
const fileArg = process.argv.find((a) => a.startsWith('--file='));

// Sheet title -> the title already in the DB (from the showreel import). Only
// the ones fuzzy matching can't get on its own; everything else matches by
// YouTube id or normalized title.
const ALIASES = {
  Cntrl: 'CTRL',
  'Gangs of Wasseypur I & II': 'Gangs of Wassepyur',
  'Bandits of gollak': 'The Bandits of Golak',
  'Rejectx I & II': 'RejctX',
  'The Katmandu Connection': 'Kathmandu Connection',
  'Sound Trippin': 'SoundTrippin'
};

// Posters for the projects that only exist in the sheet. The sheet's own
// image_url column points at GitHub raw URLs for these same files, but the
// local copies in public/images/projects/ are the originals.
const POSTERS = {
  'The Umesh Chronicle': 'TUC.png',
  'Hyndai -Kona Electric': 'Hyndai.png',
  'MTV Rush (Ep1)': 'RUSH.jpg',
  'Folk 2.0 Documentary': 'Folk.png'
};

// Sheet's `category` column mixes real categories with role names
// (MUSIC PRODUCER, SCORE). Only the ones in lib/taxonomy.js are categories.
function sheetTags(raw) {
  return (raw || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((t) => TAG_ORDER.includes(t));
}

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function parseCsv(text) {
  // Minimal RFC4180 parser — the sheet has quoted fields containing commas,
  // newlines and escaped quotes, so splitting on commas doesn't cut it.
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift().map((h) => h.trim());
  return rows
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] || '').trim()])))
    .filter((r) => r.title);
}

async function loadSheet() {
  if (fileArg) {
    const path = fileArg.split('=').slice(1).join('=');
    console.log(`Reading ${path}`);
    return parseCsv(fs.readFileSync(path, 'utf8'));
  }
  console.log('Fetching the live sheet...');
  const res = await fetch(CSV_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`sheet fetch failed: HTTP ${res.status}`);
  return parseCsv(await res.text());
}

function findMatch(sheetRow, tracks) {
  const wanted = ALIASES[sheetRow.title.trim()] || sheetRow.title.trim();

  // 1. Same YouTube video = same project, whatever it's been titled.
  const vid = sheetRow.video && youtubeId(sheetRow.video);
  if (vid) {
    const hit = tracks.find((t) => t.source_url && youtubeId(t.source_url) === vid);
    if (hit) return { track: hit, how: 'youtube id' };
  }

  // 2. Exact normalized title.
  const n = norm(wanted);
  let hit = tracks.find((t) => norm(t.title) === n);
  if (hit) return { track: hit, how: 'title' };

  // 3. One title is a prefix of the other ("Ride to the Roots (Atmos Mix)").
  hit = tracks.find((t) => {
    const tn = norm(t.title);
    return tn.length > 5 && n.length > 5 && (tn.startsWith(n) || n.startsWith(tn));
  });
  if (hit) return { track: hit, how: 'title prefix' };

  return null;
}

async function main() {
  const profile = await knex('profiles').whereNotNull('user_id').first();
  if (!profile) throw new Error('No profile with a user_id — run `npm run seed:user` first.');

  const rows = await loadSheet();
  const tracks = await knex('tracks').where({ profile_id: profile.id }).select('*');
  console.log(`${rows.length} sheet rows vs ${tracks.length} existing tracks${DRY_RUN ? '  [DRY RUN]' : ''}\n`);

  let enriched = 0;
  let created = 0;
  const unmatched = [];
  const noSource = [];

  for (const r of rows) {
    const match = findMatch(r, tracks);
    const year = /^\d{4}$/.test(r.year) ? Number(r.year) : null;
    // The sheet has a "TURE" typo in one row, so this can't be a strict compare.
    const featured = /^t/i.test(r.featured);

    // Metadata the sheet is authoritative for. Sheet `details` is fuller prose
    // than the showreel descriptions, so it wins where it exists.
    const meta = {
      year,
      collaboration: r.collaboration || null,
      location: r.location || null,
      technical: r.technical || null,
      context: r.context || null,
      featured,
      external_url: r.link || null,
      description: r.details || null
    };

    if (match) {
      const t = match.track;
      // Only fill what's empty, except the sheet-authoritative fields above —
      // this keeps the showreel role/tags/nesting intact.
      const update = {};
      Object.entries(meta).forEach(([k, v]) => {
        if (v !== null && v !== false) update[k] = v;
      });

      // Add any sheet categories the track doesn't already carry.
      const existingTags = (t.tags || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      const merged = [...new Set([...existingTags, ...sheetTags(r.category)])];
      if (merged.length !== existingTags.length) update.tags = merged.join(',');

      // A playable video from the sheet beats a non-playable IMDb link.
      if (r.video && youtubeId(r.video) && !youtubeId(t.source_url || '')) update.source_url = r.video;

      console.log(`  enrich  ${t.title}  <- ${r.title}  (${match.how})`);
      if (Object.keys(update).length && !DRY_RUN) {
        await knex('tracks').where({ id: t.id }).update(update);
      }
      enriched++;
    } else {
      const tags = sheetTags(r.category);
      // No video and no project link: the live site renders these as
      // details-only cards, so keep them rather than dropping the project.
      const source = r.video || r.link || '';
      const poster = POSTERS[r.title.trim()];
      if (!source) noSource.push(r.title);
      console.log(`  CREATE  ${r.title}  [${tags.join(',') || 'no category'}]${source ? '' : '  (details-only, no link)'}`);
      if (!DRY_RUN) {
        await knex('tracks').insert({
          profile_id: profile.id,
          type: 'link',
          source_url: source,
          title: r.title,
          role: r.role || null,
          tags: tags.join(','),
          cover_image_url: poster ? `/images/projects/${poster}` : null,
          ...meta
        });
      }
      created++;
    }
  }

  if (unmatched.length) console.log('\nSkipped:\n' + unmatched.map((u) => `  ${u}`).join('\n'));
  if (noSource.length) console.log(`\nDetails-only (no link in the sheet): ${noSource.join(', ')}`);
  console.log(`\n${enriched} enriched, ${created} created.`);
  if (DRY_RUN) console.log('\nDry run — nothing written.');
}

main()
  .then(() => knex.destroy())
  .catch(async (err) => {
    console.error('\nFailed:', err.message);
    await knex.destroy();
    process.exit(1);
  });
