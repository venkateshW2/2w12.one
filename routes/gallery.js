const { classify } = require('../lib/sourceType');

// Two distinct galleries, per the brief:
//
//   /gallery            the studio's own — gallery_items rows with no profile_id
//   /portfolio/gallery  the owner's personal one, back-links to /portfolio
//   /p/:token/gallery   any other profile's
//
// A gallery is scoped by gallery_items.profile_id (NULL = company), so nothing
// leaks between the studio's gallery and an individual's.
module.exports = function (app) {
  const db = () => app.locals.db;

  function shape(rows) {
    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      caption: r.caption,
      kind: r.kind === 'video' || classify(r.url) === 'direct_video' ? 'video' : 'image'
    }));
  }

  async function itemsFor(profileId) {
    const q = db()('gallery_items').orderBy('sort_order', 'desc').orderBy('created_at', 'desc');
    return shape(await (profileId === null ? q.whereNull('profile_id') : q.where({ profile_id: profileId })));
  }

  // ---- the studio's gallery ----
  app.get('/gallery', async (req, res, next) => {
    try {
      res.render('gallery', {
        heading: '2w12.one',
        subheading: 'Studio gallery — tests, experiments, work in progress',
        items: await itemsFor(null),
        backUrl: '/',
        backLabel: 'Back to 2w12.one',
        scopeNote: 'This is the studio gallery. Each portfolio keeps its own separate one.',
        loggedIn: !!(req.session && req.session.userId)
      });
    } catch (err) {
      next(err);
    }
  });

  // ---- an individual portfolio's gallery ----
  async function renderProfileGallery(req, res, next, profile) {
    try {
      if (!profile) return res.status(404).render('not-found');
      res.render('gallery', {
        heading: profile.name,
        subheading: 'Gallery — tests, experiments, work in progress',
        items: await itemsFor(profile.id),
        backUrl: req.params.token ? `/p/${profile.token}` : '/portfolio',
        backLabel: 'Back to portfolio',
        scopeNote: null,
        loggedIn: !!(req.session && req.session.userId)
      });
    } catch (err) {
      next(err);
    }
  }

  app.get('/portfolio/gallery', async (req, res, next) => {
    const profile = await db()('profiles').whereNotNull('user_id').first();
    renderProfileGallery(req, res, next, profile);
  });

  app.get('/p/:token/gallery', async (req, res, next) => {
    const profile = await db()('profiles').where({ token: req.params.token }).first();
    renderProfileGallery(req, res, next, profile);
  });
};
