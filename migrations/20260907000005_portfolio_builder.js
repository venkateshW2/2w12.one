// Two things the portfolio needs to be usable by more than one person:
//
//   tracks.hidden      — take a project off the public page without deleting it.
//                        Draft entries, client work under embargo, old pieces.
//   profiles.<social>  — everyone building a portfolio needs their own contact
//                        surface. linkedin_url/email/website_url already existed.
exports.up = function (knex) {
  return knex.schema
    .table('tracks', (t) => {
      t.boolean('hidden').defaultTo(false);
    })
    .table('profiles', (t) => {
      t.string('instagram_url');
      t.string('twitter_url');
      t.string('substack_url');
      t.string('soundcloud_url');
      t.string('spotify_url');
      t.string('imdb_url');
      t.string('phone');
      t.string('location');
    });
};

exports.down = function (knex) {
  return knex.schema
    .table('tracks', (t) => {
      t.dropColumn('hidden');
    })
    .table('profiles', (t) => {
      t.dropColumn('instagram_url');
      t.dropColumn('twitter_url');
      t.dropColumn('substack_url');
      t.dropColumn('soundcloud_url');
      t.dropColumn('spotify_url');
      t.dropColumn('imdb_url');
      t.dropColumn('phone');
      t.dropColumn('location');
    });
};
