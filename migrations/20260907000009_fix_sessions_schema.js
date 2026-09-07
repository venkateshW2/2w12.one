// The original sessions table declared `expired` as bigInteger. That is wrong:
// connect-session-knex creates the column with `table.timestamp('expired')`
// (see its lib/index.js), and its periodic cleanup runs
//
//   delete from sessions where expired < CAST($1 as timestamp with time zone)
//
// SQLite is permissive about column types so this passed unnoticed in local
// development for the whole build. Postgres is not: bigint < timestamptz is
// error 42883, the store throws from a timer, the process exits, no port opens,
// and the deploy fails its health check.
//
// The table is rebuilt rather than altered — sessions are disposable, and
// changing a column's type in place needs a USING clause that differs per
// backend. Everyone gets logged out once; that's the entire cost.
exports.up = async function (knex) {
  const isPg = knex.client.config.client === 'pg';

  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.createTable('sessions', (t) => {
    t.string('sid').primary();
    // Matching the library: json where the backend supports it, text otherwise.
    if (isPg) t.json('sess').notNullable();
    else t.text('sess').notNullable();
    t.timestamp('expired').notNullable().index();
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.createTable('sessions', (t) => {
    t.string('sid').primary();
    t.text('sess').notNullable();
    t.bigInteger('expired').notNullable().index();
  });
};
