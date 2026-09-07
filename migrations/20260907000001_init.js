exports.up = function (knex) {
  return knex.schema
    .createTable('users', (t) => {
      t.increments('id').primary();
      t.string('email').notNullable().unique();
      t.string('password_hash').notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('profiles', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      t.string('name').notNullable();
      t.string('token').notNullable().unique(); // legacy collaborator-add-link support
      t.string('tagline');
      t.text('bio_long');
      t.text('education'); // newline-separated lines
      t.string('avatar_url');
      t.string('email');
      t.string('linkedin_url');
      t.string('website_url');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.unique(['user_id']);
    })
    .createTable('tracks', (t) => {
      t.increments('id').primary();
      t.integer('profile_id').unsigned().references('id').inTable('profiles').onDelete('CASCADE');
      t.integer('parent_track_id').unsigned().references('id').inTable('tracks').onDelete('CASCADE');
      t.string('type').notNullable().defaultTo('link'); // link | upload
      t.string('source_url').notNullable();
      t.string('title').notNullable();
      t.text('description');
      t.string('cover_image_url');
      t.string('role');
      t.string('tags'); // comma-separated category tags (FILM/SERIES/TVC/...)
      t.integer('year');
      t.string('collaboration');
      t.string('location');
      t.string('technical');
      t.string('context');
      t.boolean('featured').defaultTo(false);
      t.integer('sort_order').defaultTo(0);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('sessions', (t) => {
      t.string('sid').primary();
      t.text('sess').notNullable();
      t.bigInteger('expired').notNullable().index();
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('sessions')
    .dropTableIfExists('tracks')
    .dropTableIfExists('profiles')
    .dropTableIfExists('users');
};
