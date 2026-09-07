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
    next();
  };
}

module.exports = { hashPassword, verifyPassword, requireAuth };
