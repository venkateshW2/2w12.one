// The landing page. Registered before the static middleware in server.js so it
// takes precedence over the old static docs/index.html, which is otherwise
// still what express.static would serve for "/".
module.exports = function (app) {
  const db = () => app.locals.db;

  app.get('/', async (req, res, next) => {
    try {
      // The landing leads with portfolios, not a staff list — clicking a person
      // opens their portfolio.
      const profiles = await db()('profiles').select('*').orderBy('id');
      const primary = profiles.find((p) => p.user_id);

      const counts = await db()('tracks')
        .whereNull('parent_track_id')
        .select('profile_id')
        .count({ c: '*' })
        .groupBy('profile_id');
      const countFor = (id) => {
        const hit = counts.find((c) => c.profile_id === id);
        return hit ? Number(hit.c) : 0;
      };

      const portfolios = profiles.map((p) => ({
        name: p.name,
        tagline: p.tagline,
        avatar_url: p.avatar_url,
        projectCount: countFor(p.id),
        initials: p.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        url: primary && p.id === primary.id ? '/portfolio' : `/p/${p.token}`
      }));

      // Company gallery items are the ones with no profile_id.
      const gallery = await db()('gallery_items').whereNull('profile_id').count({ c: '*' }).first();

      const total = await db()('tracks').whereNull('parent_track_id').count({ c: '*' }).first();
      const years = await db()('tracks').min({ min: 'year' }).whereNotNull('year').first();
      const earliest = years && years.min ? Number(years.min) : 2004;

      res.render('home', {
        portfolios,
        totalProjects: Number(total.c) || 0,
        stats: [
          { value: Number(total.c) || 0, label: 'Projects' },
          { value: new Date().getFullYear() - earliest + '+', label: 'Years' },
          { value: portfolios.length, label: 'People' },
          { value: 3, label: 'Tools' }
        ],
        galleryCount: Number(gallery.c) || 0,
        loggedIn: !!(req.session && req.session.userId)
      });
    } catch (err) {
      next(err);
    }
  });

  // Studio work as a company — a real page, not yet built out.
  app.get('/work', (req, res) => {
    res.render('work', { loggedIn: !!(req.session && req.session.userId) });
  });
};
