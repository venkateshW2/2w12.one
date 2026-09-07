const bcrypt = require('bcryptjs');

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// Gate for the admin/CMS area. Loads the logged-in user's own profile onto
// req.profile so every downstream route is automatically scoped to them —
// no route has to remember to filter by profile_id itself.
function requireAuth(db) {
  return async function (req, res, next) {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }
    const profile = await db()('profiles').where({ user_id: req.session.userId }).first();
    if (!profile) return res.redirect('/login');
    req.profile = profile;
    req.user = await db()('users').where({ id: req.session.userId }).first();
    next();
  };
}

// Admin-only gate. Deliberately separate from requireAuth: an admin still has
// their own profile and portfolio, so the two aren't the same check.
function requireAdmin(db) {
  return async function (req, res, next) {
    if (!req.session || !req.session.userId) return res.redirect('/login');
    const user = await db()('users').where({ id: req.session.userId }).first();
    if (!user || !user.is_admin) return res.status(404).render('not-found');
    req.user = user;
    const profile = await db()('profiles').where({ user_id: user.id }).first();
    req.profile = profile || null;
    next();
  };
}

module.exports = { hashPassword, verifyPassword, requireAuth, requireAdmin };
