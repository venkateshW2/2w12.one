// The landing page's "> Label: text" lines. These change often — a project
// ships, something new gets built — so they belong in the database and the
// admin panel, not in the template.
exports.up = function (knex) {
  return knex.schema.createTable('status_lines', (t) => {
    t.increments('id').primary();
    t.string('label').notNullable(); // "Built", "Software", "Current", "Labs"
    t.string('body', 500).notNullable();
    t.string('note'); // optional trailing aside, rendered dimmer
    t.integer('sort_order').defaultTo(0);
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('status_lines');
};
