const { verifyPassword } = require('../lib/auth');

module.exports = function (app) {
  const db = () => app.locals.db;

  app.get('/login', (req, res) => {
    if (req.session && req.session.userId) return res.redirect('/dashboard');
    res.render('login', { error: null });
  });

  app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await db()('users').where({ email: (email || '').toLowerCase().trim() }).first();
    if (!user || !verifyPassword(password || '', user.password_hash)) {
      return res.render('login', { error: 'Wrong email or password.' });
    }
    req.session.userId = user.id;
    res.redirect('/dashboard');
  });

  app.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
  });
};
