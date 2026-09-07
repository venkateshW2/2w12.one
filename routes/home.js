// The landing page. Registered before the static middleware in server.js so it
// takes precedence over the old static docs/index.html, which is otherwise
// still what express.static would serve for "/".
module.exports = function (app) {
  const db = () => app.locals.db;

  app.get('/', async (req, res, next) => {
    try {
      // The landing is the wordmark, the tagline, and the status lines typing
      // themselves — nothing else. Navigation lives in the header, so the page
      // needs no other data.
      const statusLines = await db()('status_lines').orderBy('sort_order', 'desc').orderBy('id');

      res.render('home', {
        statusLines,
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
