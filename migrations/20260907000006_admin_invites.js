// Invite-only accounts. There is no open signup route: a person can only create
// a login if an admin has pre-added their email, and the invite carries the
// name so the profile exists with the right identity from the first login.
exports.up = function (knex) {
  return knex.schema
    .table('users', (t) => {
      t.boolean('is_admin').defaultTo(false);
    })
    .createTable('invites', (t) => {
      t.increments('id').primary();
      t.string('email').notNullable().unique();
      t.string('name').notNullable();
      t.string('token').notNullable().unique(); // the signup link
      t.boolean('is_admin').defaultTo(false); // admins can invite other admins
      t.integer('invited_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('used_at'); // set when the account is created; blocks reuse
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('invites').table('users', (t) => {
    t.dropColumn('is_admin');
  });
};
