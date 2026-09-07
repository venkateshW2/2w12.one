// Seeds the landing page's status lines. They're editable from /admin, so this
// only fills an empty table — it never overwrites what's been edited there.
//
// Usage: npm run seed:status
require('dotenv').config();
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig);

const LINES = [
  { label: 'Built', body: 'Pipe instruments for a composer — built and sampled for a Netflix series, out December', note: null, sort_order: 40 },
  { label: 'Software', body: 'Custom tools for artists — SonifyV1, Wall Harp Designer', note: null, sort_order: 30 },
  { label: 'Current', body: 'Film mixing, spatial audio, AI music workflows', note: null, sort_order: 20 },
  { label: 'Labs', body: 'Audio classification & analysis tools', note: '[experimental]', sort_order: 10 }
];

async function main() {
  const existing = await knex('status_lines').count({ c: '*' }).first();
  if (Number(existing.c) > 0) {
    console.log(`status_lines already has ${existing.c} rows — left untouched.`);
    return;
  }
  await knex('status_lines').insert(LINES);
  LINES.forEach((l) => console.log(`  > ${l.label}: ${l.body.slice(0, 56)}`));
  console.log(`\n${LINES.length} status lines seeded.`);
}

main()
  .then(() => knex.destroy())
  .catch(async (err) => {
    console.error('\nFailed:', err.message);
    await knex.destroy();
    process.exit(1);
  });
