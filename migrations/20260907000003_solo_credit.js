// Some projects aren't one credit among many — they're work where every sound
// department was handled solo (Folk 2.0, A Passage Through Passages, A Terrible
// Beauty). That's a materially different claim from "Sound Design" and has to
// read as such on the card, so it gets its own flag rather than being buried in
// the freeform `role` string.
//
// `credit_note` carries the specific context when there is one — e.g. Folk 2.0
// being the final thesis project for the Masters.
exports.up = function (knex) {
  return knex.schema.table('tracks', (t) => {
    t.boolean('solo_credit').defaultTo(false);
    t.string('credit_note');
  });
};

exports.down = function (knex) {
  return knex.schema.table('tracks', (t) => {
    t.dropColumn('solo_credit');
    t.dropColumn('credit_note');
  });
};
