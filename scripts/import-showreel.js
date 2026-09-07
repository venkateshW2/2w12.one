// One-off importer: pulls the real project data out of the showreel prototype's
// SQLite DB (sibling repo, /Users/justmac/w2app/showreel) into this app's
// `tracks` table, and fills in the owner's profile details recovered from the
// old static portfolio site.
//
// The old static site's data lived in a Google Sheet, NOT in data.js — data.js's
// loadFallbackData() only ever had one project ("Mind Quantize", re-added below
// by hand from that array since it isn't in the showreel DB). The showreel DB is
// therefore the real source of truth for the project list.
//
// Idempotent: matches existing rows on (profile_id, title) and updates them
// instead of inserting duplicates, so it's safe to re-run after editing it.
//
// Usage: npm run import:showreel [-- --source=/path/to/showreel.sqlite3]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig);

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

const SOURCE_DB = arg('source', '/Users/justmac/w2app/showreel/data/showreel.sqlite3');

// Profile details recovered from the old static portfolio
// (/Users/justmac/w2app/venkatesh-portfolio/index.html — About + Background panels).
const PROFILE = {
  name: 'Venkatesh Iyer',
  tagline: 'Sound Artist — Mumbai',
  bio_long:
    '20+ years developing innovative approaches to sound design, interactive installations, and cultural documentation through audio. Experience spans commercial film work, academic research, and experimental art installations. Sound / data / systems.',
  education: [
    'Masters in Audio Technology — West London University, 2008',
    'Bachelor of Physics — Mumbai University, 2004'
  ].join('\n'),
  email: 'whencut.y@gmail.com',
  linkedin_url: 'https://www.linkedin.com/in/whencut',
  website_url: 'https://2w12.one'
};

// Title -> poster file in public/images/projects/. These are the purpose-made
// posters carried over from the static site; they beat YouTube auto-thumbnails,
// so they win over whatever cover the showreel DB had.
const POSTERS = {
  'A Passage Through Passages, 2020': 'Passage.png',
  'A Terrible Beauty': 'TeribleBeauty.png',
  'Ride to the Roots': 'Ridetoroots.png',
  RejctX: 'RejectX.png',
  'Hello Mini': 'HelloMini.png',
  'Hyundai | ALCAZAR | Glorious Welcome to the SUV Tribe': 'Alcazar.png',
  SoundTrippin: 'SoundTrippin.png',
  'Gangs of Wassepyur': 'GOW.png',
  'Bombay Tilts Down': 'BombayTilitdown.png',
  'Kathmandu Connection': 'KatmanduKonnection.png',
  'Schirkoa: In Lies We Trust': 'Schirkoa.png',
  'The Bandits of Golak': 'BOG.png',
  Despatch: 'Despatch.png',
  CTRL: 'CTRL.png',
  'Jindal Steel': 'Jindal.png',
  'Xtreme 160R 4V 2024': 'HeroExtreme.png',
  // TaTa.png is the "Untamed Kaziranga Edition" poster — it belongs to that
  // campaign, not to Sierra.ev, which is a separate Tata TVC with no poster
  // (it falls back to its YouTube thumbnail).
  '#Untamed Kaziranga Range Edition': 'TaTa.png',
  'Hyundai CRETA N Line | Live Unleashed': 'HyndaiCretaNline.png',
  'Mind Quantize': 'Mind.png'
};

// The showreel DB has a couple of tags outside lib/taxonomy.js's TAG_ORDER
// ("MUSIC" on the Gangs of Wasseypur songs). Fold them into the real taxonomy
// so nothing lands in an ad-hoc section on the public page.
const TAG_FIXES = { MUSIC: 'FILM' };

// Likewise for roles: everything in the showreel DB already matches ROLES
// except Mind Quantize's "Concept / Development".
const ROLE_FIXES = { 'Concept / Development': 'Sound Design' };

// The one project that only ever existed in the old static site's
// loadFallbackData() array, with its full metadata.
const EXTRA_TRACKS = [
  {
    old_id: 'extra-mind-quantize',
    parent_old_id: null,
    title: 'Mind Quantize',
    role: 'Concept / Development',
    tags: 'LABS',
    source_url: 'https://2w12.one/',
    cover_image_url: '',
    description: 'Interactive installation interpreting brainwaves into sonic structures.',
    year: 2019,
    collaboration: 'Serendipity Art Festival',
    location: 'Goa',
    technical: 'EEG sensors, Max/MSP, real-time audio processing',
    context: 'Neurofeedback Art Installation',
    featured: true
  }
];

function normalizeTags(raw) {
  return (raw || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .map((t) => TAG_FIXES[t] || t)
    .filter((t, i, a) => a.indexOf(t) === i)
    .join(',');
}

function coverFor(title, existing) {
  const poster = POSTERS[title];
  if (poster) {
    const abs = path.join(__dirname, '..', 'public', 'images', 'projects', poster);
    if (fs.existsSync(abs)) return `/images/projects/${poster}`;
    console.warn(`  ! poster listed but missing on disk: ${poster}`);
  }
  return existing || null; // fall back to whatever remote cover the showreel DB had
}

async function readSourceTracks() {
  if (!fs.existsSync(SOURCE_DB)) {
    throw new Error(`showreel DB not found at ${SOURCE_DB} — pass --source=/path/to/showreel.sqlite3`);
  }
  const src = require('knex')({
    client: 'better-sqlite3',
    connection: { filename: SOURCE_DB },
    useNullAsDefault: true
  });
  try {
    return await src('tracks')
      .select('id', 'parent_track_id', 'title', 'role', 'tags', 'source_url', 'cover_image_url', 'description')
      .orderBy('id');
  } finally {
    await src.destroy();
  }
}

async function main() {
  const profile = await knex('profiles').whereNotNull('user_id').first();
  if (!profile) {
    throw new Error('No profile with a user_id — run `npm run seed:user` first.');
  }

  // ---- profile details ----
  const profileUpdate = {};
  Object.entries(PROFILE).forEach(([k, v]) => {
    if (!profile[k]) profileUpdate[k] = v; // never clobber something already edited in the CMS
  });
  if (Object.keys(profileUpdate).length) {
    await knex('profiles').where({ id: profile.id }).update(profileUpdate);
    console.log(`Profile: filled in ${Object.keys(profileUpdate).join(', ')}`);
  } else {
    console.log('Profile: already populated, left untouched.');
  }

  // ---- tracks ----
  const sourceTracks = await readSourceTracks();
  const rows = [
    ...sourceTracks.map((t) => ({
      old_id: t.id,
      parent_old_id: t.parent_track_id,
      title: t.title,
      role: t.role,
      tags: t.tags,
      source_url: t.source_url,
      cover_image_url: t.cover_image_url,
      description: t.description,
      year: null,
      collaboration: null,
      location: null,
      technical: null,
      context: null,
      featured: false
    })),
    ...EXTRA_TRACKS
  ];

  console.log(`\nImporting ${rows.length} tracks from ${SOURCE_DB}`);

  // Pass 1: insert/update every track without parent links, recording old->new ids.
  const idMap = {};
  let inserted = 0;
  let updated = 0;
  for (const r of rows) {
    const existing = await knex('tracks').where({ profile_id: profile.id, title: r.title }).first();
    const payload = {
      profile_id: profile.id,
      type: 'link', // everything imported is a pasted link; uploads happen via the CMS
      source_url: r.source_url,
      title: r.title,
      description: r.description || null,
      cover_image_url: coverFor(r.title, existing ? existing.cover_image_url : r.cover_image_url),
      role: ROLE_FIXES[r.role] || r.role || null,
      tags: normalizeTags(r.tags),
      year: r.year,
      collaboration: r.collaboration,
      location: r.location,
      technical: r.technical,
      context: r.context,
      featured: !!r.featured
    };

    if (existing) {
      await knex('tracks').where({ id: existing.id }).update(payload);
      idMap[r.old_id] = existing.id;
      updated++;
    } else {
      const [ret] = await knex('tracks').insert(payload).returning('id');
      idMap[r.old_id] = typeof ret === 'object' ? ret.id : ret;
      inserted++;
    }
  }

  // Pass 2: now that every row exists, wire up the album nesting.
  let nested = 0;
  for (const r of rows) {
    const parentNewId = r.parent_old_id ? idMap[r.parent_old_id] : null;
    if (r.parent_old_id && !parentNewId) {
      console.warn(`  ! ${r.title}: parent ${r.parent_old_id} not found, left top-level`);
      continue;
    }
    await knex('tracks').where({ id: idMap[r.old_id] }).update({ parent_track_id: parentNewId });
    if (parentNewId) nested++;
  }

  console.log(`\n${inserted} inserted, ${updated} updated, ${nested} nested under a parent.`);

  // ---- report what still needs a human ----
  const noCover = await knex('tracks').where({ profile_id: profile.id }).whereNull('cover_image_url').select('title');
  const remote = await knex('tracks')
    .where({ profile_id: profile.id })
    .where('cover_image_url', 'like', 'http%')
    .select('title', 'cover_image_url');
  const noYear = await knex('tracks').where({ profile_id: profile.id }).whereNull('year').count({ c: '*' }).first();

  const posterDir = path.join(__dirname, '..', 'public', 'images', 'projects');
  const used = new Set(Object.values(POSTERS));
  const unused = fs
    .readdirSync(posterDir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !used.has(f));

  if (noCover.length) console.log(`\nNo cover image (${noCover.length}): ${noCover.map((t) => t.title).join(', ')}`);
  if (remote.length) console.log(`\nHotlinked remote covers (${remote.length}) — run media:b2 to rehost:\n` + remote.map((t) => `  ${t.title}`).join('\n'));
  if (unused.length) console.log(`\nPosters on disk not matched to any project: ${unused.join(', ')}`);
  console.log(`\nTracks still missing a year: ${noYear.c} (the old Google Sheet had these; it's gone — fill them in via the CMS).`);
}

main()
  .then(() => knex.destroy())
  .catch(async (err) => {
    console.error('\nImport failed:', err.message);
    await knex.destroy();
    process.exit(1);
  });
