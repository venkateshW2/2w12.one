// The old static site's cards had two distinct links per project: a playable
// one (YouTube/Vimeo, the sheet's `video` column) and a "VIEW PROJECT" link to
// an IMDb/official page (the sheet's `link` column). `source_url` only covers
// the first, so the second gets its own column rather than being lost.
exports.up = function (knex) {
  return knex.schema.table('tracks', (t) => {
    t.string('external_url');
  });
};

exports.down = function (knex) {
  return knex.schema.table('tracks', (t) => {
    t.dropColumn('external_url');
  });
};
