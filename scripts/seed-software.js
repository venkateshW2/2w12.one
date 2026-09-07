// Seeds the Software section from the real GitHub repos, and marks the projects
// where every sound department was handled solo.
//
// Descriptions/links come from the actual repos (gh repo list + their READMEs),
// not invented copy. Idempotent: matches on title and updates.
//
// Usage: npm run seed:software
require('dotenv').config();
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig);

const SOFTWARE = [
  {
    title: 'SonifyV1',
    role: 'Concept / Development',
    tags: 'SOFTWARE,RESEARCH',
    year: 2025,
    source_url: 'https://github.com/venkateshW2/sonifyv.1',
    external_url: 'https://github.com/venkateshW2/sonifyv.1',
    description:
      'Tempo-synchronized microtonal highway sonification system. Converts real-world visual scenes into musical output using computer vision, tempo-synchronized randomization and microtonal scales.',
    technical: 'C++, computer vision, ML vehicle detection, microtonal tuning systems',
    context: 'Computer vision to audio research',
    featured: true
  },
  {
    title: 'Wall Harp Designer',
    role: 'Concept / Development',
    tags: 'SOFTWARE,RESEARCH',
    year: 2026,
    source_url: 'https://github.com/venkateshW2/wall-harpDesigner',
    external_url: 'https://github.com/venkateshW2/wall-harpDesigner',
    description:
      'Browser-based physics simulator and tuning calculator for a 144-string wall harp with a dual-capo tuning system. Calculates string type and length for musical intervals.',
    technical: 'JavaScript, wave equation f = v / (2L), dual-capo pitch modelling, 144-string layout',
    context: 'Instrument design tool',
    featured: true
  },
  {
    title: 'Drive Audio Analyzer',
    role: 'Concept / Development',
    tags: 'SOFTWARE',
    year: 2025,
    source_url: 'https://github.com/venkateshW2/drive-audio-analyzer',
    external_url: 'https://github.com/venkateshW2/drive-audio-analyzer',
    description:
      'Audio analysis tool for files held in Google Drive — batch analysis and sample triage without pulling everything down locally. Python analysis backend lives in 2w12-backend.',
    technical: 'JavaScript front end, Python analysis backend, Google Drive API',
    context: 'Sample library tooling'
  }
];

// Projects where the whole sound department was one person. `credit_note` is
// the specific claim; the flag is what the card badges.
const SOLO_CREDITS = {
  'Folk 2.0 Documentary': 'Solo — every department. Final thesis project for the Masters in Audio Technology.',
  'A Passage Through Passages, 2020': 'Solo — every department: recording, sound design, multichannel mix.',
  'A Terrible Beauty': 'Solo — every department: recording, sound design, music production, mix.'
};

async function main() {
  const profile = await knex('profiles').whereNotNull('user_id').first();
  if (!profile) throw new Error('No profile with a user_id — run `npm run seed:user` first.');

  let created = 0;
  let updated = 0;
  for (const s of SOFTWARE) {
    const existing = await knex('tracks').where({ profile_id: profile.id, title: s.title }).first();
    const payload = { ...s, profile_id: profile.id, type: 'link', featured: !!s.featured };
    if (existing) {
      await knex('tracks').where({ id: existing.id }).update(payload);
      console.log(`  update  ${s.title}`);
      updated++;
    } else {
      await knex('tracks').insert(payload);
      console.log(`  create  ${s.title}  [${s.tags}]`);
      created++;
    }
  }

  console.log('');
  let flagged = 0;
  for (const [title, note] of Object.entries(SOLO_CREDITS)) {
    const n = await knex('tracks').where({ profile_id: profile.id, title }).update({ solo_credit: true, credit_note: note });
    if (n) {
      console.log(`  solo credit  ${title}`);
      flagged++;
    } else {
      console.log(`  ! not found: ${title}`);
    }
  }

  console.log(`\n${created} created, ${updated} updated, ${flagged} marked as solo credits.`);
}

main()
  .then(() => knex.destroy())
  .catch(async (err) => {
    console.error('\nFailed:', err.message);
    await knex.destroy();
    process.exit(1);
  });
