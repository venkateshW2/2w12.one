// A dump for tests and experiments — images and video that aren't projects and
// shouldn't be forced into the `tracks` taxonomy. Deliberately minimal: a URL,
// a kind, an optional caption. Ordering is newest-first with an optional pin,
// matching how tracks behave.
exports.up = function (knex) {
  return knex.schema.createTable('gallery_items', (t) => {
    t.increments('id').primary();
    t.integer('profile_id').unsigned().references('id').inTable('profiles').onDelete('CASCADE');
    t.string('url').notNullable();
    t.string('kind').notNullable().defaultTo('image'); // image | video
    t.string('caption');
    t.integer('sort_order').defaultTo(0);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('gallery_items');
};
