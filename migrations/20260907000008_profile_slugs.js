// Short, shareable, human URLs: 2w12.one/venkatesh rather than
// 2w12.one/p/v1QWm8fZJ3AtpQni. The token column stays — it's the unguessable
// link for anything not meant to be public.
exports.up = function (knex) {
  return knex.schema.table('profiles', (t) => {
    t.string('slug').unique();
  });
};

exports.down = function (knex) {
  return knex.schema.table('profiles', (t) => {
    t.dropColumn('slug');
  });
};
