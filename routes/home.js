const { nanoid } = require('nanoid');

// The landing page. Registered before the static middleware in server.js so it
// takes precedence over the old static docs/index.html, which is otherwise
// still what express.static would serve for "/".
module.exports = function (app) {
  const db = () => app.locals.db;

  app.get('/', async (req, res, next) => {
    try {
      // 2w12 is a small studio, so the team rail is just the profiles table.
      // The owner's profile links to /portfolio; anyone else gets their token
      // URL until Phase 2 gives profiles real slugs.
      const profiles = await db()('profiles').select('*').orderBy('id');
      const primary = profiles.find((p) => p.user_id);

      const team = profiles.map((p) => ({
        name: p.name,
        tagline: p.tagline,
        avatar_url: p.avatar_url,
        initials: p.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        url: primary && p.id === primary.id ? '/portfolio' : `/p/${p.token}`
      }));

      const [projects, years] = await Promise.all([
        db()('tracks').whereNull('parent_track_id').count({ c: '*' }).first(),
        db()('tracks').min({ min: 'year' }).whereNotNull('year').first()
      ]);
      const earliest = years && years.min ? Number(years.min) : 2004;

      res.render('home', {
        team,
        stats: [
          { value: projects.c, label: 'Projects' },
          { value: new Date().getFullYear() - earliest + '+', label: 'Years' },
          { value: team.length, label: 'People' },
          { value: '3', label: 'Tools' }
        ],
        loggedIn: !!(req.session && req.session.userId)
      });
    } catch (err) {
      next(err);
    }
  });
};
