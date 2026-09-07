const { classify } = require('../lib/sourceType');

// Public gallery: loose images and video from tests/experiments. Not projects,
// so deliberately not in `tracks` — no role, no category, no metadata to fill in.
module.exports = function (app) {
  const db = () => app.locals.db;

  app.get('/gallery', async (req, res, next) => {
    try {
      const profile = await db()('profiles').whereNotNull('user_id').first();
      if (!profile) return res.status(404).render('not-found');

      const rows = await db()('gallery_items')
        .where({ profile_id: profile.id })
        .orderBy('sort_order', 'desc')
        .orderBy('created_at', 'desc');

      const items = rows.map((r) => {
        const kind = r.kind === 'video' || /^direct_video$/.test(classify(r.url)) ? 'video' : r.kind;
        return { id: r.id, url: r.url, caption: r.caption, kind, embed: classify(r.url) };
      });

      res.render('gallery', {
        profile,
        items,
        loggedIn: !!(req.session && req.session.userId)
      });
    } catch (err) {
      next(err);
    }
  });
};
