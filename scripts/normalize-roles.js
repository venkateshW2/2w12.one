// One-off: collapses the nine imported role spellings into the badge text they
// were being displayed as, so that from here on `tracks.role` IS the badge —
// what you type in the CMS is exactly what the card shows, with no lookup table
// silently rewriting it.
//
// Before: role "Sound Design"  ->  ROLE_SHORT  ->  badge "Sound Design + Mix"
// After:  role "Sound Design + Mix"            ->  badge "Sound Design + Mix"
//
// NOTE: this maps only the nine legacy imported spellings listed in
// lib/taxonomy.js's ROLE_SHORT. Badges typed by hand in the CMS are free text
// and are left exactly as written — running this again will not overwrite them.
//
// Usage: npm run normalize:roles [-- --dry-run]
require('dotenv').config();
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig);
const { ROLE_SHORT } = require('../lib/taxonomy');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const rows = await knex('tracks').whereNotNull('role').select('id', 'title', 'role');
  const changes = rows
    .map((r) => ({ ...r, next: ROLE_SHORT[r.role] || r.role }))
    .filter((r) => r.next !== r.role);

  if (!changes.length) {
    console.log('Nothing to do — every role already matches its badge text.');
    return;
  }

  const grouped = {};
  changes.forEach((c) => {
    grouped[`${c.role} -> ${c.next}`] = (grouped[`${c.role} -> ${c.next}`] || 0) + 1;
  });
  Object.entries(grouped).forEach(([pair, n]) => console.log(`  ${pair}  (${n})`));

  if (DRY_RUN) {
    console.log(`\n${changes.length} tracks would change. Dry run — nothing written.`);
    return;
  }

  for (const c of changes) {
    await knex('tracks').where({ id: c.id }).update({ role: c.next });
  }
  console.log(`\n${changes.length} roles normalized. The role field is now the badge text verbatim.`);
}

main()
  .then(() => knex.destroy())
  .catch(async (err) => {
    console.error('\nFailed:', err.message);
    await knex.destroy();
    process.exit(1);
  });
